import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db/client";

export const GOVERNANCE_ALGORITHM_VERSION = "15.41-governance-deterministic-v1";
export const GOVERNANCE_STATES = ["DRAFT","EVIDENCE_COLLECTING","SIGNAL_VALIDATION","POLICY_ASSESSMENT","IMPACT_ANALYSIS","SIMULATION_REQUIRED","SIMULATING","VALIDATION_REQUIRED","GOVERNANCE_REVIEW","APPROVAL_REQUIRED","APPROVED","STAGED","CONTROLLED_VALIDATION","VERIFIED","CERTIFIED","REJECTED","DEFERRED","BLOCKED","FAILED","EXPIRED","SUPERSEDED","ROLLED_BACK","ABANDONED","INVALIDATED"] as const;
export type GovernanceState = typeof GOVERNANCE_STATES[number];
export const GOVERNANCE_DECISIONS = ["NO_CHANGE","MONITOR","COLLECT_MORE_EVIDENCE","REQUIRE_SIMULATION","REQUIRE_REHEARSAL","REQUIRE_MANUAL_REVIEW","APPROVE_FOR_STAGING","APPROVE_FOR_CONTROLLED_VALIDATION","REJECT_PROPOSAL","DEFER_PROPOSAL","SUPERSEDE_PROPOSAL"] as const;
export const RISK_CLASSES = ["LOW","MEDIUM","HIGH","CRITICAL","PROHIBITED"] as const;
export const CONFIDENCE_LEVELS = ["UNKNOWN","LOW","MEDIUM","HIGH","VERIFIED"] as const;
export const SIGNAL_STATES = ["ACTIVE","DEGRADED","LOW_VALUE","UNTRUSTED","DEPRECATED","RETIRED"] as const;

type JsonMap = Record<string, unknown>;
const json=(v:unknown)=>JSON.parse(JSON.stringify(v)) as Prisma.InputJsonValue;
const stable=(v:unknown):unknown=>Array.isArray(v)?v.map(stable):v&&typeof v==="object"?Object.fromEntries(Object.entries(v as JsonMap).sort(([a],[b])=>a.localeCompare(b)).map(([k,x])=>[k,stable(x)])):v;
const hash=(v:unknown)=>createHash("sha256").update(JSON.stringify(stable(v))).digest("hex");
const bounded=(n:number,min=1,max=100)=>Math.min(Math.max(Number.isFinite(n)?Math.floor(n):min,min),max);

const transitions:Record<GovernanceState,GovernanceState[]> = {
 DRAFT:["EVIDENCE_COLLECTING","REJECTED","DEFERRED","ABANDONED"],
 EVIDENCE_COLLECTING:["SIGNAL_VALIDATION","FAILED","DEFERRED"],
 SIGNAL_VALIDATION:["POLICY_ASSESSMENT","FAILED","BLOCKED"],
 POLICY_ASSESSMENT:["IMPACT_ANALYSIS","SIMULATION_REQUIRED","VALIDATION_REQUIRED","GOVERNANCE_REVIEW","DEFERRED"],
 IMPACT_ANALYSIS:["SIMULATION_REQUIRED","VALIDATION_REQUIRED","GOVERNANCE_REVIEW","BLOCKED"],
 SIMULATION_REQUIRED:["SIMULATING","VALIDATION_REQUIRED","GOVERNANCE_REVIEW"],
 SIMULATING:["VALIDATION_REQUIRED","GOVERNANCE_REVIEW","FAILED","BLOCKED"],
 VALIDATION_REQUIRED:["GOVERNANCE_REVIEW","FAILED","BLOCKED"],
 GOVERNANCE_REVIEW:["APPROVAL_REQUIRED","APPROVED","REJECTED","DEFERRED","BLOCKED"],
 APPROVAL_REQUIRED:["APPROVED","REJECTED","DEFERRED"],
 APPROVED:["STAGED","REJECTED","DEFERRED"],
 STAGED:["CONTROLLED_VALIDATION","ROLLED_BACK","EXPIRED"],
 CONTROLLED_VALIDATION:["VERIFIED","ROLLED_BACK","FAILED","BLOCKED"],
 VERIFIED:["CERTIFIED","ROLLED_BACK","INVALIDATED"],
 CERTIFIED:["SUPERSEDED","INVALIDATED","ROLLED_BACK","EXPIRED"],
 REJECTED:[],DEFERRED:[],BLOCKED:[],FAILED:[],EXPIRED:[],SUPERSEDED:[],ROLLED_BACK:[],ABANDONED:[],INVALIDATED:[]
};

