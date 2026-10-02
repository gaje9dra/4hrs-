import { requireAdmin } from "@/lib/admin/authorization";
import { adminErrorResponse, adminJson, readAdminJson } from "@/lib/admin/http";
import { executeAdminPaymentAction, type AdminPaymentAction } from "@/lib/admin/payments";
import { AdminError } from "@/lib/admin/errors";
import type { AdminRefundReason } from "@/lib/payments/application";
import { assertAdminSameOrigin } from "@/lib/admin/http";
const text=(v:unknown,max=1000)=>typeof v==="string"?v.trim().slice(0,max):"";
function actionBody(body:Record<string,unknown>):AdminPaymentAction{
 const action=text(body.action,32);
 const reason=text(body.reason,1000);
 if(action==="refund"){
  const amount=text(body.amount,32),currency=text(body.currency,3).toUpperCase(),refundReason=text(body.refundReason,64),idempotencyKey=text(body.idempotencyKey,128),note=text(body.note,1000);
  if(!amount||!currency||!refundReason||!idempotencyKey)throw new AdminError("INVALID_REQUEST","Refund request is invalid.");
  return {action,amount,currency,reason:refundReason as AdminRefundReason,idempotencyKey,note:note||null};
 }
 if(action==="retry"){const idempotencyKey=text(body.idempotencyKey,128);if(!idempotencyKey)throw new AdminError("INVALID_REQUEST","Retry idempotency key is required.");return {action,reason,idempotencyKey};}
 if(action==="reconcile"||action==="verify")return {action,reason};
 throw new AdminError("INVALID_REQUEST","Payment action is invalid.");
}
export async function POST(request:Request,{params}:{params:Promise<{paymentId:string}>}){try{assertAdminSameOrigin(request);const context=await requireAdmin(request);const body=await readAdminJson(request);return adminJson(await executeAdminPaymentAction(context,(await params).paymentId,actionBody(body),request));}catch(error){return adminErrorResponse(error);}}