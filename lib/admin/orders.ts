import { Prisma } from "@prisma/client";
import { db } from "@/lib/db/client";
import { AdminError } from "@/lib/admin/errors";
import { auditAdminAction } from "@/lib/admin/audit";
import { requireHighRiskReason, requirePermission, type AdminAuthorizationContext } from "@/lib/admin/authorization";
import { createReturnsApplication } from "@/lib/returns/application";
import { createFulfillmentApplication } from "@/lib/fulfillment/application";
import { createShippingApplication } from "@/lib/shipping/application";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ORDER_NUMBER = /^ORD-[A-F0-9]{24}$/i;
const MAX_PAGE_SIZE = 100;
const LIST_SORTS = ["createdAt","updatedAt","orderNumber","total"] as const;
type ListSort = typeof LIST_SORTS[number];

export type AdminOrderListQuery = {
  page: number;
  pageSize: number;
  search?: string;
  status?: "PENDING"|"CONFIRMED";
  paymentStatus?: "CREATED"|"REQUIRES_ACTION"|"PROCESSING"|"SUCCEEDED"|"FAILED"|"CANCELLED"|"EXPIRED"|"REFUNDED"|"PARTIALLY_REFUNDED";
  fulfillmentStatus?: "PENDING"|"SUBMITTED"|"FAILED"|"COMPLETED";
  shipmentStatus?: "CREATED"|"IN_TRANSIT"|"OUT_FOR_DELIVERY"|"DELIVERED"|"DELIVERY_FAILED"|"RETURNED";
  cancellationStatus?: "REQUESTED"|"APPROVED"|"REJECTED"|"PROCESSING"|"COMPLETED"|"FAILED"|"REQUIRES_REVIEW";
  returnStatus?: "REQUESTED"|"UNDER_REVIEW"|"APPROVED"|"REJECTED"|"RETURN_IN_TRANSIT"|"RETURN_RECEIVED"|"INSPECTION_PENDING"|"INSPECTED"|"RESOLUTION_PENDING"|"RESOLVED"|"FAILED";
  from?: Date;
  to?: Date;
  sort: ListSort;
  direction: "asc"|"desc";
};

export type AdminOrderListItem = {
  id: string;
  orderNumber: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  total: string;
  currency: string;
  itemCount: number;
  customer: { id: string; email: string; displayName: string|null };
  paymentStatus: string;
  fulfillmentStatus: string|null;
  shipmentStatus: string|null;
  cancellationStatus: string|null;
  returnStatus: string|null;
};

export type AdminOrderDetail = {
  id: string;
  orderNumber: string;
  checkoutReference: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  pricing: { subtotal: string; total: string; currency: string };
  customer: { id: string; email: string; displayName: string|null };
  address: { recipientName:string; phone:string|null; addressLine1:string; addressLine2:string|null; city:string; stateOrProvince:string; postalCode:string; countryCode:string; label:string|null }|null;
  items: Array<{ id:string; productId:string|null; variantId:string|null; productTitle:string; variantTitle:string|null; storeSku:string|null; selectedOptions:Record<string,string>|null; quantity:number; unitPrice:string; lineTotal:string; currency:string }>;
  payment: { id:string; status:string; amount:string; currency:string; providerId:string|null; providerReference:string|null; completedAt:string|null; createdAt:string; updatedAt:string; attempts:Array<{id:string;attemptNumber:number;status:string;providerId:string|null;providerAttemptReference:string|null;failureCode:string|null;failureCategory:string|null;createdAt:string;updatedAt:string}>; events:Array<{id:string;providerId:string;providerEventId:string;eventType:string;normalizedEventType:string|null;processingStatus:string;occurredAt:string|null;receivedAt:string}> };
  fulfillment: { id:string; provider:string; providerFulfillmentReference:string|null; status:string; requestedAt:string; createdAt:string; updatedAt:string; submittedAt:string|null; acceptedAt:string|null; completedAt:string|null; failedAt:string|null; errorCode:string|null; errorMessage:string|null; items:Array<{id:string;orderItemId:string;quantity:number;providerItemReference:string|null;providerSku:string|null;providerVariantReference:string|null;status:string|null}> }|null;
  shipments: Array<{ id:string;shipmentReference:string;providerId:string;providerReference:string|null;carrier:string|null;trackingNumber:string|null;trackingUrl:string|null;service:string|null;status:string;shippedAt:string|null;deliveredAt:string|null;reconciliationRequired:boolean;reconciliationReason:string|null;createdAt:string;updatedAt:string;trackingEvents:Array<{id:string;providerId:string;providerEventId:string|null;providerStatus:string|null;normalizedStatus:string;eventTimestamp:string;location:string|null;description:string|null;source:string}> }>;
  cancellations: Array<{id:string;reference:string;status:string;reason:string;customerDescription:string|null;operationalReason:string|null;requestedAt:string;reviewedAt:string|null;completedAt:string|null}>;
  returns: Array<{id:string;reference:string;status:string;reasonCode:string;customerDescription:string|null;operationalReason:string|null;requestedAt:string;reviewedAt:string|null;resolvedAt:string|null;items:Array<{orderItemId:string;quantity:number}>;shipment:{reference:string;status:string;carrier:string|null;trackingNumber:string|null;trackingUrl:string|null}|null;inspection:{receivedQuantity:number;acceptedQuantity:number;rejectedQuantity:number;outcome:string;inspectedAt:string}|null;resolution:{type:string;refundAmount:string|null;currency:string|null;paymentRefundIntentReference:string|null;resolvedAt:string}|null}>;
  cases: Array<{id:string;reference:string;category:string;status:string;priority:string;title:string;createdAt:string;updatedAt:string;resolvedAt:string|null}>;
  timeline: Array<{kind:"domain";type:string;occurredAt:string;label:string;resourceId:string}>;
  audit: Array<{kind:"admin";action:string;success:boolean;reason:string|null;createdAt:string;resourceId:string|null;actorAdminId:string|null;correlationId:string|null}>;
};

