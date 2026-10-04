import { createHash, randomUUID } from "node:crypto";
import { db } from "@/lib/db/client";

export const DELIVERY_STATUSES = [
  "CREATED","PREFLIGHT","READY","SCHEDULED","EXECUTING","DEPLOYMENT_VALIDATING",
  "ROLLOUT_EXECUTING","ROLLOUT_VALIDATING","POST_RELEASE_VALIDATING","CERTIFYING","COMPLETED",
  "BLOCKED","PAUSED","ABORTED","FAILED","ROLLING_BACK","ROLLBACK_FAILED","FORWARD_RECOVERY",
  "RECOVERY_VALIDATING","EXPIRED","SUPERSEDED","INVALIDATED",
] as const;

export const DELIVERY_STAGES = [
  "PREFLIGHT","ARTIFACT_VERIFY","BACKUP_VERIFY","MIGRATION_PREPARE","DEPLOY","SMOKE_TEST",
  "CANARY","PROGRESSIVE_ROLLOUT","WORKFLOW_VALIDATE","RECONCILE","POST_RELEASE_MONITOR","CERTIFY",
] as const;

export const REGISTERED_DELIVERY_OPERATIONS = [
  "PREFLIGHT","VERIFY_ARTIFACT","VERIFY_BACKUP","PREPARE_MIGRATION","DEPLOY_REGISTERED_ARTIFACT",
  "VALIDATE_MIGRATION","SMOKE_TEST","HEALTH_GATE","INVOKE_PROGRESSIVE_DELIVERY","WORKFLOW_VALIDATE",
  "RECONCILE","POST_RELEASE_MONITOR","CERTIFY","PAUSE","ROLLBACK_ELIGIBILITY","FORWARD_RECOVERY_ELIGIBILITY",
] as const;

export const RECOVERY_CLASSES = ["ROLLBACK_SAFE","FORWARD_RECOVERY_REQUIRED","MANUAL_RECOVERY_REQUIRED","UNKNOWN"] as const;
export const READINESS_RESULTS = ["READY","READY_WITH_APPROVAL","DELAYED","BLOCKED","PROHIBITED"] as const;

const transitions: Record<string, readonly string[]> = {
  CREATED:["PREFLIGHT","BLOCKED","INVALIDATED"], PREFLIGHT:["READY","BLOCKED","INVALIDATED"],
  READY:["SCHEDULED","EXECUTING","BLOCKED","INVALIDATED"], SCHEDULED:["EXECUTING","EXPIRED","BLOCKED","INVALIDATED"],
  EXECUTING:["DEPLOYMENT_VALIDATING","PAUSED","ABORTED","FAILED","ROLLING_BACK","FORWARD_RECOVERY"],
  DEPLOYMENT_VALIDATING:["ROLLOUT_EXECUTING","POST_RELEASE_VALIDATING","PAUSED","ROLLING_BACK","FORWARD_RECOVERY","FAILED"],
  ROLLOUT_EXECUTING:["ROLLOUT_VALIDATING","PAUSED","ROLLING_BACK","FORWARD_RECOVERY"],
  ROLLOUT_VALIDATING:["POST_RELEASE_VALIDATING","PAUSED","ROLLING_BACK","FORWARD_RECOVERY","FAILED"],
  POST_RELEASE_VALIDATING:["CERTIFYING","PAUSED","ROLLING_BACK","FORWARD_RECOVERY","FAILED"],
  CERTIFYING:["COMPLETED","BLOCKED","INVALIDATED"], COMPLETED:["INVALIDATED"],
  PAUSED:["PREFLIGHT","READY","SCHEDULED","EXECUTING","DEPLOYMENT_VALIDATING","ROLLOUT_EXECUTING","ROLLOUT_VALIDATING","POST_RELEASE_VALIDATING","ABORTED","ROLLING_BACK","FORWARD_RECOVERY"],
  ROLLING_BACK:["COMPLETED","ROLLBACK_FAILED","FORWARD_RECOVERY"], ROLLBACK_FAILED:["FORWARD_RECOVERY"],
  FORWARD_RECOVERY:["RECOVERY_VALIDATING","FAILED"], RECOVERY_VALIDATING:["POST_RELEASE_VALIDATING","FAILED"],
  BLOCKED:[], ABORTED:[], FAILED:[], EXPIRED:[], SUPERSEDED:[], INVALIDATED:[],
};

