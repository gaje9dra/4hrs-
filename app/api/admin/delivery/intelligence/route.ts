import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/authorization";
import type { AdminPermission } from "@/lib/admin/permissions";
import * as svc from "@/lib/delivery-intelligence/service";

export const dynamic="force-dynamic";
const text=(v:unknown)=>typeof v==="string"?v.trim():"";
const permissions:Record<string,AdminPermission>={
 LIST:"delivery:intelligence:view",DETAIL:"delivery:promotion:view",EVALUATE:"delivery:intelligence:evaluate",
 INVALIDATE:"delivery:promotion:block",CERTIFY:"delivery:certification:view",INVALIDATE_CERTIFICATION:"delivery:certification:invalidate",
 ACQUIRE_LOCK:"delivery:lock:manage",RELEASE_LOCK:"delivery:lock:manage", REQUEST_APPROVAL:"delivery:promotion:approve", APPROVE:"delivery:promotion:approve", HOLD:"delivery:promotion:block", BLOCK:"delivery:promotion:block", RE_EVALUATE:"delivery:intelligence:evaluate", MAINTENANCE:"delivery:intelligence:evaluate", INVALIDATE_MATERIAL:"delivery:promotion:block", POLICY:"delivery:policy:manage",
};
const mutating=new Set(["EVALUATE","INVALIDATE","CERTIFY","INVALIDATE_CERTIFICATION","ACQUIRE_LOCK","RELEASE_LOCK"]);
const requireIdempotency=(req:Request)=>{const k=text(req.headers.get("Idempotency-Key"));if(!k||k.length>200)throw new Error("Idempotency-Key is required.");return k;};

export async function GET(req:Request){
 try{
  const u=new URL(req.url);const action=text(u.searchParams.get("action"))||"LIST";await requireAdmin(req,permissions[action]??"delivery:intelligence:view");
  if(action==="LIST")return NextResponse.json(await svc.listAssessments(Number(u.searchParams.get("limit")||50)));
  if(action==="DETAIL")return NextResponse.json(await svc.getAssessment(text(u.searchParams.get("id"))));
  return NextResponse.json({error:"Unknown delivery intelligence query"},{status:400});
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:"Delivery intelligence query failed safely"},{status:403});}
}

export async function POST(req:Request){
 try{
  const body=await req.json() as Record<string,unknown>;const action=text(body.action);const auth=await requireAdmin(req,permissions[action]??"delivery:intelligence:view");if(mutating.has(action))requireIdempotency(req);
  if(action==="EVALUATE"){
   const input=body.input as svc.PromotionInput;
   if(!input||!input.pipelineId||!input.sourceEnvironment||!input.targetEnvironment||!input.policyVersion||!input.evidenceVersion||!input.evaluatedAt||!input.expiresAt) return NextResponse.json({error:"Incomplete promotion assessment input."},{status:400});
   return NextResponse.json({result:await svc.createAssessment(input,auth.adminUser.id)},{status:201});
  }
  if(action==="INVALIDATE")return NextResponse.json({result:await svc.invalidateAssessment(text(body.id),text(body.reason)||"Governance invalidation")});
  if(action==="CERTIFY")return NextResponse.json({result:await svc.certifyDelivery(body.input as {pipelineId:string;deliveryRunId?:string;policyVersion:string;evidenceReferences:string[];expiresAt:string;reason:string})},{status:201});
  if(action==="INVALIDATE_CERTIFICATION")return NextResponse.json({result:await svc.invalidateCertification(text(body.id),text(body.reason)||"Certification invalidated")});
  if(action==="ACQUIRE_LOCK")return NextResponse.json({result:await svc.acquireDeliveryLock(text(body.pipelineId),text(body.scope),auth.adminUser.id,Number(body.ttlSeconds)||900)},{status:201});
  if(action==="RELEASE_LOCK")return NextResponse.json({result:await svc.releaseDeliveryLock(text(body.id),auth.adminUser.id)});
  if(action==="REQUEST_APPROVAL")return NextResponse.json({result:await svc.requestApproval(text(body.assessmentId),auth.adminUser.id,text(body.reason)||"Approval requested")},{status:201});
  if(["APPROVE","HOLD","BLOCK","RE_EVALUATE"].includes(action))return NextResponse.json({result:await svc.decideApproval(text(body.assessmentId),auth.adminUser.id,action as "APPROVE"|"HOLD"|"BLOCK"|"RE_EVALUATE",text(body.reason)||"Governance decision")});
  if(action==="MAINTENANCE"){const r=await svc.runGovernanceMaintenance(auth.adminUser.id);return NextResponse.json({result:r});}
  if(action==="INVALIDATE_MATERIAL")return NextResponse.json({result:await svc.invalidateForMaterialChange(text(body.assessmentId),auth.adminUser.id,text(body.reason)||"Material condition changed")});
  if(action==="POLICY")return NextResponse.json({result:await svc.managePolicy(body.input as Parameters<typeof svc.managePolicy>[0])},{status:201});
  return NextResponse.json({error:"Unknown delivery intelligence action"},{status:400});
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:"Delivery intelligence operation failed safely"},{status:400});}
}
