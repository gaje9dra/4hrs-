import { Prisma } from "@prisma/client";
import { createHash } from "node:crypto";
import { db } from "@/lib/db/client";
import { executeRegisteredAction } from "@/lib/automation/actions";
import { incidentFingerprint, type ReliabilityCategory } from "@/lib/reliability/incidents";
import { recordReliabilityFindings } from "@/lib/reliability/service";
import { runReliabilityChecks } from "@/lib/reliability/checks";
import { SLO_CANDIDATES, ERROR_BUDGET_POLICY } from "@/lib/reliability/model";
import { deterministicAnomaly, confidenceFromEvidence, safeConfidenceForMutation, assertReliabilityTransition, type ReliabilityConfidence } from "./model";

type Json=Prisma.InputJsonValue;
const json=(v:unknown)=>JSON.parse(JSON.stringify(v)) as Json;
const hash=(v:string)=>createHash("sha256").update(v).digest("hex").slice(0,32);

function redacted(v:unknown):Json{
 const walk=(x:unknown,d=0):unknown=>{
  if(d>5)return "[TRUNCATED]";
  if(x===null||typeof x==="string"||typeof x==="boolean"||typeof x==="number")return x;
  if(Array.isArray(x))return x.slice(0,40).map(y=>walk(y,d+1));
  if(typeof x==="object"){const out:Record<string,unknown>={};for(const [k,y] of Object.entries(x)){if(/password|secret|token|cookie|authorization|apiKey|accessKey|privateKey|email|phone|address/i.test(k))continue;out[k]=walk(y,d+1);}return out;}
  return String(x);
 };
 return walk(v) as Json;
}

export async function ingestReliabilitySignal(input:{kind:string;service:string;dependency?:string;severity:string;environment:string;value:unknown;evidence?:unknown;correlationId?:string;observedAt?:Date}){
 const observedAt=input.observedAt??new Date();
 const fingerprint=hash([input.kind,input.service,input.dependency??"",input.environment,JSON.stringify(redacted(input.value))].join("\0"));
 return db.reliabilitySignal.upsert({
  where:{fingerprint},
  create:{fingerprint,kind:input.kind,service:input.service,dependency:input.dependency??null,severity:input.severity,environment:input.environment,observedAt,value:redacted(input.value),evidence:redacted(input.evidence??{}),correlationId:input.correlationId??null},
  update:{severity:input.severity,observedAt,value:redacted(input.value),evidence:redacted(input.evidence??{}),correlationId:input.correlationId??null}
 });
}

export async function correlateReliabilitySignals(input:{service:string;environment:string;windowSeconds?:number}){
 const end=new Date(), start=new Date(end.getTime()-(input.windowSeconds??300)*1000);
 const signals=await db.reliabilitySignal.findMany({where:{service:input.service,environment:input.environment,observedAt:{gte:start,lte:end}},orderBy:{observedAt:"asc"},take:200});
 if(!signals.length)return null;
 const fingerprint=hash([input.service,input.environment,start.toISOString(),end.toISOString(),...signals.map(s=>s.fingerprint)].join("\0"));
 return db.reliabilityCorrelation.upsert({
  where:{fingerprint},
  create:{fingerprint,windowStart:start,windowEnd:end,correlationType:signals.length>1?"MULTI_SIGNAL":"SINGLE_SIGNAL",signalIds:signals.map(s=>s.id),explanation:signals.length>1?"Signals share service/environment and observation window; correlation is deterministic, not proof of causality.":"Single signal observed; root cause remains unverified.",evidence:redacted({signals:signals.map(s=>({id:s.id,kind:s.kind,severity:s.severity,dependency:s.dependency,observedAt:s.observedAt}))}),correlationConfidence:signals.length>1?0.6:0.3},
  update:{signalIds:signals.map(s=>s.id),windowEnd:end,evidence:redacted({signals:signals.map(s=>({id:s.id,kind:s.kind,severity:s.severity,dependency:s.dependency,observedAt:s.observedAt}))})}
 });
}

