import assert from "node:assert/strict";
import test from "node:test";
import { AUTHORITATIVE_DOMAINS, canAutoRepair, isHighRisk, sanitizeReconciliationEvidence } from "@/lib/reconciliation/model";

test("defines authority for supported domains",()=>{
 assert.equal(AUTHORITATIVE_DOMAINS.PAYMENT,"PAYMENT");
 assert.equal(AUTHORITATIVE_DOMAINS.SEARCH,"SEARCH_PROJECTION");
 assert.equal(AUTHORITATIVE_DOMAINS.PROVIDERS,"PROVIDER_ADAPTER");
});

test("only permits projection-safe automatic repair",()=>{
 assert.equal(canAutoRepair("STALE_PROJECTION","SEARCH"),true);
 assert.equal(canAutoRepair("MISSING_EVENT","NOTIFICATIONS"),true);
 assert.equal(canAutoRepair("FINANCIAL_MISMATCH","PAYMENT"),false);
 assert.equal(canAutoRepair("OWNERSHIP_MISMATCH","CUSTOMER"),false);
 assert.equal(canAutoRepair("PROVIDER_MISMATCH","FULFILLMENT"),false);
});

test("marks high-risk discrepancies",()=>{
 assert.equal(isHighRisk("FINANCIAL_MISMATCH","PAYMENT"),true);
 assert.equal(isHighRisk("OWNERSHIP_MISMATCH","CUSTOMER"),true);
 assert.equal(isHighRisk("PROVIDER_MISMATCH","FULFILLMENT"),true);
 assert.equal(isHighRisk("STALE_PROJECTION","SEARCH"),false);
});

test("redacts sensitive evidence",()=>{
 const safe=sanitizeReconciliationEvidence({token:"secret",customerEmail:"x@example.com",phone:"123",rule:"R",nested:{address:"hidden",count:2}});
 assert.deepEqual(safe,{rule:"R",nested:{count:2}});
});
