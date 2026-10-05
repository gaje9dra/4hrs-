import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

test("Phase 16.5 certification covers the canonical shipping boundary",()=>{
 const s=readFileSync("scripts/phase-16-5-shipping-post-order-certification.ts","utf8");
 for(const term of ["createShipmentFromFulfillment","processNormalizedTrackingEvent","getCustomerShipment","requestShipmentReconciliation","PROVIDER_UNSUPPORTED","RECONCILIATION_REQUIRED","Serializable","shipping.view_sensitive","REFUND_UNAVAILABLE"]) assert.ok(s.includes(term),term);
});
test("Qikink shipping capability remains explicitly unsupported",()=>{
 const s=readFileSync("lib/shipping/providers/qikink.ts","utf8");
 assert.match(s,/createShipment:\s*false/); assert.match(s,/trackingLookup:\s*false/); assert.match(s,/webhooks:\s*false/);
});
test("shipping domain protects terminal and stale tracking states",()=>{
 const s=readFileSync("lib/shipping/domain.ts","utf8");
 assert.match(s,/DELIVERED:\s*\[\]/); assert.match(s,/RETURNED:\s*\[\]/); assert.match(s,/HISTORY_ONLY/); assert.match(s,/eventTimestamp\.getTime\(\) < latestEventTimestamp\.getTime\(\)/);
});
test("customer shipment lookup is customer-scoped",()=>{
 const s=readFileSync("lib/shipping/application.ts","utf8");
 assert.match(s,/getShipmentByCustomer\(input\.shipmentId, input\.customerId\)/); assert.match(s,/getShipmentByReference\(reference, input\.customerId\)/);
});
test("admin shipping mutations remain behind canonical application",()=>{
 const s=readFileSync("lib/admin/shipping.ts","utf8");
 assert.match(s,/createShippingApplication/); assert.doesNotMatch(s,/db\.(shipment|trackingEvent)\.(create|update|updateMany|delete|deleteMany)/);
});
test("refund execution remains outside shipping/returns",()=>{
 const s=readFileSync("lib/returns/application.ts","utf8");
 assert.match(s,/REFUND_UNAVAILABLE/); assert.match(s,/Payment\/refund.*not implemented/);
});