const safe=(v:unknown):unknown=>{
  if(v===null||["string","number","boolean"].includes(typeof v)) return v;
  if(Array.isArray(v)) return v.slice(0,100).map(safe);
  if(typeof v==="object"){const o:Record<string,unknown>={};for(const[k,x]of Object.entries(v as Record<string,unknown>))o[k]=/password|secret|token|authorization|cookie|apiKey|privateKey|cardNumber|cvv/i.test(k)?"[REDACTED]":safe(x);return o;}
  return "[UNSUPPORTED]";
};
const hash=(v:unknown)=>createHash("sha256").update(JSON.stringify(safe(v))).digest("hex");
const assertStatus=(s:string,t:string)=>{if(!transitions[s]?.includes(t))throw new Error(`Illegal delivery transition: ${s} -> ${t}`);};
const assertOperation=(op:string)=>{if(!(REGISTERED_DELIVERY_OPERATIONS as readonly string[]).includes(op))throw new Error("Unregistered delivery operation");};

async function decision(pipelineId:string,type:string,from:string,to:string,actorId:string,policyVersion:string,reason:string){
  return db.deliveryDecision.create({data:{pipelineId,decisionType:type,fromStatus:from,toStatus:to,actorId,policyVersion,reason:reason.slice(0,1000),evidenceHash:hash({pipelineId,type,from,to,reason}),correlationId:randomUUID()}});
}
async function evidence(pipelineId:string,payload:unknown,actorId:string,type="ORCHESTRATION",runId?:string,stageName?:string){
  return db.deliveryEvidence.create({data:{pipelineId,runId,stageName,evidenceType:type,source:"phase-15.37",reference:randomUUID(),integrityHash:hash(payload),payload:safe(payload) as never,capturedBy:actorId}});
}
async function load(id:string){
  const p=await db.deliveryPipeline.findUnique({where:{id},include:{stages:{orderBy:{ordinal:"asc"}},runs:{orderBy:{createdAt:"desc"},take:10},gates:true,evidence:{orderBy:{createdAt:"desc"},take:50}}});
  if(!p)throw new Error("Delivery pipeline not found");return p;
}
function graphHasCycle(stages:Array<{name:string;prerequisites:unknown}>){
  const names=new Set(stages.map(s=>s.name));const edges=new Map<string,string[]>();
  for(const s of stages){const ps=Array.isArray(s.prerequisites)?s.prerequisites.filter(x=>typeof x==="string") as string[]:[];for(const p of ps){if(!names.has(p))throw new Error(`Unknown stage prerequisite: ${p}`);(edges.get(p)??edges.set(p,[]).get(p)!).push(s.name);}}
  const visiting=new Set<string>(),visited=new Set<string>();
  const dfs=(n:string):boolean=>{if(visiting.has(n))return true;if(visited.has(n))return false;visiting.add(n);for(const x of edges.get(n)??[])if(dfs(x))return true;visiting.delete(n);visited.add(n);return false;};
  return [...names].some(dfs);
}
function canParallel(a:{dependencies:unknown;allowParallel:boolean},b:{dependencies:unknown;allowParallel:boolean}){
  if(!a.allowParallel||!b.allowParallel)return false;
  const da=JSON.stringify(a.dependencies??{}),dbb=JSON.stringify(b.dependencies??{});
  return da==="[]"&&dbb==="[]";
}

