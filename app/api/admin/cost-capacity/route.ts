import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/authorization";
import { AdminError } from "@/lib/admin/errors";
import { adminEvaluate, adminRecordMetric, costCapacitySummary, ensureResourceInventory, evaluateCapacityPolicies } from "@/lib/cost-capacity/service";
import { COST_RESOURCE_CATEGORIES } from "@/lib/cost-capacity/model";

export const dynamic="force-dynamic";
export const revalidate=0;

function errorResponse(error:unknown){
  const code=error instanceof AdminError?error.code:"COST_CAPACITY_ERROR";
  return NextResponse.json({error:{code,message:error instanceof Error?error.message:"Cost/capacity operation failed."}},{status:code==="FORBIDDEN"?403:code==="ADMIN_REQUIRED"?401:400});
}

export async function GET(request:Request){
  try{
    const context=await requireAdmin(request,"cost_capacity.read");
    const url=new URL(request.url);
    await ensureResourceInventory();
    if(url.searchParams.get("evaluate")==="1"){
      await requireAdmin(request,"cost_capacity.manage");
      return NextResponse.json({summary:await costCapacitySummary(),capacity:await evaluateCapacityPolicies()});
    }
    return NextResponse.json({summary:await costCapacitySummary(),resources:await ensureResourceInventory(),categories:COST_RESOURCE_CATEGORIES});
  }catch(error){return errorResponse(error);}
}

export async function POST(request:Request){
  try{
    const context=await requireAdmin(request,"cost_capacity.manage");
    const body=await request.json() as Record<string,unknown>;
    if(body.action==="metric"){
      const metric=await adminRecordMetric(context,{
        resourceKey:String(body.resourceKey||""),metricKey:String(body.metricKey||""),value:Number(body.value),
        unit:String(body.unit||""),status:body.status as never,service:body.service==null?undefined:String(body.service),
        correlationId:request.headers.get("x-request-id")??undefined,metadata:body.metadata,
      });
      return NextResponse.json({metric},{status:201});
    }
    if(body.action==="evaluate") return NextResponse.json(await adminEvaluate(context));
    return NextResponse.json({error:{code:"INVALID_REQUEST",message:"Unsupported cost/capacity action."}},{status:400});
  }catch(error){return errorResponse(error);}
}
