import { db } from "@/lib/db/client";
import { randomUUID } from "node:crypto";
import { executeRegisteredAction, getRegisteredAction, listRegisteredActions } from "./actions";
import { assertExecutionTransition, autonomousAllowed, evaluateConditions, riskRequiresApproval, type AutomationRiskClass, type AutomationExecutionState, type StructuredCondition, validatePolicyDefinition, boundedScope } from "./model";

type EvaluationInput={environment:string;values:Record<string,unknown>;triggerFingerprint:string;targetResource:string;reason:string;correlationId:string;dryRun?:boolean};

function jsonObject(value:unknown):Record<string,unknown>{return value&&typeof value==="object"&&!Array.isArray(value)?value as Record<string,unknown>:{};}
function conditionsOf(value:unknown):StructuredCondition[]{return Array.isArray(value)?value.filter((x):x is StructuredCondition=>Boolean(x&&typeof x==="object"&&typeof (x as Record<string,unknown>).key==="string")):[];}
function actionKeys(value:unknown){return Array.isArray(value)?value.filter((x):x is string=>typeof x==="string"):[];}

export async function evaluateAutomation(policyId:string,input:EvaluationInput){
 const policy=await db.automationPolicy.findUnique({where:{id:policyId},include:{versions:true}});
 if(!policy)throw new Error("Automation policy not found.");
 const risk=policy.risk as AutomationRiskClass;
 const conditions=conditionsOf(policy.conditions);
 const actions=actionKeys(policy.actions);
 validatePolicyDefinition({risk,enabled:policy.enabled,dryRun:policy.dryRun,timeoutSeconds:policy.timeoutSeconds,retryLimit:policy.retryLimit,cooldownSeconds:policy.cooldownSeconds,maxExecutionsPerWindow:policy.maxExecutionsPerWindow,actions});
 const safety=await db.automationSafetyEvaluation.create({data:{policyId,allowed:false,risk,reason:"Evaluating deterministic safety controls.",environment:input.environment,details:{target:input.targetResource}}});
 const conditionsPass=evaluateConditions(input.values,conditions);
 const envAllowed=policy.allowedEnvironments.length===0||policy.allowedEnvironments.includes(input.environment);
 const allowed=policy.status==="ACTIVE"&&policy.enabled&&conditionsPass&&envAllowed&&!risk==="PROHIBITED";
 const requiresApproval=riskRequiresApproval(risk)||!autonomousAllowed(risk);
 await db.automationSafetyEvaluation.update({where:{id:safety.id},data:{allowed:allowed&&!requiresApproval,reason:!conditionsPass?"Conditions did not match.":!envAllowed?"Environment is not allowed.":requiresApproval?"Human approval is required.":"Safety controls passed.",details:{conditionsPass,envAllowed,requiresApproval,risk}}});
 const version=[...policy.versions].sort((a,b)=>b.version-a.version)[0];
 const state:AutomationExecutionState=input.dryRun||policy.dryRun?"BLOCKED":allowed&&!requiresApproval?"RUNNING":allowed?"PENDING_APPROVAL":"BLOCKED";
 const execution=await db.automationExecution.create({data:{policyId,policyVersionId:version?.id??null,triggerFingerprint:input.triggerFingerprint,idempotencyKey:input.triggerFingerprint+"::"+policy.version,targetResource:input.targetResource,targetScope:boundedScope({environment:input.environment,resourceId:input.targetResource}),state,environment:input.environment,correlationId:input.correlationId,reason:input.reason,result:{conditionsPass,envAllowed,requiresApproval,dryRun:Boolean(input.dryRun||policy.dryRun)}}});
 return {policy,execution,safetyId:safety.id,actions:actions.map(key=>getRegisteredAction(key)).filter(Boolean),registeredActions:listRegisteredActions()};
}

export async function executeAutomation(executionId:string,input:{reason:string;parameters?:Record<string,unknown>}){
 const execution=await db.automationExecution.findUnique({where:{id:executionId},include:{policy:true}});
 if(!execution)throw new Error("Automation execution not found.");
 if(execution.state!=="RUNNING")throw new Error("Automation execution is not in a runnable state.");
 if(execution.policy.risk!=="SAFE_AUTOMATION"&&execution.policy.risk!=="CONTROLLED_AUTOMATION")throw new Error("Automation execution requires explicit approval.");
 const actionKeysList=actionKeys(execution.policy.actions);
 const results=[] as unknown[];
 for(const key of actionKeysList){
   const action=getRegisteredAction(key); if(!action)throw new Error("Automation action is not registered.");
   if(!autonomousAllowed(action.risk))throw new Error("Action is not autonomously executable.");
   const result=await executeRegisteredAction(key,{reason:input.reason,correlationId:execution.correlationId,environment:execution.environment,targetResource:execution.targetResource},input.parameters??{});
   results.push({action:key,result});
 }
 assertExecutionTransition(execution.state as AutomationExecutionState,"SUCCEEDED");
 return db.automationExecution.update({where:{id:executionId},data:{state:"SUCCEEDED",finishedAt:new Date(),result:{results}}});
}

export async function listAutomationExecutions(limit=50){
 return db.automationExecution.findMany({orderBy:{createdAt:"desc"},take:Math.min(Math.max(limit,1),100),select:{id:true,policyId:true,state:true,risk:true,idempotencyKey:true,targetResource:true,environment:true,correlationId:true,createdAt:true,finishedAt:true,result:true,reason:true}});
}
