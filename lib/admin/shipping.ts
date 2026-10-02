import { Prisma, type ShipmentStatus } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { db } from "@/lib/db/client";
import { AdminError } from "@/lib/admin/errors";
import { auditAdminAction } from "@/lib/admin/audit";
import { requireHighRiskReason, requirePermission, type AdminAuthorizationContext } from "@/lib/admin/authorization";
import { createShippingApplication } from "@/lib/shipping/application";

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SHIPMENT_REFERENCE=/^SHP-[A-F0-9]{32}$/i;
const MAX_PAGE_SIZE=100;
const SORTS=["createdAt","updatedAt","shipmentReference","status","providerId","carrier"] as const;
type Sort=typeof SORTS[number];
const STATUSES=["CREATED","IN_TRANSIT","OUT_FOR_DELIVERY","DELIVERED","DELIVERY_FAILED","RETURNED"] as const;
type Status=typeof STATUSES[number];

export type AdminShippingQuery={
 page:number;pageSize:number;search?:string;status?:Status;provider?:string;carrier?:string;
 trackingNumber?:string;reconciliationRequired?:boolean;from?:Date;to?:Date;sort:Sort;direction:"asc"|"desc";
};

export type AdminShipmentListItem={
 id:string;shipmentReference:string;orderId:string;orderNumber:string;customer:{id:string;email:string;displayName:string|null};
 providerId:string;providerReference:string|null;carrier:string|null;trackingNumber:string|null;trackingUrl:string|null;
 service:string|null;status:Status;reconciliationRequired:boolean;reconciliationReason:string|null;
 createdAt:string;updatedAt:string;shippedAt:string|null;deliveredAt:string|null;trackingEventCount:number;
};

export type AdminShipmentDetail={
 id:string;shipmentReference:string;orderId:string;orderNumber:string;
 customer:{id:string;email:string;displayName:string|null};
 address:{recipientName:string;phone:string|null;addressLine1:string;addressLine2:string|null;city:string;stateOrProvince:string;postalCode:string;countryCode:string;label:string|null}|null;
 fulfillment:{id:string;status:string;provider:string;providerReference:string|null};
 provider:{id:string;reference:string|null;carrier:string|null;service:string|null;trackingNumber:string|null;trackingUrl:string|null};
 status:Status;createdAt:string;updatedAt:string;shippedAt:string|null;deliveredAt:string|null;
 reconciliation:{required:boolean;reason:string|null;requestedAt:string|null};
 trackingEvents:Array<{id:string;providerId:string;providerEventId:string|null;providerStatus:string|null;normalizedStatus:Status;eventTimestamp:string;receivedAt:string;location:string|null;description:string|null;source:string}>;
 returnShipments:Array<{reference:string;status:string;carrier:string|null;trackingNumber:string|null;trackingUrl:string|null;createdAt:string;updatedAt:string}>;
 cases:Array<{id:string;reference:string;status:string;category:string;priority:string;createdAt:string;updatedAt:string}>;
 audit:Array<{action:string;success:boolean;reason:string|null;createdAt:string;actorAdminId:string|null;correlationId:string|null}>;
};

