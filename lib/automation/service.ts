import { db } from "@/lib/db/client";
import { executeRegisteredAction, getRegisteredAction, listRegisteredActions } from "./actions";
import { assertExecutionTransition, autonomousAllowed, evaluateConditions, riskRequiresApproval, type AutomationRiskClass, type AutomationExecutionState, type StructuredCondition, validatePolicyDefinition, boundedScope } from "./model";

type EvaluationInput={environment:string;values:Record<string,unknown>;triggerFingerprint:string;targetResource:string;reason:string;correlationId:string;dryRun?:boolean;requestedBy?:string};

function conditionsOf(value:unknown):StructuredCondition[]{return Array.isArray(value)?value.filter((x):x is StructuredCondition=>Boolean(x&&typeof x==="object"&&typeof (x as Record<string,unknown>).key==="string")):[];}
function actionKeys(value:unknown){return Array.isArray(value)?value.filter((x):x is string=>typeof x==="string"):[];}

export async function evaluateAutomation(policyId:string,input:EvaluationInput){
 const policy=await db.automationPolicy.findUnique({where:{id:policyId}});
 if(!policy)throw new Error("Automation policy not found.");
 const versions=await db.automationPolicyVersion.findMany({where:{policyId},orderBy:{version:"desc"},take:1});
 const risk=policy.risk as AutomationRiskClass;
 const conditions=conditionsOf(policy.conditions);
 const actions=actionKeys(policy.actions);
 validatePolicyDefinition({risk,enabled:policy.enabled,dryRun:policy.dryRun,timeoutSeconds:policy.timeoutSeconds,retryLimit:policy.retryLimit,cooldownSeconds:policy.cooldownSeconds,maxExecutionsPerWindow:policy.maxExecutionsPerWindow,actions});
 const conditionsPass=evaluateConditions(input.values,conditions);
 const envAllowed=policy.allowedEnvironments.length===0||policy.allowedEnvironments.includes(input.environment);
 const prohibited=risk==="PROHIBITED";
 const autonomous=autonomousAllowed(risk);
 const requiresApproval=riskRequiresApproval(risk)||!autonomous;
 const allowed=policy.status==="ACTIVE"&&policy.enabled&&conditionsPass&&envAllowed&&!prohibited;
 const safety=await db.automationSafetyEvaluation.create({data:{policyId,allowed:allowed&&!requiresApproval,risk,reason:!conditionsPass?"Conditions did not match.":!envAllowed?"Environment is not allowed.":requiresApproval?"Human approval is required.":"Safety controls passed.",environment:input.environment,details:{conditionsPass,envAllowed,requiresApproval,risk}}});
 const dryRun=Boolean(input.dryRun||policy.dryRun);
 const state:AutomationExecutionState=dryRun?"BLOCKED":allowed&&!requiresApproval?"RUNNING":allowed?"PENDING_APPROVAL":"BLOCKED";
 const execution=await db.automationExecution.create({data:{policyId,policyVersionId:versions[0]?.id??null,triggerFingerprint:input.triggerFingerprint,idempotencyKey:input.triggerFingerprint+"::"+policy.version,targetResource:input.targetResource,targetScope:boundedScope({environment:input.environment,resourceId:input.targetResource}),risk,state,environment:input.environment,correlationId:input.correlationId,reason:input.reason,requestedBy:input.requestedBy??null,result:{conditionsPass,envAllowed,requiresApproval,dryRun}}});
 await db.automationSafetyEvaluation.update({where:{id:safety.id},data:{executionId:execution.id}});
 return {policy,execution,safetyId:safety.id,actions:actions.map(key=>getRegisteredAction(key)).filter(Boolean),registeredActions:listRegisteredActions()};
}

