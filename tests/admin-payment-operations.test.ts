import assert from "node:assert/strict";
import test from "node:test";
import { Prisma, type PaymentRefundReason } from "@prisma/client";
import { createPaymentApplication, type AdminRefundInput } from "@/lib/payments/application";
import { createPaymentProviderRegistry, createPaymentProviderResolver } from "@/lib/payments/resolver";
import type { PaymentProviderAdapter } from "@/lib/payments/provider";
import type { PaymentAdminRecord, PaymentRepository } from "@/lib/payments/repository";
import { parseAdminPaymentQuery } from "@/lib/admin/payments";
import { readFileSync } from "node:fs";

const customerId="11111111-1111-4111-8111-111111111111";
const paymentId="22222222-2222-4222-8222-222222222222";
const now=new Date("2026-10-02T00:00:00.000Z");

function makeState(status:"SUCCEEDED"|"PARTIALLY_REFUNDED"="SUCCEEDED"){
 return {
  id:paymentId,customerId,checkoutReference:"checkout-ref",internalReference:"payment-ref",
  providerId:"test-provider",providerReference:"provider-payment",status,amount:new Prisma.Decimal("1000.00"),currency:"INR",
  completedAt:now,expiresAt:null,createdAt:now,updatedAt:now,
  customer:{id:customerId,email:"customer@example.com",displayName:"Customer",status:"ACTIVE",emailVerifiedAt:null,createdAt:now,updatedAt:now},
  order:null,attempts:[],events:[],refunds:[]
 };
}
function fakeRefundRepository(initial=makeState()){
 let current=initial as unknown as PaymentAdminRecord;
 const idempotency=new Map<string,{requestFingerprint:string;paymentId:string}>();
 const refundMap=new Map<string,Record<string,unknown>>();
 let refundCount=0;
 let lock=Promise.resolve();
 const repo={
  withTransaction:async <T>(work:(repository:PaymentRepository)=>Promise<T>)=>{const previous=lock;let release!:()=>void;lock=new Promise<void>(r=>{release=r});await previous;try{return await work(repo as unknown as PaymentRepository);}finally{release();}},
  createPayment:async()=>{throw new Error("unused")},createPaymentWithInitialAttempt:async()=>{throw new Error("unused")},
  getPaymentById:async(id:string,owner:string)=>id===paymentId&&owner===customerId?current:null,
  getPaymentForAdmin:async(id:string)=>id===paymentId?current:null,
  listPaymentsForAdmin:async()=>{throw new Error("unused")},getPaymentsByCustomer:async()=>[],getPaymentByCheckout:async()=>null,
  getPaymentByInternalReference:async()=>current,getPaymentByProviderReference:async()=>current,
  updatePaymentStatus:async(_id:string,expected:string,next:string)=>{if(current.status!==expected)throw new Error("concurrent");current={...current,status:next,updatedAt:new Date()} as PaymentAdminRecord;return current;},
  createPaymentAttempt:async()=>{throw new Error("unused")},updatePaymentProviderReferences:async()=>{throw new Error("unused")},getPaymentAttempts:async()=>[],
  getPaymentAttemptByProviderReference:async()=>null,recordPaymentEvent:async()=>{throw new Error("unused")},findPaymentEventByProviderEventId:async()=>null,
  markPaymentEventProcessed:async()=>{throw new Error("unused")},markPaymentEventFailed:async()=>{throw new Error("unused")},
  lookupByIdempotencyKey:async(owner:string,operation:string,key:string)=>{const value=idempotency.get(owner+":"+operation+":"+key);return value?{id:key,requestFingerprint:value.requestFingerprint,paymentId:value.paymentId} as never:null;},
  createPaymentIdempotency:async(input:{customerId:string;operation:string;key:string;requestFingerprint:string;paymentId:string})=>{const k=input.customerId+":"+input.operation+":"+input.key;if(idempotency.has(k))throw new Error("P2002");idempotency.set(k,{requestFingerprint:input.requestFingerprint,paymentId:input.paymentId});return {id:k} as never;},
  getRefundByIdempotencyKey:async(key:string)=>refundMap.get(key) as never??null,
  createPaymentRefund:async(input:{paymentId:string;idempotencyKey:string;amount:Prisma.Decimal|string;currency:string;reason:PaymentRefundReason;note?:string|null})=>{const record={id:"refund-"+(++refundCount),paymentId:input.paymentId,idempotencyKey:input.idempotencyKey,amount:new Prisma.Decimal(input.amount),currency:input.currency,status:"PENDING",reason:input.reason,note:input.note??null,providerId:null,providerReference:null,failureCode:null,createdAt:now,updatedAt:now,completedAt:null};refundMap.set(input.idempotencyKey,record);current={...current,refunds:[...current.refunds,record]} as unknown as PaymentAdminRecord;return record as never;},
  updatePaymentRefund:async(input:{id:string;status:string;providerId?:string|null;providerReference?:string|null;failureCode?:string|null;completedAt?:Date|null})=>{const record=[...refundMap.values()].find(x=>x.id===input.id) as Record<string,unknown>;Object.assign(record,input);if(input.status==="SUCCEEDED")current={...current,refunds:current.refunds.map(r=>r.id===input.id?{...r,...input}:r)} as unknown as PaymentAdminRecord;return record as never;},
  getPaymentRefunds:async()=>[],
 };
 return repo as unknown as PaymentRepository;
}
function refundProvider(status:"PARTIALLY_REFUNDED"|"REFUNDED"="PARTIALLY_REFUNDED"):PaymentProviderAdapter{
 return {
  id:"test-provider",
  capabilities:{createPayment:false,clientAction:false,webhookVerification:true,statusLookup:true,cancellation:false,refunds:true,partialRefunds:true},
  async createPayment(){throw new Error("unused")},async retrievePayment(){throw new Error("unused")},async verifyPayment(){throw new Error("unused")},async verifyWebhook(){throw new Error("unused")},
  async refundPayment(request){assert.equal(request.amount?.currency,"INR");return {providerId:"test-provider",providerPaymentReference:"refund-ref-1",providerAttemptReference:null,status,clientAction:{type:"NONE"}};},
  normalizeStatus(){return "PROCESSING"},normalizeError(){return "PROVIDER_UNKNOWN_ERROR"},
 };
}
function appFor(repository:PaymentRepository){return createPaymentApplication({repository,providerResolver:createPaymentProviderResolver({registry:createPaymentProviderRegistry([refundProvider()]),configuration:{id:"test-provider",enabled:true,mode:"test",publicKey:null,secretReference:"SERVER_SECRET",webhookSecretReference:"SERVER_WEBHOOK_SECRET",timeoutMs:10000,capabilities:{}}})});}

