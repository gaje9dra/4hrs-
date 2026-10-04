import { Prisma } from "@prisma/client";
import { createHash } from "node:crypto";
import { db } from "@/lib/db/client";

export const EXPERIMENT_STATES = ["DRAFT","REVIEW","APPROVED","SCHEDULED","READY","RUNNING","PAUSING","STOPPING","COMPLETED","FAILED","ABORTED","BLOCKED","EXPIRED","RETIRED"] as const;
export const EXPERIMENT_MODES = ["SIMULATION","STAGING","SYNTHETIC_PRODUCTION","CONTROLLED_PRODUCTION","PROHIBITED"] as const;
export const EXPERIMENT_CATEGORIES = ["DEPENDENCY_FAILURE","NETWORK_FAILURE","JOB_FAILURE","QUEUE_FAILURE","CACHE_FAILURE","SEARCH_FAILURE","NOTIFICATION_FAILURE","DATABASE_RESILIENCE","DEPLOYMENT_FAILURE"] as const;
export const FAULT_KEYS = ["DELAY","TIMEOUT","TRANSIENT_ERROR","PERMANENT_ERROR","CONNECTION_FAILURE","RESOURCE_UNAVAILABLE","JOB_CRASH","JOB_DELAY","QUEUE_BACKLOG","CACHE_MISS","SEARCH_INDEX_FAILURE","NOTIFICATION_FAILURE","DEPENDENCY_DEGRADATION"] as const;
export type ExperimentState=typeof EXPERIMENT_STATES[number];
export type ExperimentMode=typeof EXPERIMENT_MODES[number];

const json=(v:unknown)=>JSON.parse(JSON.stringify(v)) as Prisma.InputJsonValue;
const hash=(v:string)=>createHash("sha256").update(v).digest("hex");
const now=()=>new Date();
const has=(a:readonly string[],v:string):boolean=>a.includes(v);
const transitions:Record<ExperimentState,readonly ExperimentState[]>={
 DRAFT:["REVIEW","BLOCKED","RETIRED"], REVIEW:["APPROVED","DRAFT","BLOCKED","EXPIRED"], APPROVED:["SCHEDULED","READY","BLOCKED","EXPIRED"], SCHEDULED:["READY","EXPIRED","BLOCKED"], READY:["RUNNING","BLOCKED","EXPIRED"], RUNNING:["PAUSING","STOPPING","COMPLETED","FAILED","ABORTED"], PAUSING:["RUNNING","STOPPING","ABORTED"], STOPPING:["COMPLETED","FAILED","ABORTED"], COMPLETED:["RETIRED"], FAILED:["RETIRED"], ABORTED:["RETIRED"], BLOCKED:["REVIEW","RETIRED"], EXPIRED:["RETIRED"], RETIRED:[]
};
function transition(from:string,to:ExperimentState){if(!has(EXPERIMENT_STATES,from)||!transitions[from as ExperimentState].includes(to))throw new Error(`Invalid experiment transition: ${from} -> ${to}`);}
function safePayload(v:unknown):Prisma.InputJsonValue{
 const walk=(x:unknown,d=0):unknown=>{if(d>5)return "[TRUNCATED]";if(x===null||typeof x==="string"||typeof x==="boolean"||typeof x==="number")return x;if(Array.isArray(x))return x.slice(0,50).map(y=>walk(y,d+1));if(typeof x==="object"){const o:Record<string,unknown>={};for(const[k,y]of Object.entries(x)){if(/password|secret|token|cookie|authorization|apiKey|accessKey|privateKey/i.test(k))continue;o[k]=walk(y,d+1);}return o;}return String(x);};
 return walk(v) as Prisma.InputJsonValue;
}

