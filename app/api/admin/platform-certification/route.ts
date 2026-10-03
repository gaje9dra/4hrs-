import { NextResponse } from "next/server";
import { requireAdmin, requireHighRiskReason } from "@/lib/admin/authorization";
import { collectPlatformCertification } from "@/lib/platform-certification/service";
import { db } from "@/lib/db/client";
export const dynamic="force-dynamic";
export async function GET(request:Request){
  await requireAdmin(request,"platform.certification.read");
  const latest=await db.platformCertification.findFirst({orderBy:{timestamp:"desc"}});
  return NextResponse.json({latest});
}
export async function POST(request:Request){
  const context=await requireAdmin(request,"platform.certification.certify");
  const body=await request.json().catch(()=>null) as Record<string,unknown>|null;
  const reason=requireHighRiskReason(body?.reason);
  const record=await collectPlatformCertification({persist:true,evaluator:`admin:${context.adminUser.id}`,environment:typeof body?.environment==="string"?body.environment:undefined,commitSha:typeof body?.commitSha==="string"?body.commitSha:undefined,deploymentId:typeof body?.deploymentId==="string"?body.deploymentId:undefined});
  return NextResponse.json({record,reason});
}