function decimal(value: Prisma.Decimal): string { return value.toFixed(2); }
function iso(value: Date|null|undefined): string|null { return value ? value.toISOString() : null; }
function selectedOptions(value: Prisma.JsonValue|null): Record<string,string>|null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const out: Record<string,string> = {};
  for (const [key,v] of Object.entries(value)) if (typeof v === "string") out[key] = v;
  return Object.keys(out).length ? out : null;
}
function enumValue<T extends string>(value: string|undefined, allowed: readonly T[], field: string): T|undefined {
  if (value === undefined || value === "") return undefined;
  if (!allowed.includes(value as T)) throw new AdminError("INVALID_REQUEST", `Invalid ${field} filter.`);
  return value as T;
}
function dateValue(value: string|undefined, field: string): Date|undefined {
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new AdminError("INVALID_REQUEST", `Invalid ${field} filter.`);
  return date;
}
function integer(value: string|null, fallback: number, max: number, field: string): number {
  if (value === null || value === "") return fallback;
  if (!/^\d+$/.test(value)) throw new AdminError("INVALID_REQUEST", `Invalid ${field}.`);
  const n = Number(value);
  if (!Number.isSafeInteger(n) || n < 1 || n > max) throw new AdminError("INVALID_REQUEST", `Invalid ${field}.`);
  return n;
}
function direction(value: string|null): "asc"|"desc" {
  if (!value || value === "desc") return "desc";
  if (value === "asc") return "asc";
  throw new AdminError("INVALID_REQUEST", "Invalid sort direction.");
}
function parseSort(value: string|null): ListSort {
  if (!value) return "createdAt";
  if (!LIST_SORTS.includes(value as ListSort)) throw new AdminError("INVALID_REQUEST", "Invalid sort field.");
  return value as ListSort;
}
export function parseAdminOrderQuery(url: URL): AdminOrderListQuery {
  const allowed = new Set(["page","pageSize","search","status","paymentStatus","fulfillmentStatus","shipmentStatus","cancellationStatus","returnStatus","from","to","sort","direction"]);
  for (const key of url.searchParams.keys()) if (!allowed.has(key)) throw new AdminError("INVALID_REQUEST", "Unsupported order list parameter.");
  const from = dateValue(url.searchParams.get("from") ?? undefined, "from");
  const to = dateValue(url.searchParams.get("to") ?? undefined, "to");
  if (from && to && from > to) throw new AdminError("INVALID_REQUEST", "The order date range is invalid.");
  return {
    page: integer(url.searchParams.get("page"),1,1000000,"page"),
    pageSize: integer(url.searchParams.get("pageSize"),25,MAX_PAGE_SIZE,"pageSize"),
    search: url.searchParams.get("search")?.trim().slice(0,120) || undefined,
    status: enumValue(url.searchParams.get("status") ?? undefined,["PENDING","CONFIRMED"] as const,"status"),
    paymentStatus: enumValue(url.searchParams.get("paymentStatus") ?? undefined,["CREATED","REQUIRES_ACTION","PROCESSING","SUCCEEDED","FAILED","CANCELLED","EXPIRED","REFUNDED","PARTIALLY_REFUNDED"] as const,"paymentStatus"),
    fulfillmentStatus: enumValue(url.searchParams.get("fulfillmentStatus") ?? undefined,["PENDING","SUBMITTED","FAILED","COMPLETED"] as const,"fulfillmentStatus"),
    shipmentStatus: enumValue(url.searchParams.get("shipmentStatus") ?? undefined,["CREATED","IN_TRANSIT","OUT_FOR_DELIVERY","DELIVERED","DELIVERY_FAILED","RETURNED"] as const,"shipmentStatus"),
    cancellationStatus: enumValue(url.searchParams.get("cancellationStatus") ?? undefined,["REQUESTED","APPROVED","REJECTED","PROCESSING","COMPLETED","FAILED","REQUIRES_REVIEW"] as const,"cancellationStatus"),
    returnStatus: enumValue(url.searchParams.get("returnStatus") ?? undefined,["REQUESTED","UNDER_REVIEW","APPROVED","REJECTED","RETURN_IN_TRANSIT","RETURN_RECEIVED","INSPECTION_PENDING","INSPECTED","RESOLUTION_PENDING","RESOLVED","FAILED"] as const,"returnStatus"),
    from,to,sort:parseSort(url.searchParams.get("sort")),direction:direction(url.searchParams.get("direction")),
  };
}

