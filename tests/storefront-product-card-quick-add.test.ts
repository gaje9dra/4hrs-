import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const card = readFileSync("components/storefront/product-card.tsx", "utf8");
const route = readFileSync("app/api/storefront/products/[slug]/quick-add/route.ts", "utf8");

test("Product card quick-add uses a size/options dialog and does not navigate", () => {
  assert.match(card, /role="dialog"/);
  assert.match(card, /selectedValues/);
  assert.ok(card.includes("/api/storefront/products/"));
  assert.ok(card.includes('fetch("/api/cart"'));
  assert.doesNotMatch(card, /router\.push|intent=cart/);
});

test("Quick-add endpoint exposes only public option and availability data", () => {
  assert.match(route, /getStorefrontProduct/);
  assert.match(route, /option\.values\.map/);
  assert.match(route, /variant\.optionValues\.map/);
  assert.match(route, /Cache-Control.*no-store/);
  assert.doesNotMatch(route, /customerId|ownerId|sessionId|password|token/i);
});

test("Quick-add dialog closes only after the cart API confirms success", () => {
  const successIndex = card.indexOf('setCartState("success");');
  const closeIndex = card.indexOf("setQuickAddOpen(false);", successIndex);
  const catchIndex = card.indexOf("} catch (error)", successIndex);
  assert.notEqual(successIndex, -1);
  assert.ok(closeIndex > successIndex, "close the dialog after the cart API succeeds");
  assert.ok(catchIndex > closeIndex, "do not close the dialog on the error path");
});
