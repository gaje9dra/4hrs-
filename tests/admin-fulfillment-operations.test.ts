import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { parseAdminFulfillmentQuery } from "@/lib/admin/fulfillment";
import { createFulfillmentApplication } from "@/lib/fulfillment/application";

test("fulfillment admin query is bounded and deterministic",()=>{
 const q=parseAdminFulfillmentQuery(new URL("https://admin.local/admin/fulfillments?status=FAILED&page=2&pageSize=50&sort=updatedAt&direction=asc&failureOnly=true"));
 assert.equal(q.status,"FAILED");assert.equal(q.page,2);assert.equal(q.pageSize,50);assert.equal(q.sort,"updatedAt");assert.equal(q.direction,"asc");assert.equal(q.failureOnly,true);
 assert.throws(()=>parseAdminFulfillmentQuery(new URL("https://admin.local/admin/fulfillments?sort=providerReference")));
 assert.throws(()=>parseAdminFulfillmentQuery(new URL("https://admin.local/admin/fulfillments?pageSize=101")));
});

test("admin fulfillment routes do not directly mutate Prisma fulfillment records",()=>{
 for(const file of [
  "app/api/admin/fulfillments/route.ts",
  "app/api/admin/fulfillments/[fulfillmentId]/route.ts",
  "lib/admin/fulfillment.ts",
 ]) {
  const source=readFileSync(file,"utf8");
  assert.doesNotMatch(source,/db\.fulfillment\.(update|updateMany|create|delete)/);
 }
});

test("admin fulfillment actions invoke canonical application service",()=>{
 const source=readFileSync("lib/admin/fulfillment.ts","utf8");
 assert.match(source,/createFulfillmentApplication/);
 assert.match(source,/submitFulfillment/);
 assert.match(source,/reconcileFulfillment/);
 assert.doesNotMatch(source,/qikink/i);
});

test("provider secrets are excluded from admin fulfillment DTOs",()=>{
 const source=readFileSync("lib/admin/fulfillment.ts","utf8");
 assert.doesNotMatch(source,/QIKINK_CLIENT_SECRET|QIKINK_AUTH_TOKEN|Accesstoken|authorization|apiKey|privateKey/i);
});

test("canonical fulfillment application requires operation idempotency keys",()=>{
 const source=readFileSync("lib/fulfillment/application.ts","utf8");
 assert.match(source,/executeIdempotentOperation/);
 assert.match(source,/FULFILLMENT_PROVIDER_RECONCILIATION_REQUIRED/);
});

test("application factory remains constructible",()=>{
 assert.equal(typeof createFulfillmentApplication({}).submitFulfillment,"function");
});
