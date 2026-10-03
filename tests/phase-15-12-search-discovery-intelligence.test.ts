import assert from "node:assert/strict";
import test from "node:test";
import { merchandisingPrecedence, validateMerchandisingRuleInput } from "@/lib/discovery/merchandising";
import { normalizeCatalogSearchQueryParameter } from "@/lib/catalog/search";

test("Phase 15.12 merchandising precedence is deterministic", () => {
  assert.equal(merchandisingPrecedence("PIN"), 0);
  assert.equal(merchandisingPrecedence("BOOST"), 1);
  assert.equal(merchandisingPrecedence("PROMOTE"), 1);
  assert.equal(merchandisingPrecedence("DEMOTE"), 2);
  assert.equal(merchandisingPrecedence("BURY"), 3);
});

test("Phase 15.12 rejects unbounded merchandising priority", () => {
  assert.throws(() => validateMerchandisingRuleInput({
    name: "unsafe",
    environment: "PRODUCTION",
    action: "BOOST",
    scope: "GLOBAL",
    priority: 1001,
  }));
});

test("Phase 15.12 validates scope requirements", () => {
  assert.throws(() => validateMerchandisingRuleInput({
    name: "missing product",
    environment: "PRODUCTION",
    action: "PIN",
    scope: "PRODUCT",
  }));
  assert.throws(() => validateMerchandisingRuleInput({
    name: "bad query",
    environment: "PRODUCTION",
    action: "BOOST",
    scope: "QUERY",
    scopeValue: "T-shirts",
  }));
});

test("Phase 15.12 normalizes Unicode and whitespace deterministically", () => {
  assert.equal(normalizeCatalogSearchQueryParameter("  Ｔ-shirt  "), "t-shirt");
  assert.equal(normalizeCatalogSearchQueryParameter("COTTON\u00A0TEE"), "cotton tee");
});
