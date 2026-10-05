import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db/client";
import { graphHealth, graphOverview, impactAnalysis as graphImpactAnalysis } from "@/lib/platform-graph/service";
import { reconciliationSummary } from "@/lib/reconciliation/service";
import { GOVERNANCE_ADAPTATION_ALGORITHM_VERSION } from "@/lib/delivery-governance-adaptation/service";
import { GOVERNANCE_ALGORITHM_VERSION } from "@/lib/delivery-governance-intelligence/service";

export const GOVERNANCE_STABILITY_ALGORITHM_VERSION="15.43-governance-stability-deterministic-v1";
export const STABILITY_CLASSIFICATIONS=["STABLE","STABLE_WITH_WARNINGS","DEGRADED","UNSTABLE","CRITICAL","UNKNOWN"] as const;
export type StabilityClassification=typeof STABILITY_CLASSIFICATIONS[number];
export const COMPATIBILITY=["COMPATIBLE","CONDITIONAL","REDUNDANT","CONFLICTING","UNKNOWN"] as const;
export const DEGRADED_GOVERNANCE_MODES=["NORMAL","DEGRADED","OBSERVE_ONLY","MANUAL_REVIEW","FROZEN","EMERGENCY_RESTRICTED"] as const;
export type GovernanceMode=typeof DEGRADED_GOVERNANCE_MODES[number];
export const CONFLICT_TYPES=["THRESHOLD","APPROVAL","ROLLOUT","ENVIRONMENT","DEPENDENCY","FREEZE","DUPLICATE","OBSOLETE","CUSTOMER_IMPACT","SAFETY_ASSUMPTION","UNSAFE_INTERACTION"] as const;
export const GOVERNANCE_RELATION_TYPES=["CONTROLS","DEPENDS_ON","CONFLICTS_WITH","REINFORCES","DUPLICATES","PRECONDITIONS","INVALIDATES","TRIGGERS","BLOCKS","REQUIRES","PROTECTS","OBSERVES","VALIDATES","ROLLS_BACK","RECOVERS","SUPERSEDES"] as const;

type Json=Record<string,unknown>;
const safe=(v:unknown,d=0):unknown=>{
 if(d>6)return"[TRUNCATED]";
 if(v===null||typeof v==="string"||typeof v==="number"||typeof v==="boolean")return v;
 if(Array.isArray(v))return v.slice(0,100).map(x=>safe(x,d+1));
 if(typeof v==="object"){const o:Json={};for(const[k,x]of Object.entries(v as Json))o[k]=/password|secret|token|authorization|cookie|apiKey|privateKey|cardNumber|cvv/i.test(k)?"[REDACTED]":safe(x,d+1);return o}
 return"[UNSUPPORTED]";
};
const stable=(v:unknown):unknown=>Array.isArray(v)?v.map(stable):v&&typeof v==="object"?Object.fromEntries(Object.entries(v as Json).sort(([a],[b])=>a.localeCompare(b)).map(([k,x])=>[k,stable(x)])):v;
const hash=(v:unknown)=>createHash("sha256").update(JSON.stringify(stable(v))).digest("hex");
const json=(v:unknown)=>safe(v) as Prisma.InputJsonValue;

export type Control={
 id:string;
 policyVersion?:string;
 owner?:string;
 workflow?:string;
 action?:string;
 threshold?:number;
 direction?:"ALLOW"|"BLOCK"|"REQUIRE";
 requires?:string[];
 blocks?:string[];
 protects?:string[];
 dependencies?:string[];
 active?:boolean;
 evidenceFresh?:boolean;
};
export type ControlInteraction={a:string;b:string;classification:typeof COMPATIBILITY[number];reason:string;evidence:string[]};