export async function executeAutomation(executionId:string,input:{reason:string;parameters?:Record<string,unknown>}){
 const execution=await db.automationExecution.findUnique({where:{id:executionId}});
 if(!execution)throw new Error("Automation execution not found.");
 const policy=await db.automationPolicy.findUnique({where:{id:execution.policyId}});
 if(!policy)throw new Error("Automation policy not found.");
 if(execution.state!=="RUNNING")throw new Error("Automation execution is not in a runnable state.");
 if(execution.risk!=="SAFE_AUTOMATION"&&execution.risk!=="CONTROLLED_AUTOMATION")throw new Error("Automation execution requires explicit approval.");
 const actionKeysList=actionKeys(policy.actions);
 const results:unknown[]=[];
 for(const key of actionKeysList){
   const action=getRegisteredAction(key);
   if(!action)throw new Error("Automation action is not registered.");
   if(!autonomousAllowed(action.risk))throw new Error("Action is not autonomously executable.");
   const result=await executeRegisteredAction(key,{reason:input.reason,correlationId:execution.correlationId,environment:execution.environment,targetResource:execution.targetResource},input.parameters??{});
   results.push({action:key,result});
 }
 assertExecutionTransition(execution.state as AutomationExecutionState,"SUCCEEDED");
 return db.automationExecution.update({where:{id:executionId},data:{state:"SUCCEEDED",startedAt:execution.startedAt??new Date(),finishedAt:new Date(),result:{results}}});
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
 return {policies,executions,circuits, pendingApprovals:approvals, registeredActions:listRegisteredActions()};
}

export async function approveAutomation(executionId:string,approverId:string,reason:string){
 const execution=await db.automationExecution.findUnique({where:{id:executionId}});
 if(!execution)throw new Error("Automation execution not found.");
 if(execution.state!=="PENDING_APPROVAL")throw new Error("Automation execution is not awaiting approval.");
 if(execution.requestedBy&&execution.requestedBy===approverId)throw new Error("Separation of duties prevents self-approval.");
 const policy=await db.automationPolicy.findUnique({where:{id:execution.policyId}});
 if(!policy||policy.status!=="ACTIVE"||!policy.enabled)throw new Error("Automation policy is not currently executable.");
 const approval=await db.automationApproval.create({data:{executionId,policyId:execution.policyId,policyVersionId:execution.policyVersionId,requesterId:execution.requestedBy,approverId,target:execution.targetResource,action:actionKeys(policy.actions).join(","),reason,risk:execution.risk,expiresAt:new Date(Date.now()+15*60*1000),approvedAt:new Date()}});
 await db.automationExecution.update({where:{id:executionId},data:{state:"APPROVED",approvedBy:approverId,approvalId:approval.id}});
 return db.automationExecution.update({where:{id:executionId},data:{state:"RUNNING"}});
}

export async function rejectAutomation(executionId:string,approverId:string,reason:string){
 const execution=await db.automationExecution.findUnique({where:{id:executionId}});
 if(!execution)throw new Error("Automation execution not found.");
 if(execution.state!=="PENDING_APPROVAL")throw new Error("Automation execution is not awaiting approval.");
 if(execution.requestedBy&&execution.requestedBy===approverId)throw new Error("Separation of duties prevents self-rejection.");
 await db.automationApproval.create({data:{executionId,policyId:execution.policyId,policyVersionId:execution.policyVersionId,requesterId:execution.requestedBy,approverId,target:execution.targetResource,action:"REJECT",reason,risk:execution.risk,expiresAt:new Date(),rejectedAt:new Date()}});
 return db.automationExecution.update({where:{id:executionId},data:{state:"BLOCKED",escalationState:"REJECTED"}});
}

export async function disableAutomation(policyId:string,reason:string){
 const policy=await db.automationPolicy.findUnique({where:{id:policyId}});
 if(!policy)throw new Error("Automation policy not found.");
 const updated=await db.automationPolicy.update({where:{id:policyId},data:{enabled:false,status:"DISABLED",version:{increment:1}}});
 await db.automationCircuit.upsert({where:{policyId},create:{policyId,state:"OPEN",reason},update:{state:"OPEN",reason}});
 return updated;
}
