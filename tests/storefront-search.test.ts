import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import { catalogQueryFromSearchParams } from "@/lib/storefront/query-params";

const root = resolve(process.cwd());
const read = (path: string) => readFileSync(resolve(root, path), "utf8");

test("search route uses the canonical public search service and remains noindex", () => {
  const source = read("app/(storefront)/search/page.tsx");
  assert.match(source, /searchStorefrontProducts/);
  assert.match(source, /noindex/);
  assert.match(source, /alternates:\s*\{\s*canonical:\s*"\/search"/);
  assert.doesNotMatch(source, /Prisma|@\/lib\/db|qikink|printful|printrove|printify/i);
});

test("search input submits the canonical q parameter", () => {
  const source = read("components/storefront/search-input.tsx");
  assert.match(source, /role="search"/);
  assert.match(source, /name="q"/);
  assert.match(source, /method="get"/);
  assert.match(source, /action=\{action\}/);
  assert.match(source, /Search products/);
});

test("search normalization removes control whitespace and repeated spaces", () => {
  const source = read("app/(storefront)/search/page.tsx");
  assert.match(source, /replace\(\/\[\\u0000-\\u001F\\u007F\]\//);
  assert.match(source, /replace\(\/\\s\+\/g, " "\)/);
});

test("search filters preserve q when composing canonical catalog filters", () => {
  const source = read("components/storefront/catalog-filters.tsx");
  assert.match(source, /name="q"/);
  assert.match(source, /preservedParams/);

  const query = catalogQueryFromSearchParams({
    q: "hoodie",
    category: "hoodies",
    sort: "newest",
    page: "2",
  });
  assert.equal(query.category, "hoodies");
  assert.equal(query.sort, "newest");
  assert.equal(query.page, 2);
});

test("search listing reuses Phase 3.4 product grid and pagination", () => {
  const source = read("components/storefront/catalog-listing.tsx");
  assert.match(source, /ProductGrid/);
  assert.match(source, /CatalogPagination/);
  assert.match(source, /searchQuery/);
  assert.match(source, /No results for/);
});

test("search does not introduce an external provider or ranking engine", () => {
  const source = [
    "app/(storefront)/search/page.tsx",
    "components/storefront/search-input.tsx",
    "components/storefront/catalog-listing.tsx",
    "components/storefront/catalog-filters.tsx",
  ].map(read).join("\n");
  assert.doesNotMatch(source, /Algolia|Elasticsearch|OpenSearch|Meilisearch|Typesense|semantic|vector|recommendation engine/i);
  assert.doesNotMatch(source, /provider ===|Qikink|Printful|Printrove|Printify/i);
});

test("search errors render the customer-safe storefront error state", () => {
  const source = read("app/(storefront)/search/page.tsx");
  assert.match(source, /CatalogErrorState/);
  assert.doesNotMatch(source, /stack|DATABASE_URL|PrismaError|console\.error/i);
});
