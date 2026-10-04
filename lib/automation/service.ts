import { Prisma } from "@prisma/client";
import { db } from "@/lib/db/client";
import { executeRegisteredAction, getRegisteredAction, listRegisteredActions } from "./actions";
import { assertExecutionTransition, autonomousAllowed, evaluateConditions, riskRequiresApproval, type AutomationRiskClass, type AutomationExecutionState, type StructuredCondition, validatePolicyDefinition, boundedScope } from "./model";
import { recordReliabilityFindings } from "@/lib/reliability/service";
import { incidentFingerprint } from "@/lib/reliability/incidents";

type EvaluationInput={environment:string;values:Record<string,unknown>;triggerFingerprint:string;targetResource:string;reason:string;correlationId:string;dryRun?:boolean;requestedBy?:string;triggerId?:string};
type JsonObject=Record<string,unknown>;

function conditionsOf(value:unknown):StructuredCondition[]{return Array.isArray(value)?value.filter((x):x is StructuredCondition=>Boolean(x&&typeof x==="object"&&typeof (x as JsonObject).key==="string")):[];}
function actionKeys(value:unknown){return Array.isArray(value)?value.filter((x):x is string=>typeof x==="string"):[];}
function jsonObject(value:unknown):JsonObject{ return value&&typeof value==="object"&&!Array.isArray(value)?value as JsonObject:{}; }
function windowSeconds(policy:JsonObject){const raw=policy.windowSeconds;return typeof raw==="number"&&Number.isInteger(raw)&&raw>0?Math.min(raw,86400):3600;}
function nowPlus(seconds:number){return new Date(Date.now()+seconds*1000);}

async function openCircuit(policyId:string,reason:string){
 await db.automationCircuit.upsert({where:{policyId},create:{policyId,state:"OPEN",openedAt:new Date(),lastFailureAt:new Date(),reason},update:{state:"OPEN",openedAt:new Date(),lastFailureAt:new Date(),reason}});
}

async function enforceGuards(policy:Awaited<ReturnType<typeof db.automationPolicy.findUnique>>,input:EvaluationInput){
 if(!policy) throw new Error("Automation policy not found.");
 if(policy.status!=="ACTIVE"||!policy.enabled) return {allowed:false,reason:"Automation policy is not active or enabled."};
 if(policy.expiresAt&&policy.expiresAt<=new Date()) return {allowed:false,reason:"Automation policy has expired."};
 if(policy.allowedEnvironments.length>0&&!policy.allowedEnvironments.includes(input.environment)) return {allowed:false,reason:"Environment is not allowed."};
 const circuit=await db.automationCircuit.findUnique({where:{policyId:policy.id}});
 if(circuit?.state==="OPEN") return {allowed:false,reason:"Automation circuit is open."};
 const cooldown=await db.automationCooldown.findFirst({where:{policyId:policy.id,targetResource:input.targetResource,endsAt:{gt:new Date()}},orderBy:{endsAt:"desc"}});
 if(cooldown) return {allowed:false,reason:"Automation cooldown is active."};
 const since=new Date(Date.now()-windowSeconds(jsonObject(policy.idempotencyPolicy))*1000);
 const recent=await db.automationExecution.count({where:{policyId:policy.id,targetResource:input.targetResource,createdAt:{gte:since},state:{notIn:["BLOCKED","CANCELLED"]}}});
 if(recent>=policy.maxExecutionsPerWindow) return {allowed:false,reason:"Automation execution-rate limit has been reached."};
 const active=await db.automationExecution.count({where:{policyId:policy.id,targetResource:input.targetResource,state:{in:["RUNNING","APPROVED","PENDING_APPROVAL"]}}});
 const concurrency=jsonObject(policy.concurrencyPolicy).maxConcurrent;
 if(typeof concurrency==="number"&&active>=Math.max(1,Math.min(10,Math.floor(concurrency)))) return {allowed:false,reason:"Automation concurrency limit has been reached."};
 return {allowed:true,reason:"Safety controls passed."};
}