export function compatibilityMatrix(controls:Control[]):ControlInteraction[]{
 const out:ControlInteraction[]=[];
 const list=controls.slice(0,250);
 for(let i=0;i<list.length;i++)for(let j=i+1;j<list.length;j++){
  const a=list[i],b=list[j],e:string[]=[];
  const ab=(a.blocks??[]).includes(b.id)||(b.blocks??[]).includes(a.id);
  const thresholdConflict=a.threshold!==undefined&&b.threshold!==undefined&&a.workflow===b.workflow&&a.direction!==b.direction;
  const duplicate=a.action===b.action&&a.workflow===b.workflow;
  const protectiveOverlap=(a.protects??[]).some(x=>(b.protects??[]).includes(x));
  let classification:typeof COMPATIBILITY[number]="UNKNOWN";
  if(ab||thresholdConflict){classification="CONFLICTING";e.push(ab?"EXPLICIT_BLOCK":"CONTRADICTORY_RULE")}
  else if(duplicate){classification="REDUNDANT";e.push("SAME_WORKFLOW_AND_ACTION")}
  else if(protectiveOverlap){classification="CONDITIONAL";e.push("SHARED_PROTECTED_RISK")}
  else if((a.requires??[]).includes(b.id)||(b.requires??[]).includes(a.id)){classification="CONDITIONAL";e.push("PRECONDITION")}
  else if(a.workflow&&b.workflow&&a.workflow===b.workflow){classification="COMPATIBLE";e.push("SAME_SCOPE_NO_CONTRADICTION")}
  out.push({a:a.id,b:b.id,classification,reason:e.join(","),evidence:[a.policyVersion??"unknown",b.policyVersion??"unknown"]});
 }
 return out;
}

export function detectConflicts(controls:Control[],policyVersions:Record<string,string>={}){
 return compatibilityMatrix(controls).filter(x=>x.classification==="CONFLICTING").map((x,i)=>({
  stableId:`governance-conflict-${hash(x).slice(0,24)}`,controlIds:[x.a,x.b],policyVersions:[policyVersions[x.a]??"unknown",policyVersions[x.b]??"unknown"],
  conflictType:"UNSAFE_INTERACTION",severity:"HIGH",impact:{blockedControls:x.a===x.b?[]:[x.a,x.b]},evidence:{interaction:x},resolutionState:"OPEN",provenance:{algorithmVersion:GOVERNANCE_STABILITY_ALGORITHM_VERSION,method:"deterministic-compatibility-matrix",index:i}
 }));
}

export function detectDeadlocks(nodes:string[],edges:Array<{from:string;to:string;type:string}>){
 const adjacency=new Map<string,string[]>();for(const n of nodes.slice(0,500))adjacency.set(n,[]);
 for(const e of edges.slice(0,2000))if(adjacency.has(e.from)&&adjacency.has(e.to))adjacency.get(e.from)!.push(e.to);
 const cycles:string[][]=[];const seen=new Set<string>();const stack:string[]=[];const inStack=new Set<string>();
 const dfs=(n:string)=>{if(cycles.length>=50)return;if(inStack.has(n)){const idx=stack.indexOf(n);if(idx>=0)cycles.push(stack.slice(idx).concat(n));return}if(seen.has(n))return;seen.add(n);inStack.add(n);stack.push(n);for(const next of adjacency.get(n)??[])dfs(next);stack.pop();inStack.delete(n)};
 for(const n of nodes.slice(0,500))dfs(n);
 return cycles.map((cycle,i)=>({stableId:`governance-deadlock-${hash(cycle).slice(0,24)}`,nodes:[...new Set(cycle)],cycle,severity:"HIGH",blockedAction:"Governance progression",evidence:{cycleLength:cycle.length},provenance:{algorithmVersion:GOVERNANCE_STABILITY_ALGORITHM_VERSION,index:i}}));
}

export function detectOscillation(input:{policyId:string;sequence:Array<{version:string;state:string;at:string}>}){
 const seq=input.sequence.slice(-100);let toggles=0;
 for(let i=2;i<seq.length;i++)if(seq[i].state===seq[i-2].state&&seq[i].state!==seq[i-1].state)toggles++;
 const first=seq[0]?.at,last=seq.at(-1)?.at;
 const duration=first&&last?Math.max(0,(new Date(last).getTime()-new Date(first).getTime())/1000):0;
 const frequency=duration?toggles/(duration/3600):toggles;
 const classification=toggles>=6?"UNSTABLE":toggles>=3?"WARNING":"HEALTHY_ADAPTATION";
 return {stableId:`governance-oscillation-${hash({policyId:input.policyId,seq}).slice(0,24)}`,policyId:input.policyId,sequence:seq,frequency,durationSeconds:Math.floor(duration),classification,evidence:{toggles,method:"alternating-state-detection"}};
}

