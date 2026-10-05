import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/authorization";
import { recordAdminAudit } from "@/lib/admin/audit";
import * as svc from "@/lib/delivery-learning/service";
import type { AdminPermission } from "@/lib/admin/permissions";

export const dynamic="force-dynamic";
const perms:Record<string,AdminPermission>={
 OUTCOMES:"delivery_learning.view",OUTCOME:"delivery_learning.inspect",PREDICTION:"delivery_learning.inspect",DECISION:"delivery_learning.inspect",
 SIGNAL:"delivery_learning.inspect",PATTERNS:"delivery_learning.inspect",PROPOSAL:"delivery_learning.propose",TRANSITION:"delivery_learning.review",
 POLICY:"delivery_learning.approve",EXPERIMENT:"delivery_learning.experiment",CERTIFY:"delivery_learning.certify",MAINTENANCE:"delivery_learning.review"
};
const text=(v:unknown)=>typeof v==="string"?v.trim():"";
const key=(req:Request)=>{const v=text(req.headers.get("Idempotency-Key"));if(!v||v.length>255)throw new Error("Idempotency-Key is required.");return v;};

export async function GET(req:Request){
 try{
  const u=new URL(req.url);const action=text(u.searchParams.get("action"))||"OUTCOMES";await requireAdmin(req,perms[action]??"delivery_learning.view");
  if(action==="OUTCOMES")return NextResponse.json(await svc.listOutcomes(Number(u.searchParams.get("limit")||50)));
  if(action==="OUTCOME")return NextResponse.json(await svc.getOutcome(text(u.searchParams.get("id"))));
  if(action==="PROPOSALS")return NextResponse.json(await svc.listLearning({limit:Number(u.searchParams.get("limit")||50),offset:Number(u.searchParams.get("offset")||0),state:text(u.searchParams.get("state"))||undefined,confidence:text(u.searchParams.get("confidence"))||undefined,risk:text(u.searchParams.get("risk"))||undefined}));
  if(action==="EXPERIMENTS")return NextResponse.json(await svc.listExperiments(Number(u.searchParams.get("limit")||50)));
  if(action==="POLICIES")return NextResponse.json(await svc.listPolicies(Number(u.searchParams.get("limit")||50)));
  return NextResponse.json({error:"Unknown learning query"},{status:400});
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:"Learning query failed safely"},{status:400});}
}
export async function POST(req:Request){
 try{
  const body=await req.json() as Record<string,unknown>;const action=text(body.action);const auth=await requireAdmin(req,perms[action]??"delivery_learning.inspect");
  if(["OUTCOME","PREDICTION","DECISION","SIGNAL","PATTERNS","PROPOSAL","TRANSITION","POLICY","EXPERIMENT","CERTIFY","MAINTENANCE"].includes(action))key(req);
  let result:unknown;
  if(action==="OUTCOME")result=await svc.captureOutcome(body.input as Parameters<typeof svc.captureOutcome>[0]);
  else if(action==="PREDICTION")result=await svc.evaluatePrediction(body.input as Parameters<typeof svc.evaluatePrediction>[0]);
  else if(action==="DECISION")result=await svc.evaluateDecision(body.input as Parameters<typeof svc.evaluateDecision>[0]);
  else if(action==="SIGNAL")result=await svc.evaluateSignalQuality(body.input as Parameters<typeof svc.evaluateSignalQuality>[0]);
  else if(action==="PATTERNS")result=await svc.analyzePatterns(body.input as Parameters<typeof svc.analyzePatterns>[0]);
  else if(action==="PROPOSAL")result=await svc.createOptimizationProposal({...body.input as Omit<Parameters<typeof svc.createOptimizationProposal>[0],"createdBy">,createdBy:auth.adminUser.id});
  else if(action==="TRANSITION")result=await svc.transitionProposal({...body.input as Parameters<typeof svc.transitionProposal>[0],actor:auth.adminUser.id});
  else if(action==="POLICY")result=await svc.createPolicy({...body.input as Omit<Parameters<typeof svc.createPolicy>[0],"createdBy">,createdBy:auth.adminUser.id});
  else if(action==="EXPERIMENT")result=await svc.createExperiment({...body.input as Omit<Parameters<typeof svc.createExperiment>[0],"createdBy">,createdBy:auth.adminUser.id});
  else if(action==="CERTIFY")result=await svc.certifyProposal({...body.input as Omit<Parameters<typeof svc.certifyProposal>[0],"actor">,actor:auth.adminUser.id});
  else if(action==="MAINTENANCE")result=await svc.expireLearning();
  else return NextResponse.json({error:"Unknown learning action"},{status:400});
  await recordAdminAudit({actorAdminId:auth.adminUser.id,action:`DELIVERY_LEARNING_${action}`,resourceType:"Phase15.40Learning",success:true,metadata:{algorithmVersion:svc.ALGORITHM_VERSION}});
  return NextResponse.json({result},{status:action==="OUTCOME"||action==="PROPOSAL"||action==="EXPERIMENT"||action==="CERTIFY"?201:200});
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:"Learning operation failed safely"},{status:400});}
}
