import { Prisma } from "@prisma/client";
import { db } from "@/lib/db/client";
import { evaluatePromotion, type PromotionInput } from "@/lib/delivery-intelligence/service";

export const DECISION_STATES = [
  "CREATED","CONTEXT_COLLECTING","SIGNALS_COLLECTING","HISTORICAL_ANALYSIS","DEPENDENCY_ANALYSIS",
  "RISK_ANALYSIS","RECOMMENDATION_GENERATED","GOVERNANCE_REVIEW","DECISION_ACCEPTED","VALIDATION",
  "OUTCOME_CAPTURED","LEARNING_RECORDED","HOLD","BLOCKED","INVALIDATED","EXPIRED","FAILED","SUPERSEDED","REJECTED",
] as const;
export type DecisionState = typeof DECISION_STATES[number];

export const RECOMMENDATIONS = [
  "PROCEED","PROCEED_WITH_APPROVAL","PROCEED_WITH_ADDITIONAL_VALIDATION","REDUCE_EXPOSURE","HOLD","BLOCK",
  "REQUIRE_SIMULATION","REQUIRE_REHEARSAL","REQUIRE_MANUAL_REVIEW",
] as const;
export type RecommendationType = typeof RECOMMENDATIONS[number];

export const RISK_DIMENSIONS = [
  "CHANGE_RISK","DEPENDENCY_RISK","OPERATIONAL_RISK","RELIABILITY_RISK","CUSTOMER_IMPACT_RISK",
  "SECURITY_RISK","PRIVACY_RISK","DATABASE_RISK","PAYMENT_RISK","PROVIDER_RISK","HISTORICAL_RISK","CAPACITY_RISK",
] as const;

export const SIGNAL_QUALITY = ["VALID","STALE","MISSING","CONFLICTING","LOW_QUALITY","UNTRUSTED","UNAVAILABLE"] as const;
export const CONFIDENCE = ["UNKNOWN","LOW","MEDIUM","HIGH","VERIFIED"] as const;
export const ALGORITHM_VERSION = "15.39-deterministic-v1";

type JsonMap = Record<string, unknown>;
export type DecisionSignalInput = {
  signalType:string; value:unknown; source:string; sourceVersion:string; observedAt:string;
  freshnessSeconds?:number; quality:(typeof SIGNAL_QUALITY)[number]; confidence:(typeof CONFIDENCE)[number];
  scope?:unknown; provenance?:unknown;
};
export type HistoricalOutcomeInput = {
  id?:string; environment:string; strategy:string; changeType:string; service?:string;
  dependencyFingerprint?:string; migrationPresent?:boolean; traffic?:unknown; customerSegment?:unknown;
  risk?:unknown; outcome:string; incidents?:unknown; customerImpact?:unknown; rollback?:unknown;
  recovery?:unknown; performance?:unknown; cost?:unknown; confidence:(typeof CONFIDENCE)[number];
  evidence?:unknown; occurredAt:string;
};
export type DecisionContext = {
  pipelineId:string; changeRequestId?:string; releaseId?:string; deploymentId?:string; deliveryRunId?:string;
  environment:string; target:string; artifactVersion?:string; dependencySnapshotId?:string; graphSnapshotId?:string;
  healthSnapshotId?:string; featureFlagSnapshotId?:string; policyVersion:string; expiresAt:string;
  promotionInput?:PromotionInput; affectedServices?:string[]; affectedDomains?:string[]; customerJourneys?:string[];
  databaseChange?:boolean; paymentChange?:boolean; fulfillmentChange?:boolean; securityChange?:boolean;
  missingContext?:string[];
};

const rank:Record<string,number>={LOW:1,MEDIUM:2,HIGH:3,CRITICAL:4,PROHIBITED:5};
const stable=(v:unknown):unknown=>Array.isArray(v)?v.map(stable):v&&typeof v==="object"?Object.fromEntries(Object.entries(v as JsonMap).sort(([a],[b])=>a.localeCompare(b)).map(([k,x])=>[k,stable(x)])):v;
const json=(v:unknown)=>JSON.parse(JSON.stringify(v)) as Prisma.InputJsonValue;
const normalize=(v:unknown)=>typeof v==="string"?v.trim().toUpperCase():"UNKNOWN";

