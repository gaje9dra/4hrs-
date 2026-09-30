import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const detail = readFileSync("components/storefront/product-detail.tsx", "utf8");
const sections = readFileSync("components/storefront/product-detail-sections.tsx", "utf8");
const options = readFileSync("components/storefront/product-options.tsx", "utf8");
const gallery = readFileSync("components/storefront/product-gallery.tsx", "utf8");
const storefront = readFileSync("lib/storefront/catalog.ts", "utf8");

test("Phase 3.7 reuses the product detail architecture and existing Accordion", () => {
  assert.match(detail, /ProductDetailInteractive/);
  assert.match(detail, /ProductDetailSections/);
  assert.match(sections, /AccordionItem/);
  assert.doesNotMatch(sections, /Accordion.*from ["'].*accordion.*library/i);
});

test("product detail only renders structured sections from canonical public fields", () => {
  assert.match(sections, /product\.description/);
  assert.match(sections, /product\.categories/);
  assert.match(sections, /product\.collections/);
  assert.match(sections, /product\.tags/);
  assert.doesNotMatch(sections, /Materials|Fit|Care|Delivery times|Return policy|Sustainability/i);
});

test("variant states expose explicit semantic selection and unavailable state", () => {
  assert.match(options, /aria-pressed={selected}/);
  assert.match(options, /disabled={!selectable}/);
  assert.match(options, /This option combination is currently unavailable/);
});

test("related product discovery is bounded, deterministic, and deduplicated", () => {
  assert.match(storefront, /pageSize: 8/);
  assert.match(storefront, /new Set/);
  assert.match(storefront, /item\.id !== product\.id/);
});

test("PDP contains no commerce transaction implementation", () => {
  const source = detail + sections + options + gallery;
  assert.doesNotMatch(source, /addToCart|createOrder|checkout|payment|wishlist|review|rating/i);
});
