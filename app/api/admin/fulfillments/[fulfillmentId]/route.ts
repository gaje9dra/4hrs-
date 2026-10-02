import { requireAdmin } from "@/lib/admin/authorization";
import { adminErrorResponse, adminJson, assertAdminSameOrigin, readAdminJson } from "@/lib/admin/http";
import { AdminError } from "@/lib/admin/errors";
import { executeAdminFulfillmentAction, getAdminFulfillment, type AdminFulfillmentAction } from "@/lib/admin/fulfillment";

export const dynamic="force-dynamic";
export const revalidate=0;

function text(value:unknown,max=255){return typeof value==="string"&&value.trim().length>0&&value.length<=max?value.trim():undefined;}
function bodyAction(body:Record<string,unknown>,fulfillmentId:string):AdminFulfillmentAction{
  const action=body.action;
  if(action!=="submit"&&action!=="retry"&&action!=="reconcile")throw new AdminError("INVALID_REQUEST","Unsupported fulfillment action.");
  const idempotencyKey=text(body.idempotencyKey,128),reason=text(body.reason,1000);
  if(!idempotencyKey||!reason)throw new AdminError("INVALID_REQUEST","Fulfillment action request is invalid.");
  return {action,fulfillmentId,idempotencyKey,reason} as AdminFulfillmentAction;
}
export async function GET(request:Request,{params}:{params:Promise<{fulfillmentId:string}>}){
  try{const context=await requireAdmin(request,"fulfillment.read");return adminJson(await getAdminFulfillment((await params).fulfillmentId,context));}
  catch(error){return adminErrorResponse(error);}
}
export async function POST(request:Request,{params}:{params:Promise<{fulfillmentId:string}>}){
  try{
    assertAdminSameOrigin(request);
    const context=await requireAdmin(request);
    const id=(await params).fulfillmentId;
    return adminJson(await executeAdminFulfillmentAction(context,bodyAction(await readAdminJson(request),id)));
  }catch(error){return adminErrorResponse(error);}
}