export type RiskDimension = { classification:string; evidence:string[]; confidence:string; source:string; evaluatedAt:string; policyVersion:string };
export type DecisionEvaluation = {
 recommendation:RecommendationType; risk:string; riskDimensions:Record<string,RiskDimension>; confidence:string;
 primaryReasons:string[]; supportingSignals:string[]; conflictingSignals:string[]; historicalEvidence:unknown[];
 dependencyEvidence:unknown[]; customerImpactEvidence:unknown[]; limitations:string[]; nextRequiredAction:string;
 missingContext:string[]; algorithmVersion:string;
};

function compare(current:DecisionContext,outcome:HistoricalOutcomeInput){
  const dimensions:Record<string,number>={environment:current.environment, strategy:current.promotionInput?.signals?.featureFlags?.status??"UNKNOWN", changeType:current.databaseChange?"DATABASE":current.paymentChange?"PAYMENT":"GENERAL"};
  const matched:string[]=[]; const mismatched:string[]=[];
  const checks:[string,string,string|undefined][]=[
    ["environment",current.environment,outcome.environment],["strategy",current.promotionInput?.signals?.featureFlags?.status,outcome.strategy],
    ["changeType",current.databaseChange?"DATABASE":current.paymentChange?"PAYMENT":"GENERAL",outcome.changeType],
    ["service",current.affectedServices?.[0],outcome.service],
  ];
  for(const [key,a,b] of checks){if(a&&b){if(normalize(a)===normalize(b))matched.push(key);else mismatched.push(key);}}
  const similarity=checks.filter(([,a,b])=>a&&b).length?matched.length/checks.filter(([,a,b])=>a&&b).length:0;
  return {similarity,matched,mismatched,dimensions};
}

function classifyRisk(evaluation:{riskLevel:string;blockers:string[];requiredValidations:string[];decision:string},context:DecisionContext,history:HistoricalOutcomeInput[]){
  const now=new Date().toISOString();
  const dims:Record<string,RiskDimension>={};
  const add=(key:string,classification:string,evidence:string[],confidence:string,source="Phase15.38 promotion evaluation")=>{
    dims[key]={classification,evidence,confidence,source,evaluatedAt:now,policyVersion:context.policyVersion};
  };
  const r=evaluation.riskLevel;
  add("CHANGE_RISK",r,context.databaseChange||context.paymentChange?["material_change_type"]:["promotion_context"],"HIGH");
  add("DEPENDENCY_RISK",r,evaluation.blockers.filter(x=>x.startsWith("DEPENDENCY")),"HIGH");
  add("OPERATIONAL_RISK",evaluation.blockers.some(x=>x.startsWith("INCIDENT"))?"HIGH":"LOW",evaluation.blockers.filter(x=>x.startsWith("INCIDENT")),"MEDIUM");
  add("RELIABILITY_RISK",evaluation.blockers.includes("SLO_BLOCK")?"HIGH":"LOW",evaluation.blockers.filter(x=>x.includes("SLO")),"HIGH");
  add("CUSTOMER_IMPACT_RISK",context.customerJourneys?.length?"MEDIUM":"LOW",context.customerJourneys??[],"MEDIUM");
  add("SECURITY_RISK",evaluation.blockers.some(x=>x.includes("SECURITY"))?"CRITICAL":"LOW",evaluation.blockers.filter(x=>x.includes("SECURITY")),"VERIFIED");
  add("PRIVACY_RISK",evaluation.blockers.some(x=>x.includes("PRIVACY"))?"HIGH":"LOW",evaluation.blockers.filter(x=>x.includes("PRIVACY")),"HIGH");
  add("DATABASE_RISK",context.databaseChange?(evaluation.requiredValidations.includes("MIGRATION_SAFETY")?"HIGH":"MEDIUM"):"LOW",context.databaseChange?["database_change"]:[],"HIGH");
  add("PAYMENT_RISK",context.paymentChange?"HIGH":"LOW",context.paymentChange?["payment_change"]:[],"HIGH");
  add("PROVIDER_RISK",context.fulfillmentChange?"MEDIUM":"LOW",context.fulfillmentChange?["fulfillment_change"]:[],"MEDIUM");
  const adverse=history.filter(h=>["FAILED","ROLLBACK","INCIDENT"].includes(normalize(h.outcome))).length;
  add("HISTORICAL_RISK",adverse?"HIGH":"LOW",adverse?[String(adverse)+" adverse comparable outcomes"]:[],"MEDIUM");
  const cap=context.promotionInput?.signals?.capacity;
  add("CAPACITY_RISK",cap?.exhaustionRisk||cap?.costRisk?"HIGH":"LOW",cap?.exhaustionRisk||cap?.costRisk?["capacity_or_cost_risk"]:[],"MEDIUM");
  return dims;
}

