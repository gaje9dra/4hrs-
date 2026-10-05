import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/authorization";
import { recordAdminAudit } from "@/lib/admin/audit";
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
  if(action==="CREATE"){const result=await svc.createDecision({context:body.context as svc.DecisionContext,signals:(body.signals??[]) as svc.DecisionSignalInput[],history:(body.history??[]) as svc.HistoricalOutcomeInput[],actorId:auth.adminUser.id});await recordAdminAudit({actorAdminId:auth.adminUser.id,action:"DELIVERY_DECISION_CREATED",resourceType:"DeliveryDecisionProfile",resourceId:result.profile?.id,success:true,metadata:{recommendation:result.recommendation.recommendation,algorithmVersion:result.evaluation.algorithmVersion}});return NextResponse.json({result},{status:201});}
  if(action==="TRANSITION"){const result=await svc.transitionDecision(text(body.profileId),text(body.newState) as svc.DecisionState,auth.adminUser.id,text(body.reason)||"Governed decision transition",body.evidence??{});await recordAdminAudit({actorAdminId:auth.adminUser.id,action:"DELIVERY_DECISION_TRANSITION",resourceType:"DeliveryDecisionProfile",resourceId:text(body.profileId),success:true,metadata:{newState:body.newState}});return NextResponse.json({result});}
  if(action==="OUTCOME"){const result=await svc.recordOutcome({...body.input as Parameters<typeof svc.recordOutcome>[0],actorId:auth.adminUser.id});await recordAdminAudit({actorAdminId:auth.adminUser.id,action:"DELIVERY_DECISION_OUTCOME_CAPTURED",resourceType:"DeliveryRecommendationOutcome",resourceId:result.id,success:true});return NextResponse.json({result},{status:201});}
  if(action==="POLICY"){const result=await svc.createPolicy({...body.input as Omit<Parameters<typeof svc.createPolicy>[0],"createdBy">,createdBy:auth.adminUser.id});await recordAdminAudit({actorAdminId:auth.adminUser.id,action:"DELIVERY_DECISION_POLICY_CHANGED",resourceType:"DecisionIntelligencePolicy",resourceId:result.id,success:true,metadata:{policyKey:result.policyKey,version:result.version}});return NextResponse.json({result},{status:201});}
  if(action==="EXPERIMENT"){const result=await svc.createExperiment({...body.input as Omit<Parameters<typeof svc.createExperiment>[0],"createdBy">,createdBy:auth.adminUser.id});await recordAdminAudit({actorAdminId:auth.adminUser.id,action:"DELIVERY_DECISION_EXPERIMENT_CREATED",resourceType:"DeliveryDecisionExperiment",resourceId:result.id,success:true});return NextResponse.json({result},{status:201});}
  if(action==="MAINTENANCE"){const result=await svc.expireStaleRecommendations();await recordAdminAudit({actorAdminId:auth.adminUser.id,action:"DELIVERY_DECISION_MAINTENANCE",resourceType:"DeliveryRecommendation",success:true,metadata:{count:result.count}});return NextResponse.json({result});}
  return NextResponse.json({error:"Unknown decision-intelligence action"},{status:400});
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:"Decision-intelligence operation failed safely"},{status:400});}
}
