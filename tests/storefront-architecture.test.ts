import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import { catalogQueryFromSearchParams } from "@/lib/storefront/query-params";

const root = resolve(process.cwd());
const read = (path: string) => readFileSync(resolve(root, path), "utf8");

test("storefront route foundation exists", () => {
  for (const path of [
    "app/(storefront)/page.tsx",
    "app/(storefront)/shop/page.tsx",
    "app/(storefront)/category/[slug]/page.tsx",
    "app/(storefront)/collection/[slug]/page.tsx",
    "app/(storefront)/product/[slug]/page.tsx",
    "app/(storefront)/search/page.tsx",
    "app/(storefront)/loading.tsx",
    "app/(storefront)/error.tsx",
    "app/(storefront)/not-found.tsx",
  ]) assert.ok(read(path).length > 0, path + " should exist");
});

test("storefront routes do not access Prisma or providers directly", () => {
  const routePaths = [
    "app/(storefront)/shop/page.tsx",
    "app/(storefront)/category/[slug]/page.tsx",
    "app/(storefront)/collection/[slug]/page.tsx",
    "app/(storefront)/product/[slug]/page.tsx",
    "app/(storefront)/search/page.tsx",
  ];
  for (const path of routePaths) {
    const source = read(path);
    assert.equal(/from ["']@\/lib\/db\//.test(source), false, path);
    assert.equal(/from ["']@\/prisma\//.test(source), false, path);
    assert.equal(/qikink|printful|printrove|printify/i.test(source), false, path);
  }
});

test("public repository visibility requires an active product, active variant and product media", () => {
  const source = read("lib/catalog/repository.ts");
  assert.match(source, /status:\s*"ACTIVE"/);
  assert.match(source, /variants:\s*\{\s*some:\s*\{[\s\S]*status:\s*"ACTIVE"/);
  assert.match(source, /images:\s*\{/);
  assert.match(source, /mediaType:\s*true/);
});

test("product detail uses the public catalog query service", () => {
  const source = read("app/(storefront)/product/[slug]/page.tsx");
  assert.match(source, /getStorefrontProduct/);
  assert.match(source, /getPublicProductSeoMetadata/);
  assert.doesNotMatch(source, /getProductById|findUnique|findFirst|Prisma/);
});

test("category and collection routes preserve canonical merchandising semantics", () => {
  assert.match(read("lib/storefront/catalog.ts"), /sort: query\.sort \?\? "merchandising"/g);
  assert.match(read("app/(storefront)/category/[slug]/page.tsx"), /getStorefrontCategoryProducts/);
  assert.match(read("app/(storefront)/collection/[slug]/page.tsx"), /getStorefrontCollectionProducts/);
});

test("search is explicitly noindex and uses the public search adapter", () => {
  const source = read("app/(storefront)/search/page.tsx");
  assert.match(source, /noindex|index:\s*false/);
  assert.match(source, /searchStorefrontProducts/);
  assert.match(read("lib/storefront/catalog.ts"), /search\.searchPublic/);
});

test("public storefront DTO boundary excludes internal inventory and SKU fields", () => {
  const source = read("lib/storefront/catalog.ts");
  assert.doesNotMatch(source, /onHand|reserved|audit|provider|sku/i);
  const detail = read("lib/catalog/query.ts");
  const typeStart = detail.indexOf("export type PublishedProductDetailResult");
  const typeEnd = detail.indexOf("\n};", typeStart);
  const detailType = detail.slice(typeStart, typeEnd + 3);
  assert.match(detailType, /PublishedProductDetailResult/);
  assert.doesNotMatch(detailType, /sku:/);
});

test("query parameters normalize pagination, tags and allowlisted sorting", () => {
  const result = catalogQueryFromSearchParams({
    page: "3",
    pageSize: "48",
    tags: "shirts, summer,shirts",
    tagMode: "OR",
    sort: "price_asc",
    inStock: "true",
  });
  assert.equal(result.page, 3);
  assert.equal(result.pageSize, 48);
  assert.deepEqual(result.tags, ["shirts", "summer"]);
  assert.equal(result.tagMode, "OR");
  assert.equal(result.sort, "price_asc");
  assert.equal(result.inStock, true);
});

test("SEO pages use canonical Phase 2 helpers", () => {
  assert.match(read("app/(storefront)/product/[slug]/page.tsx"), /getPublicProductSeoMetadata/);
  assert.match(read("app/(storefront)/category/[slug]/page.tsx"), /getPublicCategorySeoMetadata/);
  assert.match(read("app/(storefront)/collection/[slug]/page.tsx"), /getPublicCollectionSeoMetadata/);
  assert.match(read("lib/catalog/routes.ts"), /productCanonicalUrl|categoryCanonicalUrl|collectionCanonicalUrl/);
});

test("safe error and not-found boundaries avoid raw internal errors", () => {
  const error = read("app/(storefront)/error.tsx");
  const notFound = read("app/(storefront)/not-found.tsx");
  assert.doesNotMatch(error, /console\.error|stack|DATABASE_URL|Prisma/);
  assert.doesNotMatch(notFound, /Prisma|database|SQL|stack/i);
  assert.match(read("components/storefront/catalog-error.tsx"), /Please try again in a moment/);
});
