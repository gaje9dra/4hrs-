import test from "node:test";
import assert from "node:assert/strict";
import {
 compatibilityMatrix,detectConflicts,detectDeadlocks,detectOscillation,assessChurn,analyzeCascade,analyzeCoverage,
 evaluateInvariants,resilienceMode,classifyStability,policyStabilityGates,detectDrift,DEFAULT_INVARIANTS,
 GOVERNANCE_STABILITY_ALGORITHM_VERSION
} from "../lib/delivery-governance-stability/service";

test("15.43 compatibility is deterministic and distinguishes redundancy/conflict",()=>{
 const controls=[
  {id:"a",workflow:"deploy",action:"promote",direction:"BLOCK" as const,blocks:["b"],protects:["release"]},
  {id:"b",workflow:"deploy",action:"promote",direction:"ALLOW" as const,protects:["release"]},
  {id:"c",workflow:"deploy",action:"promote",direction:"ALLOW" as const}
 ];
 const m=compatibilityMatrix(controls);
 assert.equal(m.find(x=>x.a==="a"&&x.b==="b")?.classification,"CONFLICTING");
 assert.equal(m.find(x=>x.a==="b"&&x.b==="c")?.classification,"REDUNDANT");
 assert.deepEqual(m,compatibilityMatrix(controls));
});

test("15.43 conflict detection is bounded and version-aware",()=>{
 const conflicts=detectConflicts([{id:"a",workflow:"x",direction:"BLOCK",blocks:["b"]},{id:"b",workflow:"x",direction:"ALLOW"}],{a:"1",b:"2"});
 assert.equal(conflicts.length,1); assert.deepEqual(conflicts[0].policyVersions,["1","2"]);
});

test("15.43 deadlock detection finds governance cycles without bypassing them",()=>{
 const r=detectDeadlocks(["a","b","c"],[{from:"a",to:"b",type:"REQUIRES"},{from:"b",to:"c",type:"BLOCKS"},{from:"c",to:"a",type:"REQUIRES"}]);
 assert.equal(r.length,1); assert.ok(r[0].cycle.length>=3);
});

test("15.43 oscillation distinguishes repeated toggles",()=>{
 const base=Date.parse("2026-01-01T00:00:00Z");
 const sequence=Array.from({length:9},(_,i)=>({version:String(i),state:i%2?"B":"A",at:new Date(base+i*60000).toISOString()}));
 const r=detectOscillation({policyId:"p",sequence});
 assert.equal(r.classification,"UNSTABLE"); assert.ok(r.frequency>0);
});

test("15.43 churn measures but does not itself block delivery",()=>{
 const r=assessChurn({windowStart:"2026-01-01",windowEnd:"2026-01-02",policyChanges:40,controlChanges:0,exceptions:0,freezes:0,invalidations:0,rollbacks:0,certificationFailures:0});
 assert.equal(r.classification,"HIGH"); assert.equal(r.metrics.total,40);
});

test("15.43 causal cascade does not fabricate causality",()=>{
 const r=analyzeCascade([{control:"a",effect:"b",relationship:"TEMPORAL_CORRELATION"}]);
 assert.equal(r.causalClassification,"CORRELATION_ONLY"); assert.equal(r.confidence,"MEDIUM");
});

test("15.43 coverage identifies unprotected and fragile risks",()=>{
 const r=analyzeCoverage({risks:["payment","deploy"],controls:[{id:"p",protects:["payment"]}]});
 assert.equal(r.gaps.length,1); assert.equal(r.fragile.length,1);
});

test("15.43 invariants fail closed",()=>{
 const facts=Object.fromEntries(DEFAULT_INVARIANTS.map(x=>[x.stableId,true]));
 facts["payment-safety"]=false;
 assert.equal(evaluateInvariants({facts}).status,"BLOCKED");
});

test("15.43 degraded modes fail safe",()=>{
 assert.equal(resilienceMode({dependencies:{graph:"UNAVAILABLE",simulation:"AVAILABLE"}}).mode,"FROZEN");
 assert.equal(resilienceMode({dependencies:{security:"UNKNOWN"},criticalUnknown:true}).mode,"EMERGENCY_RESTRICTED");
 assert.ok(resilienceMode({dependencies:{graph:"DEGRADED"}}).prohibitedActions.includes("AUTONOMOUS_ACTIVATION"));
});

test("15.43 stability classification remains explainable",()=>{
 const r=classifyStability({structural:.9,behavioral:.9,operational:.9,safety:.9,policy:.9,dependency:.9,cost:.9,customer:.9});
 assert.equal(r.classification,"STABLE"); assert.deepEqual(r.reasons,[]);
 const c=classifyStability({structural:.9,behavioral:.9,operational:.9,safety:.2,policy:.9,dependency:.9,cost:.9,customer:.9});
 assert.equal(c.classification,"UNSTABLE"); assert.ok(c.reasons.includes("SAFETY_INSTABILITY"));
});

test("15.43 policy stability gates block critical failures",()=>{
 const r=policyStabilityGates({conflicts:1,invariantViolations:0,deadlocks:0,oscillationUnexplained:0,churnExcessive:false,safetyEnvelopePreserved:true,coverageGaps:0,rollbackAvailable:true,dependenciesValid:true,certificationValid:true,auditAvailable:true});
 assert.equal(r.status,"BLOCKED"); assert.ok(r.failures.includes("UNRESOLVED_CONTROL_CONFLICT"));
});

test("15.43 drift is visible and never silently reconciled",()=>{
 const r=detectDrift({documented:{x:1},configured:{x:2},deployed:{x:2},certified:{x:2},observed:{x:3}});
 assert.deepEqual(r.documentedVsConfigured,["x"]); assert.deepEqual(r.certifiedVsObserved,["x"]);
});

assert.ok(GOVERNANCE_STABILITY_ALGORITHM_VERSION.startsWith("15.43-"));