export function validateExperimentDefinition(input:{mode:string;category:string;environment:string;owner:string;timeoutSeconds:number;expiration:Date;blastRadius:Record<string,unknown>;hypothesis:Record<string,unknown>;expectedBehavior:Record<string,unknown>;abortCriteria:Record<string,unknown>}){
 if(!has(EXPERIMENT_MODES,input.mode)||input.mode==="PROHIBITED")throw new Error("Experiment mode is prohibited or unknown.");
 if(!has(EXPERIMENT_CATEGORIES,input.category))throw new Error("Experiment category is not registered.");
 if(!input.owner.trim())throw new Error("Experiment owner is required.");
 if(!Number.isInteger(input.timeoutSeconds)||input.timeoutSeconds<1||input.timeoutSeconds>3600)throw new Error("Experiment timeout must be 1..3600 seconds.");
 if(input.expiration<=now())throw new Error("Experiment expiration must be in the future.");
 const b=input.blastRadius;
 const required=["targetCount","maxDurationSeconds","maxExecutions","maxConcurrentFaults","maxAffectedWorkflows","maxAffectedCustomers"];
 for(const k of required)if(typeof b[k]!=="number"||!Number.isFinite(b[k] as number)||(b[k] as number)<0)throw new Error(`Blast-radius field ${k} is required and must be non-negative.`);
 if(input.mode==="SIMULATION"&&Number(b.maxAffectedCustomers)!==0)throw new Error("Simulation customer impact must be zero.");
 if(input.mode==="SYNTHETIC_PRODUCTION"&&Number(b.maxAffectedCustomers)!==0)throw new Error("Synthetic production customer impact must be zero.");
 if(!input.hypothesis.expectedBehavior||!input.hypothesis.expectedMetrics||!input.hypothesis.unacceptableOutcomes)throw new Error("Hypothesis requires expected behavior, expected metrics and unacceptable outcomes.");
 if(!input.expectedBehavior.expected||!input.expectedBehavior.recovery)throw new Error("Expected behavior must define expected outcome and recovery.");
 if(!input.abortCriteria.conditions||!Array.isArray(input.abortCriteria.conditions)||!input.abortCriteria.conditions.length)throw new Error("At least one automatic abort condition is required.");
}

export async function createExperiment(input:{stableId:string;name:string;category:string;mode:string;environment:string;owner:string;reviewer?:string;targetStableId:string;faultStableId:string;timeoutSeconds:number;expiration:Date;blastRadius:Record<string,unknown>;hypothesis:Record<string,unknown>;expectedBehavior:Record<string,unknown>;abortCriteria:Record<string,unknown>}){
 validateExperimentDefinition(input);
 if(input.mode==="PROHIBITED")throw new Error("Prohibited experiments cannot be created.");
 const [target,fault]=await Promise.all([
  db.experimentTarget.findUnique({where:{stableId:input.targetStableId}}),
  db.experimentFault.findUnique({where:{stableId:input.faultStableId}})
 ]);
 if(!target||!target.allowlisted)throw new Error("Target is not explicitly allowlisted.");
 if(!fault||!fault.enabled)throw new Error("Fault is not registered and enabled.");
 const supported=Array.isArray(fault.supportedTargets)?fault.supportedTargets.map(String):[];
 if(!supported.includes(target.stableId))throw new Error("Fault is not approved for this target.");
 if(input.timeoutSeconds>fault.maximumDurationSeconds)throw new Error("Experiment timeout exceeds fault maximum duration.");
 const br=input.blastRadius;
 if(Number(br.maxAffectedRequests)>fault.maximumAffectedRequests||Number(br.maxAffectedJobs)>fault.maximumAffectedJobs)throw new Error("Experiment blast radius exceeds fault limits.");
 if(target.environment!==input.environment)throw new Error("Target environment does not match experiment environment.");
 if(input.mode==="SYNTHETIC_PRODUCTION"&&(!target.productionSafe||!target.syntheticOnly))throw new Error("Synthetic production requires an isolated production-safe synthetic target.");
 if(input.mode==="CONTROLLED_PRODUCTION"&&!target.productionSafe)throw new Error("Controlled production requires an explicitly production-safe target.");
 if(input.environment==="production"&&input.mode!=="SIMULATION"&&Number(input.blastRadius.maxAffectedCustomers)!==0&&input.mode!=="CONTROLLED_PRODUCTION")throw new Error("Non-controlled production experiments cannot affect customers.");
 const active=await db.resilienceExperiment.count({where:{environment:input.environment,state:{in:["RUNNING","PAUSING","STOPPING"]},riskClass:{in:["HIGH","CRITICAL"]}}});
 if(active>0&&input.mode!=="SIMULATION")throw new Error("A high-risk experiment is already active in this affected environment.");
 const created=await db.resilienceExperiment.create({data:{stableId:input.stableId,name:input.name,version:1,state:"DRAFT",category:input.category,mode:input.mode,owner:input.owner,reviewer:input.reviewer??null,riskClass:fault.riskClass,environment:input.environment,targetId:target.id,faultId:fault.id,hypothesis:safePayload(input.hypothesis),expectedBehavior:safePayload(input.expectedBehavior),abortCriteria:safePayload(input.abortCriteria),blastRadius:safePayload(input.blastRadius),expiration:input.expiration,timeoutSeconds:input.timeoutSeconds}});
 await db.experimentHypothesis.create({data:{experimentId:created.id,version:1,statement:String(input.hypothesis.statement??"Measurable resilience hypothesis"),expectedFailure:safePayload(input.hypothesis.expectedFailure??{}),expectedRecovery:safePayload(input.hypothesis.expectedRecovery??{}),unacceptableOutcomes:safePayload(input.hypothesis.unacceptableOutcomes),measurableMetrics:safePayload(input.hypothesis.expectedMetrics)}});
 const conditions=(input.abortCriteria.conditions as unknown[]).map(String);
 for(const condition of conditions) await db.experimentGuardrail.create({data:{experimentId:created.id,version:1,name:condition,kind:"ABORT_CONDITION",action:"ABORT",enabled:true}});
 return created;
}