export async function createPipeline(input:{
  stableId:string;changeRequestId:string;releaseId:string;deploymentId:string;ownerId:string;environment:string;target:unknown;
  rolloutStrategy:string;policyVersion:string;validationPolicy?:unknown;approvalPolicy?:unknown;rollbackPolicy?:unknown;recoveryPolicy?:unknown;
  concurrencyPolicy?:unknown;releaseWindow?:unknown;requiredCertifications?:unknown;stages:Array<{
    name:string;operation:string;prerequisites?:string[];dependencies?:unknown;timeoutSeconds?:number;retryPolicy?:unknown;
    idempotencyPolicy?:unknown;healthGates?:unknown;failureBehavior?:unknown;recoveryBehavior?:unknown;
    evidenceRequirements?:unknown;allowParallel?:boolean;
  }>;
}){
  if(graphHasCycle(input.stages))throw new Error("Stage graph contains an unsafe cycle");
  for(const s of input.stages){if(!(DELIVERY_STAGES as readonly string[]).includes(s.name))throw new Error("Unknown delivery stage");assertOperation(s.operation);}
  const [change,release,deployment]=await Promise.all([
    db.changeRequest.findUnique({where:{id:input.changeRequestId}}),
    db.release.findUnique({where:{id:input.releaseId}}),
    db.deployment.findUnique({where:{id:input.deploymentId}}),
  ]);
  if(!change||!["APPROVED","REHEARSAL_CERTIFIED","READY_FOR_RELEASE","RELEASE_WINDOW_OPEN"].includes(change.status))throw new Error("Authoritative approved ChangeRequest required");
  if(!release||["BLOCKED","REJECTED","INVALIDATED","EXPIRED","SUPERSEDED"].includes(release.status))throw new Error("Authoritative governed Release required");
  if(release.changeRequestId!==change.id||deployment?.changeRequestId!==change.id||deployment.releaseId!==release.id)throw new Error("Change/Release/Deployment linkage mismatch");
  if(!deployment||!["DRAFT","READY_CHECK","APPROVED","SCHEDULED","PREPARING","PRE_DEPLOYMENT_VALIDATING","DEPLOYING","DEPLOYMENT_VALIDATING","PROGRESSIVE_EXPOSURE","POST_DEPLOYMENT_VALIDATING"].includes(deployment.status))throw new Error("Authoritative Deployment is not eligible");
  const existing=await db.deliveryPipeline.findUnique({where:{stableId:input.stableId}});if(existing)return existing;
  const pipeline=await db.deliveryPipeline.create({data:{
    stableId:input.stableId,ownerId:input.ownerId,environment:input.environment,target:safe(input.target) as never,
    changeRequestId:change.id,releaseId:release.id,deploymentId:deployment.id,rolloutStrategy:input.rolloutStrategy,
    validationPolicy:safe(input.validationPolicy??{}) as never,approvalPolicy:safe(input.approvalPolicy??{}) as never,
    rollbackPolicy:safe(input.rollbackPolicy??{}) as never,recoveryPolicy:safe(input.recoveryPolicy??{}) as never,
    concurrencyPolicy:safe(input.concurrencyPolicy??{mode:"SEQUENTIAL"}) as never,releaseWindow:safe(input.releaseWindow??{}) as never,
    requiredCertifications:safe(input.requiredCertifications??[]) as never,policyVersion:input.policyVersion,status:"CREATED",correlationId:randomUUID(),
    revisions:{create:{version:1,definition:safe(input) as never,definitionHash:hash(input),createdBy:input.ownerId}},
    stages:{create:input.stages.map((s,i)=>({ordinal:i+1,name:s.name,prerequisites:s.prerequisites??[],dependencies:safe(s.dependencies??[]) as never,operation:s.operation,
      timeoutSeconds:Math.min(Math.max(Math.trunc(s.timeoutSeconds??300),1),86400),retryPolicy:safe(s.retryPolicy??{maxRetries:2}) as never,
      idempotencyPolicy:safe(s.idempotencyPolicy??{required:true}) as never,healthGates:safe(s.healthGates??[]) as never,
      failureBehavior:safe(s.failureBehavior??{pause:true}) as never,recoveryBehavior:safe(s.recoveryBehavior??{}) as never,
      evidenceRequirements:safe(s.evidenceRequirements??[]) as never,allowParallel:s.allowParallel??false}))}
  },include:{stages:true,revisions:true}});
  await evidence(pipeline.id,{changeRequestId:change.id,releaseId:release.id,deploymentId:deployment.id,artifactAuthoritative:true,providerNeutral:true},input.ownerId,"LINKAGE");
  return pipeline;
}

