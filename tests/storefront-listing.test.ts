import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import { catalogQueryFromSearchParams } from "@/lib/storefront/query-params";

const root = resolve(process.cwd());
const read = (path: string) => readFileSync(resolve(root, path), "utf8");

test("Phase 3.4 listing routes use the shared server listing component", () => {
  const routes = [
    "app/(storefront)/shop/page.tsx",
    "app/(storefront)/categories/[slug]/page.tsx",
    "app/(storefront)/collections/[slug]/page.tsx",
  ];

  for (const path of routes) {
    const source = read(path);
    assert.match(source, /CatalogListing/);
    assert.doesNotMatch(source, /findUnique|findFirst|Prisma|@\/lib\/db/);
  }
});

test("listing controls expose only canonical sort values", () => {
  const source = read("components/storefront/catalog-filters.tsx");
  for (const sort of ["newest", "oldest", "price_asc", "price_desc", "title_asc", "title_desc", "updated", "merchandising"]) {
    assert.match(source, new RegExp(sort));
  }
  assert.doesNotMatch(source, /bestSellerScore|trendingScore|popularityRank|recommendation/i);
});

test("listing query normalization rejects malformed URL values instead of forwarding them", () => {
  const result = catalogQueryFromSearchParams({
    category: " T-SHIRTS ",
    collection: "NEW-ARRIVALS",
    minPrice: "899.99",
    maxPrice: "1500.00",
    tags: ["shirts,summer", "shirts"],
    sort: "price_asc",
    page: "2",
  });

  assert.equal(result.category, "t-shirts");
  assert.equal(result.collection, "new-arrivals");
  assert.equal(result.minPrice, "899.99");
  assert.equal(result.maxPrice, "1500.00");
  assert.deepEqual(result.tags, ["shirts", "summer"]);
  assert.equal(result.sort, "price_asc");
  assert.equal(result.page, 2);

  const invalid = catalogQueryFromSearchParams({
    category: "../../internal",
    minPrice: "-1",
    maxPrice: "12.345",
    sort: "not-supported",
    page: "0",
  });
  assert.equal(invalid.category, undefined);
  assert.equal(invalid.minPrice, undefined);
  assert.equal(invalid.maxPrice, undefined);
  assert.equal(invalid.sort, undefined);
  assert.equal(invalid.page, undefined);
});

test("listing UX has an explicit public empty state and accessible pagination", () => {
  const listing = read("components/storefront/catalog-listing.tsx");
  const pagination = read("components/storefront/catalog-pagination.tsx");
  assert.match(listing, /No products found/);
  assert.match(listing, /Shop all/);
  assert.match(listing, /aria-live/);
  assert.match(pagination, /aria-label="Catalog pagination"/);
  assert.match(pagination, /aria-current="page"/);
  assert.match(pagination, /rel="prev"/);
  assert.match(pagination, /rel="next"/);
});

test("listing UI remains provider-neutral and does not expose internal product fields", () => {
  const listing = read("components/storefront/catalog-listing.tsx") + read("components/storefront/catalog-filters.tsx");
  assert.doesNotMatch(listing, /qikink|printful|printrove|printify|provider|sku|onHand|reserved|audit/i);
});