async function ensurePolicyActions(policy:NonNullable<Awaited<ReturnType<typeof db.automationPolicy.findUnique>>>){
 const keys=actionKeys(policy.actions);
 if(!keys.length) throw new Error("Automation policy contains no registered actions.");
 for(const key of keys){
  const action=getRegisteredAction(key);
  if(!action) throw new Error(`Automation action is not registered: ${key}.`);
  if(action.risk==="PROHIBITED") throw new Error(`Automation action is prohibited: ${key}.`);
  if(action.risk!==policy.risk&&!(policy.risk==="CONTROLLED_AUTOMATION"&&action.risk==="SAFE_AUTOMATION")) throw new Error(`Action risk does not match policy risk: ${key}.`);
 }
 return keys;
}

export async function evaluateAutomation(policyId:string,input:EvaluationInput){
 const policy=await db.automationPolicy.findUnique({where:{id:policyId}});
 if(!policy)throw new Error("Automation policy not found.");
 const version=await db.automationPolicyVersion.findUnique({where:{policyId_version:{policyId,version:policy.version}}});
 const risk=policy.risk as AutomationRiskClass;
 const actions=await ensurePolicyActions(policy);
 validatePolicyDefinition({risk,enabled:policy.enabled,dryRun:policy.dryRun,timeoutSeconds:policy.timeoutSeconds,retryLimit:policy.retryLimit,cooldownSeconds:policy.cooldownSeconds,maxExecutionsPerWindow:policy.maxExecutionsPerWindow,actions});
 const conditionsPass=evaluateConditions(input.values,conditionsOf(policy.conditions));
 const guards=await enforceGuards(policy,input);
 const autonomous=autonomousAllowed(risk);
 const requiresApproval=riskRequiresApproval(risk)||!autonomous;
 const allowed=guards.allowed&&conditionsPass&&!requiresApproval;
 const dryRun=Boolean(input.dryRun||policy.dryRun);
 const state:AutomationExecutionState=dryRun?"BLOCKED":allowed?"RUNNING":guards.allowed&&conditionsPass?"PENDING_APPROVAL":"BLOCKED";
 const reason=!conditionsPass?"Conditions did not match.":guards.reason;
 const safety=await db.automationSafetyEvaluation.create({data:{policyId,allowed,risk,reason,environment:input.environment,details:{conditionsPass,guards,requiresApproval,dryRun,policyVersion:policy.version}}});
 const execution=await db.automationExecution.create({data:{policyId,policyVersionId:version?.id??null,triggerId:input.triggerId??null,triggerFingerprint:input.triggerFingerprint,idempotencyKey:input.triggerFingerprint+"::"+policy.version,targetResource:input.targetResource,targetScope:boundedScope({environment:input.environment,resourceId:input.targetResource}),risk,state,environment:input.environment,correlationId:input.correlationId,reason,requestedBy:input.requestedBy??null,result:{conditionsPass,guards,requiresApproval,dryRun}}});
 await db.automationSafetyEvaluation.update({where:{id:safety.id},data:{executionId:execution.id}});
 return {policy,execution,safetyId:safety.id,actions:actions.map(key=>getRegisteredAction(key)).filter(Boolean),registeredActions:listRegisteredActions()};
}

