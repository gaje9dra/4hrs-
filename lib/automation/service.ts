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
function safeJson(value:unknown):Prisma.InputJsonValue { const seen=new WeakSet<object>(); const walk=(v:unknown,depth=0):unknown=>{ if(v===null||typeof v==="string"||typeof v==="boolean"||typeof v==="number") return typeof v==="number"&& !Number.isFinite(v)?String(v):v; if(depth>5)return "[TRUNCATED]"; if(Array.isArray(v))return v.slice(0,50).map(x=>walk(x,depth+1)); if(typeof v==="object"){ if(seen.has(v))return "[CIRCULAR]"; seen.add(v); const out:Record<string,unknown>={}; for(const [k,x] of Object.entries(v).slice(0,50)){if(/password|hash|secret|token|cookie|credential|authorization|apiKey|accessKey|privateKey|email|phone|address/i.test(k))continue; out[k]=walk(x,depth+1);} return out;} return String(v); }; return walk(value) as Prisma.InputJsonValue; }

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
 const [active,criticalReconciliation,criticalCost,securityIncidents]=await Promise.all([
  db.automationExecution.count({where:{policyId:policy.id,targetResource:input.targetResource,state:{in:["RUNNING","APPROVED","PENDING_APPROVAL"]}}}),
  db.reconciliationCase.count({where:{severity:"CRITICAL",status:{notIn:["RESOLVED","IGNORED","NOT_REPRODUCIBLE"]}}}),
  db.costAnomaly.count({where:{severity:"CRITICAL",status:"OPEN"}}),
  db.reliabilityIncident.count({where:{category:"SECURITY",severity:{in:["CRITICAL","MAJOR"]},status:{in:["OPEN","ACKNOWLEDGED"]}}}),
 ]);
 if(criticalReconciliation>0)return {allowed:false,reason:"Critical reconciliation discrepancies are open; automation is fail-closed."};
 if(criticalCost>0)return {allowed:false,reason:"Critical cost anomalies are open; automation is fail-closed."};
 if(securityIncidents>0)return {allowed:false,reason:"Critical security incidents are open; automation is fail-closed."};
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
 const reason=!conditionsPass?"Conditions did not match.":guards.reason;
 const dryRun=Boolean(input.dryRun||policy.dryRun);
 if(dryRun){
  const targetScope=boundedScope({environment:input.environment,resourceId:input.targetResource});
  const conditionJson=JSON.parse(JSON.stringify(conditionsOf(policy.conditions))) as Prisma.InputJsonValue;
  const authorizationJson=JSON.parse(JSON.stringify(policy.authorization)) as Prisma.InputJsonValue;
  const inputJson=JSON.parse(JSON.stringify({triggerFingerprint:input.triggerFingerprint,values:input.values,environment:input.environment,targetResource:input.targetResource})) as Prisma.InputJsonValue;
  await db.automationDryRun.create({data:{policyId,policyVersionId:version?.id??null,trigger:{fingerprint:input.triggerFingerprint,environment:input.environment},conditions:conditionJson,target:{resource:input.targetResource,scope:targetScope},proposedAction:{actions},risk,authorization:authorizationJson,expectedImpact:"No production mutation is performed.",rollbackCapability:"Simulation only; no rollback is claimed.",blastRadius:targetScope,decisionReason:reason}});
  await db.automationSimulation.create({data:{policyId,policyVersionId:version?.id??null,input:inputJson,output:JSON.parse(JSON.stringify({conditionsPass,guards,requiresApproval,actions})) as Prisma.InputJsonValue,synthetic:true}});
 }
 const state:AutomationExecutionState=dryRun?"BLOCKED":allowed?"RUNNING":guards.allowed&&conditionsPass?"PENDING_APPROVAL":"BLOCKED";
 const safety=await db.automationSafetyEvaluation.create({data:{policyId,allowed,risk,reason,environment:input.environment,details:{conditionsPass,guards,requiresApproval,dryRun,policyVersion:policy.version}}});
 const execution=await db.automationExecution.create({data:{policyId,policyVersionId:version?.id??null,triggerId:input.triggerId??null,triggerFingerprint:input.triggerFingerprint,idempotencyKey:input.triggerFingerprint+"::"+policy.version,targetResource:input.targetResource,targetScope:boundedScope({environment:input.environment,resourceId:input.targetResource}),risk,state,environment:input.environment,correlationId:input.correlationId,reason,requestedBy:input.requestedBy??null,result:{conditionsPass,guards,requiresApproval,dryRun}}});
 await db.automationSafetyEvaluation.update({where:{id:safety.id},data:{executionId:execution.id}});
 await db.automationEvidence.create({data:{executionId:execution.id,policyId, type:dryRun?"SIMULATION":"SAFETY_EVALUATION",reference:safety.id,metadata:safeJson({conditionsPass,guards,requiresApproval,dryRun,policyVersion:policy.version})}});
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
 const latestApproval=execution.approvalId?await db.automationApproval.findUnique({where:{id:execution.approvalId}}):null;
 if(execution.risk!=="SAFE_AUTOMATION"&&execution.risk!=="CONTROLLED_AUTOMATION"&&(!latestApproval||!latestApproval.approvedAt||latestApproval.expiresAt<=new Date())) throw new Error("Automation approval is missing or expired.");
 const guard=await enforceGuards(policy,{environment:execution.environment,values:{},triggerFingerprint:execution.triggerFingerprint,targetResource:execution.targetResource,reason:input.reason,correlationId:execution.correlationId});
 if(!guard.allowed)throw new Error(guard.reason);
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
  await db.automationFailure.create({data:{executionId:execution.id,class:"UNKNOWN",message:message.slice(0,2000),metadata:safeJson({correlationId:execution.correlationId}),retryCount:execution.retryCount}});
  await db.automationEvidence.create({data:{executionId:execution.id,type:"FAILURE",reference:execution.id,metadata:safeJson({message,correlationId:execution.correlationId})}});
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
 const nextVersion=policy.version+1;
 const updated=await db.$transaction(async(tx)=>{
  const row=await tx.automationPolicy.update({where:{id:policyId},data:{enabled:false,status:"DISABLED",version:nextVersion}});
  await tx.automationPolicyVersion.create({data:{policyId,version:nextVersion,snapshot:{stableId:row.stableId,name:row.name,risk:row.risk,trigger:row.trigger,conditions:row.conditions,actions:row.actions,enabled:false,dryRun:row.dryRun,status:"DISABLED"}}});
  await tx.automationCircuit.upsert({where:{policyId},create:{policyId,state:"OPEN",openedAt:new Date(),reason},update:{state:"OPEN",openedAt:new Date(),reason}});
  return row;
 });
 return updated;
}

