import { NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { requireAdmin, requireHighRiskReason } from "@/lib/admin/authorization";
import { ingestReliabilitySignal, assessReliability, detectReliabilityAnomaly, seedReliabilityStrategies } from "@/lib/reliability/autonomous";

export const dynamic="force-dynamic";
export const revalidate=0;

export async function GET(request:Request){
 try{
  await requireAdmin(request,"reliability.read");
  const [assessments,signals,anomalies,strategies,circuits,regressions]=await Promise.all([
   db.reliabilityAssessment.findMany({orderBy:{updatedAt:"desc"},take:50}),
   db.reliabilitySignal.findMany({orderBy:{observedAt:"desc"},take:50}),
   db.reliabilityAnomaly.findMany({orderBy:{detectedAt:"desc"},take:50}),
   db.reliabilityStrategy.findMany({orderBy:{updatedAt:"desc"},take:50}),
   db.reliabilityCircuit.findMany({orderBy:{updatedAt:"desc"},take:50}),
   db.reliabilityRegression.findMany({orderBy:{createdAt:"desc"},take:50})
  ]);
  return NextResponse.json({assessments,signals,anomalies,strategies,circuits,regressions},{headers:{"cache-control":"private,no-store"}});
 }catch(error){return NextResponse.json({error:{message:error instanceof Error?error.message:"Reliability request failed safely."}},{status:403});}
}

export async function POST(request:Request){
 try{
  const body=await request.json() as Record<string,unknown>;
  const action=body.action;
  if(action==="SEED_STRATEGIES"){await requireAdmin(request,"reliability.manage");return NextResponse.json({result:await seedReliabilityStrategies()});}
  if(action==="INGEST"){
   await requireAdmin(request,"reliability.simulate");
   if(typeof body.kind!=="string"||typeof body.service!=="string"||typeof body.environment!=="string")return NextResponse.json({error:{message:"kind, service and environment are required."}},{status:400});
   return NextResponse.json({result:await ingestReliabilitySignal({kind:body.kind,service:body.service,dependency:typeof body.dependency==="string"?body.dependency:undefined,severity:typeof body.severity==="string"?body.severity:"OPERATIONAL",environment:body.environment,value:body.value,evidence:body.evidence,correlationId:typeof body.correlationId==="string"?body.correlationId:undefined})});
  }
  if(action==="ASSESS"){
   const context=await requireAdmin(request,"reliability.simulate");
   if(typeof body.service!=="string"||typeof body.environment!=="string")return NextResponse.json({error:{message:"service and environment are required."}},{status:400});
   const reason=requireHighRiskReason(body.reason);
   return NextResponse.json({result:await assessReliability({service:body.service,environment:body.environment,incidentId:typeof body.incidentId==="string"?body.incidentId:undefined,reason})});
  }
  if(action==="ANOMALY"){
   await requireAdmin(request,"reliability.simulate");
   if(typeof body.baselineId!=="string"||typeof body.value!=="number")return NextResponse.json({error:{message:"baselineId and numeric value are required."}},{status:400});
   return NextResponse.json({result:await detectReliabilityAnomaly({baselineId:body.baselineId,value:body.value})});
  }
  return NextResponse.json({error:{message:"Unsupported reliability action."}},{status:400});
 }catch(error){return NextResponse.json({error:{message:error instanceof Error?error.message:"Reliability operation failed safely."}},{status:403});}
}
