import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const route = readFileSync("app/(storefront)/product/[slug]/page.tsx", "utf8");
const detail = readFileSync("components/storefront/product-detail.tsx", "utf8");
const interactive = readFileSync("components/storefront/product-detail-interactive.tsx", "utf8");
const gallery = readFileSync("components/storefront/product-gallery.tsx", "utf8");
const options = readFileSync("components/storefront/product-options.tsx", "utf8");
const storefront = readFileSync("lib/storefront/catalog.ts", "utf8");

test("Phase 3.6 uses the singular canonical product route and public storefront query", () => {
  assert.match(route, /getStorefrontProduct/);
  assert.match(route, /getStorefrontRelatedProducts/);
  assert.doesNotMatch(route, /prisma|@\/lib\/db|repository/);
});

test("product detail keeps the interactive surface client-only", () => {
  assert.match(interactive, /["']use client["']/);
  assert.match(gallery, /["']use client["']/);
  assert.match(options, /["']use client["']/);
  assert.doesNotMatch(detail, /["']use client["']/);
});

test("variant UI is driven by canonical option relationships", () => {
  assert.match(options, /product\.options\.map/);
  assert.match(options, /resolveSelectedVariant/);
  assert.match(options, /aria-pressed/);
  assert.match(options, /disabled={!selectable}/);
  assert.match(options, /selectedVariant\?\.price/);
  assert.match(options, /variant\.media/);
});

test("related products reuse canonical merchandising helpers and exclude the current product", () => {
  assert.match(storefront, /getStorefrontCollectionProducts|collection/);
  assert.match(storefront, /getStorefrontCategoryProducts|category/);
  assert.match(storefront, /sort: "merchandising"/);
  assert.match(storefront, /item\.slug/);
});

test("Product Detail sends only the canonical purchase selection to Cart", () => {
  assert.match(options, /buildPurchaseSelection/);
  assert.match(options, /fetch\("\/api\/cart"/);
  assert.match(options, /method: "POST"/);
  assert.match(options, /productId: string; variantId: string; quantity: number/);
  assert.doesNotMatch(options, /price.*body|body.*price|provider|inventory|subtotal|total/i);
  assert.doesNotMatch(interactive + options + detail, /checkout|payment|createOrder|review|rating/i);
});

test("gallery provides keyboard-operable image controls and meaningful primary alt text", () => {
  assert.match(gallery, /type="button"/);
  assert.match(gallery, /aria-label={"View product image "/);
  assert.match(gallery, /alt={selected\.altText \?\? product\.title}/);
  assert.match(gallery, /aspect-square/);
});
