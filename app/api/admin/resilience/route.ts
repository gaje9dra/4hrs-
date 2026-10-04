import { NextResponse } from "next/server";
import { requireAdmin, requireHighRiskReason } from "@/lib/admin/authorization";
import {
 createExperiment, reviewExperiment, reviseExperiment, approveExperiment, scheduleExperiment, readyExperiment,
 executeExperiment, abortExperiment, registerFault, registerTarget, createCertificate,
 setEmergencySuppression, getResilienceOverview
} from "@/lib/resilience/experiments";

export const dynamic="force-dynamic";
export const revalidate=0;

const jsonBody=async(request:Request)=>await request.json() as Record<string,unknown>;
const str=(v:unknown)=>typeof v==="string"?v.trim():"";

export async function GET(request:Request){
 try{await requireAdmin(request,"resilience.read");return NextResponse.json(await getResilienceOverview(),{headers:{"cache-control":"private,no-store"}});}
 catch(error){return NextResponse.json({error:{message:error instanceof Error?error.message:"Resilience request failed safely."}},{status:403});}
}

export async function POST(request:Request){
 try{
  const body=await jsonBody(request); const action=str(body.action);
  if(action==="CREATE"){
   const ctx=await requireAdmin(request,"resilience.create");
   return NextResponse.json({result:await createExperiment({
    stableId:str(body.stableId),name:str(body.name),category:str(body.category),mode:str(body.mode),environment:str(body.environment),
    owner:str(body.owner)||ctx.adminUser.id,reviewer:str(body.reviewer)||ctx.adminUser.id,targetStableId:str(body.targetStableId),faultStableId:str(body.faultStableId),
    timeoutSeconds:Number(body.timeoutSeconds),expiration:new Date(str(body.expiration)),blastRadius:(body.blastRadius??{}) as Record<string,unknown>,
    hypothesis:(body.hypothesis??{}) as Record<string,unknown>,expectedBehavior:(body.expectedBehavior??{}) as Record<string,unknown>,abortCriteria:(body.abortCriteria??{}) as Record<string,unknown>
   })},{status:201});
  }
  if(action==="REVIEW"){await requireAdmin(request,"resilience.edit");return NextResponse.json({result:await reviewExperiment(str(body.id))});}
  if(action==="EDIT"){await requireAdmin(request,"resilience.edit");return NextResponse.json({result:await reviseExperiment(str(body.id),{targetStableId:str(body.targetStableId)||undefined,faultStableId:str(body.faultStableId)||undefined,timeoutSeconds:body.timeoutSeconds===undefined?undefined:Number(body.timeoutSeconds),blastRadius:body.blastRadius as Record<string,unknown>|undefined,hypothesis:body.hypothesis as Record<string,unknown>|undefined,expectedBehavior:body.expectedBehavior as Record<string,unknown>|undefined,abortCriteria:body.abortCriteria as Record<string,unknown>|undefined})});}
  if(action==="APPROVE"){
   const ctx=await requireAdmin(request,"resilience.approve"); const reason=requireHighRiskReason(body.reason);
   return NextResponse.json({result:await approveExperiment(str(body.id),{approvedBy:ctx.adminUser.id,reason,expiresAt:new Date(str(body.expiresAt))})});
  }
  if(action==="SCHEDULE"){
   const ctx=await requireAdmin(request,"resilience.schedule");
   return NextResponse.json({result:await scheduleExperiment(str(body.id),{scheduledFor:new Date(str(body.scheduledFor)),createdBy:ctx.adminUser.id})});
  }
  if(action==="READY"){await requireAdmin(request,"resilience.simulate");return NextResponse.json({result:await readyExperiment(str(body.id))});}
  if(action==="EXECUTE"){
   const mode=str(body.mode);
   const permission=mode==="CONTROLLED_PRODUCTION"?"resilience.execute.production":mode==="SYNTHETIC_PRODUCTION"?"resilience.execute.synthetic":mode==="STAGING"?"resilience.execute.staging":"resilience.simulate";
   const ctx=await requireAdmin(request,permission);
   return NextResponse.json({result:await executeExperiment(str(body.id),{requestedBy:ctx.adminUser.id,correlationId:str(body.correlationId)||undefined,permissionMode:mode})});
  }
  if(action==="ABORT"){
   const ctx=await requireAdmin(request,"resilience.abort"); const reason=requireHighRiskReason(body.reason);
   return NextResponse.json({result:await abortExperiment(str(body.id),{reason,actor:ctx.adminUser.id})});
  }
  if(action==="REGISTER_TARGET"){
   await requireAdmin(request,"resilience.catalog.manage");
   return NextResponse.json({result:await registerTarget({stableId:str(body.stableId),name:str(body.name),targetType:str(body.targetType),environment:str(body.environment),syntheticOnly:Boolean(body.syntheticOnly),productionSafe:Boolean(body.productionSafe),scope:body.scope??{}})},{status:201});
  }
  if(action==="REGISTER_FAULT"){
   await requireAdmin(request,"resilience.catalog.manage");
   return NextResponse.json({result:await registerFault({stableId:str(body.stableId),name:str(body.name),category:str(body.category),riskClass:str(body.riskClass),supportedTargets:Array.isArray(body.supportedTargets)?body.supportedTargets.filter((x):x is string=>typeof x==="string"):[],maximumDurationSeconds:Number(body.maximumDurationSeconds),maximumAffectedRequests:Number(body.maximumAffectedRequests),maximumAffectedJobs:Number(body.maximumAffectedJobs),rollbackBehavior:body.rollbackBehavior??{},observabilityRequirements:body.observabilityRequirements??{}})},{status:201});
  }
  if(action==="CERTIFY"){
   const ctx=await requireAdmin(request,"resilience.certify");
   return NextResponse.json({result:await createCertificate(str(body.experimentId),str(body.executionId),ctx.adminUser.id)});
  }
  if(action==="EMERGENCY_SUPPRESS"){
   const ctx=await requireAdmin(request,"resilience.disable"); const reason=requireHighRiskReason(body.reason);
   return NextResponse.json({result:await setEmergencySuppression({stableId:str(body.stableId),reason:reason+" [actor:"+ctx.adminUser.id+"]",expiresAt:new Date(str(body.expiresAt)),disabledClass:str(body.disabledClass)||undefined})});
  }
  return NextResponse.json({error:{message:"Unsupported resilience action."}},{status:400});
 }catch(error){return NextResponse.json({error:{message:error instanceof Error?error.message:"Resilience operation failed safely."}},{status:403});}
}