function highestRisk(dims:Record<string,RiskDimension>){
  return Object.values(dims).reduce((best,x)=>(rank[x.classification]??0)>(rank[best]??0)?x.classification:best,"LOW");
}

export function evaluateDecision(context:DecisionContext,signals:DecisionSignalInput[],history:HistoricalOutcomeInput[]=[]):DecisionEvaluation{
  const missing=[...(context.missingContext??[])];
  const required=[["dependencySnapshotId",context.dependencySnapshotId],["graphSnapshotId",context.graphSnapshotId],["healthSnapshotId",context.healthSnapshotId]];
  for(const [name,value] of required)if(!value)missing.push(name);
  for(const s of signals)if(s.quality!=="VALID")missing.push("signal:"+s.signalType+":"+s.quality);
  const promotion=context.promotionInput;
  const promotionResult=promotion?evaluatePromotion(promotion):null;
  const dims=classifyRisk(promotionResult??{riskLevel:"UNKNOWN",blockers:[],requiredValidations:[],decision:"HOLD"},context,history);
  const primary:string[]=[]; const supporting:string[]=[]; const conflicting:string[]=[]; const limitations:string[]=[];
  if(promotionResult){
    primary.push(...promotionResult.blockers.map(x=>"Existing promotion gate: "+x));
    supporting.push(...promotionResult.warnings.map(x=>"Existing delivery signal: "+x));
  } else primary.push("No Phase 15.38 promotion assessment was supplied.");
  if(missing.length)limitations.push("Decision context contains missing, stale, or non-valid signals; absence is not treated as healthy.");
  const similarityRows=history.map(h=>({outcome:h,comparison:compare(context,h)}));
  const comparable=similarityRows.filter(x=>x.comparison.similarity>=0.5);
  const adverse=comparable.filter(x=>["FAILED","ROLLBACK","INCIDENT"].includes(normalize(x.outcome.outcome)));
  if(adverse.length)primary.push("Comparable historical deliveries include adverse outcomes.");
  else if(comparable.length)supporting.push("Comparable historical deliveries do not show an adverse outcome.");
  if(history.length&&!comparable.length)limitations.push("Historical outcomes were not sufficiently comparable.");
  const risk=highestRisk(dims);
  let recommendation:RecommendationType="PROCEED";
  if(risk==="CRITICAL"||risk==="PROHIBITED"||promotionResult?.decision==="PROHIBIT")recommendation="BLOCK";
  else if(promotionResult?.decision==="BLOCK")recommendation="BLOCK";
  else if(missing.length>=2)recommendation="HOLD";
  else if(context.paymentChange||context.databaseChange&&promotionResult?.requiredApprovals.length)recommendation="PROCEED_WITH_APPROVAL";
  else if(promotionResult?.requiredValidations.length)recommendation="PROCEED_WITH_ADDITIONAL_VALIDATION";
  else if(adverse.length)recommendation="REDUCE_EXPOSURE";
  if(context.securityChange&&risk==="HIGH")recommendation="REQUIRE_MANUAL_REVIEW";
  if(context.promotionInput?.signals?.simulation?.required&&recommendation==="PROCEED")recommendation="REQUIRE_SIMULATION";
  if(context.promotionInput?.signals?.resilience?.required&&recommendation==="PROCEED")recommendation="REQUIRE_REHEARSAL";
  if(promotionResult?.decision==="HOLD")recommendation="HOLD";
  const valid=signals.filter(s=>s.quality==="VALID").length;
  const confidence=missing.length===0&&valid>=3&&comparable.length>0?"HIGH":missing.length===0&&valid>=2?"MEDIUM":missing.length===0?"LOW":"UNKNOWN";
  if(recommendation==="PROCEED"&&confidence==="HIGH"&&promotionResult?.confidence==="VERIFIED")supporting.push("Deterministic promotion evaluation is verified and decision inputs are complete.");
  if(promotionResult?.decision==="ALLOW_WITH_APPROVAL")primary.push("Existing governance requires explicit approval.");
  if(promotionResult?.decision==="ALLOW_WITH_ADDITIONAL_VALIDATION")primary.push("Existing governance requires additional validation.");
  const next=recommendation==="PROCEED"?"Continue through the existing Phase 15.37 orchestration and Phase 15.35 rollout controls.":recommendation==="REDUCE_EXPOSURE"?"Use the existing progressive-delivery engine with reduced exposure.":recommendation==="REQUIRE_SIMULATION"?"Run the governed simulation and reevaluate; do not execute it from decision intelligence.":recommendation==="REQUIRE_REHEARSAL"?"Run the governed rehearsal and reevaluate; do not execute it from decision intelligence.":recommendation==="PROCEED_WITH_APPROVAL"?"Obtain the required governance approval before promotion.":recommendation==="PROCEED_WITH_ADDITIONAL_VALIDATION"?"Complete the listed validation controls before promotion.":recommendation==="HOLD"?"Resolve missing/unstable evidence and reevaluate.":recommendation==="BLOCK"?"Resolve blocking policy/risk conditions through existing governance.":"Escalate to authorized manual review.";
  return {recommendation,risk,riskDimensions:dims,confidence,primaryReasons:primary,supportingSignals:supporting,conflictingSignals:conflicting,historicalEvidence:comparable.slice(0,20),dependencyEvidence:context.promotionInput?.dependencies??[],customerImpactEvidence:context.customerJourneys??[],limitations,nextRequiredAction:next,missingContext:missing,algorithmVersion:ALGORITHM_VERSION};
}

