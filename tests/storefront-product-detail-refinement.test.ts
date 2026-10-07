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
  assert.match(options, /purchaseIntentState|buildPurchaseSelection/);
});

test("variant engine is dynamic, canonical, deterministic and rejects unavailable combinations", () => {
  assert.match(options, /product\.options\.map/);
  assert.match(options, /resolveSelectedVariant/);
  assert.match(options, /selectionFromVariant/);
  assert.match(options, /getDeterministicInitialVariant/);
  assert.match(options, /availability\.state === "OUT_OF_STOCK"/);
  assert.match(options, /aria-pressed/);
  assert.match(options, /aria-disabled/);
  assert.match(options, /disabled={!selectable}/);
  assert.match(options, /selectedVariant\?\.price/);
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
  assert.match(detail, /collectionPath\(collectionContext\)/);
  assert.match(detail, /categoryPath\(categoryContext\)/);
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
  assert.match(storefront, /new Set<string>\(\[product\.slug\]\)/);
  assert.match(storefront, /if \(seen\.has\(item\.slug\)\)/);
  assert.match(storefront, /related\.length === 4/);
});

test("Cart integration remains createOrder|wishlist|review|rating|qikink|createOrder|qikink|provider-neutral and excludes downstream commerce", () => {
  const source = route + detail + interactive + sections + options + gallery;
  assert.match(options, /fetch\("\/api\/cart"/);
  assert.match(options, /buildPurchaseSelection/);
  assert.doesNotMatch(source, /createOrder|checkout|payment|wishlist|review|rating|qikink|createOrder|wishlist|review|rating|qikink|createOrder|qikink|provider/i);
});

test("public storefront DTO strips internal variant availability quantities", () => {
  assert.match(storefront, /availability: \{ state: product\.availability\.state \}/);
  assert.match(storefront, /availability: \{ state: variant\.availability\.state \}/);
  assert.doesNotMatch(storefront, /availableQuantity/);
});


test("published lifecycle permits valid active products without optional media or variants", () => {
  const publishedWhere = repository.match(/const publishedProductWhere: Prisma\.ProductWhereInput = \{[\s\S]*?\n\};/)?.[0] ?? "";
  assert.match(publishedWhere, /const publishedProductWhere/);
  assert.doesNotMatch(publishedWhere, /variants:\s*\{\s*some:/);
  assert.doesNotMatch(publishedWhere, /images:\s*\{\s*some:/);
  assert.match(publishedWhere, /status: "ACTIVE"/);
  assert.match(publishedWhere, /price: \{ gte: new Prisma\.Decimal\(0\) \}/);
});

test("compare-at pricing is sanitized against each effective selling price at the server boundary", () => {
  assert.match(query, /function formatValidCompareAtPrice/);
  assert.match(query, /compareAt\.gte\(selling\)/);
  assert.match(query, /formatValidCompareAtPrice\(effectivePrice, variant\.compareAtPrice\)/);
  assert.match(query, /formatValidCompareAtPrice\(effectivePrice, product\.compareAtPrice\)/);
});


test("PDP uses canonical breadcrumb helpers and deduplicates route loading", () => {
  assert.match(detail, /categoryPath/);
  assert.match(detail, /collectionPath/);
  assert.match(route, /cache\(async/);
  assert.match(route, /loadProductForRequest/);
});

test("invalid product slugs resolve through not-found behavior", () => {
  assert.match(route, /error\.code === "PRODUCT_NOT_FOUND" \|\| error\.code === "INVALID_QUERY"/);
});

test("Phase 7.2 centralizes variant resolution and rejects ambiguous or incomplete matrices", () => {
  const selection = readFileSync("lib/storefront/variant-selection.ts", "utf8");
  assert.match(selection, /resolveSelectedVariant/);
  assert.match(selection, /isVariantValueSelectable/);
  assert.match(selection, /selectionFromVariant/);
  assert.match(query, /validateVariantMatrix/);
  assert.match(query, /duplicate variant option combinations/i);
  assert.match(query, /seenOptionTypes/);
  assert.match(query, /seenCombinations/);
  assert.doesNotMatch(options, /function optionValueId|function matchesSelection|function isSelectable|function initialSelection/);
});

test("Phase 8.5 keeps the Cart handoff createOrder|wishlist|review|rating|qikink|createOrder|qikink|provider-neutral and server-authoritative", () => {
  assert.match(options, /fetch\("\/api\/cart"/);
  assert.doesNotMatch(options + interactive, /createOrder|checkout|payment|qikink|createOrder|wishlist|review|rating|qikink|createOrder|qikink|provider/i);
  assert.match(storefront, /variants: product\.variants\.map/);
  assert.match(storefront, /availability: \{ state: variant\.availability\.state \}/);
});


test("Phase 7.3 purchase intent remains the canonical pre-Cart selection contract", () => {
  const selection = readFileSync("lib/storefront/variant-selection.ts", "utf8");
  assert.match(selection, /PurchaseSelection/);
  assert.match(selection, /PurchaseIntentState/);
  assert.match(selection, /getPurchaseIntentState/);
  assert.match(selection, /buildPurchaseSelection/);
  assert.match(selection, /quantity: 1/);
  assert.doesNotMatch(selection, /createOrder|checkout|payment|persistCart/i);
  assert.match(options, /purchaseIntentState|buildPurchaseSelection/);
  assert.match(options, /purchaseIntentState|Selection is ready to add to Cart/);
  assert.match(options, /MISSING_REQUIRED_SELECTION|Select every required option/);
  assert.match(options, /INVALID_SELECTION|selected option combination is not valid/);
  assert.match(options, /UNAVAILABLE|option combination is currently unavailable/);
});

test("Phase 8.5 keeps purchase intent canonical and createOrder|wishlist|review|rating|qikink|createOrder|qikink|provider-neutral", () => {
  assert.match(options, /buildPurchaseSelection/);
  assert.match(options, /fetch\("\/api\/cart"/);
  assert.doesNotMatch(options + interactive, /createOrder|checkout|payment|qikink|createOrder|wishlist|review|rating|qikink|createOrder|qikink|provider/i);
  assert.match(storefront, /availability: \{ state: variant\.availability\.state \}/);
});

test("Phase 7.3 does not add a quantity UI", () => {
  assert.doesNotMatch(options, /<input[^>]+quantity|name="quantity"|Quantity/);
  assert.doesNotMatch(interactive, /<input[^>]+quantity|name="quantity"|Quantity/);
});


test("Phase 7.4 rejects malformed or cross-option selection state before purchase handoff", () => {
  const selection = readFileSync("lib/storefront/variant-selection.ts", "utf8");
  assert.match(selection, /!optionIds\.has\(optionTypeId\)/);
  assert.match(selection, /typeof valueId !== "string"/);
  assert.match(selection, /valueId\.length === 0/);
  assert.match(selection, /resolveSelectedVariant/);
});

test("Phase 8.5 connects the purchase CTA only through the Cart API", () => {
  assert.match(options, /Add to cart/);
  assert.match(options, /method: "POST"/);
  assert.match(options, /\/api\/cart/);
  assert.doesNotMatch(options, /Order created|Payment successful|Reserved/i);
});


test("Phase 7.5 keeps PDP detail navigation on canonical singular catalog routes", () => {
  assert.match(sections, /import \{ categoryPath, collectionPath \} from "@\/lib\/catalog\/routes"/);
  assert.match(sections, /href=\{categoryPath\(category\)\}/);
  assert.match(sections, /href=\{collectionPath\(collection\)\}/);
  assert.doesNotMatch(sections, /href=\{["']\/categories\//);
  assert.doesNotMatch(sections, /href=\{["']\/collections\//);
});

test("Phase 7.5 distinguishes product-level unavailability before purchase handoff", () => {
  const selection = readFileSync("lib/storefront/variant-selection.ts", "utf8");
  assert.match(selection, /"PRODUCT_UNAVAILABLE"/);
  assert.match(selection, /product\.availability\.state === "OUT_OF_STOCK"/);
});

test("Phase 7.5 purchase contract remains minimal and createOrder|wishlist|review|rating|qikink|createOrder|qikink|provider-neutral", () => {
  const selection = readFileSync("lib/storefront/variant-selection.ts", "utf8");
  assert.match(selection, /productId: product\.id/);
  assert.match(selection, /variantId: variant\.id/);
  assert.match(selection, /quantity: 1/);
  assert.doesNotMatch(selection, /price|currency|sku|shipping|payment|createOrder|wishlist|review|rating|qikink|createOrder|qikink|provider|qikink/i);
});

test("Phase 8.5 does not introduce downstream commerce or inventory reservation", () => {
  const source = route + detail + interactive + sections + options + gallery;
  assert.match(source, /fetch\("\/api\/cart"/);
  assert.doesNotMatch(source, /createOrder|checkout|payment|persistCart|createOrder|persistCart|reserveInventory/i);
});
