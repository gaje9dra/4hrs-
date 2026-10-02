import test from "node:test";
import assert from "node:assert/strict";
import { db } from "@/lib/db/client";
import { requireAdmin } from "@/lib/admin/authorization";
import { AdminError } from "@/lib/admin/errors";
import { executeAdminOrderAction, getAdminOrder, parseAdminOrderQuery } from "@/lib/admin/orders";
import { hashPassword } from "@/lib/auth/password";
import { createSessionToken, hashSessionToken, CUSTOMER_SESSION_TTL_SECONDS } from "@/lib/auth/session";

async function fixture(){
 const email="phase14-3-"+crypto.randomUUID()+"@example.test";
 const role=await db.adminRole.findUnique({where:{name:"ADMIN"}});assert.ok(role);
 const customer=await db.customer.create({data:{email,status:"ACTIVE",credential:{create:{passwordHash:await hashPassword("Phase14-3-Secure-Test-Password!")}}}});
 const token=createSessionToken();
 const session=await db.customerSession.create({data:{customerId:customer.id,sessionTokenHash:hashSessionToken(token),expiresAt:new Date(Date.now()+CUSTOMER_SESSION_TTL_SECONDS*1000)}});
 const admin=await db.adminUser.create({data:{customerId:customer.id,roles:{create:{roleId:role.id}}}});
 const payment=await db.payment.create({data:{customerId:customer.id,checkoutReference:"phase14-3-checkout-"+crypto.randomUUID(),internalReference:crypto.randomUUID(),amount:"100.00",currency:"INR",status:"SUCCEEDED",completedAt:new Date()}});
 const order=await db.order.create({data:{customerId:customer.id,checkoutReference:payment.checkoutReference,paymentId:payment.id,orderNumber:"ORD-"+crypto.randomUUID().replaceAll("-","").slice(0,24).toUpperCase(),status:"CONFIRMED",subtotal:"100.00",total:"100.00",currency:"INR",items:{create:{productTitleSnapshot:"Phase 14.3 Test Product",quantity:1,unitPrice:"100.00",lineTotal:"100.00",currency:"INR"}}}});
 const cancellation=await db.cancellationRequest.create({data:{cancellationReference:"CAN-"+crypto.randomUUID().replaceAll("-","").slice(0,32).toUpperCase(),customerId:customer.id,orderId:order.id,status:"REQUESTED",reason:"test",customerDescription:"test"}});
 const request=()=>new Request("https://4hrs.test/admin/orders/"+order.orderNumber,{headers:{cookie:"customer_session="+token}});
 return {customer,session,admin,payment,order,cancellation,request};
}
async function cleanup(f:Awaited<ReturnType<typeof fixture>>){
 await db.notificationEvent.deleteMany({where:{orderId:f.order.id}});
 await db.commerceExceptionAuditEvent.deleteMany({where:{orderId:f.order.id}});
 await db.adminAuditLog.deleteMany({where:{actorAdminId:f.admin.id}});
 await db.cancellationRequest.deleteMany({where:{id:f.cancellation.id}});
 await db.orderItem.deleteMany({where:{orderId:f.order.id}});
 await db.order.delete({where:{id:f.order.id}});
 await db.payment.delete({where:{id:f.payment.id}});
 await db.adminUser.delete({where:{id:f.admin.id}});
 await db.customerSession.delete({where:{id:f.session.id}});
 await db.customerCredential.deleteMany({where:{customerId:f.customer.id}});
 await db.customer.delete({where:{id:f.customer.id}});
}

test("admin order query rejects unsupported parameters",()=>{
 assert.throws(()=>parseAdminOrderQuery(new URL("https://example.test/admin/orders?sort=customerPassword")),/Invalid sort field/);
});
test("admin order query validates bounded pagination and whitelisted sorting",()=>{
 const query=parseAdminOrderQuery(new URL("https://example.test/admin/orders?page=2&pageSize=100&sort=total&direction=asc&status=CONFIRMED"));
 assert.equal(query.page,2);assert.equal(query.pageSize,100);assert.equal(query.sort,"total");assert.equal(query.direction,"asc");assert.equal(query.status,"CONFIRMED");
 assert.throws(()=>parseAdminOrderQuery(new URL("https://example.test/admin/orders?pageSize=101")),/Invalid pageSize/);
 assert.throws(()=>parseAdminOrderQuery(new URL("https://example.test/admin/orders?sort=id")),/Invalid sort field/);
});
test("admin order query validates date range",()=>{
 assert.throws(()=>parseAdminOrderQuery(new URL("https://example.test/admin/orders?from=2026-10-10&to=2026-10-01")),/date range/);
});
test("admin order query accepts canonical operational filters",()=>{
 const q=parseAdminOrderQuery(new URL("https://example.test/admin/orders?paymentStatus=SUCCEEDED&fulfillmentStatus=SUBMITTED&shipmentStatus=IN_TRANSIT&cancellationStatus=REQUIRES_REVIEW&returnStatus=REQUESTED"));
 assert.equal(q.paymentStatus,"SUCCEEDED");assert.equal(q.fulfillmentStatus,"SUBMITTED");assert.equal(q.shipmentStatus,"IN_TRANSIT");assert.equal(q.cancellationStatus,"REQUIRES_REVIEW");assert.equal(q.returnStatus,"REQUESTED");
});

test("admin order detail is snapshot-safe and cancellation action is resource-bound",async()=>{
 const f=await fixture();
 try{
  const context=await requireAdmin(f.request(),"orders.read");
  const detail=await getAdminOrder(f.order.orderNumber);
  assert.equal(detail.orderNumber,f.order.orderNumber);
  assert.equal(detail.items[0]?.productTitle,"Phase 14.3 Test Product");
  assert.equal(detail.payment.status,"SUCCEEDED");
  assert.equal("metadata" in (detail.payment.events[0]??{}),false);
  assert.equal(detail.cancellations[0]?.reference,f.cancellation.cancellationReference);
  const own=await executeAdminOrderAction(context,f.order.orderNumber,{action:"review_cancellation",cancellationReference:f.cancellation.cancellationReference,decision:"APPROVE",reason:"Customer-requested cancellation"},f.request());
  assert.equal(own.action,"review_cancellation");
  const state=await db.cancellationRequest.findUnique({where:{id:f.cancellation.id},select:{status:true}});
  assert.equal(state?.status,"APPROVED");
  await assert.rejects(
   ()=>executeAdminOrderAction(context,f.order.orderNumber,{action:"review_cancellation",cancellationReference:"CAN-"+crypto.randomUUID().replaceAll("-","").slice(0,32).toUpperCase(),decision:"APPROVE",reason:"IDOR attempt"},f.request()),
   (error)=>error instanceof AdminError&&error.code==="NOT_FOUND",
  );
  const audit=await db.adminAuditLog.findFirst({where:{actorAdminId:f.admin.id,resourceType:"Order",resourceId:f.order.id,action:"ORDER_CANCELLATION_REVIEWED"}});
  assert.ok(audit);
 }finally{await cleanup(f);}
});
