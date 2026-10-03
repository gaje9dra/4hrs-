import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db/client";
import { recordReliabilityFindings } from "@/lib/reliability/service";
import { incidentFingerprint } from "@/lib/reliability/incidents";
import { evaluateSyntheticSafety } from "./safety";
import { getWorkflow, WORKFLOW_REGISTRY } from "./registry";
import type { SyntheticFailureCode, SyntheticMode, SyntheticStatus } from "./model";

function envName(){return process.env.NODE_ENV==="production"?"PRODUCTION":(process.env.NODE_ENV??"development").toUpperCase();}
function releaseId(){return process.env.APP_VERSION??process.env.COMMIT_REF??null;}
function safeMeta(value: unknown): Prisma.InputJsonValue {
  if(!value||typeof value!=="object"||Array.isArray(value)) return {};
  const input=value as Record<string,unknown>; const out:Record<string,unknown>={};
  const sensitive=/(token|secret|password|authorization|cookie|api.?key|email|phone|address|payment|credential)/i;
  for(const [k,v] of Object.entries(input)){ if(sensitive.test(k)) continue; out[k]=typeof v==="string"?v.slice(0,300):v; }
  return JSON.parse(JSON.stringify(out)) as Prisma.InputJsonValue;
}
function combineStatus(statuses:SyntheticStatus[]):SyntheticStatus{
  if(statuses.includes("FAILING")) return "FAILING";
  if(statuses.includes("BLOCKED")) return "BLOCKED";
  if(statuses.includes("UNAVAILABLE")) return "UNAVAILABLE";
  if(statuses.includes("DEGRADED")) return "DEGRADED";
  if(statuses.length && statuses.every(s=>s==="HEALTHY")) return "HEALTHY";
  return "UNKNOWN";
}
async function identityFor(workflowId:string, environment:string, correlationId:string){
  const key=`synthetic:${environment.toLowerCase()}:${workflowId.toLowerCase()}`;
  return db.syntheticIdentity.upsert({where:{kind_environment_deterministicKey:{kind:"CATALOG_FIXTURE",environment,deterministicKey:key}},create:{key,kind:"CATALOG_FIXTURE",environment,deterministicKey:key,correlationId,metadata:{synthetic:true}},update:{active:true,correlationId}});
}
export async function executeSyntheticWorkflow(workflowId:string, mode:SyntheticMode, options:{baseUrl?:string; reason?:string; correlationId?:string}={}){
  const workflow=getWorkflow(workflowId); if(!workflow) throw new Error("Synthetic workflow was not found.");
  const safety=evaluateSyntheticSafety(mode);
  const correlationId=options.correlationId??randomUUID();
  if(!safety.allowed) {
    return persistBlocked(workflowId,mode,correlationId,safety.reasons);
  }
  if(mode==="PRODUCTION_SAFE"&&!workflow.productionSafe) return persistBlocked(workflowId,mode,correlationId,[workflow.blockedReason??"Workflow is not production-safe."]);
  const baseUrl=options.baseUrl??safety.baseUrl??process.env.NEXT_PUBLIC_SITE_URL??undefined;
  if(baseUrl&&safety.baseUrl) { const a=new URL(baseUrl); const b=new URL(safety.baseUrl); if(a.origin!==b.origin) return persistBlocked(workflowId,mode,correlationId,["Target is outside allowlist."]); }
  const started=new Date();
  const execution=await db.syntheticExecution.create({data:{workflowId,mode,environment:safety.environment,status:"UNKNOWN",startedAt:started,correlationId,traceId:correlationId,releaseId:releaseId(),deploymentId:process.env.NETLIFY_DEPLOY_ID??process.env.DEPLOYMENT_ID??null,featureFlagState:{mode},dependencyVersions:{app:releaseId()},syntheticIdentityId:(await identityFor(workflowId,safety.environment,correlationId)).id}});
  const stepResults:SyntheticStatus[]=[];
  let failureCode:SyntheticFailureCode|undefined=undefined;
  try {
    for(let i=0;i<workflow.steps.length;i++){
      const step=workflow.steps[i]; const ss=new Date();
      let result;
      try{ result=await step.execute({mode,environment:safety.environment,correlationId,traceId:correlationId,baseUrl,timeoutMs:workflow.timeoutMs}); }
      catch(error){ result={status:"FAILING" as const,failureCode:"CONFIGURATION_FAILURE" as const,diagnostic:{error:error instanceof Error?error.message:"unknown"}}; }
      stepResults.push(result.status); if(result.failureCode) failureCode=result.failureCode;
      await db.syntheticStepExecution.create({data:{executionId:execution.id,stepKey:step.key,stepOrder:i+1,status:result.status,startedAt:ss,endedAt:new Date(),durationMs:new Date().getTime()-ss.getTime(),failureCode:result.failureCode,diagnostic:safeMeta(result.diagnostic),dependency:step.dependency??null}});
      if(result.status==="FAILING") break;
    }
    const status=combineStatus(stepResults);
    const ended=new Date();
    const row=await db.syntheticExecution.update({where:{id:execution.id},data:{status,failureCode,endedAt:ended,durationMs:ended.getTime()-started.getTime(),cleanupStatus:"SUCCEEDED",evidence:{stepCount:stepResults.length,mode}}});
    if(status==="FAILING"||status==="DEGRADED"){
      await recordReliabilityFindings([{fingerprint:incidentFingerprint("synthetic","AVAILABILITY",workflowId),severity:workflow.failureSeverity==="P0"?"CRITICAL":workflow.failureSeverity==="P1"?"MAJOR":"OPERATIONAL",category:"AVAILABILITY" as const,capability:"synthetic-monitoring",title:`Synthetic workflow ${workflowId} failed`,summary:`Synthetic execution ${row.id} reported ${status}.`,metadata:{workflowId,executionId:row.id,correlationId,failureCode}}]);
    }
    return row;
  } catch(error){
    await db.syntheticExecution.update({where:{id:execution.id},data:{status:"FAILING",failureCode:"CONFIGURATION_FAILURE",endedAt:new Date(),cleanupStatus:"FAILED",cleanupError:error instanceof Error?error.message:"unknown"}});
    throw error;
  }
}
async function persistBlocked(workflowId:string,mode:SyntheticMode,correlationId:string,reasons:string[]){
  const now=new Date();
  return db.syntheticExecution.create({data:{workflowId,mode,environment:envName(),status:"BLOCKED",failureCode:"SAFETY_GUARD_BLOCK",startedAt:now,endedAt:now,durationMs:0,correlationId,traceId:correlationId,releaseId:releaseId(),deploymentId:process.env.NETLIFY_DEPLOY_ID??null,cleanupStatus:"NOT_REQUIRED",evidence:{reasons:safeMeta({reasons})}}});
}
export async function syntheticSummary(){
  const [total,healthy,failing,blocked,latest]=await Promise.all([
    db.syntheticExecution.count(),db.syntheticExecution.count({where:{status:"HEALTHY"}}),db.syntheticExecution.count({where:{status:"FAILING"}}),
    db.syntheticExecution.count({where:{status:"BLOCKED"}}),db.syntheticExecution.findMany({orderBy:{startedAt:"desc"},take:50,select:{workflowId:true,status:true,startedAt:true,durationMs:true,failureCode:true,environment:true,releaseId:true,deploymentId:true,cleanupStatus:true}})
  ]);
  return {total,healthy,failing,blocked,latest};
}
export async function listSyntheticExecutions(options:{workflowId?:string;status?:SyntheticStatus;environment?:string;limit?:number}={}){
  return db.syntheticExecution.findMany({where:{...(options.workflowId?{workflowId:options.workflowId}:{}),...(options.status?{status:options.status}:{}),...(options.environment?{environment:options.environment}:{})},orderBy:{startedAt:"desc"},take:Math.min(Math.max(options.limit??100,1),200),include:{steps:{orderBy:{stepOrder:"asc"}}}});
}
export async function evaluateReadiness(environment=envName()){
  const latest=await db.syntheticExecution.findMany({where:{environment},orderBy:{startedAt:"desc"},take:200});
  const byWorkflow=new Map<string,typeof latest[number]>();
  for(const row of latest) if(!byWorkflow.has(row.workflowId)) byWorkflow.set(row.workflowId,row);
  const critical=WORKFLOW_REGISTRY.filter(w=>w.failureSeverity==="P0"&&w.productionSafe);
  const criticalFailures=critical.filter(w=>byWorkflow.get(w.id)?.status!=="HEALTHY").map(w=>({workflowId:w.id,status:byWorkflow.get(w.id)?.status??"NOT_CONFIGURED"}));
  const blocked=WORKFLOW_REGISTRY.filter(w=>!w.productionSafe).map(w=>({workflowId:w.id,reason:w.blockedReason}));
  const readiness=criticalFailures.length?"NOT_READY":blocked.length?"READY_WITH_WARNINGS":"READY";
  const certification=await db.syntheticCertification.create({data:{environment,releaseId:releaseId(),deploymentId:process.env.NETLIFY_DEPLOY_ID??null,evaluator:"synthetic-readiness-engine",readiness,workflowResults:{count:byWorkflow.size,critical:critical.map(w=>w.id)},criticalFailures,warnings:blocked,blockedCapabilities:blocked,unresolvedExceptions:[],governanceEvidence:{source:"synthetic-monitoring"},reconciliationStatus:{source:"phase-15.22"}}});
  return {readiness,criticalFailures,blockedCapabilities:blocked,certificationId:certification.id};
}
export function registryHealth(){return {workflowCount:WORKFLOW_REGISTRY.length,productionSafeCount:WORKFLOW_REGISTRY.filter(w=>w.productionSafe).length,blockedCount:WORKFLOW_REGISTRY.filter(w=>!w.productionSafe).length};}
