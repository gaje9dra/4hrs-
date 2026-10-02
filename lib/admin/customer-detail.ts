import { Prisma } from "@prisma/client";
import { db } from "@/lib/db/client";
import { AdminError } from "@/lib/admin/errors";
import { createCustomerApplication } from "@/lib/customer/application";
import { type CustomerStatus, parseCustomerStatus } from "@/lib/customer/domain";

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function getAdminCustomerDetail(customerId:string,permissions:Set<string>){
 if(!UUID.test(customerId))throw new AdminError("INVALID_REQUEST","Customer identifier is invalid.");
 const canAddress=permissions.has("customers.address.read"),canFinancial=permissions.has("customers.financial.read"),canCase=permissions.has("customers.case.read");
 const [customer,orderCount,orders,payments,returns,cancellations,cases,financial,addresses]=await Promise.all([
  db.customer.findUnique({where:{id:customerId},select:{id:true,email:true,displayName:true,status:true,emailVerifiedAt:true,createdAt:true,updatedAt:true}}),
  db.order.count({where:{customerId}}),
  db.order.findMany({where:{customerId},orderBy:{createdAt:"desc"},take:20,select:{id:true,orderNumber:true,status:true,total:true,currency:true,createdAt:true,payment:{select:{status:true}},fulfillment:{select:{status:true}},shipments:{orderBy:{updatedAt:"desc"},take:1,select:{status:true,trackingNumber:true}}}}),
  db.payment.findMany({where:{customerId},orderBy:{createdAt:"desc"},take:10,select:{id:true,status:true,amount:true,currency:true,createdAt:true,completedAt:true,_count:{select:{attempts:true,refunds:true}}}}),
  db.returnRequest.findMany({where:{customerId},orderBy:{createdAt:"desc"},take:10,select:{returnReference:true,order:{select:{orderNumber:true}},status:true,createdAt:true,resolvedAt:true}}),
  db.cancellationRequest.findMany({where:{customerId},orderBy:{createdAt:"desc"},take:10,select:{cancellationReference:true,order:{select:{orderNumber:true}},status:true,createdAt:true,completedAt:true}}),
  canCase?db.case.findMany({where:{customerId},orderBy:{updatedAt:"desc"},take:10,select:{caseReference:true,title:true,status:true,priority:true,assignedOperatorId:true,createdAt:true,updatedAt:true}}):Promise.resolve([]),
  canFinancial?db.$queryRaw<Array<{paidOrders:bigint;gross:Prisma.Decimal|null;refund:Prisma.Decimal|null;firstOrder:Date|null;lastOrder:Date|null;currencyCount:bigint}>>(Prisma.sql`WITH paid AS (SELECT o."total",o."currency",o."createdAt" FROM "Order" o JOIN "Payment" p ON p."id"=o."paymentId" WHERE o."customerId"=${customerId}::uuid AND p."status" IN ('SUCCEEDED','REFUNDED','PARTIALLY_REFUNDED')),refunds AS (SELECT COALESCE(SUM(r."amount"),0) AS amount FROM "PaymentRefund" r JOIN "Payment" p ON p."id"=r."paymentId" WHERE p."customerId"=${customerId}::uuid AND r."status"='SUCCEEDED') SELECT COUNT(*)::bigint AS "paidOrders",SUM(paid."total") FILTER(WHERE paid."currency"='INR') AS gross,refunds.amount AS refund,MIN(paid."createdAt") AS "firstOrder",MAX(paid."createdAt") AS "lastOrder",COUNT(DISTINCT paid."currency")::bigint AS "currencyCount" FROM paid CROSS JOIN refunds GROUP BY refunds.amount`):Promise.resolve([]),
  canAddress?db.customerAddress.findMany({where:{customerId},orderBy:{updatedAt:"desc"},select:{id:true,recipientName:true,phone:true,addressLine1:true,addressLine2:true,city:true,stateOrProvince:true,postalCode:true,countryCode:true,label:true,isDefault:true,createdAt:true,updatedAt:true}}):Promise.resolve([])
 ]);
 if(!customer)throw new AdminError("NOT_FOUND","Customer could not be found.");
 const f=financial[0],safe=!!f&&Number(f.currencyCount)<=1,gross=safe?(f?.gross??new Prisma.Decimal(0)):null,refund=safe?(f?.refund??new Prisma.Decimal(0)):null,paid=Number(f?.paidOrders??0n),net=gross&&refund?gross.sub(refund):null,aov=gross&&paid>0?gross.div(paid).toFixed(2):null;
 return {
  customer:{id:customer.id,email:customer.email,displayName:customer.displayName,status:customer.status,emailVerifiedAt:customer.emailVerifiedAt?.toISOString()??null,createdAt:customer.createdAt.toISOString(),updatedAt:customer.updatedAt.toISOString()},
  metrics:{totalOrders:orderCount,paidOrders:safe?paid:null,grossPurchaseValue:gross?.toFixed(2)??null,refundValue:refund?.toFixed(2)??null,netPurchaseValue:net?.toFixed(2)??null,averageOrderValue:aov,firstOrderDate:f?.firstOrder?.toISOString()??null,mostRecentOrderDate:f?.lastOrder?.toISOString()??null,openCaseCount:canCase?cases.filter(c=>["OPEN","TRIAGED","ASSIGNED","IN_PROGRESS","WAITING"].includes(c.status)).length:null,returnCount:returns.length,cancellationCount:cancellations.length},
  orders:orders.map(o=>({id:o.id,orderNumber:o.orderNumber,status:o.status,total:o.total.toFixed(2),currency:o.currency,createdAt:o.createdAt.toISOString(),paymentStatus:o.payment.status,fulfillmentStatus:o.fulfillment?.status??null,shipmentStatus:o.shipments[0]?.status??null,trackingAvailable:!!o.shipments[0]?.trackingNumber})),
  payments:payments.map(p=>({id:p.id,status:p.status,amount:p.amount.toFixed(2),currency:p.currency,createdAt:p.createdAt.toISOString(),completedAt:p.completedAt?.toISOString()??null,attemptCount:p._count.attempts,refundCount:p._count.refunds})),
  returns:returns.map(r=>({reference:r.returnReference,orderNumber:r.order.orderNumber,status:r.status,createdAt:r.createdAt.toISOString(),resolvedAt:r.resolvedAt?.toISOString()??null})),
  cancellations:cancellations.map(c=>({reference:c.cancellationReference,orderNumber:c.order.orderNumber,status:c.status,createdAt:c.createdAt.toISOString(),completedAt:c.completedAt?.toISOString()??null})),
  cases:canCase?cases.map(c=>({reference:c.caseReference,title:c.title,status:c.status,priority:c.priority,assignedOperatorId:c.assignedOperatorId,createdAt:c.createdAt.toISOString(),updatedAt:c.updatedAt.toISOString()})):null,
  addresses:canAddress?addresses.map(a=>({id:a.id,recipientName:a.recipientName,phone:a.phone,addressLine1:a.addressLine1,addressLine2:a.addressLine2,city:a.city,stateOrProvince:a.stateOrProvince,postalCode:a.postalCode,countryCode:a.countryCode,label:a.label,isDefault:a.isDefault,createdAt:a.createdAt.toISOString(),updatedAt:a.updatedAt.toISOString()})):null,
  privacy:{addressesRestricted:!canAddress,financialRestricted:!canFinancial,casesRestricted:!canCase}
 };
}