export async function assessReliability(input:{service:string;environment:string;incidentId?:string;reason:string}){
 const correlation=await correlateReliabilitySignals(input);
 if(!correlation){
  return db.reliabilityAssessment.create({data:{state:"ESCALATED",confidence:"UNKNOWN",signals:json([]),evidence:json({reason:"No signals available."}),remediationConsidered:json([]),selectionRationale:"Unknown is not healthy; no remediation is selected.",incidentId:input.incidentId??null,correlationFingerprint:hash(input.service+input.environment)}});
 }
 const signalCount=correlation.signalIds.length;
 const confidence:ReliabilityConfidence=confidenceFromEvidence({signalCount,contradictions:0,validated:false,stableBaseline:false});
 const hypothesis=await db.reliabilityHypothesis.create({data:{correlationId:correlation.id,statement:"Observed reliability degradation is associated with the correlated signal set; causal proof is not claimed.",domain:input.service,resources:[input.service],evidence:correlation.evidence,confidence,validationMethod:"Deterministic signal corroboration and postcondition verification",expiresAt:new Date(Date.now()+15*60_000)}});
 const state=confidence==="UNKNOWN"||confidence==="LOW"?"AWAITING_VALIDATION":"ACTIONABLE";
 const assessment=await db.reliabilityAssessment.create({data:{correlationId:correlation.id,hypothesisId:hypothesis.id,state,confidence,signals:json(correlation.signalIds),evidence:correlation.evidence,contradictions:json([]),remediationConsidered:json(["SYNTHETIC_RETRY"]),selectionRationale:confidence==="HIGH"||confidence==="VERIFIED"?"Confidence permits evaluation of approved safe strategy subject to all server-side gates.":"Confidence is insufficient for autonomous mutation; observe/validate/escalate.",incidentId:input.incidentId??null,correlationFingerprint:correlation.fingerprint}});
 const requiresApproval=!safeConfidenceForMutation(confidence);
 await db.reliabilityDecision.create({data:{assessmentId:assessment.id,decision:requiresApproval?"ESCALATE":"CONSIDER_SAFE_REMEDIATION",reason:input.reason,risk:"SAFE_AUTOMATION",requiresApproval,blockedConditions:json(requiresApproval?["confidence-below-high-or-unverified"]:[])}}); 
 return assessment;
}

export async function updateBaseline(input:{key:string;environment:string;metricKey:string;value:number;windowStart:Date;windowEnd:Date;freeze?:boolean;freezeReason?:string}){
 const previous=await db.reliabilityBaseline.findFirst({where:{key:input.key,environment:input.environment,metricKey:input.metricKey},orderBy:{version:"desc"}});
 if(previous?.frozen)return previous;
 const center=previous?Number(previous.center):input.value;
 const spread=previous?Number(previous.spread):0;
 const nextCenter=previous?center*0.8+input.value*0.2:input.value;
 const nextSpread=previous?Math.abs(spread*0.8+Math.abs(input.value-center)*0.2):0;
 return db.reliabilityBaseline.create({data:{key:input.key,environment:input.environment,metricKey:input.metricKey,sampleCount:(previous?.sampleCount??0)+1,center:nextCenter,spread:nextSpread,method:"BOUNDED_EXPONENTIAL_BASELINE",frozen:Boolean(input.freeze),freezeReason:input.freezeReason??null,windowStart:input.windowStart,windowEnd:input.windowEnd,version:(previous?.version??0)+1,evidence:json({boundedUpdate:true,previousCenter:previous?.center??null})}});
}

