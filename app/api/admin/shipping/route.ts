import { requireAdmin } from "@/lib/admin/authorization";
import { AdminError } from "@/lib/admin/errors";
import { adminErrorResponse, adminJson, assertAdminSameOrigin, readAdminJson } from "@/lib/admin/http";
import { executeAdminShippingAction, listAdminShipments, parseAdminShippingQuery, type AdminShippingAction } from "@/lib/admin/shipping";

export const dynamic="force-dynamic";
export const revalidate=0;

function text(value:unknown,max=255){return typeof value==="string"&&value.trim().length>0&&value.length<=max?value.trim():undefined;}
function actionFromBody(body:Record<string,unknown>):AdminShippingAction{
 const action=body.action;
 const idempotencyKey=text(body.idempotencyKey,128);
 const reason=text(body.reason,1000);
 if(!idempotencyKey||!reason)throw new AdminError("INVALID_REQUEST","Shipping operation metadata is invalid.");
 if(action==="create"){
  const fulfillmentId=text(body.fulfillmentId,64),orderId=text(body.orderId,64);
  if(!fulfillmentId||!orderId)throw new AdminError("INVALID_REQUEST","Order and Fulfillment identifiers are required.");
  return {action,fulfillmentId,orderId,idempotencyKey,reason};
 }
 throw new AdminError("INVALID_REQUEST","Unsupported Shipping collection action.");
}

export async function GET(request:Request){
 try{
  const context=await requireAdmin(request,"shipping.read");
  return adminJson(await listAdminShipments(parseAdminShippingQuery(new URL(request.url)),context));
 }catch(error){return adminErrorResponse(error);}
}
export async function POST(request:Request){
 try{
  assertAdminSameOrigin(request);
  const context=await requireAdmin(request);
  return adminJson(await executeAdminShippingAction(context,actionFromBody(await readAdminJson(request))));
 }catch(error){return adminErrorResponse(error);}
}