export async function ingestAutomationTrigger(input:{policyId:string;kind:string;fingerprint:string;environment:string;severity?:string;confidence?:number;evidence?:unknown;dependencyState?:unknown;maintenanceActive?:boolean;incidentId?:string;values?:Record<string,unknown>;targetResource:string;reason:string;correlationId:string;requestedBy?:string}){
 if(input.maintenanceActive) return {accepted:false,reason:"Automation trigger suppressed during maintenance."};
 const windowStart=new Date(Date.now()-15*60*1000);
 const [existing,causalExecution]=await Promise.all([
  db.automationTrigger.findFirst({where:{policyId:input.policyId,fingerprint:input.fingerprint,environment:input.environment,observedAt:{gte:windowStart}},orderBy:{observedAt:"desc"}}),
  db.automationExecution.findFirst({where:{policyId:input.policyId,correlationId:input.correlationId,createdAt:{gte:windowStart},state:{notIn:["BLOCKED","CANCELLED"]}},orderBy:{createdAt:"desc"}}),
 ]);
 if(existing) return {accepted:false,reason:"Duplicate trigger fingerprint suppressed.",triggerId:existing.id};
 if(causalExecution) return {accepted:false,reason:"Automation-induced trigger loop suppressed by correlation.",executionId:causalExecution.id};
 const trigger=await db.automationTrigger.create({data:{policyId:input.policyId,kind:input.kind,fingerprint:input.fingerprint,environment:input.environment,severity:input.severity,confidence:input.confidence,evidence:input.evidence===undefined?undefined:safeJson(input.evidence),dependencyState:input.dependencyState===undefined?undefined:safeJson(input.dependencyState),maintenanceActive:false,incidentId:input.incidentId,accepted:true}});
 const evaluation=await evaluateAutomation(input.policyId,{environment:input.environment,values:input.values??{},triggerFingerprint:input.fingerprint,targetResource:input.targetResource,reason:input.reason,correlationId:input.correlationId,requestedBy:input.requestedBy,triggerId:trigger.id});
 return {accepted:true,triggerId:trigger.id,evaluation};
}