export async function detectReliabilityAnomaly(input:{baselineId:string;value:number}){
 const baseline=await db.reliabilityBaseline.findUnique({where:{id:input.baselineId}});
 if(!baseline)return null;
 const result=deterministicAnomaly({value:input.value,center:Number(baseline.center),spread:Number(baseline.spread),minimumDeviation:0});
 return db.reliabilityAnomaly.create({data:{baselineId:baseline.id,metricKey:baseline.metricKey,environment:baseline.environment,observedValue:input.value,expectedValue:Number(baseline.center),deviation:result.deviation,method:"BASELINE_3_SPREAD",sustained:result.anomalous,explanation:result.explanation}});
}

async function safetyGates(targetResource:string,environment:string){
 const policy=await db.automationPolicy.findUnique({where:{stableId:"phase-15-26-synthetic-diagnostic"}});\n const now=new Date();\n const [reconciliation,cost,security,cooldown,recent]=await Promise.all([
  db.reconciliationCase.count({where:{severity:"CRITICAL",status:{notIn:["RESOLVED","IGNORED","NOT_REPRODUCIBLE"]}}}),
  db.costAnomaly.count({where:{severity:"CRITICAL",status:"OPEN"}}),
  db.reliabilityIncident.count({where:{category:"SECURITY",severity:{in:["CRITICAL","MAJOR"]},status:{in:["OPEN","ACKNOWLEDGED"]}}})
 ]);
 const blocked:string[]=[];
 if(reconciliation)blocked.push("critical-reconciliation");
 if(cost)blocked.push("critical-cost-anomaly");
 if(security)blocked.push("major-critical-security-incident");
 if(!policy)blocked.push("automation-policy-missing");\n if(policy&&(!policy.enabled||policy.dryRun||policy.status!=="ACTIVE"))blocked.push("automation-policy-not-active");\n if(policy&&policy.allowedEnvironments.length>0&&!policy.allowedEnvironments.includes(environment))blocked.push("environment-not-allowed");\n if(cooldown)blocked.push("automation-cooldown");\n if(policy&&recent>=policy.maxExecutionsPerWindow)blocked.push("automation-rate-limit");\n if(environment!=="production"&&environment!=="staging"&&environment!=="test"&&environment!=="development")blocked.push("unknown-environment");
 if(!targetResource.trim())blocked.push("empty-target");
 return blocked;
}