function integer(value:string|null,fallback:number,max:number,field:string){if(value===null||value==="")return fallback;if(!/^\d+$/.test(value))throw new AdminError("INVALID_REQUEST",`Invalid ${field}.`);const n=Number(value);if(!Number.isSafeInteger(n)||n<1||n>max)throw new AdminError("INVALID_REQUEST",`Invalid ${field}.`);return n;}
function direction(value:string|null):"asc"|"desc"{if(!value||value==="desc")return "desc";if(value==="asc")return "asc";throw new AdminError("INVALID_REQUEST","Invalid sort direction.");}
function dateValue(value:string|null,field:string){if(!value)return undefined;const d=new Date(value);if(Number.isNaN(d.getTime()))throw new AdminError("INVALID_REQUEST",`Invalid ${field} filter.`);return d;}
function status(value:string|null):Status|undefined{if(!value)return undefined;if(!STATUSES.includes(value as Status))throw new AdminError("INVALID_REQUEST","Invalid shipment status filter.");return value as Status;}
function boolValue(value:string|null,field:string):boolean|undefined{if(value===null||value==="")return undefined;if(value==="true")return true;if(value==="false")return false;throw new AdminError("INVALID_REQUEST",`Invalid ${field} filter.`);}
function sort(value:string|null):Sort{if(!value)return "createdAt";if(!SORTS.includes(value as Sort))throw new AdminError("INVALID_REQUEST","Invalid shipment sort field.");return value as Sort;}
function iso(value:Date|null|undefined){return value?value.toISOString():null;}
function requireShipmentId(value:string){if(!UUID.test(value.trim()))throw new AdminError("INVALID_REQUEST","Shipment identifier is invalid.");return value.trim();}

export function parseAdminShippingQuery(url:URL):AdminShippingQuery{
 const allowed=new Set(["page","pageSize","search","status","provider","carrier","trackingNumber","reconciliationRequired","from","to","sort","direction"]);
 for(const key of url.searchParams.keys())if(!allowed.has(key))throw new AdminError("INVALID_REQUEST","Unsupported shipment list parameter.");
 const from=dateValue(url.searchParams.get("from"),"from"),to=dateValue(url.searchParams.get("to"),"to");
 if(from&&to&&from>to)throw new AdminError("INVALID_REQUEST","The shipment date range is invalid.");
 return {
  page:integer(url.searchParams.get("page"),1,1000000,"page"),
  pageSize:integer(url.searchParams.get("pageSize"),25,MAX_PAGE_SIZE,"pageSize"),
  search:url.searchParams.get("search")?.trim().slice(0,120)||undefined,
  status:status(url.searchParams.get("status")),provider:url.searchParams.get("provider")?.trim().slice(0,64)||undefined,
  carrier:url.searchParams.get("carrier")?.trim().slice(0,120)||undefined,
  trackingNumber:url.searchParams.get("trackingNumber")?.trim().slice(0,160)||undefined,
  reconciliationRequired:boolValue(url.searchParams.get("reconciliationRequired"),"reconciliationRequired"),
  from,to,sort:sort(url.searchParams.get("sort")),direction:direction(url.searchParams.get("direction")),
 };
}

function whereFor(query:AdminShippingQuery,sensitive:boolean):Prisma.ShipmentWhereInput{
 const and:Prisma.ShipmentWhereInput[]=[];
 if(query.status)and.push({status:query.status});
 if(query.provider)and.push({providerId:{contains:query.provider,mode:"insensitive"}});
 if(query.carrier)and.push({carrier:{contains:query.carrier,mode:"insensitive"}});
 if(query.reconciliationRequired!==undefined)and.push({reconciliationRequired:query.reconciliationRequired});
 if(query.from||query.to)and.push({createdAt:{...(query.from?{gte:query.from}:{}),...(query.to?{lte:query.to}:{})}});
 if(query.search){
  const s=query.search;const or:Prisma.ShipmentWhereInput[]=[
   {shipmentReference:{contains:s,mode:"insensitive"}},
   {order:{orderNumber:{contains:s,mode:"insensitive"}}},
   {order:{customer:{email:{contains:s,mode:"insensitive"}}}},
   {order:{customer:{displayName:{contains:s,mode:"insensitive"}}}},
  ];
  if(UUID.test(s))or.push({id:s},{orderId:s},{fulfillmentId:s});
  if(sensitive)or.push({trackingNumber:{contains:s,mode:"insensitive"}},{providerReference:{contains:s,mode:"insensitive"}});
  and.push({OR:or});
 }
 if(query.trackingNumber){if(!sensitive)throw new AdminError("FORBIDDEN","Tracking-number search requires sensitive shipment access.");and.push({trackingNumber:{contains:query.trackingNumber,mode:"insensitive"}});}
 return and.length?{AND:and}:{};
}