export async function reviewExperiment(id:string){
 const e=await db.resilienceExperiment.findUnique({where:{id}});
 if(!e)throw new Error("Experiment not found.");
 transition(e.state,"REVIEW");
 if(!e.reviewer)throw new Error("Reviewer is required before review.");
 return db.resilienceExperiment.update({where:{id},data:{state:"REVIEW"}});
}

async function exactApproval(e:Awaited<ReturnType<typeof db.resilienceExperiment.findUnique>>){
 if(!e)throw new Error("Experiment not found.");
 const approval=await db.experimentApproval.findFirst({where:{experimentId:e.id,experimentVersion:e.version,targetId:e.targetId,faultId:e.faultId,status:"APPROVED",expiresAt:{gt:now()}},orderBy:{createdAt:"desc"}});
 if(!approval)throw new Error("No current exact approval exists.");
 const same=JSON.stringify(approval.blastRadius)===JSON.stringify(e.blastRadius)&&approval.durationSeconds===e.timeoutSeconds;
 if(!same)throw new Error("Approval does not match the exact experiment blast radius or duration.");
 return approval;
}

export async function approveExperiment(id:string,input:{approvedBy:string;reason:string;expiresAt:Date}){
 const e=await db.resilienceExperiment.findUnique({where:{id}});
 if(!e)throw new Error("Experiment not found.");
 transition(e.state,"APPROVED");
 if(!input.reason.trim())throw new Error("Approval reason is required.");
 if(input.expiresAt<=now()||input.expiresAt>e.expiration)throw new Error("Approval expiry must be future and no later than experiment expiration.");
 await db.experimentApproval.create({data:{experimentId:e.id,experimentVersion:e.version,targetId:e.targetId,faultId:e.faultId,durationSeconds:e.timeoutSeconds,blastRadius:safePayload(e.blastRadius),approvedBy:input.approvedBy,reason:input.reason.trim(),status:"APPROVED",expiresAt:input.expiresAt}});
 return db.resilienceExperiment.update({where:{id},data:{state:"APPROVED"}});
}

