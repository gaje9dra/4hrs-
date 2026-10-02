import { Prisma, type FulfillmentStatus, type ShipmentStatus, type CancellationStatus, type ReturnRequestStatus } from "@prisma/client";
import { db } from "@/lib/db/client";
import { AdminError } from "@/lib/admin/errors";
import { auditAdminAction } from "@/lib/admin/audit";
import { requireHighRiskReason, requirePermission, type AdminAuthorizationContext } from "@/lib/admin/authorization";
import { createFulfillmentApplication } from "@/lib/fulfillment/application";
import { FulfillmentDomainError } from "@/lib/fulfillment/errors";
import { randomUUID } from "node:crypto";

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_PAGE_SIZE=100;
const LIST_SORTS=["createdAt","updatedAt","requestedAt","status","provider"] as const;
type ListSort=(typeof LIST_SORTS)[number];

export type AdminFulfillmentQuery={
  page:number;pageSize:number;search?:string;status?:FulfillmentStatus;provider?:string;providerReference?:string;
  failureOnly?:boolean;from?:Date;to?:Date;shipmentStatus?:ShipmentStatus;sort:ListSort;direction:"asc"|"desc";
};

export type AdminFulfillmentListItem={
  id:string;orderId:string;orderNumber:string;customer:{id:string;email:string;displayName:string|null};
  status:FulfillmentStatus;provider:string;providerReference:string|null;requestedAt:string;createdAt:string;updatedAt:string;
  itemCount:number;shipmentStatus:ShipmentStatus|null;failure:{code:string|null;message:string|null;reconciliationRequired:boolean};
};

export type AdminFulfillmentDetail={
  id:string;orderId:string;orderNumber:string;customer:{id:string;email:string;displayName:string|null};
  status:FulfillmentStatus;provider:string;providerReference:string|null;requestedAt:string;createdAt:string;updatedAt:string;
  submittedAt:string|null;acceptedAt:string|null;completedAt:string|null;failedAt:string|null;
  failure:{code:string|null;message:string|null;reconciliationRequired:boolean};
  items:Array<{id:string;orderItemId:string;productTitle:string;variantTitle:string|null;storeSku:string|null;quantity:number;providerSku:string|null;providerVariantReference:string|null;status:string|null}>;
  attempts:Array<{number:number;status:string;occurredAt:string;note:string}>;
  shipments:Array<{id:string;reference:string;providerId:string;providerReference:string|null;carrier:string|null;trackingNumber:string|null;trackingUrl:string|null;status:ShipmentStatus;shippedAt:string|null;deliveredAt:string|null;reconciliationRequired:boolean}>;
  cancellations:Array<{reference:string;status:CancellationStatus;reason:string;requestedAt:string}>;
  returns:Array<{reference:string;status:ReturnRequestStatus;reasonCode:string;requestedAt:string}>;
  audit:Array<{action:string;success:boolean;reason:string|null;createdAt:string;actorAdminId:string|null;correlationId:string|null}>;
};

function iso(value:Date|null|undefined):string|null{return value?value.toISOString():null;}
function int(value:string|null,fallback:number,max:number,field:string):number{
  if(value===null||value==="")return fallback;
  if(!/^\d+$/.test(value))throw new AdminError("INVALID_REQUEST",`Invalid ${field}.`);
  const n=Number(value);if(!Number.isSafeInteger(n)||n<1||n>max)throw new AdminError("INVALID_REQUEST",`Invalid ${field}.`);return n;
}
function enumValue<T extends string>(value:string|null,allowed:readonly T[],field:string):T|undefined{
  if(!value)return undefined;if(!allowed.includes(value as T))throw new AdminError("INVALID_REQUEST",`Invalid ${field}.`);return value as T;
}
function dateValue(value:string|null,field:string):Date|undefined{
  if(!value)return undefined;const d=new Date(value);if(Number.isNaN(d.getTime()))throw new AdminError("INVALID_REQUEST",`Invalid ${field}.`);return d;
}
function parseSort(value:string|null):ListSort{if(!value)return"createdAt";if(!LIST_SORTS.includes(value as ListSort))throw new AdminError("INVALID_REQUEST","Invalid sort field.");return value as ListSort;}
function parseDirection(value:string|null):"asc"|"desc"{if(!value||value==="desc")return"desc";if(value==="asc")return"asc";throw new AdminError("INVALID_REQUEST","Invalid sort direction.");}

