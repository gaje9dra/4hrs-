import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const card = readFileSync("components/storefront/product-card.tsx", "utf8");
const route = readFileSync("app/api/storefront/products/[slug]/quick-add/route.ts", "utf8");

test("Product card quick-add uses a size/options dialog and does not navigate", () => {
  assert.match(card, /role="dialog"/);
  assert.match(card, /selectedValues/);
  assert.match(card, //api/storefront/products/);
  assert.match(card, /fetch("/api/cart"/);
  assert.doesNotMatch(card, /router\.push|intent=cart/);
});

test("Quick-add endpoint exposes only public option and availability data", () => {
  assert.match(route, /getStorefrontProduct/);
  assert.match(route, /option\.values\.map/);
  assert.match(route, /variant\.optionValues\.map/);
  assert.match(route, /Cache-Control.*no-store/);
  assert.doesNotMatch(route, /customerId|ownerId|sessionId|password|token/i);
});
