import { Prisma } from "@prisma/client";
import { db } from "@/lib/db/client";
import { requireHighRiskReason, requirePermission, type AdminAuthorizationContext } from "@/lib/admin/authorization";
import { auditAdminAction } from "@/lib/admin/audit";
import { AdminError } from "@/lib/admin/errors";
import { createPaymentApplication } from "@/lib/payments/application";
import type { AdminRefundReason } from "@/lib/payments/application";

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const STATUSES=["CREATED","REQUIRES_ACTION","PROCESSING","SUCCEEDED","FAILED","CANCELLED","EXPIRED","REFUNDED","PARTIALLY_REFUNDED"] as const;
const REFUND_STATUSES=["PENDING","SUCCEEDED","FAILED","AMBIGUOUS"] as const;
const REASONS=["CUSTOMER_REQUEST","ORDER_CANCELLED","RETURN_APPROVED","DUPLICATE_PAYMENT","PAYMENT_ERROR","OPERATIONAL_CORRECTION","OTHER"] as const;
type PaymentStatus=typeof STATUSES[number];

function boundedInt(value:string|null, fallback:number, min:number, max:number){const n=Number(value??fallback);return Number.isInteger(n)?Math.min(max,Math.max(min,n)):fallback;}
function decimal(value:Prisma.Decimal){return value.toFixed(2);}
function iso(value:Date|null){return value?.toISOString()??null;}
function date(value:string|null, end=false){if(!value)return undefined;const d=new Date(end?value+"T23:59:59.999Z":value+"T00:00:00.000Z");return Number.isNaN(d.getTime())?undefined:d;}
function clean(value:string|null,max=120){const v=value?.trim()??"";return v? v.slice(0,max):undefined;}

export type AdminPaymentQuery={
 page:number;pageSize:number;search?:string;status?:PaymentStatus;providerId?:string;orderId?:string;
 currency?:string;from?:Date;to?:Date;minAmount?:string;maxAmount?:string;refundStatus?:typeof REFUND_STATUSES[number];
 sort:"createdAt_desc"|"createdAt_asc"|"amount_desc"|"amount_asc";
};

export function parseAdminPaymentQuery(url:URL):AdminPaymentQuery{
 const status=clean(url.searchParams.get("status"));
 const refundStatus=clean(url.searchParams.get("refundStatus"));
 const sort=clean(url.searchParams.get("sort"))??"createdAt_desc";
 const allowedSort=["createdAt_desc","createdAt_asc","amount_desc","amount_asc"] as const;
 if(status && !(STATUSES as readonly string[]).includes(status))throw new AdminError("INVALID_REQUEST","Payment status is invalid.");
 if(refundStatus && !(REFUND_STATUSES as readonly string[]).includes(refundStatus))throw new AdminError("INVALID_REQUEST","Refund status is invalid.");
 if(!allowedSort.includes(sort as typeof allowedSort[number]))throw new AdminError("INVALID_REQUEST","Payment sort is invalid.");
 const orderId=clean(url.searchParams.get("orderId"),64); if(orderId && !UUID.test(orderId))throw new AdminError("INVALID_REQUEST","Order identifier is invalid.");
 const currency=clean(url.searchParams.get("currency"),3)?.toUpperCase(); if(currency && !/^[A-Z]{3}$/.test(currency))throw new AdminError("INVALID_REQUEST","Currency is invalid.");
 const from=date(url.searchParams.get("from")); const to=date(url.searchParams.get("to"),true);
 if(url.searchParams.get("from") && !from || url.searchParams.get("to") && !to)throw new AdminError("INVALID_REQUEST","Payment date range is invalid.");
 const minAmount=clean(url.searchParams.get("minAmount"),32); const maxAmount=clean(url.searchParams.get("maxAmount"),32);
 for(const value of [minAmount,maxAmount])if(value!==undefined && (!/^\d+(?:\.\d{1,2})?$/.test(value)||new Prisma.Decimal(value).lt(0)))throw new AdminError("INVALID_REQUEST","Payment amount filter is invalid.");
 if(minAmount&&maxAmount&&new Prisma.Decimal(minAmount).gt(new Prisma.Decimal(maxAmount)))throw new AdminError("INVALID_REQUEST","Payment amount range is invalid.");
 return {page:boundedInt(url.searchParams.get("page"),1,1,100000),pageSize:boundedInt(url.searchParams.get("pageSize"),25,1,50),search:clean(url.searchParams.get("search"),120),status:status as PaymentStatus|undefined,providerId:clean(url.searchParams.get("providerId"),64),orderId,currency,from,to,minAmount,maxAmount,refundStatus:refundStatus as typeof REFUND_STATUSES[number]|undefined,sort:sort as AdminPaymentQuery["sort"]};
}