export async function updateAdminCustomerProfile(customerId:string,body:Record<string,unknown>){
 if(!UUID.test(customerId))throw new AdminError("INVALID_REQUEST","Customer identifier is invalid.");
 if(Object.keys(body).some(k=>k!=="displayName"&&k!=="expectedUpdatedAt"))throw new AdminError("INVALID_REQUEST","Unsupported customer fields were supplied.");
 if(typeof body.expectedUpdatedAt!=="string"||Number.isNaN(Date.parse(body.expectedUpdatedAt)))throw new AdminError("INVALID_REQUEST","A valid expectedUpdatedAt is required.");
 const before=await db.customer.findUnique({where:{id:customerId},select:{displayName:true,email:true,status:true,updatedAt:true}});if(!before)throw new AdminError("NOT_FOUND","Customer could not be found.");
 try{return {customer:await createCustomerApplication().updateProfile({customerId,displayName:body.displayName,expectedUpdatedAt:new Date(body.expectedUpdatedAt)}),before};}
 catch(error){if(error instanceof Error&&"code" in error&&error.code==="CONFLICT")throw new AdminError("CONFLICT",error.message);if(error instanceof Error&&"code" in error&&error.code==="INVALID_REQUEST")throw new AdminError("INVALID_REQUEST",error.message);throw error;}
}
export async function updateAdminCustomerStatus(customerId:string,body:Record<string,unknown>){
 if(!UUID.test(customerId))throw new AdminError("INVALID_REQUEST","Customer identifier is invalid.");
 if(Object.keys(body).some(k=>!["status","expectedUpdatedAt","reason"].includes(k)))throw new AdminError("INVALID_REQUEST","Unsupported customer fields were supplied.");
 const status=typeof body.status==="string"?parseCustomerStatus(body.status):undefined;if(!status)throw new AdminError("INVALID_REQUEST","Customer status is required.");
 if(typeof body.expectedUpdatedAt!=="string"||Number.isNaN(Date.parse(body.expectedUpdatedAt)))throw new AdminError("INVALID_REQUEST","A valid expectedUpdatedAt is required.");
 const reason=typeof body.reason==="string"?body.reason.trim():"";if(reason.length<3||reason.length>1000)throw new AdminError("INVALID_REQUEST","A reason is required for customer status changes.");
 const before=await db.customer.findUnique({where:{id:customerId},select:{displayName:true,email:true,status:true,updatedAt:true}});if(!before)throw new AdminError("NOT_FOUND","Customer could not be found.");
 try{return {customer:await createCustomerApplication().transitionStatus({customerId,status,expectedUpdatedAt:new Date(body.expectedUpdatedAt)}),before,reason};}
 catch(error){if(error instanceof Error&&"code" in error&&error.code==="CONFLICT")throw new AdminError("CONFLICT",error.message);if(error instanceof Error&&"code" in error&&error.code==="INVALID_REQUEST")throw new AdminError("INVALID_REQUEST",error.message);throw error;}
}