function listWhere(query: AdminOrderListQuery): Prisma.OrderWhereInput {
  const where: Prisma.OrderWhereInput = {};
  const and: Prisma.OrderWhereInput[] = [];
  if (query.status) and.push({status:query.status});
  if (query.paymentStatus) and.push({payment:{status:query.paymentStatus}});
  if (query.fulfillmentStatus) and.push({fulfillment:{status:query.fulfillmentStatus}});
  if (query.shipmentStatus) and.push({shipments:{some:{status:query.shipmentStatus}}});
  if (query.cancellationStatus) and.push({cancellationRequests:{some:{status:query.cancellationStatus}}});
  if (query.returnStatus) and.push({returnRequests:{some:{status:query.returnStatus}}});
  if (query.from || query.to) and.push({createdAt:{...(query.from?{gte:query.from}:{}),...(query.to?{lte:query.to}:{})}});
  if (query.search) {
    const s=query.search;
    const or: Prisma.OrderWhereInput[]=[
      {orderNumber:{contains:s,mode:"insensitive"}},
      {checkoutReference:{contains:s,mode:"insensitive"}},
      {customer:{email:{contains:s,mode:"insensitive"}}},
      {customer:{displayName:{contains:s,mode:"insensitive"}}},
      {items:{some:{skuSnapshot:{contains:s,mode:"insensitive"}}}},
    ];
    if (UUID.test(s)) or.push({id:s});
    and.push({OR:or});
  }
  if (and.length) where.AND=and;
  return where;
}

function listOrderBy(query: AdminOrderListQuery): Prisma.OrderOrderByWithRelationInput[] {
  const order = {[query.sort]:query.direction} as Prisma.OrderOrderByWithRelationInput;
  return [order,{id:query.direction}];
}

