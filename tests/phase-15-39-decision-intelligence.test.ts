import test from "node:test";
import assert from "node:assert/strict";
import { evaluateDecision, ALGORITHM_VERSION, DECISION_STATES, RECOMMENDATIONS, type DecisionContext, type DecisionSignalInput } from "@/lib/delivery-decision-intelligence/service";

const context=():DecisionContext=>({
 pipelineId:"00000000-0000-0000-0000-000000000001",environment:"STAGING",target:"PRODUCTION",policyVersion:"decision-policy:v1",
 expiresAt:"2026-10-05T04:00:00.000Z",dependencySnapshotId:"dep-1",graphSnapshotId:"graph-1",healthSnapshotId:"health-1",
 affectedServices:["checkout"],customerJourneys:["checkout"],promotionInput:{
  pipelineId:"00000000-0000-0000-0000-000000000001",sourceEnvironment:"STAGING",targetEnvironment:"PRODUCTION",
  policyVersion:"decision-policy:v1",evidenceVersion:"e1",evaluatedAt:"2026-10-05T03:00:00.000Z",expiresAt:"2026-10-05T04:00:00.000Z",
  dependencies:[{class:"DATABASE",reference:"db",status:"HEALTHY"}],signals:{artifact:{status:"PASS",identity:"a",assessedIdentity:"a"},security:{status:"PASS",criticalFindings:0},lock:{available:true},promotionWindow:{allowed:true}}
 }
});
const signals=():DecisionSignalInput[]=>[
 {signalType:"HEALTH",value:{status:"PASS"},source:"health",sourceVersion:"v1",observedAt:"2026-10-05T03:00:00.000Z",quality:"VALID",confidence:"HIGH"},
 {signalType:"SECURITY",value:{status:"PASS"},source:"security",sourceVersion:"v1",observedAt:"2026-10-05T03:00:00.000Z",quality:"VALID",confidence:"VERIFIED"},
 {signalType:"RECONCILIATION",value:{status:"PASS"},source:"reconciliation",sourceVersion:"v1",observedAt:"2026-10-05T03:00:00.000Z",quality:"VALID",confidence:"HIGH"}
];

test("healthy complete context produces explainable proceed recommendation",()=>{
 const r=evaluateDecision(context(),signals(),[{environment:"STAGING",strategy:"PASS",changeType:"GENERAL",outcome:"SUCCESS",confidence:"HIGH",occurredAt:"2026-10-04T03:00:00.000Z"}]);
 assert.equal(r.recommendation,"PROCEED"); assert.equal(r.algorithmVersion,ALGORITHM_VERSION); assert.ok(r.primaryReasons); assert.ok(r.riskDimensions.CHANGE_RISK);
});

test("missing graph and health context is not treated as healthy",()=>{
 const c=context(); delete c.graphSnapshotId; delete c.healthSnapshotId;
 const r=evaluateDecision(c,signals(),[]);
 assert.equal(r.recommendation,"HOLD"); assert.ok(r.missingContext.includes("graphSnapshotId")); assert.ok(r.missingContext.includes("healthSnapshotId")); assert.equal(r.confidence,"UNKNOWN");
});

test("security risk can require manual review without autonomous execution",()=>{
 const c=context(); c.securityChange=true; c.promotionInput={...c.promotionInput!,signals:{...c.promotionInput!.signals,security:{status:"CRITICAL",criticalFindings:1}}};
 const r=evaluateDecision(c,signals(),[]);
 assert.ok(["BLOCK","REQUIRE_MANUAL_REVIEW"].includes(r.recommendation));
 assert.ok(r.nextRequiredAction.length>0);
});

test("payment changes require approval rather than bypassing governance",()=>{
 const c=context(); c.paymentChange=true; c.promotionInput={...c.promotionInput!,signals:{...c.promotionInput!.signals,paymentChange:true,approval:{required:true,valid:false}}};
 const r=evaluateDecision(c,signals(),[]);
 assert.equal(r.recommendation,"PROCEED_WITH_APPROVAL");
});

test("historical adverse outcomes reduce exposure",()=>{
 const c=context(); c.databaseChange=false;
 const history=[{environment:"STAGING",strategy:"PASS",changeType:"GENERAL",service:"checkout",outcome:"ROLLBACK",confidence:"HIGH" as const,occurredAt:"2026-10-04T03:00:00.000Z"}];
 const r=evaluateDecision(c,signals(),history);
 assert.equal(r.recommendation,"REDUCE_EXPOSURE");
 assert.ok(r.primaryReasons.some(x=>x.includes("historical")));
});

test("signal quality is explicit and lowers decision confidence",()=>{
 const r=evaluateDecision(context(),signals().map(s=>({...s,quality:"STALE" as const})),[]);
 assert.equal(r.confidence,"UNKNOWN"); assert.ok(r.missingContext.some(x=>x.includes(":STALE")));
});

test("supported recommendation and lifecycle vocabularies are complete",()=>{
 assert.deepEqual(RECOMMENDATIONS,["PROCEED","PROCEED_WITH_APPROVAL","PROCEED_WITH_ADDITIONAL_VALIDATION","REDUCE_EXPOSURE","HOLD","BLOCK","REQUIRE_SIMULATION","REQUIRE_REHEARSAL","REQUIRE_MANUAL_REVIEW"]);
 assert.ok(DECISION_STATES.includes("OUTCOME_CAPTURED")); assert.ok(DECISION_STATES.includes("LEARNING_RECORDED"));
});

test("evaluation is deterministic for identical inputs",()=>{
 const a=evaluateDecision(context(),signals(),[]); const b=evaluateDecision(context(),signals(),[]);
 assert.deepEqual(a,b);
});
