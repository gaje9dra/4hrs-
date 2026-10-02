import { requireAdmin } from "@/lib/admin/authorization";
import { AdminError } from "@/lib/admin/errors";
import { adminErrorResponse, adminJson, assertAdminSameOrigin, readAdminJson } from "@/lib/admin/http";
import { executeAdminOrderAction, type AdminOrderAction } from "@/lib/admin/orders";

export const dynamic="force-dynamic";
export const revalidate=0;

const ACTIONS=new Set(["review_cancellation","review_return","fulfillment_retry","fulfillment_reconcile","shipping_reconcile"]);

function text(value:unknown,max=255){return typeof value==="string"&&value.trim().length>0&&value.length<=max?value.trim():undefined;}
function actionBody(body:Record<string,unknown>):AdminOrderAction{
  const action=text(body.action,64);
  if(!action || !ACTIONS.has(action)) throw new Error("INVALID_ACTION");
  const reason=text(body.reason,1000);
  if(action==="review_cancellation"){
    const reference=text(body.cancellationReference,64);
    if(!reference || (body.decision!=="APPROVE"&&body.decision!=="REJECT")) throw new Error("INVALID_ACTION");
    return {action,cancellationReference:reference,decision:body.decision,reason};
  }
  if(action==="review_return"){
    const reference=text(body.returnReference,64);
    if(!reference || (body.decision!=="APPROVE"&&body.decision!=="REJECT")) throw new Error("INVALID_ACTION");
    return {action,returnReference:reference,decision:body.decision,reason};
  }
  const id=text(action.startsWith("fulfillment")?body.fulfillmentId:body.shipmentId,64);
  if(!id) throw new Error("INVALID_ACTION");
  return action==="fulfillment_retry"
    ? {action,fulfillmentId:id,reason}
    : action==="fulfillment_reconcile"
      ? {action,fulfillmentId:id,reason}
      : {action,shipmentId:id,reason};
}

export async function POST(request:Request,{params}:{params:Promise<{orderId:string}>}){
  try{
    assertAdminSameOrigin(request);
    const context=await requireAdmin(request);
    const body=await readAdminJson(request);
    let input:AdminOrderAction;
    try{input=actionBody(body);}catch{throw new AdminError("INVALID_REQUEST","Order action request is invalid.");}
    return adminJson(await executeAdminOrderAction(context,(await params).orderId,input,request));
  }catch(error){return adminErrorResponse(error);}
}
