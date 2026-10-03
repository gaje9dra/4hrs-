import { NextResponse } from "next/server";
import { requireAdmin, requireHighRiskReason } from "@/lib/admin/authorization";
import { executeSyntheticWorkflow, evaluateReadiness, listSyntheticExecutions, registryHealth, syntheticSummary } from "@/lib/synthetic";
import { getWorkflow } from "@/lib/synthetic/registry";
import { SYNTHETIC_MODES, SYNTHETIC_STATUSES, type SyntheticMode, type SyntheticStatus } from "@/lib/synthetic/model";
export const dynamic="force-dynamic";
export async function GET(request:Request){
  await requireAdmin(request,"synthetic.read");
  const url=new URL(request.url);
  if(url.searchParams.get("workflows")==="1") return NextResponse.json({registry:registryHealth()});
  if(url.searchParams.get("summary")==="1") return NextResponse.json(await syntheticSummary());
  const statusParam=url.searchParams.get("status");
  const status=statusParam&&SYNTHETIC_STATUSES.includes(statusParam as SyntheticStatus)?statusParam as SyntheticStatus:undefined;
  return NextResponse.json({executions:await listSyntheticExecutions({workflowId:url.searchParams.get("workflowId")??undefined,status,environment:url.searchParams.get("environment")??undefined})});
}
export async function POST(request:Request){
  const body=await request.json().catch(()=>null) as Record<string,unknown>|null;
  if(body?.action==="run"){
    await requireAdmin(request,"synthetic.execute");
    const workflowId=typeof body.workflowId==="string"?body.workflowId:"";
    const mode=typeof body.mode==="string"?body.mode:"MANUAL_DIAGNOSTIC";
    const reason=requireHighRiskReason(body.reason);
    if(!SYNTHETIC_MODES.includes(mode as never)) return NextResponse.json({error:"Invalid synthetic mode."},{status:400});
    if(!getWorkflow(workflowId)) return NextResponse.json({error:"Unknown synthetic workflow."},{status:404});
    return NextResponse.json(await executeSyntheticWorkflow(workflowId,mode as SyntheticMode,{reason}));
  }
  if(body?.action==="certify"){
    const context=await requireAdmin(request,"synthetic.certify");
    const reason=requireHighRiskReason(body.reason);
    return NextResponse.json({...await evaluateReadiness(typeof body.environment==="string"?body.environment:undefined),certifiedBy:context.adminUser.id,reason});
  }
  return NextResponse.json({error:"Unsupported synthetic action."},{status:400});
}