function orderBy(query:AdminShippingQuery):Prisma.ShipmentOrderByWithRelationInput[]{return [{[query.sort]:query.direction}, {id:query.direction}] as Prisma.ShipmentOrderByWithRelationInput[];}

function toListItem(row:{
 id:string;shipmentReference:string;orderId:string;providerId:string;providerReference:string|null;carrier:string|null;trackingNumber:string|null;trackingUrl:string|null;service:string|null;
 status:ShipmentStatus;reconciliationRequired:boolean;reconciliationReason:string|null;createdAt:Date;updatedAt:Date;shippedAt:Date|null;deliveredAt:Date|null;
 order:{orderNumber:string;customer:{id:string;email:string;displayName:string|null}};_count:{trackingEvents:number};
},sensitive:boolean):AdminShipmentListItem{
 return {
  id:row.id,shipmentReference:row.shipmentReference,orderId:row.orderId,orderNumber:row.order.orderNumber,customer:row.order.customer,
  providerId:row.providerId,providerReference:sensitive?row.providerReference:null,carrier:row.carrier,
  trackingNumber:sensitive?row.trackingNumber:null,trackingUrl:sensitive?row.trackingUrl:null,service:row.service,status:row.status,
  reconciliationRequired:row.reconciliationRequired,reconciliationReason:row.reconciliationReason,createdAt:row.createdAt.toISOString(),
  updatedAt:row.updatedAt.toISOString(),shippedAt:iso(row.shippedAt),deliveredAt:iso(row.deliveredAt),trackingEventCount:row._count.trackingEvents,
 };
}

export async function listAdminShipments(query:AdminShippingQuery,context:AdminAuthorizationContext){
 const sensitive=context.permissions.has("shipping.view_sensitive");
 const where=whereFor(query,sensitive);
 const [total,rows]=await Promise.all([
  db.shipment.count({where}),
  db.shipment.findMany({where,orderBy:orderBy(query),skip:(query.page-1)*query.pageSize,take:query.pageSize,select:{
   id:true,shipmentReference:true,orderId:true,providerId:true,providerReference:true,carrier:true,trackingNumber:true,trackingUrl:true,service:true,status:true,
   reconciliationRequired:true,reconciliationReason:true,createdAt:true,updatedAt:true,shippedAt:true,deliveredAt:true,
   order:{select:{orderNumber:true,customer:{select:{id:true,email:true,displayName:true}}}},_count:{select:{trackingEvents:true}},
  }}),
 ]);
 return {items:rows.map(row=>toListItem(row,sensitive)),pagination:{page:query.page,pageSize:query.pageSize,total,totalPages:Math.max(1,Math.ceil(total/query.pageSize)),hasNextPage:query.page*query.pageSize<total}};
}