export async function listAdminOrders(query: AdminOrderListQuery) {
  const where=listWhere(query);
  const [total,rows]=await Promise.all([
    db.order.count({where}),
    db.order.findMany({
      where,orderBy:listOrderBy(query),skip:(query.page-1)*query.pageSize,take:query.pageSize,
      select:{
        id:true,orderNumber:true,status:true,createdAt:true,updatedAt:true,subtotal:true,total:true,currency:true,
        customer:{select:{id:true,email:true,displayName:true}},
        payment:{select:{status:true}},
        fulfillment:{select:{status:true}},
        shipments:{select:{status:true,updatedAt:true},orderBy:[{updatedAt:"desc"},{id:"desc"}],take:1},
        cancellationRequests:{select:{status:true,updatedAt:true},orderBy:[{updatedAt:"desc"},{id:"desc"}],take:1},
        returnRequests:{select:{status:true,updatedAt:true},orderBy:[{updatedAt:"desc"},{id:"desc"}],take:1},
        _count:{select:{items:true}},
      },
    }),
  ]);
  return {
    orders:rows.map(row=>({
      id:row.id,orderNumber:row.orderNumber,status:row.status,createdAt:row.createdAt.toISOString(),updatedAt:row.updatedAt.toISOString(),
      total:decimal(row.total),currency:row.currency,itemCount:row._count.items,
      customer:row.customer,paymentStatus:row.payment.status,fulfillmentStatus:row.fulfillment?.status??null,
      shipmentStatus:row.shipments[0]?.status??null,cancellationStatus:row.cancellationRequests[0]?.status??null,returnStatus:row.returnRequests[0]?.status??null,
    })),
    pagination:{page:query.page,pageSize:query.pageSize,total,totalPages:Math.max(1,Math.ceil(total/query.pageSize)),hasNextPage:query.page*query.pageSize<total},
  };
}

const DETAIL_SELECT = {
  id:true,orderNumber:true,checkoutReference:true,status:true,createdAt:true,updatedAt:true,subtotal:true,total:true,currency:true,
  customer:{select:{id:true,email:true,displayName:true}},
  shippingAddress:{select:{recipientName:true,phone:true,addressLine1:true,addressLine2:true,city:true,stateOrProvince:true,postalCode:true,countryCode:true,label:true}},
  items:{select:{id:true,productId:true,variantId:true,productTitleSnapshot:true,variantTitleSnapshot:true,skuSnapshot:true,selectedOptionsSnapshot:true,quantity:true,unitPrice:true,lineTotal:true,currency:true}},
  payment:{select:{id:true,status:true,amount:true,currency:true,providerId:true,providerReference:true,completedAt:true,createdAt:true,updatedAt:true,attempts:{select:{id:true,attemptNumber:true,status:true,providerId:true,providerAttemptReference:true,failureCode:true,failureCategory:true,createdAt:true,updatedAt:true},orderBy:[{attemptNumber:"asc"}]},events:{select:{id:true,providerId:true,providerEventId:true,eventType:true,normalizedEventType:true,processingStatus:true,occurredAt:true,receivedAt:true},orderBy:[{receivedAt:"asc"},{id:"asc"}]}}},
  fulfillment:{select:{id:true,provider:true,providerFulfillmentReference:true,status:true,requestedAt:true,createdAt:true,updatedAt:true,submittedAt:true,acceptedAt:true,completedAt:true,failedAt:true,errorCode:true,errorMessage:true,items:{select:{id:true,orderItemId:true,quantity:true,providerItemReference:true,providerSku:true,providerVariantReference:true,status:true},orderBy:{createdAt:"asc"}}}},
  shipments:{select:{id:true,shipmentReference:true,providerId:true,providerReference:true,carrier:true,trackingNumber:true,trackingUrl:true,service:true,status:true,shippedAt:true,deliveredAt:true,reconciliationRequired:true,reconciliationReason:true,createdAt:true,updatedAt:true,trackingEvents:{select:{id:true,providerId:true,providerEventId:true,providerStatus:true,normalizedStatus:true,eventTimestamp:true,location:true,description:true,source:true},orderBy:[{eventTimestamp:"asc"},{id:"asc"}]}},orderBy:[{createdAt:"asc"},{id:"asc"}]},
  cancellationRequests:{select:{id:true,cancellationReference:true,status:true,reason:true,customerDescription:true,operationalReason:true,requestedAt:true,reviewedAt:true,completedAt:true},orderBy:[{createdAt:"asc"},{id:"asc"}]},
  returnRequests:{select:{id:true,returnReference:true,status:true,reasonCode:true,customerDescription:true,operationalReason:true,requestedAt:true,reviewedAt:true,resolvedAt:true,items:{select:{orderItemId:true,quantity:true}},shipment:{select:{reference:true,status:true,carrier:true,trackingNumber:true,trackingUrl:true}},inspection:{select:{receivedQuantity:true,acceptedQuantity:true,rejectedQuantity:true,outcome:true,inspectedAt:true}},resolution:{select:{type:true,refundAmount:true,currency:true,paymentRefundIntentReference:true,resolvedAt:true}}},orderBy:[{createdAt:"asc"},{id:"asc"}]},
  cases:{select:{id:true,caseReference:true,category:true,status:true,priority:true,title:true,createdAt:true,updatedAt:true,resolvedAt:true},orderBy:[{createdAt:"asc"},{id:"asc"}]},
} satisfies Prisma.OrderSelect;