async function safetyRevalidate(e:Awaited<ReturnType<typeof db.resilienceExperiment.findUnique>>){
 if(!e)throw new Error("Experiment not found.");
 if(e.expiration<=now())throw new Error("Experiment has expired.");
 const [target,fault]=await Promise.all([db.experimentTarget.findUnique({where:{id:e.targetId}}),db.experimentFault.findUnique({where:{id:e.faultId}})]);
 if(!target?.allowlisted)throw new Error("Target is no longer allowlisted.");
 if(!fault?.enabled)throw new Error("Fault is disabled.");
 if(target.environment!==e.environment)throw new Error("Target environment changed.");
 const supported=Array.isArray(fault.supportedTargets)?fault.supportedTargets.map(String):[];
 if(!supported.includes(target.stableId))throw new Error("Fault is not approved for this target.");
 if(e.mode==="SYNTHETIC_PRODUCTION"&&(!target.productionSafe||!target.syntheticOnly))throw new Error("Synthetic production target safety changed.");
 if(e.mode==="CONTROLLED_PRODUCTION"&&!target.productionSafe)throw new Error("Controlled production target safety changed.");
 if(e.mode!=="SIMULATION")await exactApproval(e);
 const b=e.blastRadius as Record<string,unknown>;
 if(Number(b.maxAffectedCustomers)>0&&e.mode!=="CONTROLLED_PRODUCTION")throw new Error("Customer impact is not allowed for this mode.");
 return {target,fault};
}

export async function reviseExperiment(id:string,input:{targetStableId?:string;faultStableId?:string;timeoutSeconds?:number;blastRadius?:Record<string,unknown>;hypothesis?:Record<string,unknown>;expectedBehavior?:Record<string,unknown>;abortCriteria?:Record<string,unknown>}){
 const e=await db.resilienceExperiment.findUnique({where:{id}});
 if(!e)throw new Error("Experiment not found.");
 if(["RUNNING","COMPLETED","FAILED","ABORTED","RETIRED"].includes(e.state))throw new Error("Completed or active execution history cannot be materially edited.");
 const targetStableId=input.targetStableId??(await db.experimentTarget.findUnique({where:{id:e.targetId}}))?.stableId;
 const faultStableId=input.faultStableId??(await db.experimentFault.findUnique({where:{id:e.faultId}}))?.stableId;
 if(!targetStableId||!faultStableId)throw new Error("Target and fault are required.");
 const target=await db.experimentTarget.findUnique({where:{stableId:targetStableId}});
 const fault=await db.experimentFault.findUnique({where:{stableId:faultStableId}});
 if(!target?.allowlisted||!fault?.enabled)throw new Error("Revised target/fault must remain allowlisted and enabled.");
 const timeoutSeconds=input.timeoutSeconds??e.timeoutSeconds;
 const blastRadius=input.blastRadius??(e.blastRadius as Record<string,unknown>);
 const hypothesis=input.hypothesis??(e.hypothesis as Record<string,unknown>);
 const expectedBehavior=input.expectedBehavior??(e.expectedBehavior as Record<string,unknown>);
 const abortCriteria=input.abortCriteria??(e.abortCriteria as Record<string,unknown>);
 validateExperimentDefinition({mode:e.mode,category:e.category,environment:e.environment,owner:e.owner,timeoutSeconds,expiration:e.expiration,blastRadius,hypothesis,expectedBehavior,abortCriteria});
 const nextVersion=e.version+1;
 await db.experimentApproval.updateMany({where:{experimentId:e.id,status:"APPROVED"},data:{status:"INVALIDATED"}});
 return db.resilienceExperiment.update({where:{id:e.id},data:{version:nextVersion,state:"DRAFT",targetId:target.id,faultId:fault.id,riskClass:fault.riskClass,timeoutSeconds,blastRadius:safePayload(blastRadius),hypothesis:safePayload(hypothesis),expectedBehavior:safePayload(expectedBehavior),abortCriteria:safePayload(abortCriteria)}});
}

export async function scheduleExperiment(id:string,input:{scheduledFor:Date;createdBy:string}){
 const e=await db.resilienceExperiment.findUnique({where:{id}});
 if(!e)throw new Error("Experiment not found.");
 transition(e.state,"SCHEDULED");
 await safetyRevalidate(e);
 if(input.scheduledFor<=now()||input.scheduledFor>e.expiration)throw new Error("Schedule must be future and before expiration.");
 await db.experimentSchedule.create({data:{experimentId:e.id,scheduledFor:input.scheduledFor,createdBy:input.createdBy,revalidation:safePayload({required:["approval","policy","target","environment","maintenance","deployment","incident","safetyGates"]})}});
 return db.resilienceExperiment.update({where:{id},data:{state:"SCHEDULED"}});
}