export function parseAdminFulfillmentQuery(url:URL):AdminFulfillmentQuery{
  const allowed=new Set(["page","pageSize","search","status","provider","providerReference","failureOnly","from","to","shipmentStatus","sort","direction"]);
  for(const key of url.searchParams.keys())if(!allowed.has(key))throw new AdminError("INVALID_REQUEST","Unsupported fulfillment list parameter.");
  const from=dateValue(url.searchParams.get("from"),"from"),to=dateValue(url.searchParams.get("to"),"to");
  if(from&&to&&from>to)throw new AdminError("INVALID_REQUEST","The fulfillment date range is invalid.");
  const search=url.searchParams.get("search")?.trim().slice(0,120)||undefined;
  return {
    page:int(url.searchParams.get("page"),1,1000000,"page"),pageSize:int(url.searchParams.get("pageSize"),25,MAX_PAGE_SIZE,"pageSize"),
    search,status:enumValue(url.searchParams.get("status"),["PENDING","SUBMITTED","FAILED","COMPLETED"] as const,"status"),
    provider:url.searchParams.get("provider")?.trim().slice(0,64)||undefined,
    providerReference:url.searchParams.get("providerReference")?.trim().slice(0,255)||undefined,
    failureOnly:url.searchParams.get("failureOnly")==="true" ? true : url.searchParams.get("failureOnly")==="false" ? false : undefined,
    from,to,shipmentStatus:enumValue(url.searchParams.get("shipmentStatus"),["CREATED","IN_TRANSIT","OUT_FOR_DELIVERY","DELIVERED","DELIVERY_FAILED","RETURNED"] as const,"shipmentStatus"),
    sort:parseSort(url.searchParams.get("sort")),direction:parseDirection(url.searchParams.get("direction")),
  };
}

function whereFor(query:AdminFulfillmentQuery,includeSensitive:boolean):Prisma.FulfillmentWhereInput{
  const and:Prisma.FulfillmentWhereInput[]=[];
  if(query.status)and.push({status:query.status});
  if(query.provider)and.push({provider:query.provider});
  if(query.providerReference)and.push({providerFulfillmentReference:{contains:query.providerReference,mode:"insensitive"}});
  if(query.failureOnly===true)and.push({status:"FAILED"});
  if(query.from||query.to)and.push({createdAt:{...(query.from?{gte:query.from}:{}),...(query.to?{lte:query.to}:{})}});
  if(query.shipmentStatus)and.push({shipments:{some:{status:query.shipmentStatus}}});
  if(query.search){
    const s=query.search;
    const or:Prisma.FulfillmentWhereInput[]=[
      ...(UUID.test(s)?[{id:s},{orderId:s}]:[]),
      ...(includeSensitive?[{providerFulfillmentReference:{contains:s,mode:"insensitive"}}]:[]),
      {order:{orderNumber:{contains:s,mode:"insensitive"}}},
      {order:{customer:{email:{contains:s,mode:"insensitive"}}}},
      {order:{customer:{displayName:{contains:s,mode:"insensitive"}}}},
    ];
    and.push({OR:or});
  }
  return and.length?{AND:and}:{};
}
function orderBy(query:AdminFulfillmentQuery):Prisma.FulfillmentOrderByWithRelationInput[]{return [{[query.sort]:query.direction},{id:query.direction}] as Prisma.FulfillmentOrderByWithRelationInput[];}

function reconcileRequired(metadata:Prisma.JsonValue|null):boolean{
  return Boolean(metadata&&typeof metadata==="object"&&!Array.isArray(metadata)&&(metadata as Record<string,unknown>).reconciliationRequired===true);
}

