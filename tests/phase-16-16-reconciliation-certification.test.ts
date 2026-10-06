import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { AUTHORITATIVE_DOMAINS, canAutoRepair, isHighRisk, sanitizeReconciliationEvidence } from "@/lib/reconciliation/model";

const root=process.cwd();
const service=readFileSync(join(root,"lib/reconciliation/service.ts"),"utf8");
const route=readFileSync(join(root,"app/api/admin/reconciliation/route.ts"),"utf8");

test("Phase 16.16 inventories deterministic cross-domain rules",()=>{
  for(const token of [
    "PAYMENT-ORDER-MISSING","ORDER-PAYMENT-AMOUNT-MISMATCH","PAYMENT-REFUND-OVER",
    "ORDER-PAYMENT-UNSETTLED","FUL-ORPHAN","SHIP-ORPHAN-FULFILLMENT",
    "CANCEL-FULFILLMENT-COMPLETE","RETURN-ORDER-MISSING","NOTIFICATION-EVENT-MISSING"
  ]) assert.match(service,new RegExp(token));
});

test("Phase 16.16 serializes concurrent detection and records detection actions",()=>{
  assert.match(service,/pg_advisory_xact_lock/);
  assert.match(service,/actionType:"DETECT"/);
  assert.match(service,/idempotencyKey:`detect:\$\{id\}`/);
});

test("Phase 16.16 preserves safe automatic repair boundaries",()=>{
  assert.equal(canAutoRepair("STALE_PROJECTION","SEARCH"),true);
  assert.equal(canAutoRepair("MISSING_EVENT","NOTIFICATIONS"),true);
  assert.equal(canAutoRepair("FINANCIAL_MISMATCH","PAYMENT"),false);
  assert.equal(canAutoRepair("PROVIDER_MISMATCH","FULFILLMENT"),false);
  assert.equal(isHighRisk("FINANCIAL_MISMATCH","PAYMENT"),true);
});

test("Phase 16.16 requires optimistic concurrency and admin permissions",()=>{
  assert.match(service,/expectedVersion/);
  for(const permission of ["reconciliation.read","reconciliation.investigate","reconciliation.execute","reconciliation.resolve","reconciliation.export"]) assert.match(route,new RegExp(permission.replace(".","\\.")));
  assert.match(service,/SUPER_ADMIN/);
  assert.match(service,/auditAdminAction/);
});

test("Phase 16.16 preserves provider-neutral and privacy boundaries",()=>{
  const safe=sanitizeReconciliationEvidence({token:"secret",customerEmail:"x@example.com",phone:"123",address:"hidden",reference:"ok"});
  assert.deepEqual(safe,{reference:"ok"});
  assert.match(service,/providerReference|authoritativeDomain/);
});

test("authority model covers commerce and provider domains",()=>{
  assert.equal(AUTHORITATIVE_DOMAINS.CATALOG,"CATALOG");
  assert.equal(AUTHORITATIVE_DOMAINS.PAYMENT,"PAYMENT");
  assert.equal(AUTHORITATIVE_DOMAINS.ORDER,"ORDER");
  assert.equal(AUTHORITATIVE_DOMAINS.FULFILLMENT,"FULFILLMENT");
  assert.equal(AUTHORITATIVE_DOMAINS.SHIPPING,"SHIPPING");
  assert.equal(AUTHORITATIVE_DOMAINS.PROVIDERS,"PROVIDER_ADAPTER");
});