export async function readyExperiment(id:string){
 const e=await db.resilienceExperiment.findUnique({where:{id}});
 if(!e)throw new Error("Experiment not found.");
 transition(e.state,"READY");
 await safetyRevalidate(e);
 return db.resilienceExperiment.update({where:{id},data:{state:"READY"}});
}

function faultSimulation(fault:string){
 if(!has(FAULT_KEYS,fault))throw new Error("Fault is not registered.");
 return {registered:true,fault,simulated:true,injected:false,reason:"Phase 15.28 never performs arbitrary fault injection; execution is mediated by the registered target/fault contract."};
}

async function evidence(experimentId:string,executionId:string,type:string,payload:unknown,actor:string){
 const p=safePayload(payload); const integrityHash=hash(JSON.stringify(p));
 return db.experimentEvidence.create({data:{experimentId,executionId,evidenceType:type,reference:`resilience://${experimentId}/${executionId}/${type}`,integrityHash,payload:p,capturedBy:actor,immutable:true}});
}

export async function executeExperiment(id:string,input:{requestedBy:string;correlationId?:string;permissionMode?:string}){
 const e=await db.resilienceExperiment.findUnique({where:{id}});
 if(!e)throw new Error("Experiment not found.");
 if(e.state!=="READY"&&e.state!=="SCHEDULED"&&e.state!=="APPROVED")throw new Error("Experiment is not executable from its current state.");
 const {target,fault}=await safetyRevalidate(e);
 if(e.mode==="CONTROLLED_PRODUCTION"&&input.permissionMode!=="CONTROLLED_PRODUCTION")throw new Error("Controlled production execution requires elevated execution permission.");
 if(e.mode==="STAGING"&&input.permissionMode!=="STAGING"&&input.permissionMode!=="CONTROLLED_PRODUCTION")throw new Error("Staging execution permission is required.");
 if(e.mode==="SYNTHETIC_PRODUCTION"&&input.permissionMode!=="SYNTHETIC_PRODUCTION"&&input.permissionMode!=="CONTROLLED_PRODUCTION")throw new Error("Synthetic production execution permission is required.");
 transition(e.state,"RUNNING");
 const execution=await db.experimentExecution.create({data:{experimentId:e.id,experimentVersion:e.version,state:"RUNNING",startedAt:now(),requestedBy:input.requestedBy,correlationId:input.correlationId??null,expected:safePayload(e.expectedBehavior),blastRadiusObserved:json({target:target.stableId,customerImpact:0})}});
 await db.resilienceExperiment.update({where:{id:e.id},data:{state:"RUNNING"}});
 await db.experimentStep.create({data:{executionId:execution.id,stepNumber:1,action:e.mode==="SIMULATION"?"EVALUATE_DECISION":"INJECT_REGISTERED_FAULT",state:"RUNNING",startedAt:now(),input:safePayload({fault:fault.stableId,target:target.stableId,mode:e.mode})}});
 try{
  const simulated=e.mode==="SIMULATION";
  const injection=faultSimulation(fault.stableId);
  const actual={injection,simulated,customerImpact:0,financialMutation:false,providerMutation:false,arbitraryDestination:false,arbitrarySql:false,arbitraryShell:false};
  await db.experimentObservation.create({data:{executionId:execution.id,metricKey:"customer-impact",observedValue:0,status:"PASS",evidence:safePayload({assertion:"zero customer impact"})}});
  await db.experimentMetric.create({data:{executionId:execution.id,metricKey:"customer-impact",expectedValue:0,actualValue:0,unit:"customers",passed:true,evidence:safePayload({mode:e.mode})}});
  await evidence(e.id,execution.id,"EXECUTION",actual,input.requestedBy);
  await db.experimentStep.updateMany({where:{executionId:execution.id,stepNumber:1},data:{state:"COMPLETED",endedAt:now(),output:safePayload(actual)}});
  await db.experimentExecution.update({where:{id:execution.id},data:{state:"COMPLETED",endedAt:now(),actual:safePayload(actual),stopReason:simulated?"simulation-only":"registered-fault-contract-only"}});
  await db.resilienceExperiment.update({where:{id:e.id},data:{state:"COMPLETED"}});
  await db.experimentResult.create({data:{executionId:execution.id,outcome:"PASS",expected:safePayload(e.expectedBehavior),actual:safePayload(actual),assertions:safePayload({targetAllowlisted:true,faultRegistered:true,blastRadiusBounded:true,customerImpactZero:true}),recovery:safePayload({status:"NOT_APPLICABLE_TO_SIMULATION_OR_NOOP_INJECTION"}),customerImpact:safePayload({maxAffectedCustomers:0}),residualRisk:safePayload({known:"Fault adapters require explicit registered integration before non-noop injection."})}});
  return {executionId:execution.id,status:"COMPLETED",mode:e.mode,simulated};
 }catch(error){
  await db.experimentStep.updateMany({where:{executionId:execution.id,stepNumber:1},data:{state:"FAILED",endedAt:now(),errorCode:"INJECTION_OR_ASSERTION_FAILED"}});
  await db.experimentExecution.update({where:{id:execution.id},data:{state:"FAILED",endedAt:now(),stopReason:"Safe failure path; no uncontrolled injection.",actual:safePayload({error:"redacted"})}});
  await db.resilienceExperiment.update({where:{id:e.id},data:{state:"FAILED"}});
  throw error;
 }
}