export async function getAdminOrder(idOrNumber: string): Promise<AdminOrderDetail> {
  const value=idOrNumber.trim();
  if (!UUID.test(value) && !ORDER_NUMBER.test(value)) throw new AdminError("INVALID_REQUEST","Order identifier is invalid.");
  const row=await db.order.findFirst({where:UUID.test(value)?{id:value}:{orderNumber:value},select:DETAIL_SELECT});
  if (!row) throw new AdminError("NOT_FOUND","Order was not found.");

  const [auditRows,exceptionRows]=await Promise.all([
    db.adminAuditLog.findMany({where:{resourceType:"Order",resourceId:row.id},orderBy:[{createdAt:"asc"},{id:"asc"}],select:{action:true,success:true,reason:true,createdAt:true,resourceId:true,actorAdminId:true,correlationId:true}}),
    db.commerceExceptionAuditEvent.findMany({where:{orderId:row.id},orderBy:[{createdAt:"asc"},{id:"asc"}],select:{id:true,action:true,createdAt:true,orderId:true,returnRequestId:true,cancellationRequestId:true,actorId:true,reason:true,previousState:true,newState:true}}),
  ]);

  type DomainTimelineEvent = {kind:"domain";type:string;occurredAt:string;label:string;resourceId:string};
  const domainTimeline:DomainTimelineEvent[]=[
    {kind:"domain",type:"ORDER_CREATED",occurredAt:row.createdAt.toISOString(),label:"Order created",resourceId:row.id},
  ];
  for(const e of row.payment.events) domainTimeline.push({kind:"domain",type:`PAYMENT_${e.normalizedEventType??e.eventType}`,occurredAt:(e.occurredAt??e.receivedAt).toISOString(),label:`Payment event: ${e.normalizedEventType??e.eventType}`,resourceId:e.id});
  if(row.fulfillment){
    domainTimeline.push({kind:"domain",type:"FULFILLMENT_CREATED",occurredAt:row.fulfillment.createdAt.toISOString(),label:"Fulfillment created",resourceId:row.fulfillment.id});
    if(row.fulfillment.submittedAt) domainTimeline.push({kind:"domain",type:"FULFILLMENT_SUBMITTED",occurredAt:row.fulfillment.submittedAt.toISOString(),label:"Fulfillment submitted",resourceId:row.fulfillment.id});
    if(row.fulfillment.acceptedAt) domainTimeline.push({kind:"domain",type:"FULFILLMENT_ACCEPTED",occurredAt:row.fulfillment.acceptedAt.toISOString(),label:"Fulfillment accepted",resourceId:row.fulfillment.id});
    if(row.fulfillment.completedAt) domainTimeline.push({kind:"domain",type:"FULFILLMENT_COMPLETED",occurredAt:row.fulfillment.completedAt.toISOString(),label:"Fulfillment completed",resourceId:row.fulfillment.id});
    if(row.fulfillment.failedAt) domainTimeline.push({kind:"domain",type:"FULFILLMENT_FAILED",occurredAt:row.fulfillment.failedAt.toISOString(),label:"Fulfillment failed",resourceId:row.fulfillment.id});
  }
  for(const s of row.shipments){
    domainTimeline.push({kind:"domain",type:"SHIPMENT_CREATED",occurredAt:s.createdAt.toISOString(),label:"Shipment created",resourceId:s.id});
    if(s.shippedAt) domainTimeline.push({kind:"domain",type:"SHIPMENT_DISPATCHED",occurredAt:s.shippedAt.toISOString(),label:"Shipment dispatched",resourceId:s.id});
    if(s.deliveredAt) domainTimeline.push({kind:"domain",type:"SHIPMENT_DELIVERED",occurredAt:s.deliveredAt.toISOString(),label:"Shipment delivered",resourceId:s.id});
    for(const e of s.trackingEvents) domainTimeline.push({kind:"domain",type:"TRACKING_EVENT",occurredAt:e.eventTimestamp.toISOString(),label:e.description?.trim()||`Tracking: ${e.normalizedStatus}`,resourceId:e.id});
  }
  for(const c of row.cancellationRequests){
    domainTimeline.push({kind:"domain",type:"CANCELLATION_REQUESTED",occurredAt:c.requestedAt.toISOString(),label:"Cancellation requested",resourceId:c.id});
    if(c.reviewedAt) domainTimeline.push({kind:"domain",type:"CANCELLATION_REVIEWED",occurredAt:c.reviewedAt.toISOString(),label:`Cancellation reviewed: ${c.status}`,resourceId:c.id});
    if(c.completedAt) domainTimeline.push({kind:"domain",type:"CANCELLATION_COMPLETED",occurredAt:c.completedAt.toISOString(),label:"Cancellation completed",resourceId:c.id});
  }
  for(const r of row.returnRequests){
    domainTimeline.push({kind:"domain",type:"RETURN_REQUESTED",occurredAt:r.requestedAt.toISOString(),label:"Return requested",resourceId:r.id});
    if(r.reviewedAt) domainTimeline.push({kind:"domain",type:"RETURN_REVIEWED",occurredAt:r.reviewedAt.toISOString(),label:`Return reviewed: ${r.status}`,resourceId:r.id});
    if(r.resolvedAt) domainTimeline.push({kind:"domain",type:"RETURN_RESOLVED",occurredAt:r.resolvedAt.toISOString(),label:"Return resolved",resourceId:r.id});
  }
  for(const e of exceptionRows) domainTimeline.push({kind:"domain",type:e.action,occurredAt:e.createdAt.toISOString(),label:`Commerce exception: ${e.action}`,resourceId:e.returnRequestId??e.cancellationRequestId??e.orderId});
  domainTimeline.sort((a,b)=>a.occurredAt.localeCompare(b.occurredAt));

  return {
    id:row.id,orderNumber:row.orderNumber,checkoutReference:row.checkoutReference,status:row.status,createdAt:row.createdAt.toISOString(),updatedAt:row.updatedAt.toISOString(),
    pricing:{subtotal:decimal(row.subtotal),total:decimal(row.total),currency:row.currency},customer:row.customer,
    address:row.shippingAddress,
    items:row.items.map(i=>({id:i.id,productId:i.productId,variantId:i.variantId,productTitle:i.productTitleSnapshot,variantTitle:i.variantTitleSnapshot,storeSku:i.skuSnapshot,selectedOptions:selectedOptions(i.selectedOptionsSnapshot),quantity:i.quantity,unitPrice:decimal(i.unitPrice),lineTotal:decimal(i.lineTotal),currency:i.currency})),
    payment:{id:row.payment.id,status:row.payment.status,amount:decimal(row.payment.amount),currency:row.payment.currency,providerId:row.payment.providerId,providerReference:row.payment.providerReference,completedAt:iso(row.payment.completedAt),createdAt:row.payment.createdAt.toISOString(),updatedAt:row.payment.updatedAt.toISOString(),attempts:row.payment.attempts.map(a=>({id:a.id,attemptNumber:a.attemptNumber,status:a.status,providerId:a.providerId,providerAttemptReference:a.providerAttemptReference,failureCode:a.failureCode,failureCategory:a.failureCategory,createdAt:a.createdAt.toISOString(),updatedAt:a.updatedAt.toISOString()})),events:row.payment.events.map(e=>({id:e.id,providerId:e.providerId,providerEventId:e.providerEventId,eventType:e.eventType,normalizedEventType:e.normalizedEventType,processingStatus:e.processingStatus,occurredAt:iso(e.occurredAt),receivedAt:e.receivedAt.toISOString()}))},
    fulfillment:row.fulfillment?{id:row.fulfillment.id,provider:row.fulfillment.provider,providerFulfillmentReference:row.fulfillment.providerFulfillmentReference,status:row.fulfillment.status,requestedAt:row.fulfillment.requestedAt.toISOString(),createdAt:row.fulfillment.createdAt.toISOString(),updatedAt:row.fulfillment.updatedAt.toISOString(),submittedAt:iso(row.fulfillment.submittedAt),acceptedAt:iso(row.fulfillment.acceptedAt),completedAt:iso(row.fulfillment.completedAt),failedAt:iso(row.fulfillment.failedAt),errorCode:row.fulfillment.errorCode,errorMessage:row.fulfillment.errorMessage,items:row.fulfillment.items}:null,
    shipments:row.shipments.map(s=>({id:s.id,shipmentReference:s.shipmentReference,providerId:s.providerId,providerReference:s.providerReference,carrier:s.carrier,trackingNumber:s.trackingNumber,trackingUrl:s.trackingUrl,service:s.service,status:String(s.status),shippedAt:iso(s.shippedAt),deliveredAt:iso(s.deliveredAt),reconciliationRequired:s.reconciliationRequired,reconciliationReason:s.reconciliationReason,createdAt:s.createdAt.toISOString(),updatedAt:s.updatedAt.toISOString(),trackingEvents:s.trackingEvents.map(e=>({id:e.id,providerId:e.providerId,providerEventId:e.providerEventId,providerStatus:e.providerStatus,normalizedStatus:String(e.normalizedStatus),eventTimestamp:e.eventTimestamp.toISOString(),location:e.location,description:e.description,source:String(e.source)}))})),
    cancellations:row.cancellationRequests.map(c=>({id:c.id,reference:c.cancellationReference,status:c.status,reason:c.reason,customerDescription:c.customerDescription,operationalReason:c.operationalReason,requestedAt:c.requestedAt.toISOString(),reviewedAt:iso(c.reviewedAt),completedAt:iso(c.completedAt)})),
    returns:row.returnRequests.map(r=>({id:r.id,reference:r.returnReference,status:String(r.status),reasonCode:String(r.reasonCode),customerDescription:r.customerDescription,operationalReason:r.operationalReason,requestedAt:r.requestedAt.toISOString(),reviewedAt:iso(r.reviewedAt),resolvedAt:iso(r.resolvedAt),items:r.items.map(i=>({orderItemId:i.orderItemId,quantity:i.quantity})),shipment:r.shipment?{reference:r.shipment.reference,status:String(r.shipment.status),carrier:r.shipment.carrier,trackingNumber:r.shipment.trackingNumber,trackingUrl:r.shipment.trackingUrl}:null,inspection:r.inspection?{receivedQuantity:r.inspection.receivedQuantity,acceptedQuantity:r.inspection.acceptedQuantity,rejectedQuantity:r.inspection.rejectedQuantity,outcome:String(r.inspection.outcome),inspectedAt:r.inspection.inspectedAt.toISOString()}:null,resolution:r.resolution?{type:String(r.resolution.type),refundAmount:r.resolution.refundAmount?.toFixed(2)??null,currency:r.resolution.currency,paymentRefundIntentReference:r.resolution.paymentRefundIntentReference,resolvedAt:r.resolution.resolvedAt.toISOString()}:null})),
    cases:row.cases.map(c=>({id:c.id,reference:c.caseReference,category:c.category,status:c.status,priority:c.priority,title:c.title,createdAt:c.createdAt.toISOString(),updatedAt:c.updatedAt.toISOString(),resolvedAt:iso(c.resolvedAt)})),
    timeline:domainTimeline,
    audit:auditRows.map(a=>({kind:"admin" as const,action:a.action,success:a.success,reason:a.reason,createdAt:a.createdAt.toISOString(),resourceId:a.resourceId,actorAdminId:a.actorAdminId,correlationId:a.correlationId})),
  };
}