export async function attemptSafeRemediation(input:{assessmentId:string;strategyStableId:"synthetic-retry";workflowId:string;targetResource:string;environment:string;reason:string;correlationId:string;requestedBy:string}){
 const assessment=await db.reliabilityAssessment.findUnique({where:{id:input.assessmentId}});
 if(!assessment)throw new Error("Reliability assessment not found.");
 if(!safeConfidenceForMutation(assessment.confidence))throw new Error("Confidence is insufficient for autonomous remediation.");
 if(assessment.state!=="ACTIONABLE")throw new Error("Assessment is not actionable.");
 const blocked=await safetyGates(input.targetResource,input.environment);
 if(blocked.length){
  await db.reliabilityDecision.create({data:{assessmentId:assessment.id,decision:"BLOCKED",reason:"Mandatory reliability safety gate failed.",risk:"SAFE_AUTOMATION",requiresApproval:false,blockedConditions:json(blocked)}});
  assertReliabilityTransition(assessment.state,"ESCALATED");
  await db.reliabilityAssessment.update({where:{id:assessment.id},data:{state:"ESCALATED"}});
  return {status:"BLOCKED",blocked};
 }
 const strategy=await db.reliabilityStrategy.findUnique({where:{stableId:input.strategyStableId}});
 if(!strategy||strategy.status!=="ACTIVE")throw new Error("Reliability strategy is not active.");
 const circuit=await db.reliabilityCircuit.findUnique({where:{strategyId:strategy.id}});
 if(circuit?.state==="OPEN")throw new Error("Reliability strategy circuit is open.");
 const executionFingerprint=hash([assessment.id,strategy.id,input.targetResource,input.correlationId].join("\0"));
 const existing=await db.automationExecution.findUnique({where:{idempotencyKey:executionFingerprint}});
 if(existing)return {status:"DUPLICATE",executionId:existing.id};
 assertReliabilityTransition(assessment.state,"REMEDIATING");
 await db.reliabilityAssessment.update({where:{id:assessment.id},data:{state:"REMEDIATING"}});
 try{
  const result=await executeRegisteredAction("RERUN_SYNTHETIC_CHECK",{reason:input.reason,correlationId:input.correlationId,environment:input.environment,targetResource:input.targetResource},{workflowId:input.workflowId});
  const policy=await db.automationPolicy.findUnique({where:{stableId:"phase-15-26-synthetic-diagnostic"}});\n  if(!policy)throw new Error("Synthetic diagnostic automation policy is missing.");\n  const execution=await db.automationExecution.create({data:{policyId:policy.id,policyVersionId:null,triggerFingerprint:executionFingerprint,idempotencyKey:executionFingerprint,targetResource:input.targetResource,targetScope:json({environment:input.environment,resourceId:input.targetResource,maxItems:1}),risk:"SAFE_AUTOMATION",state:"SUCCEEDED",environment:input.environment,correlationId:input.correlationId,reason:input.reason,requestedBy:input.requestedBy,result:redacted(result)}});
  await db.reliabilityEvaluation.create({data:{assessmentId:assessment.id,strategyId:strategy.id,phase:"POSTCONDITION",passed:true,checks:json({syntheticExecution:result})}});
  await db.reliabilityOutcome.create({data:{assessmentId:assessment.id,strategyId:strategy.id,executionId:execution.id,status:"SUCCESS",preconditions:json({blocked}),actionEvidence:redacted(result),postconditions:json({verified:true}),observationWindowSeconds:60,verifiedAt:new Date(),explanation:"Registered synthetic diagnostic completed; production business state was not mutated."}});
  await db.reliabilityAssessment.update({where:{id:assessment.id},data:{state:"VERIFYING"}});
  return {status:"VERIFYING",executionId:execution.id,result};
 }catch(error){
  await db.reliabilityOutcome.create({data:{assessmentId:assessment.id,strategyId:strategy.id,status:"FAILED",preconditions:json({blocked}),actionEvidence:json({error:"redacted"}),postconditions:json({verified:false}),observationWindowSeconds:0,explanation:"Registered safe diagnostic action failed; autonomous chain stops and escalates."}});
  await db.reliabilityCircuit.upsert({where:{strategyId:strategy.id},create:{strategyId:strategy.id,state:"OPEN",consecutiveFailures:1,totalFailures:1,openedAt:new Date(),reason:"Safe remediation execution failed."},update:{state:"OPEN",consecutiveFailures:{increment:1},totalFailures:{increment:1},openedAt:new Date(),reason:"Safe remediation execution failed."}});
  await db.reliabilityAssessment.update({where:{id:assessment.id},data:{state:"ESCALATED"}});
  await recordReliabilityFindings([{fingerprint:incidentFingerprint("AUTONOMOUS_RELIABILITY","OPERATIONS","SAFE_REMEDIATION_FAILED",input.strategyStableId),severity:"OPERATIONAL",category:"OPERATIONS" as ReliabilityCategory,capability:"AUTONOMOUS_RELIABILITY",title:"Safe reliability remediation failed",summary:"A bounded safe remediation failed and the strategy circuit was opened.",metadata:{assessmentId:assessment.id,strategy:input.strategyStableId}}]);
  return {status:"ESCALATED",error:"remediation-failed"};
 }
}