export function assessChurn(input:{windowStart:string;windowEnd:string;policyChanges:number;controlChanges:number;exceptions:number;freezes:number;invalidations:number;rollbacks:number;certificationFailures:number}){
 const total=Math.max(0,input.policyChanges)+Math.max(0,input.controlChanges)+Math.max(0,input.exceptions)+Math.max(0,input.freezes)+Math.max(0,input.invalidations)+Math.max(0,input.rollbacks)+Math.max(0,input.certificationFailures);
 const classification=total>=100?"EXCESSIVE":total>=30?"HIGH":total>=10?"ELEVATED":"NORMAL";
 return {stableId:`governance-churn-${hash(input).slice(0,24)}`,windowStart:new Date(input.windowStart),windowEnd:new Date(input.windowEnd),metrics:{...input,total},classification,evidence:{thresholds:{normal:10,elevated:30,excessive:100},note:"Churn triggers assessment; it does not independently block delivery."}};
}

export function analyzeCascade(chain:Array<{control:string;effect:string;relationship:"DIRECT_DEPENDENCY"|"TEMPORAL_CORRELATION"|"INFERRED_DEPENDENCY"|"VERIFIED_DEPENDENCY";evidence?:unknown}>){
 const safeChain=chain.slice(0,100);
 const verified=safeChain.filter(x=>x.relationship==="VERIFIED_DEPENDENCY").length;
 const confidence=verified===safeChain.length&&safeChain.length>0?"VERIFIED":verified>0?"HIGH":safeChain.length>0?"MEDIUM":"UNKNOWN";
 const causalClassification=verified>0?"VERIFIED_DEPENDENCY":safeChain.some(x=>x.relationship==="DIRECT_DEPENDENCY")?"DIRECT_DEPENDENCY":"CORRELATION_ONLY";
 return {stableId:`governance-cascade-${hash(safeChain).slice(0,24)}`,chain:safeChain,causalClassification,confidence,evidence:{verifiedLinks:verified,doNotInferCausality:verified===0}};
}

export function analyzeCoverage(input:{risks:string[];controls:Control[]}){
 const risks=input.risks.slice(0,250);const coverage=risks.map(r=>({risk:r,controls:input.controls.filter(c=>(c.protects??[]).includes(r)).map(c=>c.id)}));
 const gaps=coverage.filter(x=>x.controls.length===0);const fragile=coverage.filter(x=>x.controls.length===1);
 return {coverage,gaps,fragile,covered:coverage.length-gaps.length,ratio:risks.length?(coverage.length-gaps.length)/risks.length:1};
}

export const DEFAULT_INVARIANTS=[
 {stableId:"payment-safety",name:"Payment safety cannot be disabled",expression:"payment validation AND reconciliation AND webhook integrity AND idempotency remain protected",severity:"CRITICAL",protectedDomain:"PAYMENT"},
 {stableId:"audit-integrity",name:"Audit integrity is mandatory",expression:"high-risk governance mutations require immutable audit evidence",severity:"CRITICAL",protectedDomain:"GOVERNANCE"},
 {stableId:"provider-credential-isolation",name:"Provider credentials stay server-side",expression:"provider credentials never enter browser/client execution",severity:"CRITICAL",protectedDomain:"SECURITY"},
 {stableId:"qikink-fulfillment-only",name:"Qikink remains fulfillment-only",expression:"Qikink is never catalog, pricing, release, deployment, governance, or customer-data authority",severity:"CRITICAL",protectedDomain:"FULFILLMENT"},
 {stableId:"database-safety",name:"Destructive database behavior remains protected",expression:"destructive database operations require appropriate protection",severity:"CRITICAL",protectedDomain:"DATABASE"},
 {stableId:"rollback-recovery",name:"Recovery remains available",expression:"rollback cannot be removed without an approved replacement recovery strategy",severity:"CRITICAL",protectedDomain:"DELIVERY"},
] as const;