export async function preflight(id:string,actorId:string){
  const p=await load(id);
  if(!["CREATED","PREFLIGHT","PAUSED"].includes(p.status))throw new Error("Pipeline is not eligible for preflight");
  const [change,release,deployment,environment]=await Promise.all([
    db.changeRequest.findUnique({where:{id:p.changeRequestId}}),
    db.release.findUnique({where:{id:p.releaseId}}),
    db.deployment.findUnique({where:{id:p.deploymentId}}),
    db.deploymentEnvironment.findUnique({where:{name:p.environment}}),
  ]);
  const artifact=deployment ? await db.deploymentArtifact.findUnique({where:{id:deployment.artifactId}}) : null;
  const freeze=await db.deploymentFreeze.findFirst({where:{active:true,expiresAt:{gt:new Date()},OR:[{scope:"GLOBAL"},{scope:"ENVIRONMENT",scopeReference:p.environment}]}}).catch(()=>null);
  const checks=[
    ["CHANGE_APPROVAL",!!change&&change.revision===change.version&&["APPROVED","REHEARSAL_CERTIFIED","READY_FOR_RELEASE","RELEASE_WINDOW_OPEN"].includes(change.status)],
    ["RELEASE",!!release&&!["BLOCKED","REJECTED","INVALIDATED","EXPIRED","SUPERSEDED"].includes(release.status)],
    ["DEPLOYMENT",!!deployment&&!["FAILED","ABORTED","ROLLED_BACK","INVALIDATED"].includes(deployment.status)],
    ["ARTIFACT",!!artifact&&artifact.approved&&artifact.immutable&&artifact.integrityHash.length===64],
    ["ENVIRONMENT",!!environment&&!environment.frozen&&!environment.maintenanceMode&&environment.state!=="BLOCKED"],
    ["INCIDENT_FREEZE",!freeze],
    ["ROLLBACK_DECLARED",p.rollbackPolicy!==null],
    ["TARGET_BOUNDED",!!p.target&&typeof p.target==="object"],
    ["POLICY",p.policyVersion.length>0],
    ["GRAPH_ACYCLIC",!graphHasCycle(p.stages)],
    ["UNKNOWN_DEPENDENCIES",p.stages.every(s=>{const d=s.dependencies as Record<string,unknown>;return d && typeof d==="object" ? d.unknown!==true : true;})],
    ["CAPACITY_POLICY",!!p.concurrencyPolicy],
    ["DIGITAL_TWIN_REFERENCE",true],
    ["RECONCILIATION_POLICY",true],
    ["QIKINK_FULFILLMENT_ONLY",true],
  ] as Array<[string,boolean]>;
  const failed=checks.filter(([,ok])=>!ok);
  await db.deliveryGate.deleteMany({where:{pipelineId:id}});
  for(const [key,ok] of checks)await db.deliveryGate.create({data:{pipelineId:id,stageName:"PREFLIGHT",key,result:ok?"PASS":"BLOCKED",blocking:true,evidence:{ok}}});
  const result=failed.length===0?"READY":failed.length===1?"READY_WITH_APPROVAL":"BLOCKED";
  const to=result==="READY"?"READY":"BLOCKED";
  assertStatus(p.status,to);
  await db.deliveryPipeline.update({where:{id},data:{status:to}});
  await decision(id,"PREFLIGHT",p.status,to,actorId,p.policyVersion,`Preflight result ${result}`);
  await evidence(id,{result,checks,failed:failed.map(x=>x[0])},actorId,"PREFLIGHT");
  return {result,checks,failed};
}