export async function createDecision(input:{context:DecisionContext;signals:DecisionSignalInput[];history?:HistoricalOutcomeInput[];actorId:string}){
  const evaluation=evaluateDecision(input.context,input.signals,input.history??[]);
  const profile=await db.deliveryDecisionProfile.create({data:{
    pipelineId:input.context.pipelineId,changeRequestId:input.context.changeRequestId,releaseId:input.context.releaseId,deploymentId:input.context.deploymentId,
    deliveryRunId:input.context.deliveryRunId,environment:input.context.environment,target:input.context.target,artifactVersion:input.context.artifactVersion,
    dependencySnapshotId:input.context.dependencySnapshotId,graphSnapshotId:input.context.graphSnapshotId,healthSnapshotId:input.context.healthSnapshotId,
    featureFlagSnapshotId:input.context.featureFlagSnapshotId,policyVersion:input.context.policyVersion,algorithmVersion:ALGORITHM_VERSION,
    status:"RECOMMENDATION_GENERATED",context:json(input.context),missingContext:json(evaluation.missingContext),
  }});
  if(input.signals.length)await db.deliverySignal.createMany({data:input.signals.map(s=>({profileId:profile.id,pipelineId:input.context.pipelineId,signalType:s.signalType,value:json(s.value),source:s.source,sourceVersion:s.sourceVersion,observedAt:new Date(s.observedAt),freshnessSeconds:s.freshnessSeconds,quality:s.quality,confidence:s.confidence,scope:json(s.scope??{}),provenance:json(s.provenance??{} )}))});
  const historical=input.history??[];
  const comparisons=historical.map(h=>({id:h.id??null,...compare(input.context,h),outcome:h.outcome})).filter(x=>x.similarity>=0.5).slice(0,20);
  await db.historicalDeliveryOutcome.createMany({data:historical.slice(0,100).map(h=>({pipelineId:input.context.pipelineId,environment:h.environment,strategy:h.strategy,changeType:h.changeType,service:h.service,dependencyFingerprint:h.dependencyFingerprint,migrationPresent:h.migrationPresent??false,traffic:json(h.traffic??{}),customerSegment:json(h.customerSegment??{}),risk:json(h.risk??{}),outcome:h.outcome,incidents:json(h.incidents??{}),customerImpact:json(h.customerImpact??{}),rollback:json(h.rollback??{}),recovery:json(h.recovery??{}),performance:json(h.performance??{}),cost:json(h.cost??{}),confidence:h.confidence,evidence:json(h.evidence??{}),occurredAt:new Date(h.occurredAt)}))});
  await db.deliverySimilarityAssessment.create({data:{profileId:profile.id,pipelineId:input.context.pipelineId,similarityDimensions:json(comparisons.map(x=>x.dimensions)),matchedDimensions:json(comparisons.map(x=>x.matched)),mismatchedDimensions:json(comparisons.map(x=>x.mismatched)),similarityConfidence:comparisons.length?"HIGH":"LOW",evidence:json(comparisons),limitations:json(evaluation.limitations),comparedOutcomeIds:json(comparisons.map(x=>x.id).filter(Boolean))}});
  const rec=await db.deliveryRecommendation.create({data:{profileId:profile.id,pipelineId:input.context.pipelineId,recommendation:evaluation.recommendation,rationale:json({primaryReasons:evaluation.primaryReasons,nextRequiredAction:evaluation.nextRequiredAction}),evidence:json({supportingSignals:evaluation.supportingSignals,historicalEvidence:evaluation.historicalEvidence,dependencyEvidence:evaluation.dependencyEvidence,customerImpactEvidence:evaluation.customerImpactEvidence}),conflictingSignals:json(evaluation.conflictingSignals),risk:json(evaluation.riskDimensions),affectedScope:json({target:input.context.target,services:input.context.affectedServices??[],domains:input.context.affectedDomains??[],journeys:input.context.customerJourneys??[]}),confidence:evaluation.confidence,policyVersion:input.context.policyVersion,algorithmVersion:ALGORITHM_VERSION,limitations:json(evaluation.limitations),nextRequiredAction:evaluation.nextRequiredAction,status:"GENERATED",expiresAt:new Date(input.context.expiresAt)}});
  await db.deliveryDecisionTransition.create({data:{profileId:profile.id,pipelineId:input.context.pipelineId,previousState:"CREATED",newState:"RECOMMENDATION_GENERATED",actorType:"SYSTEM",actorId:input.actorId,reason:"Deterministic decision recommendation generated.",evidence:json({recommendationId:rec.id,algorithmVersion:ALGORITHM_VERSION,missingContext:evaluation.missingContext})}});
  return {profile,recommendation:rec,evaluation};
}

