import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { requireAdmin } from "@/lib/admin/authorization";
import { recordAdminAudit } from "@/lib/admin/audit";
import type { AdminPermission } from "@/lib/admin/permissions";
import * as svc from "@/lib/delivery-governance-stability/service";

export const dynamic="force-dynamic";
const permissions:Record<string,AdminPermission>={
 SUMMARY:"governance.stability.read",STABILITY:"governance.stability.assess",CONFLICTS:"governance.conflict.read",
 GRAPH:"governance.control.graph.read",DEADLOCK:"governance.stability.assess",OSCILLATION:"governance.stability.assess",
 CHURN:"governance.stability.assess",COVERAGE:"governance.stability.assess",RESILIENCE:"governance.stability.assess",
 SNAPSHOT:"governance.stability.assess",CERTIFY:"governance.policy.certify",MODE:"governance.governance_mode.change",
 INVARIANTS:"governance.stability.assess",DRIFT:"governance.stability.assess"
};
const text=(v:unknown)=>typeof v==="string"?v.trim():"";
const key=(req:Request)=>{const v=text(req.headers.get("Idempotency-Key"));if(!v||v.length>255)throw new Error("Idempotency-Key is required.");return v;};
export async function GET(req:Request){
 try{const u=new URL(req.url);const action=text(u.searchParams.get("action"))||"SUMMARY";const auth=await requireAdmin(req,permissions[action]??"governance.stability.read");const limit=Number(u.searchParams.get("limit")||50);
  if(action==="CONFLICTS")return NextResponse.json(await svc.listConflicts(limit));
  if(action==="SNAPSHOT")return NextResponse.json(await svc.listSnapshots(limit));
  if(action==="CERTIFY")return NextResponse.json(await svc.listCertifications(limit));
  if(action==="SUMMARY")return NextResponse.json({phase:"15.43",algorithmVersion:svc.GOVERNANCE_STABILITY_ALGORITHM_VERSION,adaptationAlgorithmVersion:svc.GOVERNANCE_ADAPTATION_ALGORITHM_VERSION,classes:svc.STABILITY_CLASSIFICATIONS,modes:svc.DEGRADED_GOVERNANCE_MODES,compatibility:svc.COMPATIBILITY,evidence:await svc.integratedEvidence(),assessments:await svc.listStability(limit)});
  return NextResponse.json({phase:"15.43",algorithmVersion:svc.GOVERNANCE_STABILITY_ALGORITHM_VERSION,actor:auth.adminUser.id});
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:"Governance stability query failed safely"},{status:400});}
}
export async function POST(req:Request){
 try{const body=await req.json() as Record<string,unknown>;const action=text(body.action);const auth=await requireAdmin(req,permissions[action]??"governance.stability.read");const input=(body.input??{}) as Record<string,unknown>;const correlationId=text(input.correlationId)||randomUUID();const idempotencyKey=key(req);let result:unknown;
  if(action==="STABILITY"){result=await svc.assessIntegratedState({...input as Omit<Parameters<typeof svc.assessIntegratedState>[0],"actor"|"correlationId">,actor:auth.adminUser.id,correlationId});}
  else if(action==="CONFLICTS"){const items=svc.detectConflicts((input.controls??[]) as svc.Control[],(input.policyVersions??{}) as Record<string,string>);result=await svc.persistConflicts(items,correlationId);}
  else if(action==="DEADLOCK"){const items=svc.detectDeadlocks((input.nodes??[]) as string[],(input.edges??[]) as Array<{from:string;to:string;type:string}>);result=await svc.persistDeadlocks(items,correlationId);}
  else if(action==="OSCILLATION"){const item=svc.detectOscillation(input as Parameters<typeof svc.detectOscillation>[0]);result=await svc.persistOscillation(item);}
  else if(action==="CHURN"){const item=svc.assessChurn(input as Parameters<typeof svc.assessChurn>[0]);result=await svc.persistChurn(item);}
  else if(action==="COVERAGE"){result=svc.analyzeCoverage(input as Parameters<typeof svc.analyzeCoverage>[0]);}
  else if(action==="RESILIENCE"){result=await svc.persistResilience(input as Parameters<typeof svc.persistResilience>[0]);}
  else if(action==="MODE"){result=svc.resilienceMode(input as Parameters<typeof svc.resilienceMode>[0]);}
  else if(action==="SNAPSHOT"){result=await svc.buildSnapshot({...input as Omit<Parameters<typeof svc.buildSnapshot>[0],"actor"|"correlationId">,actor:auth.adminUser.id,correlationId});}
  else if(action==="INVARIANTS"){result=await svc.ensureInvariants(auth.adminUser.id);}
  else if(action==="DRIFT"){result=svc.detectDrift(input as Parameters<typeof svc.detectDrift>[0]);}
  else if(action==="CERTIFY"){result=await svc.certifyStability({...input as Omit<Parameters<typeof svc.certifyStability>[0],"actor">,actor:auth.adminUser.id});}
  else if(action==="GRAPH_IMPACT"){result=await svc.graphImpact(text(input.stableId),Number(input.depth??3));}
  else return NextResponse.json({error:"Unknown governance stability action"},{status:400});
  await recordAdminAudit({actorAdminId:auth.adminUser.id,action:"GOVERNANCE_STABILITY_"+action,resourceType:"GovernanceStability",success:true,metadata:{algorithmVersion:svc.GOVERNANCE_STABILITY_ALGORITHM_VERSION,idempotencyKey,correlationId}});
  return NextResponse.json({result},{status:action==="CERTIFY"?201:200});
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:"Governance stability operation failed safely"},{status:400});}
}