export function evaluateInvariants(input:{facts:Record<string,boolean|undefined>}){
 const violations:string[]=[];
 for(const inv of DEFAULT_INVARIANTS){
  const violated=input.facts[inv.stableId]===false;
  if(violated)violations.push(inv.stableId);
 }
 return {status:violations.length?"BLOCKED":"PASS",violations,algorithmVersion:GOVERNANCE_STABILITY_ALGORITHM_VERSION};
}

export function resilienceMode(input:{dependencies:Record<string,"AVAILABLE"|"DEGRADED"|"UNAVAILABLE"|"UNKNOWN">;criticalUnknown?:boolean}){
 const values=Object.values(input.dependencies);const unavailable=values.filter(x=>x==="UNAVAILABLE").length,unknown=values.filter(x=>x==="UNKNOWN").length,degraded=values.filter(x=>x==="DEGRADED").length;
 let mode:GovernanceMode="NORMAL";
 if(input.criticalUnknown||unknown)mode="EMERGENCY_RESTRICTED";
 else if(unavailable)mode="FROZEN";
 else if(degraded)mode="DEGRADED";
 return {mode,allowedActions:mode==="NORMAL"?["ASSESS","REVIEW","CERTIFY"]:mode==="DEGRADED"?["ASSESS","REVIEW","MANUAL_APPROVAL"]:mode==="FROZEN"?["OBSERVE","MANUAL_REVIEW"]:["OBSERVE"],prohibitedActions:mode==="NORMAL"?[]:["HIGH_RISK_MUTATION","AUTONOMOUS_ACTIVATION"],requiredApprovals:mode==="NORMAL"?"policy-dependent":"elevated",monitoring:"continuous",transitionCondition:"all critical dependencies verified",recoveryBehavior:"revalidate before promotion"};
}

export function classifyStability(d:{structural:number;behavioral:number;operational:number;safety:number;policy:number;dependency:number;cost:number;customer:number;criticalViolations?:number}):{classification:StabilityClassification;dimensions:typeof d;reasons:string[]}{
 const vals=[d.structural,d.behavioral,d.operational,d.safety,d.policy,d.dependency,d.cost,d.customer].map(x=>Math.max(0,Math.min(1,x)));
 const reasons:string[]=[];
 if((d.criticalViolations??0)>0)reasons.push("CRITICAL_INVARIANT_VIOLATION");
 if(d.safety<0.5)reasons.push("SAFETY_INSTABILITY");if(d.dependency<0.5)reasons.push("DEPENDENCY_INSTABILITY");if(d.policy<0.5)reasons.push("POLICY_INSTABILITY");
 const min=Math.min(...vals),avg=vals.reduce((a,b)=>a+b,0)/vals.length;
 const classification=(d.criticalViolations??0)>0?"CRITICAL":min<0.35?"UNSTABLE":min<0.6?"DEGRADED":avg<0.8?"STABLE_WITH_WARNINGS":"STABLE";
 return {classification,dimensions:d,reasons};
}

export function policyStabilityGates(input:{conflicts:number;invariantViolations:number;deadlocks:number;oscillationUnexplained:number;churnExcessive:boolean;safetyEnvelopePreserved:boolean;coverageGaps:number;rollbackAvailable:boolean;dependenciesValid:boolean;certificationValid:boolean;auditAvailable:boolean}){
 const failures:string[]=[];
 if(input.conflicts>0)failures.push("UNRESOLVED_CONTROL_CONFLICT");
 if(input.invariantViolations>0)failures.push("INVARIANT_VIOLATION");
 if(input.deadlocks>0)failures.push("GOVERNANCE_DEADLOCK");
 if(input.oscillationUnexplained>0)failures.push("UNEXPLAINED_OSCILLATION");
 if(input.churnExcessive)failures.push("EXCESSIVE_CHURN");
 if(!input.safetyEnvelopePreserved)failures.push("SAFETY_ENVELOPE_BREACH");
 if(input.coverageGaps>0)failures.push("CRITICAL_COVERAGE_GAP");
 if(!input.rollbackAvailable)failures.push("ROLLBACK_UNAVAILABLE");
 if(!input.dependenciesValid)failures.push("DEPENDENCIES_INVALID");
 if(!input.certificationValid)failures.push("CERTIFICATION_INVALID");
 if(!input.auditAvailable)failures.push("AUDIT_PATH_UNAVAILABLE");
 return {status:failures.length?"BLOCKED":"PASS",failures};
}