export async function listAdminFulfillments(query:AdminFulfillmentQuery,context:AdminAuthorizationContext){
  if(query.providerReference&&!context.permissions.has("fulfillment.view_sensitive"))throw new AdminError("FORBIDDEN","Provider references require sensitive fulfillment permission.");
  const sensitive=context.permissions.has("fulfillment.view_sensitive");
  const where=whereFor(query,sensitive);
  const [total,rows]=await Promise.all([
    db.fulfillment.count({where}),
    db.fulfillment.findMany({
      where,orderBy:orderBy(query),skip:(query.page-1)*query.pageSize,take:query.pageSize,
      select:{
        id:true,orderId:true,status:true,provider:true,providerFulfillmentReference:true,requestedAt:true,createdAt:true,updatedAt:true,errorCode:true,errorMessage:true,reconciliationMetadata:true,
        order:{select:{orderNumber:true,customer:{select:{id:true,email:true,displayName:true}}}},
        items:{select:{id:true}},
        shipments:{select:{status:true,updatedAt:true},orderBy:[{updatedAt:"desc"},{id:"desc"}],take:1},
      },
    }),
  ]);
  return {items:rows.map(row=>({
    id:row.id,orderId:row.orderId,orderNumber:row.order.orderNumber,
    customer:row.order.customer,status:row.status,provider:row.provider,
    providerReference:sensitive?row.providerFulfillmentReference:null,requestedAt:row.requestedAt.toISOString(),createdAt:row.createdAt.toISOString(),updatedAt:row.updatedAt.toISOString(),
    itemCount:row.items.length,shipmentStatus:row.shipments[0]?.status??null,
    failure:{code:row.errorCode,message:row.errorMessage,reconciliationRequired:reconcileRequired(row.reconciliationMetadata)},
  })),page:query.page,pageSize:query.pageSize,total,totalPages:Math.ceil(total/query.pageSize)};
}

export async function getAdminFulfillment(id:string,context:AdminAuthorizationContext){
  if(!UUID.test(id))throw new AdminError("NOT_FOUND","Fulfillment could not be found.");
  const row=await db.fulfillment.findUnique({
    where:{id},
    select:{
      id:true,orderId:true,provider:true,providerFulfillmentReference:true,status:true,requestedAt:true,createdAt:true,updatedAt:true,submittedAt:true,acceptedAt:true,completedAt:true,failedAt:true,errorCode:true,errorMessage:true,reconciliationMetadata:true,
      order:{
        select:{
          orderNumber:true,
          customer:{select:{id:true,email:true,displayName:true}},
          items:{select:{id:true,productTitleSnapshot:true,variantTitleSnapshot:true,skuSnapshot:true},orderBy:{createdAt:"asc"}},
          cancellationRequests:{select:{cancellationReference:true,status:true,reason:true,requestedAt:true}},
          returnRequests:{select:{returnReference:true,status:true,reasonCode:true,requestedAt:true}},
        },
      },
      items:{select:{id:true,orderItemId:true,quantity:true,providerSku:true,providerVariantReference:true,status:true}},
      shipments:{select:{id:true,shipmentReference:true,providerId:true,providerReference:true,carrier:true,trackingNumber:true,trackingUrl:true,status:true,shippedAt:true,deliveredAt:true,reconciliationRequired:true},orderBy:[{createdAt:"desc"},{id:"desc"}]},
    },
  });
  if(!row)throw new AdminError("NOT_FOUND","Fulfillment could not be found.");
  const audit=await db.adminAuditLog.findMany({where:{resourceType:"Fulfillment",resourceId:id},orderBy:[{createdAt:"asc"},{id:"asc"}],select:{action:true,success:true,reason:true,createdAt:true,actorAdminId:true,correlationId:true}});
  const sensitive=context.permissions.has("fulfillment.view_sensitive");
  const metadata=row.reconciliationMetadata;
  const attemptsValue=metadata&&typeof metadata==="object"&&!Array.isArray(metadata)?((metadata as Record<string,unknown>).submissionAttempts):0; const attempts=typeof attemptsValue==="number"&&Number.isSafeInteger(attemptsValue)&&attemptsValue>=0?attemptsValue:0;
  return {
    id:row.id,orderId:row.orderId,orderNumber:row.order.orderNumber,customer:row.order.customer,status:row.status,provider:row.provider,
    providerReference:sensitive?row.providerFulfillmentReference:null,requestedAt:row.requestedAt.toISOString(),createdAt:row.createdAt.toISOString(),updatedAt:row.updatedAt.toISOString(),
    submittedAt:iso(row.submittedAt),acceptedAt:iso(row.acceptedAt),completedAt:iso(row.completedAt),failedAt:iso(row.failedAt),
    failure:{code:row.errorCode,message:row.errorMessage,reconciliationRequired:reconcileRequired(metadata)},
    items:row.items.map(item=>{const orderItem=row.order.items.find(x=>x.id===item.orderItemId);return {id:item.id,orderItemId:item.orderItemId,productTitle:orderItem?.productTitleSnapshot??"Unknown product",variantTitle:orderItem?.variantTitleSnapshot??null,storeSku:orderItem?.skuSnapshot??null,quantity:item.quantity,providerSku:sensitive?item.providerSku:null,providerVariantReference:sensitive?item.providerVariantReference:null,status:item.status};}),
    attempts:Number.isSafeInteger(attempts)?Array.from({length:Math.min(attempts,20)},(_,i)=>({number:i+1,status:i+1===attempts?row.status:"COMPLETED",occurredAt:row.updatedAt.toISOString(),note:i+1===attempts?(row.errorMessage??"Current operation"):"Historical submission attempt"})):[],
    shipments:row.shipments.map(s=>({id:s.id,reference:s.shipmentReference,providerId:s.providerId,providerReference:sensitive?s.providerReference:null,carrier:s.carrier,trackingNumber:s.trackingNumber,trackingUrl:s.trackingUrl,status:s.status,shippedAt:iso(s.shippedAt),deliveredAt:iso(s.deliveredAt),reconciliationRequired:s.reconciliationRequired})),
    cancellations:row.order.cancellationRequests.map(c=>({reference:c.cancellationReference,status:c.status,reason:c.reason,requestedAt:c.requestedAt.toISOString()})),
    returns:row.order.returnRequests.map(r=>({reference:r.returnReference,status:r.status,reasonCode:r.reasonCode,requestedAt:r.requestedAt.toISOString()})),
    audit:audit.map(a=>({action:a.action,success:a.success,reason:a.reason,createdAt:a.createdAt.toISOString(),actorAdminId:a.actorAdminId,correlationId:a.correlationId})),
  } satisfies AdminFulfillmentDetail;
}