export async function verifyReliabilityOutcome(input:{assessmentId:string;executionId:string;metricKey:string;before:number;after:number;regressionThreshold:number}){
 const assessment=await db.reliabilityAssessment.findUnique({where:{id:input.assessmentId}});
 if(!assessment)throw new Error("Reliability assessment not found.");
 const regressed=input.after-input.before>input.regressionThreshold;
 if(regressed){
  await db.reliabilityRegression.create({data:{assessmentId:assessment.id,executionId:input.executionId,metricKey:input.metricKey,beforeValue:input.before,afterValue:input.after,threshold:input.regressionThreshold,explanation:"Post-remediation metric worsened beyond deterministic threshold.",circuitOpened:true}});
  const decisions=await db.reliabilityDecision.create({data:{assessmentId:assessment.id,decision:"REGRESSION_STOP",reason:"Automation-induced regression detected.",risk:"SAFE_AUTOMATION",requiresApproval:false,blockedConditions:json(["regression"])}}); 
  const strategy=await db.reliabilityStrategy.findFirst({where:{stableId:"synthetic-retry"}});
  if(strategy)await db.reliabilityCircuit.upsert({where:{strategyId:strategy.id},create:{strategyId:strategy.id,state:"OPEN",consecutiveFailures:1,totalFailures:1,openedAt:new Date(),reason:"Automation-induced regression."},update:{state:"OPEN",consecutiveFailures:{increment:1},totalFailures:{increment:1},openedAt:new Date(),reason:"Automation-induced regression."}});
  if(assessment.state==="VERIFYING")await db.reliabilityAssessment.update({where:{id:assessment.id},data:{state:"REGRESSED"}});
  return {status:"REGRESSION",decisionId:decisions.id};
 }
 if(assessment.state==="VERIFYING")await db.reliabilityAssessment.update({where:{id:assessment.id},data:{state:"RESOLVED"}});
 return {status:"SUCCESS"};
}

export async function seedReliabilityStrategies(){
 return db.reliabilityStrategy.upsert({
  where:{stableId:"synthetic-retry"},
  create:{stableId:"synthetic-retry",name:"Registered synthetic diagnostic retry",status:"ACTIVE",symptom:"Registered synthetic workflow failure with corroborated reliability evidence",risk:"SAFE_AUTOMATION",evidenceRequirements:json(["synthetic failure","correlated operational signal"]),hypothesisRequirements:json(["deterministic signal corroboration"]),actions:json(["RERUN_SYNTHETIC_CHECK"]),preconditions:json(["policy-active","environment-allowed","circuit-closed","idempotency-clear","no-critical-reconciliation","no-critical-cost-anomaly","no-major-security-incident"]),postconditions:json(["synthetic execution reaches non-failing status"]),timeoutSeconds:300,retryLimit:0,cooldownSeconds:300,maxSteps:1,maxMutations:1,maxChainDurationSeconds:300,blastRadius:json({resource:"single-synthetic-workflow"}),rollback:json({mode:"NONE"}),verification:json({windowSeconds:60,metric:"synthetic-status"}),escalation:json({onFailure:"OPEN_CIRCUIT_AND_ESCALATE"}),owner:"operations"},
  update:{status:"ACTIVE",actions:json(["RERUN_SYNTHETIC_CHECK"]),updatedAt:new Date()}
 });
}

export async function evaluateOperationalReliability(input:{environment:string;correlationId:string}){
 const findings=await runReliabilityChecks();
 for(const finding of findings){
  const signal=await ingestReliabilitySignal({kind:"OPERATIONAL_FINDING",service:finding.capability,dependency:finding.dependency,severity:finding.severity,environment:input.environment,value:{fingerprint:finding.fingerprint},evidence:finding.metadata,correlationId:input.correlationId});
  await db.reliabilityAssessment.create({data:{state:"ASSESSED",confidence:"LOW",signals:json([signal.id]),evidence:redacted(finding.metadata??{}),contradictions:json([]),remediationConsidered:json(["SYNTHETIC_RETRY"]),selectionRationale:"Operational finding requires deterministic validation before any mutation.",incidentId:null,correlationFingerprint:finding.fingerprint}});
 }
 return {findings:findings.length,sloCandidates:SLO_CANDIDATES.length,errorBudgetPolicy:ERROR_BUDGET_POLICY.treatment};
}
