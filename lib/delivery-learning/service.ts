import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db/client";

export const LEARNING_STATES=["DRAFT","EVIDENCE_COLLECTING","ANALYZING","VALIDATION_REQUIRED","SIMULATION_REQUIRED","GOVERNANCE_REVIEW","APPROVAL_REQUIRED","APPROVED","STAGED","VALIDATING","VERIFIED","CERTIFIED","REJECTED","DEFERRED","ROLLED_BACK","FAILED","EXPIRED","SUPERSEDED","ABANDONED"] as const;
export type LearningState=typeof LEARNING_STATES[number];
export const ALGORITHM_VERSION="15.40-learning-deterministic-v1";
const json=(v:unknown)=>JSON.parse(JSON.stringify(v)) as Prisma.InputJsonValue;
const stable=(v:unknown):unknown=>{
 if(Array.isArray(v)) return v.map(stable);
 if(v&&typeof v==="object") return Object.fromEntries(Object.entries(v as Record<string,unknown>).sort(([a],[b])=>a.localeCompare(b)).map(([k,x])=>[k,stable(x)]));
 return v;
};
const hash=(v:unknown)=>createHash("sha256").update(JSON.stringify(stable(v))).digest("hex");
const bounded=(n:number,min=1,max=100)=>Math.min(Math.max(Number.isFinite(n)?Math.floor(n):min,min,max);

const transitions:Record<LearningState,LearningState[]>={
 DRAFT:["EVIDENCE_COLLECTING","REJECTED","DEFERRED"],EVIDENCE_COLLECTING:["ANALYZING","FAILED","DEFERRED"],
 ANALYZING:["VALIDATION_REQUIRED","SIMULATION_REQUIRED","GOVERNANCE_REVIEW","FAILED"],VALIDATION_REQUIRED:["SIMULATION_REQUIRED","GOVERNANCE_REVIEW","REJECTED"],
 SIMULATION_REQUIRED:["GOVERNANCE_REVIEW","FAILED","DEFERRED"],GOVERNANCE_REVIEW:["APPROVAL_REQUIRED","REJECTED","DEFERRED"],
 APPROVAL_REQUIRED:["APPROVED","REJECTED","DEFERRED"],APPROVED:["STAGED","ROLLED_BACK"],STAGED:["VALIDATING","ROLLED_BACK","ABANDONED"],
 VALIDATING:["VERIFIED","FAILED","ROLLED_BACK"],VERIFIED:["CERTIFIED","ROLLED_BACK","SUPERSEDED"],CERTIFIED:["SUPERSEDED","ROLLED_BACK"],
 REJECTED:[],DEFERRED:["EVIDENCE_COLLECTING","ABANDONED"],ROLLED_BACK:["EVIDENCE_COLLECTING","SUPERSEDED"],FAILED:["EVIDENCE_COLLECTING","ABANDONED"],EXPIRED:[],SUPERSEDED:[],ABANDONED:[]
};

export function confidenceFromEvidence(input:{evidenceCount:number;quality:number;freshness:number;consistency:number;reproducibility:number;simulationValidated:boolean;experimentValidated:boolean}){
 if(input.evidenceCount<=0)return "UNKNOWN";
 const score=Math.max(0,Math.min(1,input.quality))+Math.max(0,Math.min(1,input.freshness))+Math.max(0,Math.min(1,input.consistency))+Math.max(0,Math.min(1,input.reproducibility))+(input.simulationValidated?1:0)+(input.experimentValidated?1:0)+(input.evidenceCount>=10?1:0);
 return score>=6?"VERIFIED":score>=4.5?"HIGH":score>=3?"MEDIUM":"LOW";
}
export function classifyPrediction(input:{predicted:unknown;actual:unknown;confidence:string;conservativeSafetyDecision?:boolean}){
 if(input.predicted===undefined||input.actual===undefined)return "UNVERIFIABLE";
 if(JSON.stringify(stable(input.predicted))===JSON.stringify(stable(input.actual)))return "CORRECT";
 if(input.conservativeSafetyDecision)return "PARTIALLY_CORRECT";
 if(["LOW","UNKNOWN"].includes(input.confidence))return "INCONCLUSIVE";
 return "INCORRECT";
}
export function classifyDecisionQuality(input:{outcomeStatus:string;falsePositive:boolean;falseNegative:boolean;confidence:string;conservativeSafetyDecision:boolean}){
 if(["UNKNOWN","INCONCLUSIVE"].includes(input.outcomeStatus))return "INCONCLUSIVE";
 if(input.falseNegative)return "INSUFFICIENTLY_CONSERVATIVE";
 if(input.falsePositive&&input.conservativeSafetyDecision)return "OVERLY_CONSERVATIVE";
 if(input.outcomeStatus==="SUCCESS"&&input.confidence==="VERIFIED")return "OPTIMAL";
 if(input.outcomeStatus==="SUCCESS")return "ACCEPTABLE";
 if(input.conservativeSafetyDecision)return "CONSERVATIVE";
 return "INCORRECT";
}
export function classifySafety(input:{affectedSystems:string[];proposedBehavior:unknown;simulationRequired:boolean}){
 const text=JSON.stringify(input.proposedBehavior);
 if(/payment|financial|destructive.?database|qikink|security.?control|privacy.?control|authentication|governance.?bypass/i.test(text))return "PROHIBITED";
 if(input.affectedSystems.some(x=>/payment|database|security|privacy|authentication|fulfillment/i.test(x)))return "HIGH";
 if(input.simulationRequired)return "MEDIUM";
 return "LOW";
}

export async function captureOutcome(input:{pipelineId:string;releaseId?:string;deploymentId?:string;changeRequestId?:string;deliveryDecisionId?:string;environment:string;target:string;artifactVersion?:string;policyVersion?:string;algorithmVersion?:string;expectedOutcome:unknown;actualOutcome:unknown;outcomeStatus:string;customerImpact?:unknown;operationalImpact?:unknown;reliabilityImpact?:unknown;performanceImpact?:unknown;securityImpact?:unknown;privacyImpact?:unknown;costImpact?:unknown;capacityImpact?:unknown;rollbackOccurred?:boolean;recoveryOccurred?:boolean;incidentOccurred?:boolean;evidenceReference?:unknown;startedAt?:string;completedAt?:string;idempotencyKey:string}){
 if(!input.idempotencyKey||input.idempotencyKey.length>255)throw new Error("A bounded idempotency key is required.");
 return db.deliveryLearningOutcome.upsert({where:{idempotencyKey:input.idempotencyKey},create:{pipelineId:input.pipelineId,releaseId:input.releaseId,deploymentId:input.deploymentId,changeRequestId:input.changeRequestId,deliveryDecisionId:input.deliveryDecisionId,environment:input.environment,target:input.target,artifactVersion:input.artifactVersion,policyVersion:input.policyVersion,algorithmVersion:input.algorithmVersion??ALGORITHM_VERSION,expectedOutcome:json(input.expectedOutcome),actualOutcome:json(input.actualOutcome),outcomeStatus:input.outcomeStatus,customerImpact:json(input.customerImpact??{}),operationalImpact:json(input.operationalImpact??{}),reliabilityImpact:json(input.reliabilityImpact??{}),performanceImpact:json(input.performanceImpact??{}),securityImpact:json(input.securityImpact??{}),privacyImpact:json(input.privacyImpact??{}),costImpact:json(input.costImpact??{}),capacityImpact:json(input.capacityImpact??{}),rollbackOccurred:!!input.rollbackOccurred,recoveryOccurred:!!input.recoveryOccurred,incidentOccurred:!!input.incidentOccurred,certificationStatus:"PENDING",evidenceReference:json({reference:input.evidenceReference??{},integrityHash:hash({expectedOutcome:input.expectedOutcome,actualOutcome:input.actualOutcome,evidenceReference:input.evidenceReference??{}})}),startedAt:input.startedAt?new Date(input.startedAt):undefined,completedAt:input.completedAt?new Date(input.completedAt):undefined,idempotencyKey:input.idempotencyKey},update:{actualOutcome:json(input.actualOutcome),outcomeStatus:input.outcomeStatus,completedAt:input.completedAt?new Date(input.completedAt):undefined}});
}
export async function evaluatePrediction(input:{pipelineId:string;outcomeId:string;predictionType:string;predictionValue:unknown;actualValue:unknown;confidence:string;predictionVersion:string;conservativeSafetyDecision?:boolean;evidence?:unknown}){
 const errorClass=classifyPrediction(input);const exact=JSON.stringify(stable(input.predictionValue))===JSON.stringify(stable(input.actualValue));
 return db.predictionEvaluation.create({data:{pipelineId:input.pipelineId,outcomeId:input.outcomeId,predictionType:input.predictionType,predictionValue:json(input.predictionValue),actualValue:json(input.actualValue),error:json(exact?{absolute:0}:{comparison:"non-identical"}),errorClass,confidence:input.confidence,calibrationStatus:errorClass==="CORRECT"?"CALIBRATED":["INCONCLUSIVE","UNVERIFIABLE"].includes(errorClass)?"INSUFFICIENT_EVIDENCE":"REVIEW_REQUIRED",predictionVersion:input.predictionVersion,evidence:json(input.evidence??{}),falsePositive:errorClass==="INCORRECT"&&!!input.conservativeSafetyDecision,falseNegative:errorClass==="INCORRECT"&&!input.conservativeSafetyDecision}});
}
export async function evaluateDecision(input:{pipelineId:string;outcomeId:string;deliveryDecisionId?:string;recommendation:string;expectedOutcome:unknown;actualOutcome:unknown;outcomeStatus:string;confidence:string;falsePositive?:boolean;falseNegative?:boolean;evidence?:unknown;conservativeSafetyDecision?:boolean}){
 const quality=classifyDecisionQuality({outcomeStatus:input.outcomeStatus,falsePositive:!!input.falsePositive,falseNegative:!!input.falseNegative,confidence:input.confidence,conservativeSafetyDecision:!!input.conservativeSafetyDecision});
 return db.decisionOutcomeEvaluation.create({data:{pipelineId:input.pipelineId,outcomeId:input.outcomeId,deliveryDecisionId:input.deliveryDecisionId,recommendation:input.recommendation,expectedOutcome:json(input.expectedOutcome),actualOutcome:json(input.actualOutcome),decisionQuality:quality,confidence:input.confidence,falsePositive:!!input.falsePositive,falseNegative:!!input.falseNegative,evidence:json(input.evidence??{})}});
}
export async function evaluateSignalQuality(input:{pipelineId:string;signal:string;observations:Array<{freshness:number;complete:boolean;consistent:boolean;stable:boolean;historical:number;predictive:number;noise:number;sourceReliable:boolean;provenance:unknown}>;version:string}){
 const o=input.observations.slice(0,1000);if(!o.length)throw new Error("Signal evaluation requires evidence.");
 const avg=(f:(x:typeof o[number])=>number)=>o.reduce((s,x)=>s+f(x),0)/o.length;
 const values={freshness:avg(x=>Math.max(0,Math.min(1,x.freshness))),completeness:avg(x=>x.complete?1:0),consistency:avg(x=>x.consistent?1:0),stability:avg(x=>x.stable?1:0),historical:avg(x=>Math.max(0,Math.min(1,x.historical))),predictive:avg(x=>Math.max(0,Math.min(1,x.predictive))),noise:avg(x=>Math.max(0,Math.min(1,x.noise))),source:avg(x=>x.sourceReliable?1:0)};
 const score=(values.freshness+values.completeness+values.consistency+values.stability+values.historical+values.predictive+values.source+(1-values.noise))/8;
 const status=score>=.8?"ACTIVE":score>=.55?"DEGRADED":score>=.3?"LOW_VALUE":"UNTRUSTED";
 return db.signalQualityEvaluation.create({data:{pipelineId:input.pipelineId,signal:input.signal,freshnessScore:json(values.freshness),completenessScore:json(values.completeness),consistencyScore:json(values.consistency),stabilityScore:json(values.stability),historicalUsefulness:json(values.historical),predictiveUsefulness:json(values.predictive),noise:json(values.noise),sourceReliability:json(values.source),provenance:json(o.map(x=>x.provenance).slice(0,20)),version:input.version,status,evidence:json({sampleSize:o.length,methodology:ALGORITHM_VERSION})}});
}
export async function analyzePatterns(input:{pipelineId:string;patterns:Array<{patternType:string;scope:unknown;conditions:unknown;evidenceCount:number;successRate:number;failureRate:number;confidence:string;validityWindow:unknown;associationType?:string;supportingEvidence?:unknown;counterEvidence?:unknown;provenance?:unknown}>}){
 return db.learningPattern.createMany({data:input.patterns.slice(0,100).map(p=>({pipelineId:input.pipelineId,patternType:p.patternType,scope:json(p.scope),conditions:json(p.conditions),evidenceCount:Math.max(0,Math.floor(p.evidenceCount)),successRate:json(p.successRate),failureRate:json(p.failureRate),confidence:p.confidence,validityWindow:json(p.validityWindow),algorithmVersion:ALGORITHM_VERSION,validationStatus:"ANALYZED",governanceStatus:"REVIEW_REQUIRED",associationType:p.associationType??"ASSOCIATION",supportingEvidence:json(p.supportingEvidence??{}),counterEvidence:json(p.counterEvidence??{}),provenance:json(p.provenance??{})}))});
}
export async function createOptimizationProposal(input:{pipelineId?:string;problem:string;evidence:unknown;currentBehavior:unknown;proposedBehavior:unknown;expectedBenefit:unknown;risk:unknown;affectedSystems:string[];affectedPolicies:unknown;affectedCustomers:unknown;cost:unknown;validationStrategy:unknown;rollbackStrategy:unknown;simulationRequired?:boolean;approvalRequired?:boolean;policyVersion?:string;createdBy:string;evidenceConfidence:string}){
 const safetyClass=classifySafety({affectedSystems:input.affectedSystems,proposedBehavior:input.proposedBehavior,simulationRequired:!!input.simulationRequired});if(safetyClass==="PROHIBITED")throw new Error("PROHIBITED optimization is not executable through learning.");
 const highRisk=["HIGH","CRITICAL"].includes(safetyClass);
 return db.optimizationProposal.create({data:{pipelineId:input.pipelineId,problem:input.problem.slice(0,4000),evidence:json(input.evidence),currentBehavior:json(input.currentBehavior),proposedBehavior:json(input.proposedBehavior),expectedBenefit:json(input.expectedBenefit),risk:json(input.risk),affectedSystems:json(input.affectedSystems),affectedPolicies:json(input.affectedPolicies),affectedCustomers:json(input.affectedCustomers),cost:json(input.cost),validationStrategy:json(input.validationStrategy),rollbackStrategy:json(input.rollbackStrategy),simulationRequired:!!input.simulationRequired||highRisk,approvalRequired:!!input.approvalRequired||highRisk,safetyClass,lifecycleState:"DRAFT",policyVersion:input.policyVersion,algorithmVersion:ALGORITHM_VERSION,reversible:true,evidenceConfidence:input.evidenceConfidence,createdBy:input.createdBy}});
}
export async function transitionProposal(input:{proposalId:string;toState:LearningState;actor:string;reason:string;evidence?:unknown}){
 const p=await db.optimizationProposal.findUnique({where:{id:input.proposalId}});if(!p)throw new Error("Optimization proposal was not found.");const from=p.lifecycleState as LearningState;
 if(!LEARNING_STATES.includes(input.toState)||!(transitions[from]??[]).includes(input.toState))throw new Error(`Invalid learning transition: ${from} -> ${input.toState}`);
 if(["APPROVED","STAGED","VALIDATING","VERIFIED","CERTIFIED"].includes(input.toState)&&["HIGH","CRITICAL"].includes(p.safetyClass)&&!p.approvalRequired)throw new Error("High-risk optimization requires approval.");
 return db.$transaction(async tx=>{const updated=await tx.optimizationProposal.update({where:{id:p.id},data:{lifecycleState:input.toState}});await tx.learningTransition.create({data:{proposalId:p.id,fromState:from,toState:input.toState,actor:input.actor,reason:input.reason.slice(0,2000),evidence:json(input.evidence??{})}});return updated;});
}
export async function createPolicy(input:{policyKey:string;policyVersion:string;scope:unknown;allowedSignals:unknown;prohibitedSignals:unknown;minimumEvidence:unknown;confidenceRequirements:unknown;validationRequirements:unknown;approvalRequirements:unknown;privacyConstraints:unknown;safetyConstraints:unknown;status:string;createdBy:string}){
 return db.learningPolicy.create({data:{policyKey:input.policyKey,policyVersion:input.policyVersion,scope:json(input.scope),allowedSignals:json(input.allowedSignals),prohibitedSignals:json(input.prohibitedSignals),minimumEvidence:json(input.minimumEvidence),confidenceRequirements:json(input.confidenceRequirements),validationRequirements:json(input.validationRequirements),approvalRequirements:json(input.approvalRequirements),privacyConstraints:json(input.privacyConstraints),safetyConstraints:json(input.safetyConstraints),status:input.status,createdBy:input.createdBy}});
}
export async function createExperiment(input:{proposalId?:string;pipelineId?:string;experimentKey:string;mode:"SIMULATION"|"STAGING"|"SYNTHETIC_PRODUCTION"|"CONTROLLED_PRODUCTION";hypothesis:string;baseline:unknown;treatment:unknown;scope:unknown;cohort:unknown;exposure:unknown;metrics:unknown;successCriteria:unknown;stopConditions:unknown;safetyConditions:unknown;expiresAt:string;createdBy:string;approved?:boolean}){
 if(/payment correctness|financial truth|order integrity|security controls|privacy controls|destructive database|qikink credentials|irreversible fulfillment/i.test(JSON.stringify(input.treatment)))throw new Error("Unsafe experiment treatment is prohibited.");
 const expires=new Date(input.expiresAt);if(Number.isNaN(expires.getTime())||expires.getTime()<=Date.now())throw new Error("Experiment expiry must be in the future.");
 if(input.mode==="CONTROLLED_PRODUCTION"&&!input.approved)throw new Error("Controlled production experiments require explicit approval.");
 return db.learningExperiment.create({data:{proposalId:input.proposalId,pipelineId:input.pipelineId,experimentKey:input.experimentKey,mode:input.mode,hypothesis:input.hypothesis.slice(0,4000),baseline:json(input.baseline),treatment:json(input.treatment),scope:json(input.scope),cohort:json(input.cohort),exposure:json(input.exposure),metrics:json(input.metrics),successCriteria:json(input.successCriteria),stopConditions:json(input.stopConditions),safetyConditions:json(input.safetyConditions),lifecycleState:"DRAFT",approved:!!input.approved,expiresAt:expires,createdBy:input.createdBy}});
}
export async function certifyProposal(input:{proposalId:string;actor:string;policyVersion:string;algorithmVersion:string;evidence:unknown;knownLimitations:unknown;unresolvedRisks:unknown;rollbackReadiness:unknown;checks:{implementationStatus:string;testStatus:string;securityStatus:string;privacyStatus:string;dataIntegrityStatus:string;operationalStatus:string;governanceStatus:string;documentationStatus:string}}){
 const p=await db.optimizationProposal.findUnique({where:{id:input.proposalId}});if(!p)throw new Error("Optimization proposal was not found.");if(p.lifecycleState!=="VERIFIED")throw new Error("Only VERIFIED proposals may be certified.");
 return db.learningCertification.create({data:{proposalId:p.id,pipelineId:p.pipelineId,status:"CERTIFIED",...input.checks,evidence:json(input.evidence),knownLimitations:json(input.knownLimitations),unresolvedRisks:json(input.unresolvedRisks),rollbackReadiness:json(input.rollbackReadiness),policyVersion:input.policyVersion,algorithmVersion:input.algorithmVersion,immutable:true}});
}
export async function listLearning(input:{limit?:number;offset?:number;state?:string;confidence?:string;risk?:string}){const take=bounded(input.limit??50);return db.optimizationProposal.findMany({take,skip:Math.max(0,Math.floor(input.offset??0)),orderBy:{updatedAt:"desc"},where:{...(input.state?{lifecycleState:input.state}:{}),...(input.confidence?{evidenceConfidence:input.confidence}:{}),...(input.risk?{safetyClass:input.risk}:{})}});}
export async function listOutcomes(limit=50){return db.deliveryLearningOutcome.findMany({take:bounded(limit),orderBy:{createdAt:"desc"}});}
export async function getOutcome(id:string){return db.deliveryLearningOutcome.findUnique({where:{id},include:{predictionEvaluations:true,decisionEvaluations:true,observations:true}});}
export async function listExperiments(limit=50){return db.learningExperiment.findMany({take:bounded(limit),orderBy:{createdAt:"desc"}});}
export async function listPolicies(limit=50){return db.learningPolicy.findMany({take:bounded(limit),orderBy:{createdAt:"desc"}});}
export async function expireLearning(){return db.learningExperiment.updateMany({where:{expiresAt:{lte:new Date()},lifecycleState:{notIn:["CERTIFIED","EXPIRED"]}},data:{lifecycleState:"EXPIRED"}});}