test("admin payment query enforces bounded deterministic sorting and filters",()=>{
 const q=parseAdminPaymentQuery(new URL("https://admin.local/admin/payments?status=SUCCEEDED&currency=inr&minAmount=10.00&maxAmount=100.00&sort=amount_desc&pageSize=50"));
 assert.equal(q.status,"SUCCEEDED");assert.equal(q.currency,"INR");assert.equal(q.sort,"amount_desc");assert.equal(q.pageSize,50);
 const successful=parseAdminPaymentQuery(new URL("https://admin.local/admin/payments?outcome=successful"));
 assert.equal(successful.outcome,"successful");assert.equal(successful.status,"SUCCEEDED");
 const failed=parseAdminPaymentQuery(new URL("https://admin.local/admin/payments?outcome=failed"));
 assert.equal(failed.outcome,"failed");assert.equal(failed.status,"FAILED");
 assert.throws(()=>parseAdminPaymentQuery(new URL("https://admin.local/admin/payments?outcome=successful&status=FAILED")));
 assert.throws(()=>parseAdminPaymentQuery(new URL("https://admin.local/admin/payments?outcome=pending")));
 assert.throws(()=>parseAdminPaymentQuery(new URL("https://admin.local/admin/payments?sort=providerReference")));
 assert.throws(()=>parseAdminPaymentQuery(new URL("https://admin.local/admin/payments?minAmount=200&maxAmount=100")));
});