function orderBy(sort:AdminPaymentQuery["sort"]):Prisma.PaymentOrderByWithRelationInput[]{switch(sort){case"createdAt_asc":return[{createdAt:"asc"},{id:"asc"}];case"amount_desc":return[{amount:"desc"},{id:"desc"}];case"amount_asc":return[{amount:"asc"},{id:"asc"}];default:return[{createdAt:"desc"},{id:"desc"}];}}

export async function listAdminPayments(query:AdminPaymentQuery, canViewSensitive:boolean){
 const and:Prisma.PaymentWhereInput[]=[];
 if(query.status)and.push({status:query.status});
 if(query.providerId)and.push({providerId:query.providerId});
 if(query.orderId)and.push({order:{id:query.orderId}});
 if(query.currency)and.push({currency:query.currency});
 if(query.from||query.to)and.push({createdAt:{...(query.from?{gte:query.from}:{}),...(query.to?{lte:query.to}:{})}});
 if(query.minAmount||query.maxAmount)and.push({amount:{...(query.minAmount?{gte:new Prisma.Decimal(query.minAmount)}:{}),...(query.maxAmount?{lte:new Prisma.Decimal(query.maxAmount)}:{})}});
 if(query.refundStatus)and.push({refunds:{some:{status:query.refundStatus}}});
 if(query.search){const term=query.search;and.push({OR:[{internalReference:{contains:term,mode:"insensitive"}},{providerReference:{contains:term,mode:"insensitive"}},{customer:{email:{contains:term,mode:"insensitive"}}},{customer:{displayName:{contains:term,mode:"insensitive"}}},{order:{orderNumber:{contains:term,mode:"insensitive"}}}]});}
 const result=await db.payment.findMany({
  where:and.length?{AND:and}:undefined,skip:(query.page-1)*query.pageSize,take:query.pageSize,orderBy:orderBy(query.sort),
  include:{customer:{select:{id:true,email:true,displayName:true}},order:{select:{id:true,orderNumber:true,total:true,currency:true,createdAt:true}},attempts:{orderBy:[{attemptNumber:"desc"}],take:1},refunds:{orderBy:[{createdAt:"desc"},{id:"desc"}]}}
 });
 const total=await db.payment.count({where:and.length?{AND:and}:undefined});
 return {payments:result.map(p=>({id:p.id,reference:p.internalReference,status:p.status,amount:decimal(p.amount),currency:p.currency,providerId:p.providerId,providerReference:canViewSensitive?p.providerReference:null,createdAt:p.createdAt.toISOString(),updatedAt:p.updatedAt.toISOString(),completedAt:iso(p.completedAt),customer:p.customer,order:p.order?{id:p.order.id,orderNumber:p.order.orderNumber,total:decimal(p.order.total),currency:p.order.currency,createdAt:p.order.createdAt.toISOString()}:null,latestAttempt:p.attempts[0]?{id:p.attempts[0].id,number:p.attempts[0].attemptNumber,status:p.attempts[0].status,providerReference:canViewSensitive?p.attempts[0].providerAttemptReference:null}:null,refund:{count:p.refunds.length,succeeded:decimal(p.refunds.filter(r=>r.status==="SUCCEEDED").reduce((s,r)=>s.plus(r.amount),new Prisma.Decimal(0))),pending:decimal(p.refunds.filter(r=>r.status==="PENDING"||r.status==="AMBIGUOUS").reduce((s,r)=>s.plus(r.amount),new Prisma.Decimal(0)))}})),pagination:{page:query.page,pageSize:query.pageSize,total,totalPages:Math.max(1,Math.ceil(total/query.pageSize)),hasNextPage:query.page*query.pageSize<total}};
}

