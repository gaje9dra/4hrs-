import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/authorization";
import type { AdminPermission } from "@/lib/admin/permissions";
import * as svc from "@/lib/delivery-decision-intelligence/service";

export const dynamic = "force-dynamic";
const permissions:Record<string,AdminPermission>={
 LIST:"delivery:intelligence:view",DETAIL:"delivery:intelligence:view",CREATE:"delivery:intelligence:evaluate",
 TRANSITION:"delivery:promotion:approve",OUTCOME:"delivery:intelligence:evaluate",POLICY:"delivery:policy:manage",
 EXPERIMENT:"delivery:policy:manage",MAINTENANCE:"delivery:intelligence:evaluate"
};
const text=(v:unknown)=>typeof v==="string"?v.trim():"";
const idempotency=(req:Request)=>{const key=text(req.headers.get("Idempotency-Key"));if(!key||key.length>200)throw new Error("Idempotency-Key is required.");return key;};

export async function GET(req:Request){
 try{
  const u=new URL(req.url);const action=text(u.searchParams.get("action"))||"LIST";await requireAdmin(req,permissions[action]??"delivery:intelligence:view");
  if(action==="LIST")return NextResponse.json(await svc.listDecisions(Number(u.searchParams.get("limit")||50)));
  if(action==="DETAIL")return NextResponse.json(await svc.getDecision(text(u.searchParams.get("id"))));
  if(action==="POLICY")return NextResponse.json(await svc.listPolicies(Number(u.searchParams.get("limit")||50)));
  return NextResponse.json({error:"Unknown decision-intelligence query"},{status:400});
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:"Decision-intelligence query failed safely"},{status:400});}
}

export async function POST(req:Request){
 try{
  const body=await req.json() as Record<string,unknown>;const action=text(body.action);const auth=await requireAdmin(req,permissions[action]??"delivery:intelligence:view");
  if(["CREATE","TRANSITION","OUTCOME","POLICY","EXPERIMENT","MAINTENANCE"].includes(action))idempotency(req);
  if(action==="CREATE")return NextResponse.json({result:await svc.createDecision({context:body.context as svc.DecisionContext,signals:(body.signals??[]) as svc.DecisionSignalInput[],history:(body.history??[]) as svc.HistoricalOutcomeInput[],actorId:auth.adminUser.id})},{status:201});
  if(action==="TRANSITION")return NextResponse.json({result:await svc.transitionDecision(text(body.profileId),text(body.newState) as svc.DecisionState,auth.adminUser.id,text(body.reason)||"Governed decision transition",body.evidence??{})});
  if(action==="OUTCOME")return NextResponse.json({result:await svc.recordOutcome({...body.input as Parameters<typeof svc.recordOutcome>[0],actorId:auth.adminUser.id})},{status:201});
  if(action==="POLICY")return NextResponse.json({result:await svc.createPolicy({...body.input as Omit<Parameters<typeof svc.createPolicy>[0],"createdBy">,createdBy:auth.adminUser.id})},{status:201});
  if(action==="EXPERIMENT")return NextResponse.json({result:await svc.createExperiment({...body.input as Omit<Parameters<typeof svc.createExperiment>[0],"createdBy">,createdBy:auth.adminUser.id})},{status:201});
  if(action==="MAINTENANCE")return NextResponse.json({result:await svc.expireStaleRecommendations()});
  return NextResponse.json({error:"Unknown decision-intelligence action"},{status:400});
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:"Decision-intelligence operation failed safely"},{status:400});}
}
