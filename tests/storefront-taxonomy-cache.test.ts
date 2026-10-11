import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

test("storefront taxonomy reads use a short-lived shared Next.js data cache", () => {
  const source = read("lib/storefront/catalog.ts");
  assert.match(source, /import \{ unstable_cache \} from "next\/cache"/);
  assert.equal((source.match(/revalidate: 30, tags: \["storefront-taxonomy"\]/g) ?? []).length, 5);
  assert.match(source, /getActiveCategories = unstable_cache/);
  assert.match(source, /getActiveCategoriesWithPublishedProducts = unstable_cache/);
  assert.match(source, /getActiveCollections = unstable_cache/);
  assert.match(source, /getActiveCollectionsWithPublishedProducts = unstable_cache/);
  assert.match(source, /getActiveTags = unstable_cache/);
});

test("shared navigation reuses cached taxonomy reads instead of querying categories and collections independently", () => {
  const source = read("lib/storefront/navigation.ts");
  assert.match(source, /getStorefrontNavigationTaxonomy/);
  assert.doesNotMatch(source, /createCatalogQueryService|catalog\.listActiveCategories|catalog\.listActiveCollections/);
});