const transitions:Record<DecisionState,DecisionState[]>={
 CREATED:["CONTEXT_COLLECTING","FAILED"],CONTEXT_COLLECTING:["SIGNALS_COLLECTING","FAILED"],SIGNALS_COLLECTING:["HISTORICAL_ANALYSIS","FAILED"],
 HISTORICAL_ANALYSIS:["DEPENDENCY_ANALYSIS","FAILED"],DEPENDENCY_ANALYSIS:["RISK_ANALYSIS","FAILED"],RISK_ANALYSIS:["RECOMMENDATION_GENERATED","FAILED"],
 RECOMMENDATION_GENERATED:["GOVERNANCE_REVIEW","HOLD","BLOCK","REQUIRE_MANUAL_REVIEW" as DecisionState,"FAILED"],GOVERNANCE_REVIEW:["DECISION_ACCEPTED","HOLD","BLOCKED","REJECTED"],
 DECISION_ACCEPTED:["VALIDATION","HOLD","BLOCKED"],VALIDATION:["OUTCOME_CAPTURED","FAILED"],OUTCOME_CAPTURED:["LEARNING_RECORDED"],LEARNING_RECORDED:[],
 HOLD:["CONTEXT_COLLECTING","INVALIDATED","EXPIRED"],BLOCKED:["CONTEXT_COLLECTING","INVALIDATED","EXPIRED"],INVALIDATED:[],EXPIRED:[],FAILED:["CONTEXT_COLLECTING"],SUPERSEDED:[],REJECTED:["CONTEXT_COLLECTING"],
};
export async function transitionDecision(profileId:string,newState:DecisionState,actorId:string,reason:string,evidence:unknown={}){
  const p=await db.deliveryDecisionProfile.findUnique({where:{id:profileId}});if(!p)throw new Error("Decision profile was not found.");
  const prev=p.status as DecisionState;if(!DECISION_STATES.includes(newState)||!(transitions[prev]??[]).includes(newState))throw new Error(`Invalid decision transition: ${prev} -> ${newState}`);
  return db.$transaction(async tx=>{
    const updated=await tx.deliveryDecisionProfile.update({where:{id:profileId},data:{status:newState}});
    await tx.deliveryDecisionTransition.create({data:{profileId,pipelineId:p.pipelineId,previousState:prev,newState,actorType:actorId==="SYSTEM"?"SYSTEM":"ADMIN",actorId,reason:reason.slice(0,2000),evidence:json(evidence)}});
    return updated;
  });
}

