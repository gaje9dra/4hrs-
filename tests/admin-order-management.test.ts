import test from "node:test";
import assert from "node:assert/strict";
import { parseAdminOrderQuery } from "@/lib/admin/orders";

test("admin order query rejects unsupported parameters",()=>{
 assert.throws(()=>parseAdminOrderQuery(new URL("https://example.test/admin/orders?sort=customerPassword")),/Unsupported order list parameter/);
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
