import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const route = readFileSync("app/(storefront)/product/[slug]/page.tsx", "utf8");
const detail = readFileSync("components/storefront/product-detail.tsx", "utf8");
const interactive = readFileSync("components/storefront/product-detail-interactive.tsx", "utf8");
const sections = readFileSync("components/storefront/product-detail-sections.tsx", "utf8");
const options = readFileSync("components/storefront/product-options.tsx", "utf8");
const gallery = readFileSync("components/storefront/product-gallery.tsx", "utf8");
const storefront = readFileSync("lib/storefront/catalog.ts", "utf8");
const query = readFileSync("lib/catalog/query.ts", "utf8");
const repository = readFileSync("lib/catalog/repository.ts", "utf8");

test("PDP keeps server-first architecture and canonical public query boundaries", () => {
  assert.doesNotMatch(route, /prisma|@\/lib\/db|repository/);
  assert.match(route, /getStorefrontProduct/);
  assert.match(route, /getStorefrontRelatedProducts/);
  assert.match(detail, /ProductDetailInteractive/);
  assert.doesNotMatch(detail, /'use client'/);
});

test("product hierarchy contains breadcrumb, H1, description, price, availability, options and future CTA", () => {
  assert.match(detail, /aria-label="Breadcrumb"/);
  assert.match(interactive, /<h1 id="product-title"/);
  assert.match(interactive, /product\.shortDescription/);
  assert.match(options, /formatCatalogMoney\(effectivePrice/);
  assert.match(options, /compareAtPrice/);
  assert.match(interactive, /availabilityLabel/);
  assert.match(interactive, /aria-label=\{product\.options\.length \? undefined : "Product pricing and availability"\}/);
  assert.match(options, /Purchase actions coming soon/);
});

test("variant engine is dynamic, canonical, deterministic and rejects unavailable combinations", () => {
  assert.match(options, /product\.options\.map/);
  assert.match(options, /optionValueId/);
  assert.match(options, /initialSelection/);
  assert.match(options, /variant\.availability\.state !== "OUT_OF_STOCK"/);
  assert.match(options, /aria-pressed/);
  assert.match(options, /aria-disabled/);
  assert.match(options, /disabled={!selectable}/);
  assert.match(options, /variant\.price/);
  assert.match(options, /variant\.media/);
});

test("gallery supports one/many/no images and broken-image fallback without fake imagery", () => {
  assert.match(gallery, /if \(!media\.length \|\| !selected \|\| selectedFailed\)/);
  assert.match(gallery, /onError=\{\(\) => markFailed/);
  assert.match(gallery, /aspect-\[4\/5\]/);
  assert.match(gallery, /alt=\{selected\.altText \?\? product\.title\}/);
  assert.match(gallery, /type="button"/);
});

test("breadcrumbs use canonical collection/category/product relationships and no IDs", () => {
  assert.match(detail, /\/collections\/.*collectionContext\.slug/);
  assert.match(detail, /\/categories\/.*categoryContext\.slug/);
  assert.doesNotMatch(detail, /collectionContext\.id|categoryContext\.id/);
});

test("detail sections render only canonical fields and reuse Accordion", () => {
  assert.match(sections, /AccordionItem/);
  assert.match(sections, /product\.description/);
  assert.match(sections, /product\.categories/);
  assert.match(sections, /product\.collections/);
  assert.match(sections, /product\.tags/);
  assert.doesNotMatch(sections, /Materials|Fit|Care|Shipping|Returns|Sustainability/i);
});

test("related products are bounded, deterministic, deduplicated and self-excluding", () => {
  assert.match(storefront, /pageSize: 8/);
  assert.match(storefront, /sort: "merchandising"/);
  assert.match(storefront, /new Set<string>\(\[product\.id\]\)/);
  assert.match(storefront, /if \(seen\.has\(item\.id\)\)/);
  assert.match(storefront, /related\.length === 4/);
});

test("commerce, reviews and provider-specific purchasing logic remain absent", () => {
  const source = route + detail + interactive + sections + options + gallery;
  assert.doesNotMatch(source, /addToCart|createOrder|checkout|payment|wishlist|review|rating|qikink|provider/i);
});

test("public storefront DTO strips internal variant availability quantities", () => {
  assert.match(storefront, /availability: \{ state: product\.availability\.state \}/);
  assert.match(storefront, /availability: \{ state: variant\.availability\.state \}/);
  assert.doesNotMatch(storefront, /availableQuantity/);
});


test("published lifecycle permits valid active products without optional media or variants", () => {
  assert.match(repository, /const publishedProductWhere/);
  assert.doesNotMatch(repository, /publishedProductWhere[\\s\\S]*variants:\\s*\\{\\s*some:/);
  assert.doesNotMatch(repository, /publishedProductWhere[\\s\\S]*images:\\s*\\{\\s*some:/);
  assert.match(repository, /status: "ACTIVE"/);
  assert.match(repository, /price: \{ gte: new Prisma\.Decimal\(0\) \}/);
});

test("compare-at pricing is sanitized against each effective selling price at the server boundary", () => {
  assert.match(query, /function formatValidCompareAtPrice/);
  assert.match(query, /compareAt\.gte\(selling\)/);
  assert.match(query, /formatValidCompareAtPrice\(effectivePrice, variant\.compareAtPrice\)/);
  assert.match(query, /formatValidCompareAtPrice\(effectivePrice, product\.compareAtPrice\)/);
});
