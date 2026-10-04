import { NextResponse } from "next/server";
import { requireAdmin, requireHighRiskReason } from "@/lib/admin/authorization";
import { auditAdminAction } from "@/lib/admin/audit";
import { AdminError } from "@/lib/admin/errors";
import { approveAutomation, disableAutomation, evaluateAutomation, executeAutomation, getAutomationOverview, rejectAutomation } from "@/lib/automation/service";

export const dynamic="force-dynamic";
export const revalidate=0;

function errorResponse(error:unknown){
 const code=error instanceof AdminError?error.code:"AUTOMATION_ERROR";
 return NextResponse.json({error:{code,message:error instanceof Error?error.message:"Automation operation failed safely."}},{status:code==="FORBIDDEN"?403:code==="INVALID_REQUEST"?400:503});
}

export async function GET(request:Request){
 try{
  await requireAdmin(request,"automation.read");
  return NextResponse.json(await getAutomationOverview(),{headers:{"cache-control":"private,no-store"}});
 }catch(error){return errorResponse(error);}
}

export async function POST(request:Request){
 let context;
 try{
  const body=await request.json() as {action?:unknown;policyId?:unknown;executionId?:unknown;reason?:unknown;targetResource?:unknown;triggerFingerprint?:unknown;environment?:unknown;values?:unknown;dryRun?:unknown;parameters?:unknown};
  if(typeof body.action!=="string")return NextResponse.json({error:{code:"INVALID_REQUEST",message:"action is required."}},{status:400});
  if(typeof body.reason!=="string"||body.reason.trim().length<3)return NextResponse.json({error:{code:"INVALID_REQUEST",message:"A reason is required."}},{status:400});
  const reason=requireHighRiskReason(body.reason);
  const correlationId=request.headers.get("x-request-id")??crypto.randomUUID();
  let result:unknown;
  if(body.action==="EVALUATE"||body.action==="SIMULATE"){
   context=await requireAdmin(request,body.action==="SIMULATE"?"automation.simulate":"automation.evaluate");
   if(typeof body.policyId!=="string"||typeof body.targetResource!=="string"||typeof body.triggerFingerprint!=="string"||typeof body.environment!=="string")return NextResponse.json({error:{code:"INVALID_REQUEST",message:"policyId, targetResource, triggerFingerprint and environment are required."}},{status:400});
   if(body.values!==undefined&&(typeof body.values!=="object"||body.values===null||Array.isArray(body.values)))return NextResponse.json({error:{code:"INVALID_REQUEST",message:"values must be an object."}},{status:400});
   result=await evaluateAutomation(body.policyId,{environment:body.environment,values:(body.values??{}) as Record<string,unknown>,triggerFingerprint:body.triggerFingerprint,targetResource:body.targetResource,reason,correlationId,dryRun:body.action==="SIMULATE"||body.dryRun===true,requestedBy:context.adminUser.id});
  }else if(body.action==="EXECUTE"){
   context=await requireAdmin(request,"automation.execute");
   if(typeof body.executionId!=="string")return NextResponse.json({error:{code:"INVALID_REQUEST",message:"executionId is required."}},{status:400});
   result=await executeAutomation(body.executionId,{reason,parameters:body.parameters&&typeof body.parameters==="object"&&!Array.isArray(body.parameters)?body.parameters as Record<string,unknown>:{}});
  }else if(body.action==="APPROVE"||body.action==="REJECT"){
   context=await requireAdmin(request,"automation.approve");
   if(typeof body.executionId!=="string")return NextResponse.json({error:{code:"INVALID_REQUEST",message:"executionId is required."}},{status:400});
   result=body.action==="APPROVE"?await approveAutomation(body.executionId,context.adminUser.id,reason):await rejectAutomation(body.executionId,context.adminUser.id,reason);
  }else if(body.action==="DISABLE"){
   context=await requireAdmin(request,"automation.disable");
   if(typeof body.policyId!=="string")return NextResponse.json({error:{code:"INVALID_REQUEST",message:"policyId is required."}},{status:400});
   result=await disableAutomation(body.policyId,reason);
  }else return NextResponse.json({error:{code:"INVALID_REQUEST",message:"Unsupported automation action."}},{status:400});
  await auditAdminAction(context,{action:"AUTOMATION_"+body.action,resourceType:"Automation",resourceId:typeof body.policyId==="string"?body.policyId:typeof body.executionId==="string"?body.executionId:undefined,success:true,reason,requestId:request.headers.get("x-request-id"),metadata:{correlationId}});
  return NextResponse.json({result},{headers:{"cache-control":"private,no-store"}});
 }catch(error){return errorResponse(error);}
}