export async function getAdminShipment(id:string,context:AdminAuthorizationContext):Promise<AdminShipmentDetail>{
 const shipmentId=requireShipmentId(id);const sensitive=context.permissions.has("shipping.view_sensitive");
 const row=await db.shipment.findUnique({where:{id:shipmentId},select:{
  id:true,shipmentReference:true,orderId:true,fulfillmentId:true,providerId:true,providerReference:true,carrier:true,trackingNumber:true,trackingUrl:true,service:true,status:true,
  createdAt:true,updatedAt:true,shippedAt:true,deliveredAt:true,reconciliationRequired:true,reconciliationReason:true,reconciliationRequestedAt:true,
  order:{select:{orderNumber:true,customer:{select:{id:true,email:true,displayName:true}},shippingAddress:{select:{recipientName:true,phone:true,addressLine1:true,addressLine2:true,city:true,stateOrProvince:true,postalCode:true,countryCode:true,label:true}}}},
  fulfillment:{select:{id:true,status:true,provider:true,providerFulfillmentReference:true}},
  trackingEvents:{orderBy:[{eventTimestamp:"asc"},{id:"asc"}],select:{id:true,providerId:true,providerEventId:true,providerStatus:true,normalizedStatus:true,eventTimestamp:true,receivedAt:true,location:true,description:true,source:true}},
  returnShipments:{orderBy:[{createdAt:"asc"},{id:"asc"}],select:{reference:true,status:true,carrier:true,trackingNumber:true,trackingUrl:true,createdAt:true,updatedAt:true}},
  cases:{orderBy:[{createdAt:"asc"},{id:"asc"}],select:{id:true,caseReference:true,status:true,category:true,priority:true,createdAt:true,updatedAt:true}},
 }});
 if(!row)throw new AdminError("NOT_FOUND","Shipment was not found.");
 const audit=await db.adminAuditLog.findMany({where:{resourceType:"Shipment",resourceId:row.id},orderBy:[{createdAt:"asc"},{id:"asc"}],select:{action:true,success:true,reason:true,createdAt:true,actorAdminId:true,correlationId:true}});
 return {
  id:row.id,shipmentReference:row.shipmentReference,orderId:row.orderId,orderNumber:row.order.orderNumber,customer:row.order.customer,
  address:sensitive?row.order.shippingAddress?(row.order.shippingAddress):null:(row.order.shippingAddress?{...row.order.shippingAddress,phone:null,addressLine1:"[REDACTED]",addressLine2:null,recipientName:"[REDACTED]",postalCode:"[REDACTED]"}:null),
  fulfillment:{id:row.fulfillment.id,status:row.fulfillment.status,provider:row.fulfillment.provider,providerReference:sensitive?row.fulfillment.providerFulfillmentReference:null},
  provider:{id:row.providerId,reference:sensitive?row.providerReference:null,carrier:row.carrier,service:row.service,trackingNumber:sensitive?row.trackingNumber:null,trackingUrl:sensitive?row.trackingUrl:null},
  status:row.status,createdAt:row.createdAt.toISOString(),updatedAt:row.updatedAt.toISOString(),shippedAt:iso(row.shippedAt),deliveredAt:iso(row.deliveredAt),
  reconciliation:{required:row.reconciliationRequired,reason:row.reconciliationReason,requestedAt:iso(row.reconciliationRequestedAt)},
  trackingEvents:row.trackingEvents.map(e=>({id:e.id,providerId:e.providerId,providerEventId:sensitive?e.providerEventId:null,providerStatus:e.providerStatus,normalizedStatus:e.normalizedStatus,eventTimestamp:e.eventTimestamp.toISOString(),receivedAt:e.receivedAt.toISOString(),location:e.location,description:e.description,source:e.source})),
  returnShipments:row.returnShipments.map(r=>({reference:r.reference,status:r.status,carrier:r.carrier,trackingNumber:sensitive?r.trackingNumber:null,trackingUrl:sensitive?r.trackingUrl:null,createdAt:r.createdAt.toISOString(),updatedAt:r.updatedAt.toISOString()})),
  cases:row.cases.map(c=>({id:c.id,reference:c.caseReference,status:c.status,category:c.category,priority:c.priority,createdAt:c.createdAt.toISOString(),updatedAt:c.updatedAt.toISOString()})),
  audit:audit.map(entry=>({...entry,createdAt:entry.createdAt.toISOString()})),
 };
}

export type AdminShippingAction=
 | {action:"create";fulfillmentId:string;orderId:string;idempotencyKey:string;reason:string}
 | {action:"reconcile";shipmentId:string;reason:string;idempotencyKey:string}
 | {action:"recovery";shipmentId:string;reason:string;idempotencyKey:string};