export async function executeAutomation(executionId:string,input:{reason:string;parameters?:Record<string,unknown>}){
 const execution=await db.automationExecution.findUnique({where:{id:executionId}});
 if(!execution)throw new Error("Automation execution not found.");
 if(execution.state!=="RUNNING")throw new Error("Automation execution is not in a runnable state.");
 const policy=await db.automationPolicy.findUnique({where:{id:execution.policyId}});
 if(!policy)throw new Error("Automation policy not found.");
 if(policy.version!==(await db.automationPolicyVersion.findFirst({where:{policyId:policy.id},orderBy:{version:"desc"}}))?.version)throw new Error("Automation policy has changed; historical execution cannot be executed against a newer policy.");
 if(execution.risk!=="SAFE_AUTOMATION"&&execution.risk!=="CONTROLLED_AUTOMATION")throw new Error("Automation execution requires explicit approval.");
 if(policy.dryRun)throw new Error("Automation policy is in dry-run mode.");
 const actions=await ensurePolicyActions(policy);
 const circuit=await db.automationCircuit.findUnique({where:{policyId:policy.id}});
 if(circuit?.state==="OPEN")throw new Error("Automation circuit is open.");
 const lockKey=`automation:${policy.id}:${execution.targetResource}`;
 const lockExpiry=nowPlus(policy.timeoutSeconds);
 try{
  await db.automationLock.create({data:{lockKey,ownerId:execution.id,expiresAt:lockExpiry}});
 }catch{throw new Error("Automation target is already locked by another execution.");}
 const started=new Date();
 await db.automationExecution.update({where:{id:execution.id},data:{startedAt:started}});
 const results:unknown[]=[];
 try{
  for(let index=0;index<actions.length;index++){
   const key=actions[index];
   const action=getRegisteredAction(key);
   if(!action||!autonomousAllowed(action.risk))throw new Error(`Action is not autonomously executable: ${key}.`);
   const step=await db.automationExecutionStep.create({data:{executionId:execution.id,stepOrder:index+1,actionKey:key,state:"RUNNING",startedAt:new Date(),rollbackMode:action.rollback}});
   try{
    const result=await executeRegisteredAction(key,{reason:input.reason,correlationId:execution.correlationId,environment:execution.environment,targetResource:execution.targetResource},input.parameters??{});
    const normalized=jsonObject(result);
    if(normalized.status==="FAILING"||normalized.status==="BLOCKED"||normalized.success===false)throw new Error(`Automation postcondition failed for action ${key}.`);
    results.push({action:key,result});
    await db.automationExecutionStep.update({where:{id:step.id},data:{state:"SUCCEEDED",finishedAt:new Date(),result:result as Prisma.InputJsonValue}});
   }catch(error){
    const message=error instanceof Error?error.message:"Automation action failed.";
    await db.automationExecutionStep.update({where:{id:step.id},data:{state:"FAILED",finishedAt:new Date(),errorClass:"UNKNOWN",errorMetadata:{message}}});
    throw error;
   }
  }
  await db.automationCooldown.create({data:{policyId:policy.id,targetResource:execution.targetResource,startsAt:new Date(),endsAt:nowPlus(policy.cooldownSeconds)}});
  await db.automationCircuit.update({where:{policyId:policy.id},data:{state:"CLOSED",consecutiveFailures:0}});
  assertExecutionTransition(execution.state as AutomationExecutionState,"SUCCEEDED");
  return db.automationExecution.update({where:{id:execution.id},data:{state:"SUCCEEDED",finishedAt:new Date(),result:{results:results as Prisma.InputJsonValue}}});
 }catch(error){
  const message=error instanceof Error?error.message:"Automation execution failed.";
  await db.automationFailure.create({data:{executionId:execution.id,class:"UNKNOWN",message:message.slice(0,2000),metadata:{correlationId:execution.correlationId},retryCount:execution.retryCount}});
  const circuit=await db.automationCircuit.update({where:{policyId:policy.id},data:{state:"OPEN",consecutiveFailures:{increment:1},totalFailures:{increment:1},openedAt:new Date(),lastFailureAt:new Date(),reason:message.slice(0,1000)}});
  await db.automationEscalation.create({data:{executionId:execution.id,reason:message.slice(0,2000),severity:"HIGH",status:"OPEN"}});
  await recordReliabilityFindings([{fingerprint:incidentFingerprint("automation","OPERATIONS",policy.stableId),severity:"MAJOR",category:"OPERATIONS",capability:"operations-automation",title:`Automation ${policy.name} failed`,summary:message.slice(0,2000),metadata:{executionId:execution.id,policyId:policy.id,correlationId:execution.correlationId,circuitState:circuit.state}}]);
  await db.automationExecution.update({where:{id:execution.id},data:{state:"FAILED",finishedAt:new Date(),errorClass:"UNKNOWN",errorMetadata:{message}}});
  throw error;
 }finally{
  await db.automationLock.updateMany({where:{lockKey,ownerId:execution.id,releasedAt:null},data:{releasedAt:new Date()}});
 }
}

