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
  assert.match(source, /alternates:s*{s*canonical:s*["']/["']/);
  assert.match(source, /robots:s*{s*index:s*true,s*follow:s*true/);
});

test("homepage data uses public catalog services and bounded discovery sets", () => {
  const source = read("lib/storefront/catalog.ts");
  assert.match(source, /export type StorefrontHomeData/);
  assert.match(source, /getStorefrontProducts({ pageSize: 8, sort: "newest" })/);
  assert.match(source, /getStorefrontCollectionProducts/);
  assert.match(source, /pageSize: 4/);
  assert.match(source, /categories.slice(0, 6)/);
  assert.match(source, /collections.slice(0, 3)/);
  assert.doesNotMatch(source, /Prisma|@\/lib\/db|qikink|printful|printrove|printify/i);
});

test("homepage merchandising uses canonical collection ordering", () => {
  const source = read("lib/storefront/catalog.ts");
  assert.match(source, /sort: "merchandising"/);
  assert.match(source, /editorialCollection/);
});

test("homepage sections are conditional and do not manufacture empty catalog content", () => {
  const source = read("components/storefront/homepage.tsx");
  assert.match(source, /if (!products.length) return null/);
  assert.match(source, /if (!categories.length) return null/);
  assert.match(source, /if (!collections.length) return null/);
  assert.match(source, /if (!collection) return null/);
  assert.match(source, /href="\/shop"/);
});

test("homepage preserves canonical category and collection routes", () => {
  const source = read("components/storefront/homepage.tsx");
  assert.match(source, /categoryPath(category)/);
  assert.match(source, /collectionPath(collection)/);
  assert.match(source, /collectionPath(collection)/);
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
  assert.match(money, /amount.trim()/);
  assert.doesNotMatch(money, /parseFloat|parseInt|Number\(/);
});