function normalizeDomainError(error:unknown):AdminError{
 if(error instanceof AdminError)return error;
 const code=error instanceof Error&&"code" in error?String((error as {code?:unknown}).code):"";
 const message=error instanceof Error?error.message:"The shipping operation could not be completed safely.";
 if(code==="SHIPMENT_NOT_FOUND")return new AdminError("NOT_FOUND",message);
 if(code==="SHIPMENT_IDEMPOTENCY_CONFLICT"||code==="SHIPMENT_CONCURRENCY_CONFLICT"||code==="SHIPMENT_ALREADY_EXISTS")return new AdminError("CONFLICT",message);
 if(code==="UNAUTHORIZED_SHIPMENT_ACCESS")return new AdminError("FORBIDDEN",message);
 if(code==="FULFILLMENT_NOT_FOUND"||code==="FULFILLMENT_NOT_ELIGIBLE_FOR_SHIPMENT")return new AdminError("CONFLICT",message);
 if(code==="INVALID_RECOVERY_REQUEST"||code==="INVALID_TRACKING_EVENT")return new AdminError("INVALID_REQUEST",message);
 return new AdminError("CONFLICT",message);
}

export async function executeAdminShippingAction(context:AdminAuthorizationContext,input:AdminShippingAction){
 const correlationId=randomUUID();
 try{
  if(input.action==="create"){
   requirePermission(context,"shipping.create");const reason=requireHighRiskReason(input.reason);
   if(!UUID.test(input.fulfillmentId)||!UUID.test(input.orderId))throw new AdminError("INVALID_REQUEST","Order and Fulfillment identifiers are invalid.");
   const app=createShippingApplication();
   const result=await app.createShipmentFromFulfillment({fulfillmentId:input.fulfillmentId,orderId:input.orderId,idempotencyKey:input.idempotencyKey});
   if(!result) throw new AdminError("CONFLICT","The canonical Shipping service did not return the created Shipment.");
   await auditAdminAction(context,{action:"SHIPPING_SHIPMENT_CREATE",resourceType:"Shipment",resourceId:result.id,success:true,reason,correlationId,metadata:{fulfillmentId:input.fulfillmentId,orderId:input.orderId,idempotencyKey:input.idempotencyKey}});
   return getAdminShipment(result.id,context);
  }
  if(input.action==="reconcile"){
   requirePermission(context,"shipping.reconcile");const reason=requireHighRiskReason(input.reason);const shipmentId=requireShipmentId(input.shipmentId);
   const app=createShippingApplication();const result=await app.reconcileShipment({shipmentId});
   await auditAdminAction(context,{action:"SHIPPING_RECONCILE",resourceType:"Shipment",resourceId:shipmentId,success:result.status!=="RECONCILIATION_REQUIRED",reason,correlationId,metadata:{result}});
   return result;
  }
  requirePermission(context,"shipping.recovery");const reason=requireHighRiskReason(input.reason);const shipmentId=requireShipmentId(input.shipmentId);
  const app=createShippingApplication({authorizeOperationalRecovery:async ({shipmentId:requested,operatorId})=>requested===shipmentId&&operatorId===context.adminUser.id});
  const result=await app.requestShipmentReconciliation({shipmentId,operatorId:context.adminUser.id,reason,idempotencyKey:input.idempotencyKey});
  await auditAdminAction(context,{action:"SHIPPING_RECOVERY_REQUESTED",resourceType:"Shipment",resourceId:shipmentId,success:true,reason,correlationId,metadata:{idempotencyKey:input.idempotencyKey}});
  return getAdminShipment(result.id,context);
 }catch(error){
  const normalized=normalizeDomainError(error);
  await auditAdminAction(context,{action:`SHIPPING_${input.action.toUpperCase()}_FAILED`,resourceType:"Shipment",resourceId:"shipmentId" in input?input.shipmentId:undefined,success:false,reason:typeof input.reason==="string"?input.reason:null,correlationId,metadata:{errorCode:normalized.code}});
  throw normalized;
 }
}
