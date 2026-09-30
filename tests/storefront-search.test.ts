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
  assert.match(source, /generateMetadata/);
  assert.match(source, /robots:\s*\{\s*index:\s*false,\s*follow:\s*true\s*\}/);
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


test("search URL state uses the canonical bounded q normalization", async () => {
  const { buildCatalogHref } = await import("../lib/storefront/query-params.ts");
  assert.equal(
    buildCatalogHref("/search", { q: "  Oversized   Graphic  " }, 1),
    "/search?q=oversized+graphic",
  );
  assert.throws(
    () => buildCatalogHref("/search", { q: "x".repeat(101) }, 1),
    /Search query cannot exceed 100 characters/,
  );
});


test("search canonicalization preserves explicit newest because it differs from relevance", async () => {
  const { buildCatalogHref, buildCatalogFilterHref } = await import("../lib/storefront/query-params.ts");

  assert.equal(
    buildCatalogHref("/search", { q: "hoodie" }, 1),
    "/search?q=hoodie",
  );
  assert.equal(
    buildCatalogHref("/search", { q: "hoodie", sort: "newest" }, 1),
    "/search?q=hoodie&sort=newest",
  );
  assert.equal(
    buildCatalogFilterHref("/search", { q: "hoodie", sort: "newest" }),
    "/search?q=hoodie&sort=newest",
  );
  assert.equal(
    buildCatalogHref("/shop", { sort: "newest" }, 1),
    "/shop",
  );
});

test("search metadata is server-generated, query-derived, and noindex", () => {
  const source = read("app/(storefront)/search/page.tsx");
  assert.match(source, /export async function generateMetadata/);
  assert.match(source, /normalizeCatalogSearchQueryParameter/);
  assert.match(source, /robots:\s*\{\s*index:\s*false,\s*follow:\s*true\s*\}/);
  assert.match(source, /alternates:\s*\{\s*canonical\s*\}/);
  assert.match(source, /slice\(0, 80\)/);
  assert.doesNotMatch(source, /dangerouslySetInnerHTML/);
});

test("search SEO does not add a sitemap or structured-data payload", () => {
  const source = read("app/(storefront)/search/page.tsx");
  assert.doesNotMatch(source, /application\/ld\+json|itemListElement|AggregateRating|Review/);
});


test("empty search metadata canonicalizes to the landing URL even with unused catalog state", () => {
  const source = read("app/(storefront)/search/page.tsx");
  assert.match(source, /const canonical = normalizedQuery\s*\?/);
  assert.match(source, /: "\/search";/);
});