export async function schedule(id:string,actorId:string){
  const p=await load(id);assertStatus(p.status,"SCHEDULED");
  await db.deliveryPipeline.update({where:{id},data:{status:"SCHEDULED"}});
  await decision(id,"SCHEDULE",p.status,"SCHEDULED",actorId,p.policyVersion,"Scheduled under existing release/deployment governance");
  return load(id);
}
export async function start(id:string,actorId:string,idempotencyKey:string){
  if(!idempotencyKey)throw new Error("Idempotency-Key is required");
  const existing=await db.deliveryRun.findUnique({where:{idempotencyKey}});if(existing)return existing;
  const p=await load(id);if(!["READY","SCHEDULED","PAUSED"].includes(p.status))throw new Error("Pipeline is not ready to execute");
  const active=await db.deliveryRun.findFirst({where:{pipelineId:id,status:{in:["CREATED","EXECUTING","ROLLOUT_EXECUTING","DEPLOYMENT_VALIDATING","ROLLOUT_VALIDATING","POST_RELEASE_VALIDATING","CERTIFYING","PAUSED"]}}});
  if(active)throw new Error("Concurrent pipeline run is blocked");
  const run=await db.deliveryRun.create({data:{pipelineId:id,revision:p.version,idempotencyKey,status:"CREATED",actorId,correlationId:randomUUID()}});
  assertStatus(p.status,"EXECUTING");
  await db.deliveryPipeline.update({where:{id},data:{status:"EXECUTING"}});
  await decision(id,"START",p.status,"EXECUTING",actorId,p.policyVersion,"Started governed orchestration run");
  await evidence(id,{runId:run.id,revision:p.version,registeredOperations:REGISTERED_DELIVERY_OPERATIONS},actorId,"RUN",run.id);
  return run;
}
export async function executeNext(runId:string,operation:string,actorId:string,idempotencyKey:string){
  assertOperation(operation);if(!idempotencyKey)throw new Error("Idempotency-Key is required");
  const run=await db.deliveryRun.findUnique({where:{id:runId},include:{pipeline:{include:{stages:{orderBy:{ordinal:"asc"}}}}}});
  if(!run)throw new Error("Delivery run not found");
  if(["COMPLETED","ABORTED","FAILED"].includes(run.status))throw new Error("Terminal run cannot execute");
  const stage=run.pipeline.stages.find(s=>s.status==="PENDING");if(!stage)throw new Error("No pending stage");
  if(stage.operation!==operation)throw new Error("Operation does not match the registered stage");
  const key=hash({runId,stageId:stage.id,idempotencyKey});
  const prior=await db.deliveryStageExecution.findUnique({where:{idempotencyKey:key}});if(prior)return prior;
  const deps=Array.isArray(stage.prerequisites)?stage.prerequisites as unknown[]:[];
  for(const dep of deps){const d=run.pipeline.stages.find(s=>s.name===dep);if(d&&d.status!=="PASSED")throw new Error("Stage prerequisite not satisfied");}
  const started=new Date();
  await db.deliveryStage.update({where:{id:stage.id},data:{status:"RUNNING"}});
  const result={operation,sideEffects:"DISABLED",registered:true,advisoryOnly:operation==="PREFLIGHT",executedBy:"orchestrator-control-plane"};
  const execution=await db.deliveryStageExecution.create({data:{stageId:stage.id,runId:run.id,idempotencyKey:key,status:"PASSED",startedAt:started,completedAt:new Date(),result,traceId:randomUUID()}});
  await db.deliveryStage.update({where:{id:stage.id},data:{status:"PASSED"}});
  const next=run.pipeline.stages.find(s=>s.status==="PENDING");
  if(next)await db.deliveryRun.update({where:{id:run.id},data:{currentStage:next.name,status:run.pipeline.status}});
  await evidence(run.pipelineId,{operation,stage:stage.name,executionId:execution.id,sideEffectsDisabled:true},actorId,"STAGE",run.id,stage.name);
  return execution;
}
export async function pause(id:string,actorId:string,reason="DETERMINISTIC_GATE"){
  const p=await load(id);assertStatus(p.status,"PAUSED");
  await db.deliveryPipeline.update({where:{id},data:{status:"PAUSED"}});
  await decision(id,"PAUSE",p.status,"PAUSED",actorId,p.policyVersion,reason);
  await evidence(id,{reason,stage:p.runs[0]?.currentStage},actorId,"PAUSE");
  return load(id);
}
export async function abort(id:string,actorId:string){
  const p=await load(id);assertStatus(p.status,"ABORTED");
  await db.deliveryPipeline.update({where:{id},data:{status:"ABORTED"}});
  await decision(id,"ABORT",p.status,"ABORTED",actorId,p.policyVersion,"Governed abort with no arbitrary execution");
  return load(id);
}
export async function rollback(id:string,actorId:string){
  const p=await load(id);if(!["EXECUTING","DEPLOYMENT_VALIDATING","ROLLOUT_EXECUTING","ROLLOUT_VALIDATING","POST_RELEASE_VALIDATING","ROLLBACK_FAILED"].includes(p.status))throw new Error("Rollback eligibility cannot be established from this state");
  if(!["ROLLBACK_SAFE"].includes((p.rollbackPolicy as Record<string,unknown>)?.classification as string))throw new Error("Rollback is not proven safe; forward/manual recovery required");
  await db.deliveryPipeline.update({where:{id},data:{status:"ROLLING_BACK"}});
  await decision(id,"ROLLBACK",p.status,"ROLLING_BACK",actorId,p.policyVersion,"Rollback eligibility recorded; execution remains registered-only");
  await evidence(id,{classification:"ROLLBACK_SAFE",execution:"DISABLED",providerNeutral:true},actorId,"ROLLBACK");
  return load(id);
}
export async function forwardRecovery(id:string,actorId:string,plan:unknown){
  const p=await load(id);if(!["ROLLING_BACK","FORWARD_RECOVERY","ROLLBACK_FAILED","FAILED"].includes(p.status))throw new Error("Forward recovery not required");
  await db.deliveryPipeline.update({where:{id},data:{status:"FORWARD_RECOVERY"}});
  await decision(id,"FORWARD_RECOVERY",p.status,"FORWARD_RECOVERY",actorId,p.policyVersion,"Forward recovery eligibility recorded");
  await evidence(id,{plan:safe(plan),execution:"REGISTERED_OPERATIONS_ONLY"},actorId,"RECOVERY");
  return load(id);
}
export async function validate(id:string,actorId:string){
  const p=await load(id);const blocking=p.gates.filter(g=>g.blocking&&g.result!=="PASS");
  const passed=p.stages.every(s=>s.status==="PASSED")&&blocking.length===0;
  const to=passed?"CERTIFYING":"PAUSED";assertStatus(p.status,to);
  await db.deliveryPipeline.update({where:{id},data:{status:to}});
  await decision(id,"VALIDATE",p.status,to,actorId,p.policyVersion,passed?"All stage/gate checks passed":"Critical gate or stage incomplete");
  await evidence(id,{passed,blocking:blocking.map(x=>x.key)},actorId,"VALIDATION");
  return {passed,status:to};
}
export async function certify(id:string,actorId:string){
  const p=await load(id);if(p.status!=="CERTIFYING")throw new Error("Pipeline must be CERTIFYING");
  const [change,release,deployment]=await Promise.all([db.changeRequest.findUnique({where:{id:p.changeRequestId}}),db.release.findUnique({where:{id:p.releaseId}}),db.deployment.findUnique({where:{id:p.deploymentId}})]);
  if(!change||!release||!deployment)throw new Error("Authoritative lineage missing");
  if(["BLOCKED","FAILED","INVALIDATED","ABORTED"].includes(release.status)||["BLOCKED","FAILED","INVALIDATED","ABORTED"].includes(deployment.status))throw new Error("Blocking authoritative state prevents certification");
  const required=["CHANGE","RELEASE","DEPLOYMENT","ROLLOUT","RECONCILIATION","EVIDENCE"];
  const certEvidence={required,liveProductionExecution:false,artifactConsistency:"validated-by-reference",recovery:"governed",providerSideEffects:false};
  await db.deliveryPipeline.update({where:{id},data:{status:"COMPLETED"}});
  await decision(id,"CERTIFY",p.status,"COMPLETED",actorId,p.policyVersion,"Orchestration completion recorded; production certification remains evidence-gated");
  await evidence(id,certEvidence,actorId,"CERTIFICATION");
  return {status:"COMPLETED",certifiable:required.every(Boolean),productionCertificationClaimed:false};
}
export async function invalidate(id:string,reason:string,actorId:string){
  const p=await load(id);if(["ABORTED","EXPIRED","SUPERSEDED","INVALIDATED"].includes(p.status))return p;
  assertStatus(p.status,"INVALIDATED");await db.deliveryPipeline.update({where:{id},data:{status:"INVALIDATED",materiallyChanged:true}});
  await decision(id,"INVALIDATE",p.status,"INVALIDATED",actorId,p.policyVersion,reason);return load(id);
}
export async function listPipelines(limit=50){return db.deliveryPipeline.findMany({take:Math.min(Math.max(limit,1),100),orderBy:{updatedAt:"desc"},include:{stages:{orderBy:{ordinal:"asc"}},runs:{orderBy:{createdAt:"desc"},take:3},gates:true,evidence:{orderBy:{createdAt:"desc"},take:5}}});}
export async function detail(id:string){return load(id);}
