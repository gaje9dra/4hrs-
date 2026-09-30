import test from "node:test";
import assert from "node:assert/strict";
import { buildCatalogFilterHref, buildCatalogHref, catalogQueryFromSearchParams } from "../lib/storefront/query-params.ts";

test("shop query parsing normalizes canonical filter values", () => {
  assert.deepEqual(catalogQueryFromSearchParams({ category: " T-SHIRTS ", tags: ["streetwear,graphic", "streetwear"], tagMode: "OR", minPrice: "800", maxPrice: "1000.5", inStock: "true", sort: "price_desc", page: "2", pageSize: "48" }), {
    category: "t-shirts", collection: undefined, tags: ["streetwear", "graphic"], tagMode: "OR", minPrice: "800.00", maxPrice: "1000.50", inStock: true, sort: "price_desc", page: 2, pageSize: 48,
  });
});

test("shop query parsing rejects malformed recognized parameters", () => {
  assert.throws(() => catalogQueryFromSearchParams({ sort: "popular" }), /Invalid catalog query parameter: sort/);
  assert.throws(() => catalogQueryFromSearchParams({ page: "0" }), /Invalid catalog query parameter: page/);
  assert.throws(() => catalogQueryFromSearchParams({ minPrice: "10.999" }), /Invalid catalog query parameter: minPrice/);
});

test("shop URLs are canonical and remove redundant defaults", () => {
  assert.equal(buildCatalogHref("/shop", { sort: "newest", tagMode: "AND", inStock: "false", page: "1", pageSize: "24", tags: ["streetwear,graphic"], unknown: "ignored" }, 1), "/shop?tags=streetwear%2Cgraphic");
  assert.equal(buildCatalogHref("/shop", { category: "t-shirts", sort: "price_desc", inStock: "true" }, 3), "/shop?category=t-shirts&inStock=true&sort=price_desc&page=3");
});

test("search pagination preserves the search term", () => {
  assert.equal(buildCatalogHref("/search", { q: "  oversized   tee  ", sort: "newest" }, 2), "/search?q=oversized+tee&page=2");
});
\ntest("filter hrefs reset pagination and ignore unsupported parameters", () => {
  assert.equal(buildCatalogFilterHref("/shop", { category: "t-shirts", page: "9", sort: "newest", debug: "1" }), "/shop?category=t-shirts");
});