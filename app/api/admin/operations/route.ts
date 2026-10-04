import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/authorization";
import { auditAdminAction } from "@/lib/admin/audit";
import { runReconciliation } from "@/lib/reconciliation/service";
import { executeSyntheticWorkflow } from "@/lib/synthetic/service";
import { getOperationsDashboard } from "@/lib/operations/service";
import { AdminError } from "@/lib/admin/errors";
export const dynamic="force-dynamic";export const revalidate=0;
export async function GET(request:Request){try{await requireAdmin(request,"operations.read");return NextResponse.json(await getOperationsDashboard(),{headers:{"cache-control":"private,no-store"}});}catch(error){const code=error instanceof AdminError?error.code:"DATABASE_ERROR";return NextResponse.json({error:{code,message:error instanceof Error?error.message:"Operational dashboard could not be loaded."}},{status:code==="FORBIDDEN"?403:503});}}
export async function POST(request:Request){let context;try{context=await requireAdmin(request,"operations.manage");const body=await request.json() as {action?:unknown;reason?:unknown;workflowId?:unknown};if(typeof body.action!=="string"||typeof body.reason!=="string"||body.reason.trim().length<3)return NextResponse.json({error:{code:"INVALID_REQUEST",message:"action and reason are required."}},{status:400});const reason=body.reason.trim().slice(0,1000);let result:unknown;
if(body.action==="RUN_RECONCILIATION")result=await runReconciliation({maxCases:100,correlationId:request.headers.get("x-request-id")??undefined});
else if(body.action==="TRIGGER_SYNTHETIC"){if(typeof body.workflowId!=="string"||!body.workflowId.trim())return NextResponse.json({error:{code:"INVALID_REQUEST",message:"workflowId is required."}},{status:400});const syntheticContext=await requireAdmin(request,"synthetic.execute");result=await executeSyntheticWorkflow(body.workflowId.trim(),"MANUAL_DIAGNOSTIC",{reason,correlationId:request.headers.get("x-request-id")??undefined});await auditAdminAction(syntheticContext,{action:"OPERATIONS_SYNTHETIC_TRIGGER",resourceType:"SyntheticWorkflow",resourceId:body.workflowId.trim(),success:true,reason,requestId:request.headers.get("x-request-id"),metadata:{mode:"MANUAL_DIAGNOSTIC"}});}
else if(body.action==="REFRESH_HEALTH")result=await getOperationsDashboard();
else return NextResponse.json({error:{code:"INVALID_REQUEST",message:"Unsupported operational action."}},{status:400});
await auditAdminAction(context,{action:"OPERATIONS_"+body.action,resourceType:"OperationsControlPlane",success:true,reason,requestId:request.headers.get("x-request-id"),metadata:{workflowId:body.workflowId??null}});
return NextResponse.json({result},{headers:{"cache-control":"private,no-store"}});
}catch(error){const code=error instanceof AdminError?error.code:"DATABASE_ERROR";return NextResponse.json({error:{code,message:error instanceof Error?error.message:"Operational action failed safely."}},{status:code==="FORBIDDEN"?403:503});}}