export function detectDrift(input:{documented:Record<string,unknown>;configured:Record<string,unknown>;deployed:Record<string,unknown>;certified:Record<string,unknown>;observed:Record<string,unknown>}){
 const diff=(a:Record<string,unknown>,b:Record<string,unknown>)=>Object.keys({...a,...b}).sort().filter(k=>JSON.stringify(a[k])!==JSON.stringify(b[k]));
 return {documentedVsConfigured:diff(input.documented,input.configured),configuredVsDeployed:diff(input.configured,input.deployed),deployedVsCertified:diff(input.deployed,input.certified),certifiedVsObserved:diff(input.certified,input.observed),algorithmVersion:GOVERNANCE_STABILITY_ALGORITHM_VERSION};
}

export async function buildSnapshot(input:{environment:string;policyVersions:unknown;activeControls:unknown;relationships:unknown;dependencies:unknown;certifications:unknown;freezes:unknown;exceptions:unknown;configurationReferences:unknown;actor:string;correlationId:string}){
 const payload=safe({...input,actor:undefined,correlationId:undefined});
 const integrityHash=hash(payload);
 return db.governanceStabilitySnapshot.create({data:{stableId:`governance-snapshot-${integrityHash.slice(0,32)}`,environment:input.environment,policyVersions:json(input.policyVersions),activeControls:json(input.activeControls),relationships:json(input.relationships),dependencies:json(input.dependencies),certifications:json(input.certifications),freezes:json(input.freezes),exceptions:json(input.exceptions),configurationReferences:json(input.configurationReferences),integrityHash,immutable:true,provenance:json({actor:input.actor,correlationId:input.correlationId,algorithmVersion:GOVERNANCE_STABILITY_ALGORITHM_VERSION})}});
}

export async function createStabilityAssessment(input:{
 policyVersion:string;environment:string;dimensions:{structural:number;behavioral:number;operational:number;safety:number;policy:number;dependency:number;cost:number;customer:number};risk:Json;evidence:unknown;actor:string;correlationId:string;criticalViolations?:number;
}){
 const classified=classifyStability({...input.dimensions,criticalViolations:input.criticalViolations});
 return db.governanceStabilityAssessment.create({data:{stableId:`governance-stability-${hash({policyVersion:input.policyVersion,environment:input.environment,dimensions:input.dimensions,evidence:input.evidence}).slice(0,32)}`,policyVersion:input.policyVersion,environment:input.environment,classification:classified.classification,dimensions:json(classified.dimensions),risk:json(input.risk),evidence:json({input:input.evidence,reasons:classified.reasons}),provenance:json({algorithmVersion:GOVERNANCE_STABILITY_ALGORITHM_VERSION,parentAlgorithms:[GOVERNANCE_ALGORITHM_VERSION,GOVERNANCE_ADAPTATION_ALGORITHM_VERSION]}),correlationId:input.correlationId,actor:input.actor,algorithmVersion:GOVERNANCE_STABILITY_ALGORITHM_VERSION}});
}

