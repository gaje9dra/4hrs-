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

test("Quick-add modal escapes transformed product cards and fits small viewports", () => {
  assert.match(card, /createPortal/);
  assert.match(card, /document\.body/);
  assert.match(card, /max-w-md/);
  assert.match(card, /max-h-\[calc\(100dvh-1\.5rem\)\]/);
  assert.match(card, /overflow-y-auto/);
  assert.match(card, /text-\[clamp\(1\.75rem,7vw,3rem\)\]/);
  assert.match(card, /overflow-wrap:anywhere/);
});

test("Mobile product cards are polished and keep Add to Cart on product detail pages", () => {
  const cardButton = card.match(/<button type="button" disabled=\{unavailable\}[\s\S]*?className="([^"]+)"/);
  assert.ok(cardButton, "product-card add-to-cart button exists for desktop");
  assert.match(cardButton[1], /hidden/);
  assert.match(cardButton[1], /sm:flex/);
  assert.match(card, /aspect-\[4\/5\].*sm:aspect-\[2\/3\]/);
  assert.match(card, /border-2 border-border bg-white/);
  assert.match(card, /href=\{href\}/);
});

test("Mobile product image fills the card frame and product title has no underline", () => {
  assert.match(card, /-mx-3 -mt-3 aspect-\[4\/5\]/);
  assert.match(card, /scale-\[1\.78\].*sm:scale-\[1\.16\]/);
  assert.match(card, /!no-underline decoration-transparent/);
  assert.match(card, /style=\{\{ textDecoration: "none" \}\}/);
  assert.match(card, /-mx-3 -mt-3 aspect-\[4\/5\]/);
});
