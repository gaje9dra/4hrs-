import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const route = readFileSync("app/(storefront)/cart/page.tsx", "utf8");
const page = readFileSync("components/storefront/cart-page.tsx", "utf8");
const contracts = readFileSync("lib/cart/contracts.ts", "utf8");
const navigation = readFileSync("lib/storefront/navigation.ts", "utf8");
const headerAuth = readFileSync("components/storefront/customer-auth-status.tsx", "utf8");

test("Cart route is private, dynamic and uses the storefront Cart page", () => {
  assert.match(route, /force-dynamic/);
  assert.match(route, /index: false/);
  assert.match(route, /follow: false/);
  assert.match(route, /<CartPage/);
  assert.doesNotMatch(route, /prisma|@\/lib\/db|repository/);
});

test("Cart page consumes client-safe DTO contracts and the Cart API", () => {
  assert.match(page, /@\/lib\/cart\/contracts/);
  assert.match(page, /cartRequest\("\/api\/cart"/);
  assert.match(page, /cache: "no-store"/);
  assert.match(page, /credentials: "same-origin"/);
  assert.doesNotMatch(page, /@\/lib\/db|Prisma|createCartService|repository/);
});

test("Cart page renders authoritative pricing and stale states without client totals", () => {
  assert.match(page, /item\.unitPrice/);
  assert.match(page, /item\.subtotal/);
  assert.match(page, /cart\?\.subtotal/);
  assert.match(page, /PRODUCT_UNAVAILABLE/);
  assert.match(page, /VARIANT_UNAVAILABLE/);
  assert.match(page, /INSUFFICIENT_AVAILABILITY/);
  assert.doesNotMatch(page, /localStorage|sessionStorage|\bprice\s*\*|reduce\(/);
});

test("Cart controls use server-backed mutation contracts", () => {
  assert.match(page, /method: "PATCH"/);
  assert.match(page, /method: "DELETE"/);
  assert.match(page, /\/api\/cart\/items/);
  assert.match(page, /Clear cart/);
});

test("Cart DTO contracts contain no persistence or ownership fields", () => {
  assert.match(contracts, /export type CartDto/);
  assert.match(contracts, /export type CartItemDto/);
  assert.doesNotMatch(contracts, /ownerId|customerId|sessionId|createdAt|updatedAt|password|token/i);
});

test("Header exposes the real Cart route as an icon without a fake count", () => {
  assert.doesNotMatch(navigation, /label: "Cart", href: "\/cart"/);
  assert.match(headerAuth, /href="\/cart"/);
  assert.match(headerAuth, /ShoppingCart/);
  assert.doesNotMatch(headerAuth, /cartCount|itemCount|badge.*Cart/i);
});