export async function listAutomationExecutions(limit=50){
 return db.automationExecution.findMany({orderBy:{createdAt:"desc"},take:Math.min(Math.max(limit,1),100),select:{id:true,policyId:true,state:true,risk:true,idempotencyKey:true,targetResource:true,environment:true,correlationId:true,createdAt:true,finishedAt:true,result:true,reason:true}});
}

export async function getAutomationOverview(){
 const [policies,executions,circuits,approvals]=await Promise.all([
  db.automationPolicy.findMany({orderBy:{updatedAt:"desc"},take:100,select:{id:true,stableId:true,name:true,domain:true,risk:true,status:true,enabled:true,dryRun:true,version:true,owner:true,reviewer:true,expiresAt:true}}),
  listAutomationExecutions(100),
  db.automationCircuit.findMany({orderBy:{updatedAt:"desc"},take:100}),
  db.automationApproval.findMany({where:{approvedAt:null,rejectedAt:null,expiresAt:{gt:new Date()}},orderBy:{createdAt:"asc"},take:100})
 ]);
 return {policies,executions,circuits,pendingApprovals:approvals,registeredActions:listRegisteredActions()};
}

export async function approveAutomation(executionId:string,approverId:string,reason:string){
 const execution=await db.automationExecution.findUnique({where:{id:executionId}});
 if(!execution)throw new Error("Automation execution not found.");
 if(execution.state!=="PENDING_APPROVAL")throw new Error("Automation execution is not awaiting approval.");
 if(execution.requestedBy&&execution.requestedBy===approverId)throw new Error("Separation of duties prevents self-approval.");
 const policy=await db.automationPolicy.findUnique({where:{id:execution.policyId}});
 if(!policy||policy.status!=="ACTIVE"||!policy.enabled||policy.dryRun)throw new Error("Automation policy is not currently executable.");
 if(execution.policyVersionId){
  const version=await db.automationPolicyVersion.findUnique({where:{id:execution.policyVersionId}});
  if(!version||version.version!==policy.version)throw new Error("The approval request references an obsolete policy version.");
 }
 const approval=await db.automationApproval.create({data:{executionId,policyId:execution.policyId,policyVersionId:execution.policyVersionId,requesterId:execution.requestedBy,approverId,target:execution.targetResource,action:actionKeys(policy.actions).join(","),reason:reason.slice(0,1000),risk:execution.risk,expiresAt:nowPlus(15*60),approvedAt:new Date()}});
 await db.automationExecution.update({where:{id:executionId},data:{state:"APPROVED",approvedBy:approverId,approvalId:approval.id}});
 return db.automationExecution.update({where:{id:executionId},data:{state:"RUNNING"}});
}

export async function rejectAutomation(executionId:string,approverId:string,reason:string){
 const execution=await db.automationExecution.findUnique({where:{id:executionId}});
 if(!execution)throw new Error("Automation execution not found.");
 if(execution.state!=="PENDING_APPROVAL")throw new Error("Automation execution is not awaiting approval.");
 if(execution.requestedBy&&execution.requestedBy===approverId)throw new Error("Separation of duties prevents self-rejection.");
 await db.automationApproval.create({data:{executionId,policyId:execution.policyId,policyVersionId:execution.policyVersionId,requesterId:execution.requestedBy,approverId,target:execution.targetResource,action:"REJECT",reason:reason.slice(0,1000),risk:execution.risk,expiresAt:new Date(),rejectedAt:new Date()}});
 return db.automationExecution.update({where:{id:executionId},data:{state:"BLOCKED",escalationState:"REJECTED"}});
}

export async function disableAutomation(policyId:string,reason:string){
 const policy=await db.automationPolicy.findUnique({where:{id:policyId}});
 if(!policy)throw new Error("Automation policy not found.");
 const updated=await db.automationPolicy.update({where:{id:policyId},data:{enabled:false,status:"DISABLED",version:{increment:1}}});
 await db.automationCircuit.upsert({where:{policyId},create:{policyId,state:"OPEN",reason},update:{state:"OPEN",reason}});
 return updated;
}
