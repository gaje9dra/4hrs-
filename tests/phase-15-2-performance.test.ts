import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";

test("Phase 15.2 keeps public catalog listing projections bounded to card requirements", async () => {
  const source = await fs.readFile("lib/catalog/repository.ts", "utf8");
  const start = source.indexOf("const publicCatalogListSelect = {");
  const end = source.indexOf("} satisfies Prisma.ProductSelect;", start);
  assert.ok(start >= 0 && end > start, "public catalog list projection must remain explicit");

  const projection = source.slice(start, end);
  assert.doesNotMatch(projection, /take: 1/);
  assert.match(projection, /images:\s*\{/);
  assert.match(projection, /orderBy: \[\{ isPrimary: "desc" as const \}, \{ sortOrder: "asc" as const \}, \{ id: "asc" as const \}\]/);
  assert.match(projection, /inventory:/);
  assert.doesNotMatch(projection, /optionValues/);
  assert.doesNotMatch(projection, /categories:/);
  assert.doesNotMatch(projection, /collections:/);
  assert.doesNotMatch(projection, /tags:/);
  assert.doesNotMatch(projection, /createdAt: true/);
  assert.doesNotMatch(projection, /updatedAt: true/);
});

test("Phase 15.2 preserves storefront image loading priorities", async () => {
  const [card, homeHero] = await Promise.all([
    fs.readFile("components/storefront/product-card.tsx", "utf8"),
    fs.readFile("components/storefront/homepage-product-hero-carousel.tsx", "utf8"),
  ]);
  assert.match(card, /loading="lazy"/);
  assert.match(card, /sizes=/);
  assert.match(homeHero, /priority=/);
  assert.match(homeHero, /sizes=/);
});

test("Phase 15.2 keeps catalog pagination bounded", async () => {
  const source = await fs.readFile("lib/catalog/query.ts", "utf8");
  assert.match(source, /CATALOG_QUERY_PAGE_MAX = 100/);
  assert.match(source, /CATALOG_QUERY_PAGE_NUMBER_MAX = 10000/);
  assert.match(source, /normalizePageSize/);
  assert.match(source, /normalizePage/);
});

test("Phase 15.2 keeps provider APIs outside storefront catalog reads", async () => {
  const source = await fs.readFile("lib/storefront/catalog.ts", "utf8");
  assert.doesNotMatch(source, /qikink/i);
  assert.doesNotMatch(source, /fulfillment provider/i);
});