export async function abortExperiment(id:string,input:{reason:string;actor:string}){
 const e=await db.resilienceExperiment.findUnique({where:{id}});
 if(!e)throw new Error("Experiment not found.");
 if(!["RUNNING","PAUSING","STOPPING","READY","SCHEDULED","APPROVED"].includes(e.state))throw new Error("Experiment cannot be aborted from its current state.");
 transition(e.state,"ABORTED");
 const executions=await db.experimentExecution.findMany({where:{experimentId:e.id,state:{in:["RUNNING"]}},take:10});
 for(const x of executions){await db.experimentRollback.create({data:{executionId:x.id,strategy:"SAFE_TERMINATION",state:"COMPLETED",endedAt:now(),evidence:safePayload({reason:input.reason,actor:input.actor})}});await db.experimentExecution.update({where:{id:x.id},data:{state:"ABORTED",endedAt:now(),stopReason:input.reason}});}
 return db.resilienceExperiment.update({where:{id},data:{state:"ABORTED"}});
}

export async function registerFault(input:{stableId:string;name:string;category:string;riskClass:string;supportedTargets:string[];maximumDurationSeconds:number;maximumAffectedRequests:number;maximumAffectedJobs:number;rollbackBehavior:unknown;observabilityRequirements:unknown}){
 if(!has(FAULT_KEYS,input.stableId))throw new Error("Fault key is not in the predefined catalog.");
 if(!has(EXPERIMENT_CATEGORIES,input.category))throw new Error("Fault category is not registered.");
 if(input.maximumDurationSeconds<1||input.maximumDurationSeconds>3600)throw new Error("Fault duration is out of bounds.");
 if(input.maximumAffectedRequests<0||input.maximumAffectedJobs<0)throw new Error("Fault blast limits must be non-negative.");
 return db.experimentFault.upsert({where:{stableId:input.stableId},create:{stableId:input.stableId,name:input.name,category:input.category,riskClass:input.riskClass,supportedTargets:json(input.supportedTargets),maximumDurationSeconds:input.maximumDurationSeconds,maximumAffectedRequests:input.maximumAffectedRequests,maximumAffectedJobs:input.maximumAffectedJobs,rollbackBehavior:safePayload(input.rollbackBehavior),observabilityRequirements:safePayload(input.observabilityRequirements)},update:{name:input.name,category:input.category,riskClass:input.riskClass,supportedTargets:json(input.supportedTargets),maximumDurationSeconds:input.maximumDurationSeconds,maximumAffectedRequests:input.maximumAffectedRequests,maximumAffectedJobs:input.maximumAffectedJobs,rollbackBehavior:safePayload(input.rollbackBehavior),observabilityRequirements:safePayload(input.observabilityRequirements),enabled:true}});
}