async function resolveOrderId(identifier:string):Promise<{id:string;orderNumber:string}> {
  const value=identifier.trim();
  if (!UUID.test(value) && !ORDER_NUMBER.test(value)) throw new AdminError("INVALID_REQUEST","Order identifier is invalid.");
  const row=await db.order.findFirst({where:UUID.test(value)?{id:value}:{orderNumber:value},select:{id:true,orderNumber:true}});
  if(!row) throw new AdminError("NOT_FOUND","Order was not found.");
  return row;
}

function correlation(request?:Request):string|undefined {
  const value=request?.headers.get("x-request-id")?.trim();
  return value && value.length<=128 ? value : undefined;
}

export type AdminOrderAction =
  | {action:"review_cancellation"; cancellationReference:string; decision:"APPROVE"|"REJECT"; reason:unknown}
  | {action:"review_return"; returnReference:string; decision:"APPROVE"|"REJECT"; reason:unknown}
  | {action:"fulfillment_retry"; fulfillmentId:string; reason:unknown}
  | {action:"fulfillment_reconcile"; fulfillmentId:string; reason:unknown}
  | {action:"shipping_reconcile"; shipmentId:string; reason:unknown};

export async function executeAdminOrderAction(context:AdminAuthorizationContext, identifier:string, input:AdminOrderAction, request?:Request) {
  const order=await resolveOrderId(identifier);
  const cleanReason=requireHighRiskReason(input.reason);
  const correlationId=correlation(request);
  try {
    if(input.action==="review_cancellation"){
      requirePermission(context,"orders.cancel");
      requirePermission(context,"returns.manage");
      const row=await db.cancellationRequest.findFirst({where:{cancellationReference:input.cancellationReference,orderId:order.id},select:{id:true}});
      if(!row) throw new AdminError("NOT_FOUND","Cancellation request was not found for this order.");
      const result=await createReturnsApplication().reviewCancellation({reference:input.cancellationReference,decision:input.decision,reason:cleanReason,request});
      await auditAdminAction(context,{action:"ORDER_CANCELLATION_REVIEWED",resourceType:"Order",resourceId:order.id,success:true,reason:cleanReason,correlationId,metadata:{decision:input.decision}});
      return {action:input.action,result};
    }
    if(input.action==="review_return"){
      requirePermission(context,"returns.manage");
      const row=await db.returnRequest.findFirst({where:{returnReference:input.returnReference,orderId:order.id},select:{id:true}});
      if(!row) throw new AdminError("NOT_FOUND","Return request was not found for this order.");
      const result=await createReturnsApplication().reviewReturn({reference:input.returnReference,decision:input.decision,reason:cleanReason,request});
      await auditAdminAction(context,{action:"ORDER_RETURN_REVIEWED",resourceType:"Order",resourceId:order.id,success:true,reason:cleanReason,correlationId,metadata:{decision:input.decision}});
      return {action:input.action,result};
    }
    if(input.action==="fulfillment_retry"){
      requirePermission(context,"fulfillment.manage");
      const row=await db.fulfillment.findFirst({where:{id:input.fulfillmentId,orderId:order.id},select:{id:true}});
      if(!row) throw new AdminError("NOT_FOUND","Fulfillment was not found for this order.");
      const result=await createFulfillmentApplication().submitFulfillment({fulfillmentId:row.id});
      await auditAdminAction(context,{action:"ORDER_FULFILLMENT_RETRY",resourceType:"Order",resourceId:order.id,success:true,reason:cleanReason,correlationId,metadata:{fulfillmentId:row.id}});
      return {action:input.action,result};
    }
    if(input.action==="fulfillment_reconcile"){
      requirePermission(context,"fulfillment.manage");
      const row=await db.fulfillment.findFirst({where:{id:input.fulfillmentId,orderId:order.id},select:{id:true}});
      if(!row) throw new AdminError("NOT_FOUND","Fulfillment was not found for this order.");
      const result=await createFulfillmentApplication().reconcileFulfillment({fulfillmentId:row.id});
      await auditAdminAction(context,{action:"ORDER_FULFILLMENT_RECONCILE",resourceType:"Order",resourceId:order.id,success:true,reason:cleanReason,correlationId,metadata:{fulfillmentId:row.id}});
      return {action:input.action,result};
    }
    requirePermission(context,"shipping.manage");
    const row=await db.shipment.findFirst({where:{id:input.shipmentId,orderId:order.id},select:{id:true}});
    if(!row) throw new AdminError("NOT_FOUND","Shipment was not found for this order.");
    const result=await createShippingApplication().reconcileShipment({shipmentId:row.id});
    await auditAdminAction(context,{action:"ORDER_SHIPPING_RECONCILE",resourceType:"Order",resourceId:order.id,success:true,reason:cleanReason,correlationId,metadata:{shipmentId:row.id}});
    return {action:input.action,result};
  } catch(error) {
    await auditAdminAction(context,{action:`ORDER_${input.action.toUpperCase()}_FAILED`,resourceType:"Order",resourceId:order.id,success:false,reason:cleanReason,correlationId,metadata:{error:error instanceof Error?error.name:"unknown"}}).catch(()=>undefined);
    throw error;
  }
}
