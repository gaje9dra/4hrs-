import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/authorization";
import { AdminError } from "@/lib/admin/errors";
import { listReconciliationCases, reconciliationHealthCheck, reconciliationSummary, resolveReconciliationCase, retrySafeReconciliation, runReconciliation } from "@/lib/reconciliation/service";

export const dynamic="force-dynamic";
export const revalidate=0;

function errorResponse(error:unknown){
 const code=error instanceof AdminError?error.code:"RECONCILIATION_ERROR";
 return NextResponse.json({error:{code,message:error instanceof Error?error.message:"Reconciliation operation failed."}},{status:code==="FORBIDDEN"?403:code==="ADMIN_REQUIRED"?401:400});
}

export async function GET(request:Request){
 try{
  const context=await requireAdmin(request,"reconciliation.read");
  const url=new URL(request.url);
  if(url.searchParams.get("health")==="1") return NextResponse.json(await reconciliationHealthCheck());
  if(url.searchParams.get("export")==="1") { await requireAdmin(request,"reconciliation.export"); const cases=await listReconciliationCases({limit:200}); return NextResponse.json({exportedAt:new Date().toISOString(),cases}); }
  if(url.searchParams.get("summary")==="1") return NextResponse.json(await reconciliationSummary());
  const cases=await listReconciliationCases({
   status:(url.searchParams.get("status")||undefined) as never,
   domain:(url.searchParams.get("domain")||undefined) as never,
   severity:(url.searchParams.get("severity")||undefined) as never,
   limit:Number(url.searchParams.get("limit")||100),
  });
  return NextResponse.json({cases});
 }catch(error){return errorResponse(error);}
}

export async function POST(request:Request){
 try{
  const body=await request.json() as Record<string,unknown>;
  if(body.action==="scan"){
   const context=await requireAdmin(request,"reconciliation.investigate");
   const result=await runReconciliation({maxCases:Number(body.maxCases||500),domains:Array.isArray(body.domains)?body.domains as never:undefined,correlationId:request.headers.get("x-request-id")??undefined});
   return NextResponse.json(result,{status:201});
  }
  if(body.action==="retry"){
   const context=await requireAdmin(request,"reconciliation.execute");
   const row=await retrySafeReconciliation(context,{id:String(body.id||""),expectedVersion:Number(body.expectedVersion)});
   return NextResponse.json({case:row});
  }
  if(body.action==="resolve"){
   const context=await requireAdmin(request,"reconciliation.resolve");
   const row=await resolveReconciliationCase(context,{id:String(body.id||""),expectedVersion:Number(body.expectedVersion),reason:String(body.reason||""),resolution:body.resolution});
   return NextResponse.json({case:row});
  }
  return NextResponse.json({error:{code:"INVALID_REQUEST",message:"Unsupported reconciliation action."}},{status:400});
 }catch(error){return errorResponse(error);}
}