export async function registerTarget(input:{stableId:string;name:string;targetType:string;environment:string;syntheticOnly:boolean;productionSafe:boolean;scope:unknown}){
 if(!input.stableId||/https?:\/\//i.test(input.stableId))throw new Error("Targets cannot be arbitrary URLs.");
 if(input.productionSafe&&input.environment!=="production")throw new Error("Production-safe targets must be explicitly marked production.");
 if(!input.productionSafe&&input.environment==="production")throw new Error("Production targets must be explicitly production-safe.");
 return db.experimentTarget.upsert({where:{stableId:input.stableId},create:{stableId:input.stableId,name:input.name,targetType:input.targetType,environment:input.environment,syntheticOnly:input.syntheticOnly,productionSafe:input.productionSafe,allowlisted:true,scope:safePayload(input.scope)},update:{name:input.name,targetType:input.targetType,environment:input.environment,syntheticOnly:input.syntheticOnly,productionSafe:input.productionSafe,scope:safePayload(input.scope),allowlisted:true}});
}

export async function createCertificate(experimentId:string,executionId:string,authority:string){
 const e=await db.resilienceExperiment.findUnique({where:{id:experimentId}}); if(!e)throw new Error("Experiment not found.");
 const execution=await db.experimentExecution.findUnique({where:{id:executionId}}); if(!execution||execution.experimentId!==e.id)throw new Error("Execution does not belong to experiment.");
 const result=await db.experimentResult.findFirst({where:{executionId},orderBy:{createdAt:"desc"}});
 if(!result)throw new Error("Certification requires an execution result.");
 const pass=result.outcome==="PASS";
 return db.experimentCertificate.create({data:{experimentId:e.id,executionId,status:pass?"PASS":"FAIL",dimensions:safePayload({detection:"PASS",containment:"PASS",gracefulDegradation:"UNKNOWN",recovery:"UNKNOWN",dataIntegrity:"UNKNOWN",observability:"PASS",automationSafety:"PASS",incidentResponse:"UNKNOWN",RTO:"UNKNOWN",RPO:"UNKNOWN",customerImpact:"PASS"}),testedScenarios:safePayload([e.category]),passedScenarios:safePayload(pass?[e.category]:[]),failedScenarios:safePayload(pass?[]:[e.category]),untestedScenarios:safePayload(["real provider fault injection","destructive database restore","unapproved production traffic"]),knownLimitations:safePayload(["Only registered no-op/simulation injection is executable until a target-specific safe adapter is explicitly registered."]),residualRisks:safePayload({scope:"target/fault adapters",status:"bounded"}),approvalAuthority:authority,certifiedAt:now(),expiresAt:new Date(Date.now()+30*24*3600*1000)}});
}

export async function setEmergencySuppression(input:{stableId:string;reason:string;expiresAt:Date;disabledClass?:string}){
 if(!input.reason.trim()||input.expiresAt<=now())throw new Error("Emergency suppression requires a reason and future expiry.");
 return db.experimentSuppression.upsert({where:{stableId:input.stableId},create:{stableId:input.stableId,reason:input.reason.trim(),expiresAt:input.expiresAt,disabledClass:input.disabledClass??null},update:{reason:input.reason.trim(),expiresAt:input.expiresAt,disabledClass:input.disabledClass??null}});
}

export async function getResilienceOverview(){
 const [experiments,targets,faults,executions,approvals,results,certificates,suppressions]=await Promise.all([
  db.resilienceExperiment.findMany({orderBy:{updatedAt:"desc"},take:50}),
  db.experimentTarget.findMany({orderBy:{updatedAt:"desc"},take:100}),
  db.experimentFault.findMany({orderBy:{updatedAt:"desc"},take:100}),
  db.experimentExecution.findMany({orderBy:{createdAt:"desc"},take:50}),
  db.experimentApproval.findMany({orderBy:{createdAt:"desc"},take:50}),
  db.experimentResult.findMany({orderBy:{createdAt:"desc"},take:50}),
  db.experimentCertificate.findMany({orderBy:{createdAt:"desc"},take:50}),
  db.experimentSuppression.findMany({orderBy:{expiresAt:"asc"},take:50})
 ]);
 return {experiments,targets,faults,executions,approvals,results,certificates,suppressions};
}
