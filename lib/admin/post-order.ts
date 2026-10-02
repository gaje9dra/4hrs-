import { Prisma } from "@prisma/client";
import { db } from "@/lib/db/client";
import { AdminError } from "@/lib/admin/errors";
import { auditAdminAction } from "@/lib/admin/audit";
import { requireHighRiskReason, requirePermission, type AdminAuthorizationContext } from "@/lib/admin/authorization";
import { createReturnsApplication } from "@/lib/returns/application";
import { cancellationEligibility, returnEligibility } from "@/lib/returns/domain";

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_PAGE_SIZE=50;
const SORTS=["createdAt_desc","createdAt_asc","updatedAt_desc","updatedAt_asc"] as const;
type Sort=typeof SORTS[number];
type DateRange={from?:Date;to?:Date};

function page(value:string|null){const n=Number(value??1);return Number.isInteger(n)?Math.min(100000,Math.max(1,n)):1;}
function pageSize(value:string|null){const n=Number(value??25);return Number.isInteger(n)?Math.min(MAX_PAGE_SIZE,Math.max(1,n)):25;}
function clean(value:string|null,max=120){const v=value?.trim()??"";return v?v.slice(0,max):undefined;}
function parseDate(value:string|null,end=false){if(!value)return undefined;const d=new Date(end?value+"T23:59:59.999Z":value+"T00:00:00.000Z");return Number.isNaN(d.getTime())?undefined:d;}
function range(url:URL):DateRange{const from=parseDate(url.searchParams.get("from"));const to=parseDate(url.searchParams.get("to"),true);if((url.searchParams.get("from")&&!from)||(url.searchParams.get("to")&&!to)||(from&&to&&from>to))throw new AdminError("INVALID_REQUEST","Date range is invalid.");return {from,to};}
function sort(url:URL):Sort{const value=clean(url.searchParams.get("sort"))??"createdAt_desc";if(!SORTS.includes(value as Sort))throw new AdminError("INVALID_REQUEST","Sort field is invalid.");return value as Sort;}
function order(sortValue:Sort){switch(sortValue){case"createdAt_asc":return[{createdAt:"asc" as const},{id:"asc" as const}];case"updatedAt_desc":return[{updatedAt:"desc" as const},{id:"desc" as const}];case"updatedAt_asc":return[{updatedAt:"asc" as const},{id:"asc" as const}];default:return[{createdAt:"desc" as const},{id:"desc" as const}];}}
function errorMap(error:unknown):never{if(error instanceof AdminError)throw error;const code=typeof error==="object"&&error&&"code" in error?(error as {code?:unknown}).code:null;if(code==="RETURN_NOT_FOUND"||code==="ORDER_NOT_FOUND")throw new AdminError("NOT_FOUND","The requested post-order resource was not found.");if(code==="CANCELLATION_INVALID_TRANSITION"||code==="RETURN_INVALID_TRANSITION"||code==="RETURN_RESOLUTION_INVALID"||code==="CONCURRENCY_CONFLICT")throw new AdminError("CONFLICT","The post-order resource changed or is not in a valid state.");if(code==="REFUND_UNAVAILABLE")throw new AdminError("INVALID_REQUEST","This return resolution is not supported by the current Payment/Return architecture.");if(error instanceof Error&&error.name==="CaseDomainError")throw new AdminError("CONFLICT",error.message);throw new AdminError("DATABASE_ERROR","The post-order operation could not be completed safely.",{cause:error});}
function iso(d:Date|null|undefined){return d?.toISOString()??null;}
function eligibilityForOrder(row:{status:Prisma.OrderGetPayload<{select:{status:true}}>["status"];fulfillment:{status:string}|null;shipments:Array<{status:string;deliveredAt:Date|null;updatedAt:Date}>;payment:{status:string;completedAt:Date|null}}){
 const shipment=row.shipments.slice().sort((a,b)=>b.updatedAt.getTime()-a.updatedAt.getTime())[0]??null;
 const state={orderStatus:row.status,fulfillmentStatus:row.fulfillment?.status??null,hasShipment:row.shipments.length>0,shipmentStatus:shipment?.status??null,deliveredAt:shipment?.deliveredAt??null,paymentSucceeded:row.payment.status==="SUCCEEDED"&&!!row.payment.completedAt};
 return {cancellation:cancellationEligibility(state),return:returnEligibility({...state,now:new Date(),returnWindowDays:Number(process.env.RETURN_WINDOW_DAYS??"7"))};
}
export type PostOrderQuery={page:number;pageSize:number;search?:string;status?:string;reason?:string;from?:Date;to?:Date;sort:Sort};
export function parsePostOrderQuery(url:URL):PostOrderQuery{return {page:page(url.searchParams.get("page")),pageSize:pageSize(url.searchParams.get("pageSize")),search:clean(url.searchParams.get("search")),status:clean(url.searchParams.get("status")),reason:clean(url.searchParams.get("reason")), ...range(url),sort:sort(url)};}
function dateWhere(q:PostOrderQuery):Prisma.DateTimeFilter|undefined{return q.from||q.to?{...(q.from?{gte:q.from}:{}),...(q.to?{lte:q.to}:{})}:undefined;}

export async function listAdminCancellations(q:PostOrderQuery,canReadCustomer:boolean){
 const and:Prisma.CancellationRequestWhereInput[]=[];
 if(q.status)and.push({status:q.status as never}); if(q.reason)and.push({reason:{contains:q.reason,mode:"insensitive"}}); const date=dateWhere(q);if(date)and.push({createdAt:date});
 if(q.search){const x=q.search;and.push({OR:[{cancellationReference:{contains:x,mode:"insensitive"}},{reason:{contains:x,mode:"insensitive"}},{order:{orderNumber:{contains:x,mode:"insensitive"}}},{customer:{email:{contains:x,mode:"insensitive"}}},{customer:{displayName:{contains:x,mode:"insensitive"}}}]});}
 const where=and.length?{AND:and}:undefined;const [rows,total]=await db.$transaction([db.cancellationRequest.findMany({where,skip:(q.page-1)*q.pageSize,take:q.pageSize,orderBy:order(q.sort),include:{customer:{select:{id:true,email:true,displayName:true}},order:{select:{id:true,orderNumber:true,status:true}}}}),db.cancellationRequest.count({where})]);
 return {items:rows.map(r=>({id:r.id,reference:r.cancellationReference,status:r.status,reason:r.reason,description:r.customerDescription,customer:canReadCustomer?{id:r.customer.id,email:r.customer.email,displayName:r.customer.displayName}:null,order:r.order,requestedAt:r.requestedAt.toISOString(),reviewedAt:iso(r.reviewedAt),completedAt:iso(r.completedAt)})),pagination:{page:q.page,pageSize:q.pageSize,total,totalPages:Math.max(1,Math.ceil(total/q.pageSize)),hasNextPage:q.page*q.pageSize<total}};
}
export async function getAdminCancellation(reference:string,canReadCustomer:boolean,canReadAudit:boolean){
 const row=await db.cancellationRequest.findUnique({where:{cancellationReference:reference},include:{customer:{select:{id:true,email:true,displayName:true}},order:{select:{id:true,orderNumber:true,status:true,customerId:true,payment:{select:{id:true,status:true,amount:true,currency:true}},fulfillment:{select:{id:true,status:true}},shipments:{select:{id:true,status:true,trackingNumber:true,trackingUrl:true,updatedAt:true,deliveredAt:true}}}}}});
 if(!row)throw new AdminError("NOT_FOUND","Cancellation was not found.");
 const eligibility=eligibilityForOrder(row.order);
 const audit=canReadAudit?await db.adminAuditLog.findMany({where:{resourceType:{in:["CancellationRequest","Order"]},resourceId:{in:[row.id,row.order.id]}},orderBy:[{createdAt:"asc"},{id:"asc"}],select:{action:true,success:true,reason:true,createdAt:true,actorAdminId:true,correlationId:true,resourceId:true}}):[];
 const domainAudit=await db.commerceExceptionAuditEvent.findMany({where:{cancellationRequestId:row.id},orderBy:[{createdAt:"asc"},{id:"asc"}],select:{action:true,previousState:true,newState:true,reason:true,createdAt:true,actorType:true,actorId:true,correlationId:true}});
 return {id:row.id,reference:row.cancellationReference,status:row.status,reason:row.reason,customerDescription:row.customerDescription,customer:canReadCustomer?row.customer:{id:row.customer.id,email:null,displayName:null},order:{id:row.order.id,orderNumber:row.order.orderNumber,status:row.order.status},requestedAt:row.requestedAt.toISOString(),reviewedAt:iso(row.reviewedAt),completedAt:iso(row.completedAt),eligibility,audit,domainAudit,payment:row.order.payment?{id:row.order.payment.id,status:row.order.payment.status,amount:row.order.payment.amount.toFixed(2),currency:row.order.payment.currency}:null,fulfillment:row.order.fulfillment,shipments:row.order.shipments.map(s=>({...s,trackingNumber:canReadCustomer?s.trackingNumber:null,trackingUrl:canReadCustomer?s.trackingUrl:null,updatedAt:s.updatedAt.toISOString(),deliveredAt:iso(s.deliveredAt)}))};
}
export async function listAdminReturns(q:PostOrderQuery,canReadCustomer:boolean){
 const and:Prisma.ReturnRequestWhereInput[]=[];if(q.status)and.push({status:q.status as never});if(q.reason)and.push({reasonCode:q.reason as never});const date=dateWhere(q);if(date)and.push({createdAt:date});
 if(q.search){const x=q.search;and.push({OR:[{returnReference:{contains:x,mode:"insensitive"}},{order:{orderNumber:{contains:x,mode:"insensitive"}}},{customer:{email:{contains:x,mode:"insensitive"}}},{customer:{displayName:{contains:x,mode:"insensitive"}}}]});}
 const where=and.length?{AND:and}:undefined;const [rows,total]=await db.$transaction([db.returnRequest.findMany({where,skip:(q.page-1)*q.pageSize,take:q.pageSize,orderBy:order(q.sort),include:{customer:{select:{id:true,email:true,displayName:true}},order:{select:{id:true,orderNumber:true,status:true}},items:{select:{quantity:true}},shipment:{select:{reference:true,status:true,carrier:true,trackingNumber:true,trackingUrl:true}},inspection:{select:{outcome:true,inspectedAt:true}},resolution:{select:{type:true,refundAmount:true,currency:true,resolvedAt:true}}}}),db.returnRequest.count({where})]);
 return {items:rows.map(r=>({id:r.id,reference:r.returnReference,status:r.status,reasonCode:r.reasonCode,customer:canReadCustomer?{id:r.customer.id,email:r.customer.email,displayName:r.customer.displayName}:null,order:r.order,quantity:r.items.reduce((n,i)=>n+i.quantity,0),shipment:r.shipment?{...r.shipment,trackingNumber:canReadCustomer?r.shipment.trackingNumber:null,trackingUrl:canReadCustomer?r.shipment.trackingUrl:null}:null,inspection:r.inspection?{outcome:r.inspection.outcome,inspectedAt:r.inspection.inspectedAt.toISOString()}:null,resolution:r.resolution?{type:r.resolution.type,refundAmount:r.resolution.refundAmount?.toFixed(2)??null,currency:r.resolution.currency,resolvedAt:r.resolution.resolvedAt.toISOString()}:null,requestedAt:r.requestedAt.toISOString(),resolvedAt:iso(r.resolvedAt)})),pagination:{page:q.page,pageSize:q.pageSize,total,totalPages:Math.max(1,Math.ceil(total/q.pageSize)),hasNextPage:q.page*q.pageSize<total}};
}
export async function getAdminReturn(reference:string,canReadCustomer:boolean,canReadAudit:boolean){
 const row=await db.returnRequest.findUnique({where:{returnReference:reference},include:{customer:{select:{id:true,email:true,displayName:true}},order:{select:{id:true,orderNumber:true,status:true}},items:{include:{orderItem:{select:{id:true,productTitleSnapshot:true,variantTitleSnapshot:true,skuSnapshot:true,quantity:true,unitPrice:true,lineTotal:true,currency:true}}}},shipment:{select:{id:true,reference:true,status:true,carrier:true,trackingNumber:true,trackingUrl:true,externallySupplied:true,createdAt:true,updatedAt:true}},inspection:{select:{receivedQuantity:true,acceptedQuantity:true,rejectedQuantity:true,outcome:true,internalReason:true,operatorId:true,inspectedAt:true}},resolution:{select:{type:true,refundAmount:true,currency:true,paymentRefundIntentReference:true,note:true,resolvedBy:true,resolvedAt:true}}}});
 if(!row)throw new AdminError("NOT_FOUND","Return was not found.");
 const audit=canReadAudit?await db.adminAuditLog.findMany({where:{resourceType:{in:["ReturnRequest","Order"]},resourceId:{in:[row.id,row.order.id]}},orderBy:[{createdAt:"asc"},{id:"asc"}],select:{action:true,success:true,reason:true,createdAt:true,actorAdminId:true,correlationId:true,resourceId:true}}):[];
 const domainAudit=await db.commerceExceptionAuditEvent.findMany({where:{returnRequestId:row.id},orderBy:[{createdAt:"asc"},{id:"asc"}],select:{action:true,previousState:true,newState:true,reason:true,createdAt:true,actorType:true,actorId:true,correlationId:true}});
 const order=await db.order.findUnique({where:{id:row.order.id},select:{status:true,fulfillment:{select:{status:true}},shipments:{select:{status:true,deliveredAt:true,updatedAt:true}},payment:{select:{status:true,completedAt:true}}}});
 const eligibility=order?eligibilityForOrder(order).return:"ineligible";
 return {id:row.id,reference:row.returnReference,status:row.status,reasonCode:row.reasonCode,customerDescription:row.customerDescription,customer:canReadCustomer?row.customer:{id:row.customer.id,email:null,displayName:null},order:row.order,items:row.items.map(i=>({id:i.id,orderItemId:i.orderItemId,productTitle:i.orderItem.productTitleSnapshot,variantTitle:i.orderItem.variantTitleSnapshot,storeSku:i.orderItem.skuSnapshot,quantity:i.quantity,unitPrice:i.orderItem.unitPrice.toFixed(2),lineTotal:i.orderItem.lineTotal.toFixed(2),currency:i.orderItem.currency})),eligibility,shipment:row.shipment?{...row.shipment,trackingNumber:canReadCustomer?row.shipment.trackingNumber:null,trackingUrl:canReadCustomer?row.shipment.trackingUrl:null,createdAt:row.shipment.createdAt.toISOString(),updatedAt:row.shipment.updatedAt.toISOString()}:null,inspection:row.inspection?{...row.inspection,inspectedAt:row.inspection.inspectedAt.toISOString()}:null,resolution:row.resolution?{...row.resolution,resolvedAt:row.resolution.resolvedAt.toISOString(),refundAmount:row.resolution.refundAmount?.toFixed(2)??null}:null,requestedAt:row.requestedAt.toISOString(),resolvedAt:iso(row.resolvedAt),audit,domainAudit};
}
export type PostOrderAction =
 | {action:"cancellation_review";reference:string;decision:"APPROVE"|"REJECT";reason:unknown;idempotencyKey:string}
 | {action:"return_review";reference:string;decision:"APPROVE"|"REJECT";reason:unknown;idempotencyKey:string}
 | {action:"return_inspect";reference:string;receivedQuantity:number;acceptedQuantity:number;rejectedQuantity:number;outcome:"ACCEPTED"|"PARTIALLY_ACCEPTED"|"REJECTED";reason:unknown;idempotencyKey:string}
 | {action:"return_resolve_rejected";reference:string;note?:string;reason:unknown;idempotencyKey:string};

function assertKey(value:string){if(!/^[A-Za-z0-9._~-]{16,128}$/.test(value))throw new AdminError("INVALID_REQUEST","A valid Idempotency-Key is required.");}
function correlation(request?:Request){const v=request?.headers.get("x-request-id")?.trim();return v&&v.length<=128?v:undefined;}
export async function executeAdminPostOrderAction(context:AdminAuthorizationContext,input:PostOrderAction,request?:Request){
 assertKey(input.idempotencyKey);const reason=requireHighRiskReason(input.reason);const correlationId=correlation(request);
 try{
  if(input.action==="cancellation_review"){
   requirePermission(context,"cancellation.approve");const row=await db.cancellationRequest.findUnique({where:{cancellationReference:input.reference},select:{id:true}});if(!row)throw new AdminError("NOT_FOUND","Cancellation was not found.");
   const result=await createReturnsApplication().reviewCancellation({reference:input.reference,decision:input.decision,reason,idempotencyKey:input.idempotencyKey,request});
   await auditAdminAction(context,{action:"CANCELLATION_"+input.decision,resourceType:"CancellationRequest",resourceId:row.id,success:true,reason,correlationId,metadata:{idempotencyKey:input.idempotencyKey}});
   return result;
  }
  if(input.action==="return_review"){
   requirePermission(context,input.decision==="APPROVE"?"return.approve":"return.reject");const row=await db.returnRequest.findUnique({where:{returnReference:input.reference},select:{id:true}});if(!row)throw new AdminError("NOT_FOUND","Return was not found.");
   const result=await createReturnsApplication().reviewReturn({reference:input.reference,decision:input.decision,reason,idempotencyKey:input.idempotencyKey,request});
   await auditAdminAction(context,{action:"RETURN_"+input.decision,resourceType:"ReturnRequest",resourceId:row.id,success:true,reason,correlationId,metadata:{idempotencyKey:input.idempotencyKey}});
   return result;
  }
  if(input.action==="return_inspect"){
   requirePermission(context,"return.inspect");if(![input.receivedQuantity,input.acceptedQuantity,input.rejectedQuantity].every(Number.isInteger))throw new AdminError("INVALID_REQUEST","Inspection quantities must be integers.");
   const row=await db.returnRequest.findUnique({where:{returnReference:input.reference},select:{id:true}});if(!row)throw new AdminError("NOT_FOUND","Return was not found.");
   const result=await createReturnsApplication().inspectReturn({...input,reason,idempotencyKey:input.idempotencyKey,request});
   await auditAdminAction(context,{action:"RETURN_INSPECT",resourceType:"ReturnRequest",resourceId:row.id,success:true,reason,correlationId,metadata:{idempotencyKey:input.idempotencyKey}});
   return result;
  }
  requirePermission(context,"return.resolve");const row=await db.returnRequest.findUnique({where:{returnReference:input.reference},select:{id:true}});if(!row)throw new AdminError("NOT_FOUND","Return was not found.");
  const result=await createReturnsApplication().resolveReturn({reference:input.reference,type:"REJECTED",note:input.note,reason,idempotencyKey:input.idempotencyKey,request});
  await auditAdminAction(context,{action:"RETURN_RESOLVE_REJECTED",resourceType:"ReturnRequest",resourceId:row.id,success:true,reason,correlationId,metadata:{idempotencyKey:input.idempotencyKey}});
  return result;
 }catch(error){await auditAdminAction(context,{action:"POST_ORDER_"+input.action.toUpperCase()+"_FAILED",resourceType:input.action.startsWith("cancellation")?"CancellationRequest":"ReturnRequest",success:false,reason,correlationId,metadata:{error:error instanceof Error?error.name:"unknown",idempotencyKey:input.idempotencyKey}}).catch(()=>undefined);errorMap(error);}
}