export async function assessIntegratedState(input:{policyVersion:string;environment:string;dimensions:{structural:number;behavioral:number;operational:number;safety:number;policy:number;dependency:number;cost:number;customer:number};risk:Json;controls:Control[];risks:string[];dependencies:Record<string,"AVAILABLE"|"DEGRADED"|"UNAVAILABLE"|"UNKNOWN">;invariantFacts:Record<string,boolean|undefined>;actor:string;correlationId:string}){
 const interactions=compatibilityMatrix(input.controls);
 const conflicts=detectConflicts(input.controls,Object.fromEntries(input.controls.map(c=>[c.id,c.policyVersion??input.policyVersion])));
 const coverage=analyzeCoverage({risks:input.risks,controls:input.controls});
 const invariants=evaluateInvariants({facts:input.invariantFacts});
 const mode=resilienceMode({dependencies:input.dependencies});
 const gates=policyStabilityGates({conflicts:conflicts.length,invariantViolations:invariants.violations.length,deadlocks:0,oscillationUnexplained:0,churnExcessive:false,safetyEnvelopePreserved:true,coverageGaps:coverage.gaps.length,rollbackAvailable:true,dependenciesValid:mode.mode==="NORMAL"||mode.mode==="DEGRADED",certificationValid:true,auditAvailable:true});
 const graph=await graphHealth();
 const reconciliation=await reconciliationSummary();
 const classified=classifyStability({...input.dimensions,criticalViolations:invariants.violations.length});
 const assessment=await createStabilityAssessment({policyVersion:input.policyVersion,environment:input.environment,dimensions:input.dimensions,risk:{...input.risk,mode:gates.status==="BLOCKED"?"BLOCKED":"ALLOW"},evidence:{interactions,conflicts,coverage,invariants,mode,graph,reconciliation,gates},actor:input.actor,correlationId:input.correlationId,criticalViolations:invariants.violations.length});
 return {assessment,classification:classified,interactions,conflicts,coverage,invariants,mode,gates,graph,reconciliation,algorithmVersion:GOVERNANCE_STABILITY_ALGORITHM_VERSION};
}

export async function certifyStability(input:{assessmentId:string;scope:unknown;evidence:unknown;actor:string;expiresAt:string}){
 const a=await db.governanceStabilityAssessment.findUnique({where:{id:input.assessmentId}});
 if(!a)throw new Error("Stability assessment not found.");
 if(!["STABLE","STABLE_WITH_WARNINGS"].includes(a.classification))throw new Error("Only stable governance states may be certified.");
 const payload={assessmentId:a.id,scope:safe(input.scope),evidence:safe(input.evidence),classification:a.classification,expiresAt:input.expiresAt};
 const integrityHash=hash(payload);
 return db.governanceStabilityCertification.create({data:{stableId:`governance-stability-cert-${integrityHash.slice(0,32)}`,assessmentId:a.id,classification:a.classification,scope:json(input.scope),evidence:json(input.evidence),expiresAt:new Date(input.expiresAt),status:"CERTIFIED",certifiedBy:input.actor,integrityHash,immutable:true}});
}

export async function listStability(limit=50){return db.governanceStabilityAssessment.findMany({orderBy:{createdAt:"desc"},take:Math.min(Math.max(limit,1),100)});}
export async function listConflicts(limit=50){return db.governanceStabilityConflict.findMany({orderBy:{createdAt:"desc"},take:Math.min(Math.max(limit,1),100)});}
export async function listSnapshots(limit=50){return db.governanceStabilitySnapshot.findMany({orderBy:{createdAt:"desc"},take:Math.min(Math.max(limit,1),100)});}
export async function listCertifications(limit=50){return db.governanceStabilityCertification.findMany({orderBy:{createdAt:"desc"},take:Math.min(Math.max(limit,1),100)});}

export async function integratedEvidence(){
 const [graph,reconciliation,overview]=await Promise.all([graphHealth(),reconciliationSummary(),graphOverview()]);
 return {graph,reconciliation,graphRelationships:overview.relationships.slice(0,25),graphFindings:overview.findings.slice(0,25),sources:["15.32 knowledge graph","15.22 reconciliation","15.33 simulation boundary","15.28 resilience boundary","15.41 governance intelligence","15.42 governance adaptation"]};
}

export async function graphImpact(stableId:string,depth=3){return graphImpactAnalysis(stableId,Math.min(Math.max(depth,0),5));}


