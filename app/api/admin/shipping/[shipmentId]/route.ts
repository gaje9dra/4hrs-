import { requireAdmin } from "@/lib/admin/authorization";
import { AdminError } from "@/lib/admin/errors";
import { adminErrorResponse, adminJson, assertAdminSameOrigin, readAdminJson } from "@/lib/admin/http";
import { executeAdminShippingAction, getAdminShipment, type AdminShippingAction } from "@/lib/admin/shipping";

export const dynamic="force-dynamic";
export const revalidate=0;

function text(value:unknown,max=255){return typeof value==="string"&&value.trim().length>0&&value.length<=max?value.trim():undefined;}
function actionFromBody(body:Record<string,unknown>,shipmentId:string):AdminShippingAction{
 const action=body.action;
 if(action!=="reconcile"&&action!=="recovery")throw new AdminError("INVALID_REQUEST","Unsupported Shipment action.");
 const idempotencyKey=text(body.idempotencyKey,128),reason=text(body.reason,1000);
 if(!idempotencyKey||!reason)throw new AdminError("INVALID_REQUEST","Shipping operation metadata is invalid.");
 return {action,shipmentId,idempotencyKey,reason};
}
export async function GET(request:Request,{params}:{params:Promise<{shipmentId:string}>}){
 try{const context=await requireAdmin(request,"shipping.read");return adminJson(await getAdminShipment((await params).shipmentId,context));}
 catch(error){return adminErrorResponse(error);}
}
export async function POST(request:Request,{params}:{params:Promise<{shipmentId:string}>}){
 try{assertAdminSameOrigin(request);const context=await requireAdmin(request);const shipmentId=(await params).shipmentId;return adminJson(await executeAdminShippingAction(context,actionFromBody(await readAdminJson(request),shipmentId)));}catch(error){return adminErrorResponse(error);}
}
