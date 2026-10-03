import assert from "node:assert/strict";
import test from "node:test";
import { AUTHORITATIVE_DOMAINS, canAutoRepair, isHighRisk, sanitizeReconciliationEvidence } from "@/lib/reconciliation/model";

 it("defines authority for supported domains",()=>{ expect(AUTHORITATIVE_DOMAINS.PAYMENT).toBe("PAYMENT"); expect(AUTHORITATIVE_DOMAINS.SEARCH).toBe("SEARCH_PROJECTION"); expect(AUTHORITATIVE_DOMAINS.PROVIDERS).toBe("PROVIDER_ADAPTER"); });
 it("only permits projection-safe automatic repair",()=>{ expect(canAutoRepair("STALE_PROJECTION","SEARCH")).toBe(true); expect(canAutoRepair("MISSING_EVENT","NOTIFICATIONS")).toBe(true); expect(canAutoRepair("FINANCIAL_MISMATCH","PAYMENT")).toBe(false); expect(canAutoRepair("OWNERSHIP_MISMATCH","CUSTOMER")).toBe(false); expect(canAutoRepair("PROVIDER_MISMATCH","FULFILLMENT")).toBe(false); });
 it("marks high-risk discrepancies",()=>{ expect(isHighRisk("FINANCIAL_MISMATCH","PAYMENT")).toBe(true); expect(isHighRisk("OWNERSHIP_MISMATCH","CUSTOMER")).toBe(true); expect(isHighRisk("PROVIDER_MISMATCH","FULFILLMENT")).toBe(true); expect(isHighRisk("STALE_PROJECTION","SEARCH")).toBe(false); });
 it("redacts sensitive evidence",()=>{ const safe=sanitizeReconciliationEvidence({token:"secret",customerEmail:"x@example.com",phone:"123",rule:"R",nested:{address:"hidden",count:2}}); expect(safe).toEqual({rule:"R",nested:{count:2}}); });
});