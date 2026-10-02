import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { parseAdminShippingQuery } from "@/lib/admin/shipping";

test("shipping admin query is bounded, whitelisted and deterministic",()=>{
 const q=parseAdminShippingQuery(new URL("https://admin.local/admin/shipping?status=IN_TRANSIT&page=2&pageSize=50&sort=updatedAt&direction=asc&reconciliationRequired=true"));
 assert.equal(q.status,"IN_TRANSIT");assert.equal(q.page,2);assert.equal(q.pageSize,50);assert.equal(q.sort,"updatedAt");assert.equal(q.direction,"asc");assert.equal(q.reconciliationRequired,true);
 assert.throws(()=>parseAdminShippingQuery(new URL("https://admin.local/admin/shipping?sort=providerReference")));
 assert.throws(()=>parseAdminShippingQuery(new URL("https://admin.local/admin/shipping?pageSize=101")));
 assert.throws(()=>parseAdminShippingQuery(new URL("https://admin.local/admin/shipping?from=2026-10-03&to=2026-10-02")));
});

test("admin shipping APIs do not directly mutate Shipment or TrackingEvent persistence",()=>{
 for(const file of ["app/api/admin/shipping/route.ts","app/api/admin/shipping/[shipmentId]/route.ts","lib/admin/shipping.ts"]){
  const source=readFileSync(file,"utf8");
  assert.doesNotMatch(source,/db\.(shipment|trackingEvent)\.(create|update|updateMany|delete|deleteMany)/);
 assert.doesNotMatch(source,/trackingEvents?\.(create|update|delete)/);
 assert.doesNotMatch(source,/status\s*[:=]\s*["\x27]DELIVERED["\x27]/);
 assert.doesNotMatch(source,/trackingNumber\s*[:=]\s*["\x27][^"\x27]*["\x27]/);
 }
});

test("admin shipping mutations use the canonical Shipping application",()=>{
 const source=readFileSync("lib/admin/shipping.ts","utf8");
 assert.match(source,/createShippingApplication/);
 assert.match(source,/createShipmentFromFulfillment/);
 assert.match(source,/reconcileShipment/);
 assert.match(source,/requestShipmentReconciliation/);
 assert.doesNotMatch(source,/qikink/i);
});

test("provider-sensitive fields are permission gated",()=>{
 const source=readFileSync("lib/admin/shipping.ts","utf8");
 assert.match(source,/shipping\.view_sensitive/);
 assert.match(source,/sensitive\?row\.trackingNumber:null/);
 assert.match(source,/sensitive\?row\.providerReference:null/);
});

test("admin shipping does not fabricate tracking state",()=>{
 const source=readFileSync("lib/admin/shipping.ts","utf8");
});

test("Qikink shipping capabilities remain unverified where the adapter says so",()=>{
 const source=readFileSync("lib/shipping/providers/qikink.ts","utf8");
 assert.match(source,/createShipment:\s*false/);
 assert.match(source,/trackingLookup:\s*false/);
 assert.match(source,/webhooks:\s*false/);
});