test("partial refunds are provider-confirmed and preserve canonical payment state",async()=>{
 const repository=fakeRefundRepository();const app=appFor(repository);
 const input:AdminRefundInput={paymentId,amount:"400.00",currency:"INR",reason:"CUSTOMER_REQUEST",idempotencyKey:"refund-key-1234567890"};
 const result=await app.refundPayment(input);
 assert.equal(result.status,"SUCCEEDED");assert.equal(result.payment.status,"PARTIALLY_REFUNDED");assert.equal(result.amount.value,"400.00");
});

test("refund amount is recalculated server-side and cannot exceed remaining balance",async()=>{
 const repository=fakeRefundRepository();const app=appFor(repository);
 await app.refundPayment({paymentId,amount:"700.00",currency:"INR",reason:"CUSTOMER_REQUEST",idempotencyKey:"refund-key-1234567890"});
 await assert.rejects(()=>app.refundPayment({paymentId,amount:"400.00",currency:"INR",reason:"CUSTOMER_REQUEST",idempotencyKey:"refund-key-2234567890"}),/remaining refundable balance/);
});

test("two concurrent refund requests cannot exceed the refundable balance",async()=>{
 const repository=fakeRefundRepository();const app=appFor(repository);
 const results=await Promise.allSettled([
  app.refundPayment({paymentId,amount:"700.00",currency:"INR",reason:"CUSTOMER_REQUEST",idempotencyKey:"refund-key-3234567890"}),
  app.refundPayment({paymentId,amount:"700.00",currency:"INR",reason:"CUSTOMER_REQUEST",idempotencyKey:"refund-key-4234567890"}),
 ]);
 assert.equal(results.filter(x=>x.status==="fulfilled").length,1);assert.equal(results.filter(x=>x.status==="rejected").length,1);
});

test("same refund idempotency key does not execute a second financial side effect",async()=>{
 let calls=0;const repository=fakeRefundRepository();const adapter=refundProvider();
 const wrapped={...adapter,refundPayment:async(...args:Parameters<NonNullable<PaymentProviderAdapter["refundPayment"]>>)=>{calls++;return adapter.refundPayment!(...args);}};
 const app=createPaymentApplication({repository,providerResolver:createPaymentProviderResolver({registry:createPaymentProviderRegistry([wrapped]),configuration:{id:"test-provider",enabled:true,mode:"test",publicKey:null,secretReference:"SERVER_SECRET",webhookSecretReference:"SERVER_WEBHOOK_SECRET",timeoutMs:10000,capabilities:{}}})});
 const input={paymentId,amount:"100.00",currency:"INR",reason:"DUPLICATE_PAYMENT" as const,idempotencyKey:"refund-key-5234567890"};
 await app.refundPayment(input);await app.refundPayment(input);assert.equal(calls,1);
});

test("reconciliation cannot fabricate a refund state without local refund evidence",async()=>{
 const repository=fakeRefundRepository();
 const adapter=refundProvider("REFUNDED");
 const resolver=createPaymentProviderResolver({registry:createPaymentProviderRegistry([{...adapter,async retrievePayment(){return {providerId:"test-provider",providerPaymentReference:"provider-payment",providerAttemptReference:null,status:"REFUNDED",clientAction:{type:"NONE"}};}}]),configuration:{id:"test-provider",enabled:true,mode:"test",publicKey:null,secretReference:"SERVER_SECRET",webhookSecretReference:"SERVER_WEBHOOK_SECRET",timeoutMs:10000,capabilities:{}}});
 const app=createPaymentApplication({repository,providerResolver:resolver});
 await assert.rejects(()=>app.reconcilePayment(paymentId,customerId),/local refund history cannot substantiate/);
});

test("admin APIs do not expose direct Prisma payment mutations",()=>{
 const route=readFileSync("app/api/admin/payments/[paymentId]/actions/route.ts","utf8");
 assert.doesNotMatch(route,/db\.payment\.(update|updateMany|create|delete)/);
 const service=readFileSync("lib/admin/payments.ts","utf8");
 assert.doesNotMatch(service,/db\.payment\.(update|updateMany|create|delete)/);
});

test("payment secrets are not part of admin payment DTO source",()=>{
 const source=readFileSync("lib/admin/payments.ts","utf8");
 assert.doesNotMatch(source,/secret|accessToken|webhookSecret|cardNumber|cvv|cvc/i);
});
