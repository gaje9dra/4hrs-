import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const root = resolve(process.cwd());
const read = (path: string) => readFileSync(resolve(root, path), "utf8");

test("homepage is a server-rendered storefront route with SEO metadata", () => {
  const source = read("app/(storefront)/page.tsx");
  assert.doesNotMatch(source, /"use client"/);
  assert.match(source, /getStorefrontHomeCatalogData/);
  assert.match(source, /alternates:\s*\{\s*canonical:\s*["']/);
  assert.match(source, /robots:\s*\{\s*index:\s*true,\s*follow:\s*true/);
});

test("homepage data uses public catalog services and bounded discovery sets", () => {
  const source = read("lib/storefront/catalog.ts");
  assert.match(source, /export type StorefrontHomeData/);
  assert.match(source, /getStorefrontProducts\(\{ pageSize: 8, sort: "newest" \}\)/);
  assert.match(source, /getStorefrontCollectionProducts/);
  assert.match(source, /listActiveCategoriesWithPublishedProducts/);
  assert.match(source, /listActiveCollectionsWithPublishedProducts/);
  assert.match(source, /pageSize: 4/);
  assert.match(source, /categories\.slice\(0, 6\)/);
  assert.match(source, /collections\.slice\(0, 3\)/);
  assert.doesNotMatch(source, /Prisma|@\/lib\/db|qikink|printful|printrove|printify/i);
});

test("homepage merchandising uses canonical collection ordering", () => {
  const source = read("lib/storefront/catalog.ts");
  assert.match(source, /sort: "merchandising"/);
  assert.match(source, /sort: "merchandising"/);
});

test("homepage discovery does not present empty categories or collections as populated", () => {
  const source = read("lib/storefront/catalog.ts");
  assert.match(source, /listActiveCategoriesWithPublishedProducts/);
  assert.match(source, /listActiveCollectionsWithPublishedProducts/);
});

test("homepage sections are conditional and do not manufacture empty catalog content", () => {
  const source = read("components/storefront/homepage.tsx");
  assert.match(source, /if \(!products\.length\) return null/);
  assert.match(source, /if \(!categories\.length\) return null/);
  assert.match(source, /if \(!collections\.length\) return null/);
  assert.match(source, /if \(!collection\) return null/);
  assert.match(source, /href="\/shop"/);
  assert.match(source, /title="Curated picks"/);
  assert.doesNotMatch(source, /customer count|reviews?|bestseller|trending|fake/i);
});

test("homepage preserves canonical category and collection routes", () => {
  const source = read("components/storefront/homepage.tsx");
  assert.match(source, /categoryPath\(category\)/);
  assert.match(source, /collectionPath\(collection\)/);
});

test("homepage stays within the public storefront boundary", () => {
  const source = read("components/storefront/homepage.tsx");
  assert.doesNotMatch(source, /Prisma|DATABASE_URL|provider|qikink|printful|printrove|printify/i);
  assert.doesNotMatch(source, /cart|checkout|wishlist|coupon|recommendation|trending|bestseller/i);
});

test("product card uses canonical money representation without UI arithmetic", () => {
  const card = read("components/storefront/product-card.tsx");
  const money = read("lib/storefront/money.ts");
  assert.match(card, /formatCatalogMoney/);
  assert.match(money, /amount\.trim\(\)/);
  assert.doesNotMatch(money, /parseFloat|parseInt|Number\(/);
});

test("homepage imagery uses the framework image component", () => {
  const homepage = read("components/storefront/homepage.tsx");
  const card = read("components/storefront/product-card.tsx");
  assert.match(homepage, /import Image from "next\/image"/);
  assert.match(homepage, /<Image[\s\S]*priority/);
  assert.match(card, /import Image from "next\/image"/);
  assert.match(card, /<Image[\s\S]*fill/);
});


test("populated discovery methods reuse the canonical published-product predicate", () => {
  const repository = read("lib/catalog/repository.ts");
  assert.match(repository, /listActiveCategoriesWithPublishedProducts[\s\S]*products:\s*\{\s*some:\s*\{\s*product:\s*publishedProductWhere/);
  assert.match(repository, /listActiveCollectionsWithPublishedProducts[\s\S]*products:\s*\{\s*some:\s*\{\s*product:\s*publishedProductWhere/);
});

test("homepage editorial copy never fabricates collection content", () => {
  const source = read("components/storefront/homepage.tsx");
  assert.doesNotMatch(source, /A live collection from the 4HRS catalog/);
  assert.match(source, /title="Curated picks"/);
});


test("homepage conversion flow uses one primary shopping destination and clear section hierarchy", () => {
  const source = read("components/storefront/homepage.tsx");
  assert.match(source, /href="\/shop"/);
  assert.match(source, /Shop the catalog/);
  assert.match(source, /Browse all products/);
  assert.match(source, /Shop all/);
  assert.match(source, /Shop by category/);
  assert.match(source, /New arrivals/);
  assert.match(source, /Shop the collections/);
  assert.match(source, /BrandValue/);
  assert.doesNotMatch(source, /function EditorialBlock/);
});

test("homepage section headings expose their labelled-by targets", () => {
  const source = read("components/storefront/homepage.tsx");
  const heading = read("components/ui/section-heading.tsx");
  assert.match(heading, /id\?\: string/);
  assert.match(heading, /<h2 id=\{id\}/);
  assert.match(source, /aria-labelledby="curated-products-title"/);
  assert.match(source, /aria-labelledby="category-title"/);
  assert.match(source, /aria-labelledby="new-arrivals-title"/);
  assert.match(source, /aria-labelledby="collection-title"/);
});

test("product cards remain reusable and use nested heading level", () => {
  const source = read("components/storefront/product-card.tsx");
  assert.match(source, /<h3 className="text-xl/);
  assert.doesNotMatch(source, /<h2 className="text-xl/);
});

test("homepage visual polish keeps shared presentation primitives and bounded media", () => {
  const homepage = read("components/storefront/homepage.tsx");
  const card = read("components/storefront/product-card.tsx");
  assert.match(homepage, /<Card key=\{category\.id\}/);
  assert.match(homepage, /shadow-hard-(sm|md|lg)/);
  assert.match(homepage, /bg-primary-(red|blue|yellow)/);
  assert.doesNotMatch(homepage, /bg-gradient|backdrop-blur|bg-white\/\d|shadow-(sm|md|lg)(?!-hard)/);
  assert.doesNotMatch(homepage, /rounded-(sm|md|lg|xl|2xl|3xl)/);
  assert.match(homepage, /overflow-hidden/);
  assert.match(card, /loading="lazy"/);
  assert.match(card, /max-width: 1535px/);
});

test("homepage does not introduce unsupported benefits or provider-specific commerce claims", () => {
  const source = read("components/storefront/homepage.tsx");
  assert.doesNotMatch(source, /free shipping|lifetime warranty|fastest delivery|100% satisfaction|premium quality/i);
  assert.doesNotMatch(source, /Qikink|Printful|Printrove|Printify|supplier|provider/i);
});
