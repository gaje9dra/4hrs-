import test from "node:test";
import assert from "node:assert/strict";
import { buildCatalogFilterHref, buildCatalogHref, catalogQueryFromSearchParams } from "../lib/storefront/query-params.ts";

test("shop query parsing normalizes canonical filter values", () => {
  assert.deepEqual(catalogQueryFromSearchParams({ category: " T-SHIRTS ", tags: ["streetwear,graphic", "streetwear"], tagMode: "OR", minPrice: "800", maxPrice: "1000.5", inStock: "true", sort: "price_desc", page: "2", pageSize: "48" }), {
    category: "t-shirts", collection: undefined, tags: ["graphic", "streetwear"], tagMode: "OR", minPrice: "800.00", maxPrice: "1000.50", inStock: true, sort: "price_desc", page: 2, pageSize: 48,
  });
});

test("shop query parsing rejects malformed recognized parameters", () => {
  assert.throws(() => catalogQueryFromSearchParams({ sort: "popular" }), /Invalid catalog query parameter: sort/);
  assert.throws(() => catalogQueryFromSearchParams({ page: "0" }), /Invalid catalog query parameter: page/);
  assert.throws(() => catalogQueryFromSearchParams({ minPrice: "10.999" }), /Invalid catalog query parameter: minPrice/);
});

test("shop URLs are canonical and remove redundant defaults", () => {
  assert.equal(buildCatalogHref("/shop", { sort: "newest", tagMode: "AND", inStock: "false", page: "1", pageSize: "24", tags: ["streetwear,graphic"], unknown: "ignored" }, 1), "/shop?tags=graphic%2Cstreetwear");
  assert.equal(buildCatalogHref("/shop", { category: "t-shirts", sort: "price_desc", inStock: "true" }, 3), "/shop?category=t-shirts&inStock=true&sort=price_desc&page=3");
});

test("search pagination preserves the search term", () => {
  assert.equal(buildCatalogHref("/search", { q: "  oversized   tee  ", sort: "newest" }, 2), "/search?q=oversized+tee&page=2");
});

test("filter hrefs reset pagination and ignore unsupported parameters", () => {
  assert.equal(buildCatalogFilterHref("/shop", { category: "t-shirts", page: "9", sort: "newest", debug: "1" }), "/shop?category=t-shirts");
});

test("catalog URL state sorts repeated tag values and removes unused tag mode", () => {
  assert.deepEqual(catalogQueryFromSearchParams({ tags: ["streetwear", "graphic", "streetwear"], tagMode: "OR" }), {
    category: undefined,
    collection: undefined,
    tags: ["graphic", "streetwear"],
    tagMode: "OR",
    minPrice: undefined,
    maxPrice: undefined,
    inStock: false,
    sort: undefined,
    page: undefined,
    pageSize: undefined,
  });
  assert.equal(buildCatalogHref("/shop", { tags: ["streetwear", "graphic"], tagMode: "AND" }, 1), "/shop?tags=graphic%2Cstreetwear");
});

test("catalog URL state rejects page numbers outside the bounded range", () => {
  assert.throws(() => catalogQueryFromSearchParams({ page: "10001" }), /Invalid catalog query parameter: page/);
});

test("filter URLs preserve search context while resetting pagination", () => {
  assert.equal(
    buildCatalogFilterHref("/search", { q: "  oversized   tee  ", tags: ["streetwear"], page: "8" }),
    "/search?q=oversized+tee&tags=streetwear",
  );
});


test("catalog filter URLs remain bounded to the shared tag contract", () => {
  assert.throws(
    () => catalogQueryFromSearchParams({
      tags: Array.from({ length: 21 }, (_, index) => "tag-" + index),
    }),
    /Invalid catalog query parameter: tags/,
  );
});


test("catalog URL state rejects page sizes above the shared maximum", () => {
  assert.throws(
    () => catalogQueryFromSearchParams({ pageSize: "101" }),
    /Invalid catalog query parameter: pageSize/,
  );
  assert.deepEqual(catalogQueryFromSearchParams({ pageSize: "100" }).pageSize, 100);
});