export type AdminFulfillmentAction=
 | {action:"create";orderId:string;idempotencyKey:string;reason:string}
 | {action:"submit";fulfillmentId:string;idempotencyKey:string;reason:string}
 | {action:"retry";fulfillmentId:string;idempotencyKey:string;reason:string}
 | {action:"reconcile";fulfillmentId:string;idempotencyKey:string;reason:string};

function actionPermission(action:AdminFulfillmentAction["action"]):"fulfillment.create"|"fulfillment.submit"|"fulfillment.retry"|"fulfillment.reconcile"{
  return action==="create"?"fulfillment.create":action==="submit"?"fulfillment.submit":action==="retry"?"fulfillment.retry":"fulfillment.reconcile";
}
function validateKey(key:string){if(!/^[A-Za-z0-9._~-]{16,128}$/.test(key))throw new AdminError("INVALID_REQUEST","Invalid idempotency key.");return key;}
function domainError(error:unknown):never{
  if(error instanceof FulfillmentDomainError)throw new AdminError(error.code==="FULFILLMENT_ORDER_NOT_FOUND"||error.code==="FULFILLMENT_INVALID_STATE"?"NOT_FOUND":error.code==="FULFILLMENT_PROVIDER_NOT_CONFIGURED"?"CONFLICT":"CONFLICT",error.message,{cause:error});
  throw error;
}

export async function executeAdminFulfillmentAction(context:AdminAuthorizationContext,input:AdminFulfillmentAction){
  requirePermission(context,actionPermission(input.action));
  const reason=requireHighRiskReason(input.reason);
  const idempotencyKey=validateKey(input.idempotencyKey);
  const correlationId=randomUUID();
  try{
    const app=createFulfillmentApplication();
    const result=input.action==="create"
      ? await app.createFulfillment({orderId:input.orderId,idempotencyKey})
      : input.action==="submit"
        ? await app.submitFulfillment({fulfillmentId:input.fulfillmentId,idempotencyKey,operation:"SUBMIT"})
        : input.action==="retry"
          ? await app.submitFulfillment({fulfillmentId:input.fulfillmentId,idempotencyKey,operation:"RETRY"})
          : await app.reconcileFulfillment({fulfillmentId:input.fulfillmentId,idempotencyKey});
    await auditAdminAction(context,{action:`FULFILLMENT_${input.action.toUpperCase()}`,resourceType:"Fulfillment",resourceId:result.id,success:true,reason,correlationId,metadata:{idempotencyKey,provider:result.provider,status:result.status}});
    return result;
  }catch(error){
    await auditAdminAction(context,{action:`FULFILLMENT_${input.action.toUpperCase()}`,resourceType:"Fulfillment",resourceId:"fulfillmentId" in input?input.fulfillmentId:input.orderId,success:false,reason,correlationId,metadata:{idempotencyKey}});
    return domainError(error);
  }
}
