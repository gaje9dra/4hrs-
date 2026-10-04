import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/authorization";
import type { AdminPermission } from "@/lib/admin/permissions";
import * as svc from "@/lib/delivery-orchestration/service";

export const dynamic="force-dynamic";
const t=(v:unknown)=>typeof v==="string"?v.trim():"";
const perms:Record<string,AdminPermission>={
 LIST:"delivery.read",DETAIL:"delivery.read",CREATE:"delivery.create",PREFLIGHT:"delivery.preflight",SCHEDULE:"delivery.schedule",
 START:"delivery.start",EXECUTE:"delivery.execute",PAUSE:"delivery.pause",ABORT:"delivery.abort",ROLLBACK:"delivery.rollback",
 FORWARD_RECOVERY:"delivery.recovery",VALIDATE:"delivery.validate",CERTIFY:"delivery.certify",INVALIDATE:"delivery.invalidate",
};
const mutating=new Set(Object.keys(perms).filter(k=>k!=="LIST"&&k!=="DETAIL"));
const idem=(req:Request)=>{const k=t(req.headers.get("Idempotency-Key"));if(mutating.size&&(!k||k.length>200))throw new Error("Idempotency-Key is required for delivery mutations");return k;};

export async function GET(req:Request){
 try{const u=new URL(req.url);const action=t(u.searchParams.get("action"))||"LIST";await requireAdmin(req,perms[action]??"delivery.read");
  if(action==="LIST")return NextResponse.json(await svc.listPipelines(Number(u.searchParams.get("limit")||50)));
  if(action==="DETAIL")return NextResponse.json(await svc.detail(t(u.searchParams.get("id"))));
  return NextResponse.json({error:"Unknown delivery query"},{status:400});
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:"Delivery query failed safely"},{status:403});}
}
export async function POST(req:Request){
 try{const body=await req.json() as Record<string,unknown>;const action=t(body.action);const auth=await requireAdmin(req,perms[action]??"delivery.read");const key=mutating.has(action)?idem(req):"";
  if(action==="CREATE")return NextResponse.json({result:await svc.createPipeline({
    stableId:t(body.stableId),changeRequestId:t(body.changeRequestId),releaseId:t(body.releaseId),deploymentId:t(body.deploymentId),
    ownerId:auth.adminUser.id,environment:t(body.environment),target:body.target,rolloutStrategy:t(body.rolloutStrategy)||"COORDINATED",
    policyVersion:t(body.policyVersion),validationPolicy:body.validationPolicy,approvalPolicy:body.approvalPolicy,rollbackPolicy:body.rollbackPolicy,
    recoveryPolicy:body.recoveryPolicy,concurrencyPolicy:body.concurrencyPolicy,releaseWindow:body.releaseWindow,requiredCertifications:body.requiredCertifications,
    stages:Array.isArray(body.stages)?body.stages as never[]:[],
  })},{status:201});
  if(action==="PREFLIGHT")return NextResponse.json({result:await svc.preflight(t(body.id),auth.adminUser.id)});
  if(action==="SCHEDULE")return NextResponse.json({result:await svc.schedule(t(body.id),auth.adminUser.id)});
  if(action==="START")return NextResponse.json({result:await svc.start(t(body.id),auth.adminUser.id,key)});
  if(action==="EXECUTE")return NextResponse.json({result:await svc.executeNext(t(body.runId),t(body.operation),auth.adminUser.id,key)});
  if(action==="PAUSE")return NextResponse.json({result:await svc.pause(t(body.id),auth.adminUser.id,t(body.reason)||"DETERMINISTIC_GATE")});
  if(action==="ABORT")return NextResponse.json({result:await svc.abort(t(body.id),auth.adminUser.id)});
  if(action==="ROLLBACK")return NextResponse.json({result:await svc.rollback(t(body.id),auth.adminUser.id)});
  if(action==="FORWARD_RECOVERY")return NextResponse.json({result:await svc.forwardRecovery(t(body.id),auth.adminUser.id,body.plan)});
  if(action==="VALIDATE")return NextResponse.json({result:await svc.validate(t(body.id),auth.adminUser.id)});
  if(action==="CERTIFY")return NextResponse.json({result:await svc.certify(t(body.id),auth.adminUser.id)});
  if(action==="INVALIDATE")return NextResponse.json({result:await svc.invalidate(t(body.id),t(body.reason)||"Governance invalidation",auth.adminUser.id)});
  return NextResponse.json({error:"Unknown delivery action"},{status:400});
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:"Delivery operation failed safely"},{status:400});}
}
