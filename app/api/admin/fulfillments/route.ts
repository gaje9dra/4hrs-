import { requireAdmin } from "@/lib/admin/authorization";
import { adminErrorResponse, adminJson, assertAdminSameOrigin, readAdminJson } from "@/lib/admin/http";
import { AdminError } from "@/lib/admin/errors";
import { executeAdminFulfillmentAction, listAdminFulfillments, parseAdminFulfillmentQuery, type AdminFulfillmentAction } from "@/lib/admin/fulfillment";

export const dynamic="force-dynamic";
export const revalidate=0;

function text(value:unknown,max=255){return typeof value==="string"&&value.trim()&&value.length<=max?value.trim():undefined;}
function bodyAction(body:Record<string,unknown>):AdminFulfillmentAction{
  if(body.action!=="create")throw new AdminError("INVALID_REQUEST","Unsupported fulfillment collection action.");
  const orderId=text(body.orderId,64),idempotencyKey=text(body.idempotencyKey,128),reason=text(body.reason,1000);
  if(!orderId||!idempotencyKey||!reason)throw new AdminError("INVALID_REQUEST","Fulfillment creation request is invalid.");
  return {action:"create",orderId,idempotencyKey,reason};
}
export async function GET(request:Request){
  try{const context=await requireAdmin(request,"fulfillment.read");return adminJson(await listAdminFulfillments(parseAdminFulfillmentQuery(new URL(request.url)),context));}
  catch(error){return adminErrorResponse(error);}
}
export async function POST(request:Request){
  try{
    assertAdminSameOrigin(request);
    const context=await requireAdmin(request);
    const input=bodyAction(await readAdminJson(request));
    return adminJson(await executeAdminFulfillmentAction(context,input));
  }catch(error){return adminErrorResponse(error);}
}
