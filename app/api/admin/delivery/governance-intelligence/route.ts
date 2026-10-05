import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/authorization";
import { recordAdminAudit } from "@/lib/admin/audit";
import * as svc from "@/lib/delivery-governance-intelligence/service";
import * as adaptation from "@/lib/delivery-governance-adaptation/service";
import type { AdminPermission } from "@/lib/admin/permissions";

export const dynamic="force-dynamic";
const permissions:Record<string,AdminPermission>={
 SUMMARY:"governance.intelligence.read",ASSESS:"governance.intelligence.assess",PROPOSAL:"governance.optimization.create",TRANSITION:"governance.optimization.review",
 POLICY_VERSION:"governance.policy.compare",SHADOW:"governance.intelligence.assess",SIGNAL:"governance.intelligence.assess",ARCHITECTURE:"governance.intelligence.assess",SIMULATION:"governance.intelligence.assess",COMPARE:"governance.policy.compare",REGRESSION:"governance.intelligence.assess",EXPERIMENT:"governance.experiment.approve",CERTIFY:"governance.policy.certify",INVALIDATE:"governance.policy.rollback",ADAPTATION_ASSESS:"governance.adaptation.assess",ADAPTATION_CREATE:"governance.adaptation.propose",ADAPTATION_VALIDATE:"governance.adaptation.review",ADAPTATION_TRANSITION:"governance.adaptation.review"
};
const text=(v:unknown)=>typeof v==="string"?v.trim():"";
const idempotency=(req:Request)=>{const k=text(req.headers.get("Idempotency-Key"));if(!k||k.length>255)throw new Error("Idempotency-Key is required.");return k;};
export async function GET(req:Request){
 try{const u=new URL(req.url);const action=text(u.searchParams.get("action"))||"SUMMARY";await requireAdmin(req,permissions[action]??"governance.intelligence.read");
  if(action==="PROPOSALS")return NextResponse.json(await svc.listProposals(Number(u.searchParams.get("limit")||50)));
  if(action==="ASSESSMENTS")return NextResponse.json(await svc.listAssessments(Number(u.searchParams.get("limit")||50)));
  if(action==="CERTIFICATIONS")return NextResponse.json(await svc.listCertifications(Number(u.searchParams.get("limit")||50)));
  return NextResponse.json({phase:"15.41-15.42",algorithmVersion:svc.GOVERNANCE_ALGORITHM_VERSION,adaptationAlgorithmVersion:adaptation.GOVERNANCE_ADAPTATION_ALGORITHM_VERSION,states:svc.GOVERNANCE_STATES,adaptationStates:adaptation.ADAPTATION_STATES,decisions:svc.GOVERNANCE_DECISIONS,adaptationDecisions:adaptation.ADAPTATION_DECISIONS,riskClasses:svc.RISK_CLASSES});
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:"Governance intelligence query failed safely"},{status:400});}
}
export async function POST(req:Request){
 try{const body=await req.json() as Record<string,unknown>;const action=text(body.action);const auth=await requireAdmin(req,permissions[action]??"governance.intelligence.read");const key=idempotency(req);let result:unknown;
  if(action==="ASSESS")result=await svc.createAssessment({...body.input as Omit<Parameters<typeof svc.createAssessment>[0],"actor">,actor:auth.adminUser.id});
  else if(action==="PROPOSAL")result=await svc.createProposal({...body.input as Omit<Parameters<typeof svc.createProposal>[0],"actor">,actor:auth.adminUser.id});
  else if(action==="TRANSITION")result=await svc.transitionProposal({...body.input as Omit<Parameters<typeof svc.transitionProposal>[0],"actor"|"idempotencyKey">,actor:auth.adminUser.id,idempotencyKey:key});
  else if(action==="POLICY_VERSION")result=await svc.createPolicyVersion({...body.input as Omit<Parameters<typeof svc.createPolicyVersion>[0],"actor">,actor:auth.adminUser.id});
  else if(action==="SIGNAL")result=await svc.createSignal(body.input as Parameters<typeof svc.createSignal>[0]);
  else if(action==="ARCHITECTURE")result=await svc.collectArchitectureEvidence(body.input as Parameters<typeof svc.collectArchitectureEvidence>[0]);
  else if(action==="SIMULATION")result=await svc.recordPolicySimulation(body.input as Parameters<typeof svc.recordPolicySimulation>[0]);
  else if(action==="COMPARE")result=await svc.compareProposalPolicies(text((body.input as Record<string,unknown>)?.proposalId));
  else if(action==="REGRESSION")result=await svc.regressionCheck({...body.input as Omit<Parameters<typeof svc.regressionCheck>[0],"actor">,actor:auth.adminUser.id});
  else if(action==="SHADOW")result=await svc.createShadowEvaluation({...body.input as Omit<Parameters<typeof svc.createShadowEvaluation>[0],"actor">,actor:auth.adminUser.id});
  else if(action==="EXPERIMENT")result=await svc.createExperiment({...body.input as Omit<Parameters<typeof svc.createExperiment>[0],"actor">,actor:auth.adminUser.id});
  else if(action==="CERTIFY")result=await svc.certify({...body.input as Omit<Parameters<typeof svc.certify>[0],"actor">,actor:auth.adminUser.id});
  else if(action==="INVALIDATE")result=await svc.invalidateCertifications({...body.input as Omit<Parameters<typeof svc.invalidateCertifications>[0],"actor">,actor:auth.adminUser.id});
  else return NextResponse.json({error:"Unknown governance intelligence action"},{status:400});
  await recordAdminAudit({actorAdminId:auth.adminUser.id,action:"GOVERNANCE_INTELLIGENCE_"+action,resourceType:action.startsWith("ADAPTATION_")?"Phase15.42GovernanceAdaptation":"Phase15.41GovernanceIntelligence",success:true,metadata:{algorithmVersion:svc.GOVERNANCE_ALGORITHM_VERSION}});
  return NextResponse.json({result},{status:["PROPOSAL","POLICY_VERSION","EXPERIMENT","CERTIFY"].includes(action)?201:200});
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:"Governance operation failed safely"},{status:400});}
}