export async function getAdminPayment(paymentId:string, canViewSensitive:boolean, canReadAudit:boolean){
 if(!UUID.test(paymentId))throw new AdminError("INVALID_REQUEST","Payment identifier is invalid.");
 const payment=await db.payment.findUnique({where:{id:paymentId},include:{customer:{select:{id:true,email:true,displayName:true}},order:{select:{id:true,orderNumber:true,total:true,currency:true,createdAt:true}},attempts:{orderBy:[{attemptNumber:"asc"},{createdAt:"asc"}]},events:{orderBy:[{receivedAt:"asc"},{id:"asc"}]},refunds:{orderBy:[{createdAt:"asc"},{id:"asc"}]}}});
 if(!payment)throw new AdminError("NOT_FOUND","Payment was not found.");
 const audit=canReadAudit?await db.adminAuditLog.findMany({where:{resourceType:"Payment",resourceId:payment.id},orderBy:[{createdAt:"asc"},{id:"asc"}],select:{action:true,success:true,reason:true,createdAt:true,actorAdminId:true,correlationId:true}}):[];
 return {id:payment.id,reference:payment.internalReference,checkoutReference:payment.checkoutReference,status:payment.status,amount:decimal(payment.amount),currency:payment.currency,providerId:payment.providerId,providerReference:canViewSensitive?payment.providerReference:null,completedAt:iso(payment.completedAt),expiresAt:iso(payment.expiresAt),createdAt:payment.createdAt.toISOString(),updatedAt:payment.updatedAt.toISOString(),customer:payment.customer,order:payment.order?{id:payment.order.id,orderNumber:payment.order.orderNumber,total:decimal(payment.order.total),currency:payment.order.currency,createdAt:payment.order.createdAt.toISOString()}:null,attempts:payment.attempts.map(a=>({id:a.id,attemptNumber:a.attemptNumber,status:a.status,amount:decimal(a.amount),currency:a.currency,providerId:a.providerId,providerReference:canViewSensitive?a.providerAttemptReference:null,failureCode:a.failureCode,failureCategory:a.failureCategory,createdAt:a.createdAt.toISOString(),updatedAt:a.updatedAt.toISOString()})),events:payment.events.map(e=>({id:e.id,providerId:e.providerId,providerEventId:canViewSensitive?e.providerEventId:null,eventType:e.eventType,normalizedEventType:e.normalizedEventType,processingStatus:e.processingStatus,occurredAt:iso(e.occurredAt),receivedAt:e.receivedAt.toISOString(),processingError:e.processingError})),refunds:payment.refunds.map(r=>({id:r.id,amount:decimal(r.amount),currency:r.currency,status:r.status,reason:r.reason,note:r.note,providerId:r.providerId,providerReference:canViewSensitive?r.providerReference:null,failureCode:r.failureCode,createdAt:r.createdAt.toISOString(),updatedAt:r.updatedAt.toISOString(),completedAt:iso(r.completedAt),idempotencyKey:canViewSensitive?r.idempotencyKey:null})),audit};
}

export type AdminPaymentAction=
 | {action:"refund";amount:string;currency:string;reason:AdminRefundReason;note?:string|null;idempotencyKey:string}
 | {action:"reconcile";reason:unknown}
 | {action:"verify";reason:unknown}
 | {action:"retry";reason:unknown;idempotencyKey:string};

export async function executeAdminPaymentAction(context:AdminAuthorizationContext,paymentId:string,input:AdminPaymentAction,request?:Request){
 if(!UUID.test(paymentId))throw new AdminError("INVALID_REQUEST","Payment identifier is invalid.");
 const reason=requireHighRiskReason(input.reason);
 const correlationId=request?.headers.get("x-request-id")?.slice(0,128);
 const paymentApp=createPaymentApplication();
 try{
  if(input.action==="refund"){
   const permission=input.amount===undefined?"payments.refund":"payments.refund_partial";
   requirePermission(context,permission);
   const current=await db.payment.findUnique({where:{id:paymentId},select:{amount:true,status:true}});
   if(!current)throw new AdminError("NOT_FOUND","Payment was not found.");
   const full=new Prisma.Decimal(input.amount).eq(current.amount);
   requirePermission(context,full?"payments.refund":"payments.refund_partial");
   const result=await paymentApp.refundPayment({paymentId,amount:input.amount,currency:input.currency,reason,note:input.note??null,idempotencyKey:input.idempotencyKey});
   await auditAdminAction(context,{action:"PAYMENT_REFUND",resourceType:"Payment",resourceId:paymentId,success:true,reason,correlationId,metadata:{refundId:result.refundId,amount:result.amount.value,currency:result.currency,status:result.status}});
   return {action:input.action,result};
  }
  if(input.action==="reconcile"){
   requirePermission(context,"payments.reconcile");
   const result=await paymentApp.reconcilePayment(paymentId,context.customer.id);
   await auditAdminAction(context,{action:"PAYMENT_RECONCILE",resourceType:"Payment",resourceId:paymentId,success:true,reason,correlationId,metadata:{status:result.status}});
   return {action:input.action,result};
  }
  if(input.action==="verify"){
   requirePermission(context,"payments.verify");
   const result=await paymentApp.reconcilePayment(paymentId,context.customer.id);
   await auditAdminAction(context,{action:"PAYMENT_VERIFY",resourceType:"Payment",resourceId:paymentId,success:true,reason,correlationId,metadata:{status:result.status}});
   return {action:input.action,result};
  }
  requirePermission(context,"payments.retry");
  const result=await paymentApp.retryPayment(paymentId,context.customer.id,input.idempotencyKey);
  await auditAdminAction(context,{action:"PAYMENT_RETRY",resourceType:"Payment",resourceId:paymentId,success:true,reason,correlationId,metadata:{status:result.status}});
  return {action:input.action,result};
 }catch(error){
  await auditAdminAction(context,{action:"PAYMENT_"+input.action.toUpperCase()+"_FAILED",resourceType:"Payment",resourceId:paymentId,success:false,reason,correlationId,metadata:{error:error instanceof Error?error.name:"unknown"}}).catch(()=>undefined);
  throw error;
 }
}