export async function persistConflicts(items:ReturnType<typeof detectConflicts>,correlationId:string){
 const rows=[]; for(const item of items.slice(0,100)){rows.push(await db.governanceStabilityConflict.upsert({where:{stableId:item.stableId},create:{stableId:item.stableId,controlIds:json(item.controlIds),policyVersions:json(item.policyVersions),affectedWorkflow:null,conflictType:item.conflictType,severity:item.severity,impact:json(item.impact),evidence:json(item.evidence),resolutionState:"OPEN",provenance:json(item.provenance),correlationId},update:{impact:json(item.impact),evidence:json(item.evidence),updatedAt:new Date()}}));}return rows;
}
export async function persistDeadlocks(items:ReturnType<typeof detectDeadlocks>,correlationId:string){
 const rows=[];for(const item of items.slice(0,50)){rows.push(await db.governanceStabilityDeadlockAssessment.upsert({where:{stableId:item.stableId},create:{stableId:item.stableId,nodes:json(item.nodes),cycle:json(item.cycle),severity:item.severity,blockedAction:item.blockedAction,evidence:json(item.evidence),provenance:json(item.provenance),correlationId},update:{evidence:json(item.evidence),provenance:json(item.provenance)}}));}return rows;
}
export async function persistOscillation(item:ReturnType<typeof detectOscillation>){return db.governanceOscillationAssessment.upsert({where:{stableId:item.stableId},create:{stableId:item.stableId,policyId:item.policyId,sequence:json(item.sequence),frequency:item.frequency,durationSeconds:item.durationSeconds,classification:item.classification,evidence:json(item.evidence)},update:{sequence:json(item.sequence),frequency:item.frequency,durationSeconds:item.durationSeconds,classification:item.classification,evidence:json(item.evidence)}});}
export async function persistChurn(item:ReturnType<typeof assessChurn>){return db.governanceChurnAssessment.upsert({where:{stableId:item.stableId},create:{stableId:item.stableId,windowStart:item.windowStart,windowEnd:item.windowEnd,metrics:json(item.metrics),classification:item.classification,evidence:json(item.evidence)},update:{metrics:json(item.metrics),classification:item.classification,evidence:json(item.evidence)}});}
export async function persistCascade(item:ReturnType<typeof analyzeCascade>){return db.governanceCascadeAssessment.upsert({where:{stableId:item.stableId},create:{stableId:item.stableId,chain:json(item.chain),causalClassification:item.causalClassification,confidence:item.confidence,evidence:json(item.evidence)},update:{chain:json(item.chain),causalClassification:item.causalClassification,confidence:item.confidence,evidence:json(item.evidence)}});}
export async function persistResilience(input:{scenario:unknown;dependencies:Record<string,"AVAILABLE"|"DEGRADED"|"UNAVAILABLE"|"UNKNOWN">;criticalUnknown?:boolean}){
 const result=resilienceMode(input);const stableId=`governance-resilience-${hash({scenario:input.scenario,dependencies:input.dependencies}).slice(0,32)}`;
 return db.governanceResilienceAssessment.upsert({where:{stableId},create:{stableId,mode:result.mode,scenario:json(input.scenario),result:json(result),risk:json({mode:result.mode,critical:result.mode==="EMERGENCY_RESTRICTED"}),evidence:json({algorithmVersion:GOVERNANCE_STABILITY_ALGORITHM_VERSION})},update:{mode:result.mode,result:json(result),risk:json({mode:result.mode,critical:result.mode==="EMERGENCY_RESTRICTED"}),evidence:json({algorithmVersion:GOVERNANCE_STABILITY_ALGORITHM_VERSION})}});
}
export async function ensureInvariants(actor:string){
 const rows=[];for(const item of DEFAULT_INVARIANTS){rows.push(await db.governanceControlInvariant.upsert({where:{stableId:item.stableId},create:{...item,provenance:json({actor,algorithmVersion:GOVERNANCE_STABILITY_ALGORITHM_VERSION})},update:{name:item.name,expression:item.expression,severity:item.severity,protectedDomain:item.protectedDomain,active:true,provenance:json({actor,algorithmVersion:GOVERNANCE_STABILITY_ALGORITHM_VERSION})}}));}return rows;
}