export type PolicyMetricInput={deploymentSuccessRate?:number;verifiedReleaseRate?:number;rollbackRate?:number;forwardRecoveryRate?:number;failedDeploymentRate?:number;incidentCorrelation?:number;customerImpactCorrelation?:number;sloImpact?:number;errorBudgetImpact?:number;securityFindings?:number;privacyFindings?:number;databaseMigrationFailures?:number;paymentIncidents?:number;fulfillmentIncidents?:number;shippingIncidents?:number;qikinkFailures?:number;backgroundJobFailures?:number;queueFailures?:number;cacheFailures?:number;searchFailures?:number;notificationFailures?:number;operationalToil?:number;deploymentDuration?:number;approvalLatency?:number;rehearsalDuration?:number;simulationDuration?:number;unnecessaryBlocking?:number;falsePositiveRate?:number;falseNegativeRate?:number;costImpact?:number;infrastructureImpact?:number;capacityImpact?:number};
export function assessPolicy(input:{policyId:string;policyVersion:string;metrics:PolicyMetricInput;evidence:unknown[];architectureVersion?:string;baselineVersion?:string}){
 const m=input.metrics;
 const evidenceCount=input.evidence.length;
 const safety=(m.securityFindings??0)+ (m.privacyFindings??0)+ (m.paymentIncidents??0)+ (m.databaseMigrationFailures??0);
 const detection=1-Math.min(1,m.falseNegativeRate??0);
 const precision=1-Math.min(1,m.falsePositiveRate??0);
 const efficiency=1-Math.min(1,((m.operationalToil??0)+(m.unnecessaryBlocking??0))/2);
 const timeliness=1-Math.min(1,((m.approvalLatency??0)+(m.deploymentDuration??0))/2);
 const stability=1-Math.min(1,(m.rollbackRate??0)+(m.failedDeploymentRate??0));
 const cost=1-Math.min(1,m.costImpact??0);
 const safetyScore=safety===0?1:Math.max(0,1-Math.min(1,safety/10));
 const dimensions={safety:safetyScore,detection,precision,efficiency,timeliness,stability,cost,customerImpact:1-Math.min(1,m.customerImpactCorrelation??0)};
 const driftReasons:string[]=[];
 if(input.architectureVersion&&input.baselineVersion&&input.architectureVersion!==input.baselineVersion)driftReasons.push("ARCHITECTURE_VERSION_CHANGED");
 if((m.falsePositiveRate??0)>=0.35)driftReasons.push("EXCESSIVE_FALSE_POSITIVES");
 if((m.falseNegativeRate??0)>=0.10)driftReasons.push("MEANINGFUL_FALSE_NEGATIVES");
 if((m.unnecessaryBlocking??0)>=0.30)driftReasons.push("EXCESSIVE_BLOCKING");
 const confidence=evidenceCount>=30&&Object.values(dimensions).every(v=>v>=0.8)?"HIGH":evidenceCount>=10?"MEDIUM":evidenceCount>0?"LOW":"UNKNOWN";
 return {dimensions,confidence,driftDetected:driftReasons.length>0,driftReasons,evidenceCount,algorithmVersion:GOVERNANCE_ALGORITHM_VERSION};
}
export function validateSignal(input:{state:string;freshnessSeconds:number;maxAgeSeconds:number;confidence:string;provenanceValid:boolean;versionCompatible:boolean;sourceAvailable:boolean;corrupted?:boolean}){
 const reasons:string[]=[];
 if(input.freshnessSeconds>input.maxAgeSeconds)reasons.push("STALE");
 if(!input.provenanceValid)reasons.push("INVALID_PROVENANCE");
 if(!input.versionCompatible)reasons.push("INCOMPATIBLE_VERSION");
 if(!input.sourceAvailable)reasons.push("SOURCE_UNAVAILABLE");
 if(input.corrupted)reasons.push("CORRUPTED");
 if(!CONFIDENCE_LEVELS.includes(input.confidence as typeof CONFIDENCE_LEVELS[number])||input.confidence==="UNKNOWN")reasons.push("LOW_CONFIDENCE");
 const status=input.state==="RETIRED"||input.state==="DEPRECATED"?input.state:reasons.length?reasons.includes("STALE")||reasons.includes("LOW_CONFIDENCE")?"LOW_VALUE":"UNTRUSTED":"ACTIVE";
 return {status,usable:status==="ACTIVE"||status==="DEGRADED",excluded:status!=="ACTIVE"&&status!=="DEGRADED",exclusionReasons:reasons};
}
export function classifyOptimization(input:{proposedPolicy:unknown;affectedSystems:string[];paymentChange?:boolean;securityChange?:boolean;privacyChange?:boolean;databaseIntegrityChange?:boolean;fulfillmentChange?:boolean;shippingChange?:boolean;rollbackCapability?:boolean}){
 const raw=JSON.stringify(input.proposedPolicy).toLowerCase();
 if(/bypass|disable|skip|remove/.test(raw)&&(/payment|security|privacy|audit|rollback|database|fulfillment|shipping|qikink/.test(raw)))return "PROHIBITED";
 if(input.paymentChange||input.securityChange||input.privacyChange||input.databaseIntegrityChange||input.fulfillmentChange||input.shippingChange)return "CRITICAL";
 if(!input.rollbackCapability)return "HIGH";
 if(input.affectedSystems.length>10)return "HIGH";
 return input.affectedSystems.length>3?"MEDIUM":"LOW";
}
export function comparePolicies(current:Record<string,unknown>,proposed:Record<string,unknown>){
 const keys=[...new Set([...Object.keys(current),...Object.keys(proposed)])].sort();
 return keys.filter(k=>JSON.stringify(current[k])!==JSON.stringify(proposed[k])).map(k=>({key:k,current:current[k]??null,proposed:proposed[k]??null}));
}
export function evaluateShadow(input:{currentResult:unknown;proposedResult:unknown;releaseIds:string[];policyId:string;policyVersion:string}){
 const differences=comparePolicies((input.currentResult??{}) as Record<string,unknown>,(input.proposedResult??{}) as Record<string,unknown>);
 return {classification:differences.length?"DIFFERENT":"EQUIVALENT",differences,releaseIds:input.releaseIds.slice(0,100),policyId:input.policyId,policyVersion:input.policyVersion,observationalOnly:true,algorithmVersion:GOVERNANCE_ALGORITHM_VERSION};
}
export function evaluateRegression(input:{baseline:Record<string,number>;candidate:Record<string,number>;thresholds:Record<string,number>}){
 const regressions=Object.keys(input.thresholds).filter(k=>(input.candidate[k]??0)-(input.baseline[k]??0)>input.thresholds[k]);
 return {regressed:regressions.length>0,regressions,action:regressions.length?"PAUSE_AND_REVIEW":"CONTINUE_OBSERVATION"};
}
export function confidenceFromEvidence(input:{sampleSize:number;evidenceQuality:number;simulationCoverage:number;environmentConsistency:number;signalFreshness:number;architectureStability:number;outcomeCertainty:number}){
 const values=[input.evidenceQuality,input.simulationCoverage,input.environmentConsistency,input.signalFreshness,input.architectureStability,input.outcomeCertainty].map(v=>Math.max(0,Math.min(1,v)));
 const avg=values.reduce((a,b)=>a+b,0)/values.length;
 return input.sampleSize>=50&&avg>=.9?"VERIFIED":input.sampleSize>=20&&avg>=.75?"HIGH":input.sampleSize>=8&&avg>=.55?"MEDIUM":input.sampleSize>0?"LOW":"UNKNOWN";
}
export async function createAssessment(input:{policyId:string;policyVersion:string;correlationId:string;metrics:PolicyMetricInput;evidence:unknown[];architectureVersion?:string;baselineVersion?:string;actor:string}){
 const evaluation=assessPolicy(input);
 return db.governancePolicyAssessment.create({data:{stableId:"assessment:"+input.policyId+":"+input.policyVersion+":"+hash(input.metrics).slice(0,24),policyId:input.policyId,policyVersion:input.policyVersion,status:"ASSESSED",metrics:json(input.metrics),dimensions:json(evaluation.dimensions),driftDetected:evaluation.driftDetected,driftReasons:json(evaluation.driftReasons),evidence:json(input.evidence.slice(0,100)),confidence:evaluation.confidence,architectureVersion:input.architectureVersion,baselineVersion:input.baselineVersion,correlationId:input.correlationId,algorithmVersion:GOVERNANCE_ALGORITHM_VERSION,createdBy:input.actor}});
}
export async function createProposal(input:{policyId:string;policyVersion:string;problem:string;currentPolicy:unknown;proposedPolicy:unknown;rationale:string;evidence:unknown;expectedBenefit:unknown;expectedRisk:unknown;affectedSystems:string[];affectedPolicies:unknown;affectedCustomers:unknown;affectedEnvironments:unknown;costImpact:unknown;operationalImpact:unknown;rollbackStrategy:unknown;validationCriteria:unknown;simulationRequired:boolean;approvalRequired:boolean;rollbackCapability:boolean;actor:string}){
 const risk=classifyOptimization({proposedPolicy:input.proposedPolicy,affectedSystems:input.affectedSystems,rollbackCapability:input.rollbackCapability});
 if(risk==="PROHIBITED")throw new Error("PROHIBITED governance optimization.");
 return db.governanceOptimizationProposal.create({data:{stableId:"proposal:"+input.policyId+":"+hash({p:input.proposedPolicy,e:input.evidence}).slice(0,24),policyId:input.policyId,policyVersion:input.policyVersion,problem:input.problem.slice(0,4000),currentPolicy:json(input.currentPolicy),proposedPolicy:json(input.proposedPolicy),rationale:input.rationale.slice(0,4000),evidence:json(input.evidence),expectedBenefit:json(input.expectedBenefit),expectedRisk:json(input.expectedRisk),affectedSystems:json(input.affectedSystems.slice(0,100)),affectedPolicies:json(input.affectedPolicies),affectedCustomers:json(input.affectedCustomers),affectedEnvironments:json(input.affectedEnvironments),costImpact:json(input.costImpact),operationalImpact:json(input.operationalImpact),rollbackStrategy:json(input.rollbackStrategy),validationCriteria:json(input.validationCriteria),riskClass:risk,simulationRequired:input.simulationRequired||["HIGH","CRITICAL"].includes(risk),approvalRequired:input.approvalRequired||["HIGH","CRITICAL"].includes(risk),rollbackCapability:input.rollbackCapability,lifecycleState:"DRAFT",confidence:"UNKNOWN",algorithmVersion:GOVERNANCE_ALGORITHM_VERSION,createdBy:input.actor}}); 
}
export async function transitionProposal(input:{proposalId:string;toState:GovernanceState;actor:string;reason:string;evidence:unknown;idempotencyKey:string}){
 const p=await db.governanceOptimizationProposal.findUnique({where:{id:input.proposalId}});
 if(!p)throw new Error("Governance proposal not found.");
 if(!GOVERNANCE_STATES.includes(input.toState)||!(transitions[p.lifecycleState as GovernanceState]??[]).includes(input.toState))throw new Error("Illegal governance transition.");
 return db.$transaction(async tx=>{const updated=await tx.governanceOptimizationProposal.update({where:{id:p.id},data:{lifecycleState:input.toState}});await tx.governanceOptimizationTransition.create({data:{proposalId:p.id,fromState:p.lifecycleState,toState:input.toState,actor:input.actor,reason:input.reason.slice(0,2000),evidence:json(input.evidence),idempotencyKey:input.idempotencyKey}});return updated;});
}
export async function createPolicyVersion(input:{policyId:string;version:string;parentVersion?:string;description:string;effectiveAt:string;expiresAt?:string;logic:unknown;rationale:string;evidence:unknown;rollbackVersion?:string;owner:string;reviewers:unknown;actor:string}){
 const effective=new Date(input.effectiveAt);if(Number.isNaN(effective.getTime()))throw new Error("effectiveAt must be valid.");
 return db.governancePolicyVersion.create({data:{stableId:"policy-version:"+input.policyId+":"+input.version,policyId:input.policyId,version:input.version,parentVersion:input.parentVersion,description:input.description.slice(0,2000),effectiveAt:effective,expiresAt:input.expiresAt?new Date(input.expiresAt):undefined,logic:json(input.logic),rationale:input.rationale.slice(0,4000),evidence:json(input.evidence),rollbackVersion:input.rollbackVersion,owner:input.owner,reviewers:json(input.reviewers),immutable:true,createdBy:input.actor}});
}
export async function createShadowEvaluation(input:{proposalId:string;policyId:string;policyVersion:string;currentResult:unknown;proposedResult:unknown;releaseIds:string[];correlationId:string;actor:string}){
 const result=evaluateShadow(input);
 return db.governanceShadowEvaluation.create({data:{proposalId:input.proposalId,policyId:input.policyId,policyVersion:input.policyVersion,currentResult:json(input.currentResult),proposedResult:json(input.proposedResult),differences:json(result.differences),affectedReleases:json(result.releaseIds),classification:result.classification,observationalOnly:true,correlationId:input.correlationId,algorithmVersion:GOVERNANCE_ALGORITHM_VERSION,createdBy:input.actor}});
}
export async function createExperiment(input:{proposalId:string;policyId:string;hypothesis:string;baseline:unknown;proposedPolicy:unknown;targetPopulation:unknown;environment:string;durationSeconds:number;successMetrics:unknown;safetyMetrics:unknown;abortConditions:unknown;customerImpactLimits:unknown;securityLimits:unknown;privacyLimits:unknown;costLimits:unknown;approved:boolean;actor:string}){
 if(durationSecondsSafe(input.durationSeconds)>86400*30)throw new Error("Experiment duration exceeds bounded maximum.");
 if(!input.approved&&input.environment==="CONTROLLED_PRODUCTION")throw new Error("Controlled production requires explicit approval.");
 return db.governanceOptimizationExperiment.create({data:{proposalId:input.proposalId,policyId:input.policyId,hypothesis:input.hypothesis.slice(0,4000),baseline:json(input.baseline),proposedPolicy:json(input.proposedPolicy),targetPopulation:json(input.targetPopulation),environment:input.environment,durationSeconds:durationSecondsSafe(input.durationSeconds),successMetrics:json(input.successMetrics),safetyMetrics:json(input.safetyMetrics),abortConditions:json(input.abortConditions),customerImpactLimits:json(input.customerImpactLimits),securityLimits:json(input.securityLimits),privacyLimits:json(input.privacyLimits),costLimits:json(input.costLimits),status:"DRAFT",approved:input.approved,actor:input.actor,createdBy:input.actor}});
}
const durationSecondsSafe=(v:number)=>Math.min(Math.max(Number.isFinite(v)?Math.floor(v):1,1),86400*30);
export async function certify(input:{proposalId:string;policyVersion:string;validationEvidence:unknown;approvalEvidence:unknown;simulationEvidence:unknown;knownLimitations:unknown;effectiveScope:unknown;expiresAt:string;actor:string}){
 const p=await db.governanceOptimizationProposal.findUnique({where:{id:input.proposalId}});
 if(!p||p.lifecycleState!=="VERIFIED")throw new Error("Only VERIFIED proposals can be certified.");
 return db.governanceOptimizationCertification.create({data:{proposalId:input.proposalId,policyVersion:input.policyVersion,validationEvidence:json(input.validationEvidence),approvalEvidence:json(input.approvalEvidence),simulationEvidence:json(input.simulationEvidence),knownLimitations:json(input.knownLimitations),effectiveScope:json(input.effectiveScope),expiresAt:new Date(input.expiresAt),certifiedBy:input.actor,immutable:true,integrityHash:hash(input),status:"CERTIFIED"}});
}
export async function invalidateCertifications(input:{triggerType:string;triggerReference:string;reason:string;actor:string}){
 const rows=await db.governanceOptimizationCertification.findMany({where:{status:"CERTIFIED"},take:100});
 return db.$transaction(rows.map(c=>db.governanceOptimizationCertification.update({where:{id:c.id},data:{status:"INVALIDATED",invalidationReason:input.reason.slice(0,1000),invalidationTrigger:input.triggerReference}})));
}
export async function listProposals(limit=50){return db.governanceOptimizationProposal.findMany({take:bounded(limit),orderBy:{updatedAt:"desc"}});}
export async function listAssessments(limit=50){return db.governancePolicyAssessment.findMany({take:bounded(limit),orderBy:{createdAt:"desc"}});}
export async function listCertifications(limit=50){return db.governanceOptimizationCertification.findMany({take:bounded(limit),orderBy:{createdAt:"desc"}});}