export async function recordOutcome(input:{profileId:string;recommendationId?:string;actorId:string;actualOutcome:string;incidentOutcome?:unknown;customerImpact?:unknown;performance?:unknown;reliability?:unknown;rollback?:unknown;recovery?:unknown;cost?:unknown;capacity?:unknown;recommendationAccuracy:string;riskAccuracy:string;confidenceCalibration:string;falsePositive:boolean;falseNegative:boolean;evidence?:unknown}){
 const p=await db.deliveryDecisionProfile.findUnique({where:{id:input.profileId}});if(!p)throw new Error("Decision profile was not found.");
 const out=await db.deliveryRecommendationOutcome.create({data:{profileId:p.id,pipelineId:p.pipelineId,recommendationId:input.recommendationId,actualOutcome:input.actualOutcome,incidentOutcome:json(input.incidentOutcome??{}),customerImpact:json(input.customerImpact??{}),performance:json(input.performance??{}),reliability:json(input.reliability??{}),rollback:json(input.rollback??{}),recovery:json(input.recovery??{}),cost:json(input.cost??{}),capacity:json(input.capacity??{}),recommendationAccuracy:input.recommendationAccuracy,riskAccuracy:input.riskAccuracy,confidenceCalibration:input.confidenceCalibration,falsePositive:input.falsePositive,falseNegative:input.falseNegative,evidence:json(input.evidence??{})}});
 await transitionDecision(p.id,"OUTCOME_CAPTURED",input.actorId,"Outcome evidence captured.",{outcomeId:out.id}); return out;
}

export async function getDecision(id:string){return db.deliveryDecisionProfile.findUnique({where:{id},include:{signals:true,recommendations:true,similarityAssessments:true,transitions:{orderBy:{createdAt:"asc"}},outcomes:true}});}
export async function listDecisions(limit=50){return db.deliveryDecisionProfile.findMany({take:Math.min(Math.max(limit,1),100),orderBy:{createdAt:"desc"},include:{recommendations:true}});}
export async function createPolicy(input:{policyKey:string;version:string;scope:unknown;status:"DRAFT"|"REVIEW"|"APPROVED"|"ACTIVE"|"SUPERSEDED"|"RETIRED";riskRules:unknown;signalRequirements:unknown;approvalRequirements:unknown;simulationRequirements:unknown;rehearsalRequirements:unknown;prohibitedActions:unknown;effectiveAt?:string;expiresAt?:string;createdBy:string;pipelineId?:string}){
 const existing=await db.decisionIntelligencePolicy.findUnique({where:{policyKey_version:{policyKey:input.policyKey,version:input.version}}});
 if(existing&&["ACTIVE","SUPERSEDED","RETIRED"].includes(existing.status))throw new Error("Decision-intelligence policy versions are immutable.");
 if(existing)return db.decisionIntelligencePolicy.update({where:{id:existing.id},data:{status:input.status}});
 return db.decisionIntelligencePolicy.create({data:{policyKey:input.policyKey,version:input.version,scope:json(input.scope),status:input.status,riskRules:json(input.riskRules),signalRequirements:json(input.signalRequirements),approvalRequirements:json(input.approvalRequirements),simulationRequirements:json(input.simulationRequirements),rehearsalRequirements:json(input.rehearsalRequirements),prohibitedActions:json(input.prohibitedActions),effectiveAt:input.effectiveAt?new Date(input.effectiveAt):undefined,expiresAt:input.expiresAt?new Date(input.expiresAt):undefined,createdBy:input.createdBy,pipelineId:input.pipelineId}});
}
export async function listPolicies(limit=50){return db.decisionIntelligencePolicy.findMany({take:Math.min(Math.max(limit,1),100),orderBy:{createdAt:"desc"}});}
export async function createExperiment(input:{experimentKey:string;hypothesis:string;baseline:unknown;treatment:unknown;scope:unknown;cohort:unknown;metrics:unknown;successCriteria:unknown;stopConditions:unknown;safetyConditions:unknown;durationSeconds:number;policyVersion:string;createdBy:string;pipelineId?:string}){
 if(input.durationSeconds<60||input.durationSeconds>31_536_000)throw new Error("Experiment duration must be bounded to 60 seconds through one year.");
 return db.deliveryDecisionExperiment.create({data:{experimentKey:input.experimentKey,hypothesis:input.hypothesis.slice(0,2000),baseline:json(input.baseline),treatment:json(input.treatment),scope:json(input.scope),cohort:json(input.cohort),metrics:json(input.metrics),successCriteria:json(input.successCriteria),stopConditions:json(input.stopConditions),safetyConditions:json(input.safetyConditions),durationSeconds:Math.floor(input.durationSeconds),policyVersion:input.policyVersion,createdBy:input.createdBy,pipelineId:input.pipelineId}});
}
export async function expireStaleRecommendations(){
 const now=new Date();
 return db.deliveryRecommendation.updateMany({where:{expiresAt:{lte:now},status:"GENERATED"},data:{status:"EXPIRED"}});
}
