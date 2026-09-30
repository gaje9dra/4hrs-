import test from "node:test";
import assert from "node:assert/strict";
import { CatalogServiceError } from "../lib/catalog/errors.ts";
import { createCatalogQueryService } from "../lib/catalog/query.ts";
import { categoryPath } from "../lib/catalog/routes.ts";

function category(status: "ACTIVE" | "ARCHIVED" = "ACTIVE", products = 2) {
  return { id: "cat-1", name: "T-Shirts", slug: "t-shirts", description: "T-shirts", seoTitle: "T-Shirts", seoDescription: "T-Shirts", parentId: null, status, createdAt: new Date(), updatedAt: new Date(), _count: { products } };
}

const repo = {
  async queryPublishedCatalogProducts() { return { items: [], total: 0, limit: 24, offset: 0, hasNextPage: false }; },
  async getPublishedProductBySlug() { return null; },
  async getCategoryBySlug(slug: string) { return slug === "missing" ? null : category(slug === "archived" ? "ARCHIVED" : "ACTIVE", slug === "empty" ? 0 : 2); },
  async listActiveCategories() { return [category()]; },
  async listActiveCategoriesWithPublishedProducts() { return [category("ACTIVE", 2)]; },
  async getCollectionBySlug() { return null; },
  async listActiveCollections() { return []; },
  async getTagBySlug() { return null; },
  async listTags() { return []; },
};

test("category resolution accepts a canonical active slug", async () => {
  const service = createCatalogQueryService(repo);
  const result = await service.getCategoryBySlug(" T-SHIRTS ");
  assert.equal(result.slug, "t-shirts");
  assert.equal(result.status, "ACTIVE");
  assert.equal(result._count.products, 2);
});

test("category resolution rejects invalid, missing, and unpublished slugs", async () => {
  const service = createCatalogQueryService(repo);
  await assert.rejects(service.getCategoryBySlug("bad/slug"), (error: unknown) => error instanceof CatalogServiceError && error.code === "INVALID_QUERY");
  await assert.rejects(service.getCategoryBySlug("missing"), (error: unknown) => error instanceof CatalogServiceError && error.code === "CATEGORY_NOT_FOUND");
  await assert.rejects(service.getCategoryBySlug("archived"), (error: unknown) => error instanceof CatalogServiceError && error.code === "CATEGORY_NOT_FOUND");
});

test("empty categories remain resolvable without pretending they contain products", async () => {
  const service = createCatalogQueryService(repo);
  const result = await service.getCategoryBySlug("empty");
  assert.equal(result.status, "ACTIVE");
  assert.equal(result._count.products, 0);
});

test("category listing requires the canonical category context for merchandising order", async () => {
  let received: any;
  const service = createCatalogQueryService({
    ...repo,
    queryPublishedCatalogProducts: async (options) => { received = options; return { items: [], total: 0, limit: 24, offset: 24, hasNextPage: false }; },
  });
  await service.listPublishedProducts({ category: "t-shirts", sort: "merchandising", page: 2 });
  assert.deepEqual(received.filters.categorySlug, "t-shirts");
  assert.equal(received.sortBy, "merchandising");
  assert.equal(received.offset, 24);
});

test("category listing cannot use merchandising order without category or collection context", async () => {
  const service = createCatalogQueryService(repo);
  await assert.rejects(service.listPublishedProducts({ sort: "merchandising" }), (error: unknown) => error instanceof CatalogServiceError && error.code === "INVALID_SORT");
});

test("category URLs use the singular canonical route", () => {
  assert.equal(categoryPath({ slug: " T-SHIRTS " }), "/category/t-shirts");
  assert.throws(() => categoryPath({ slug: "t-shirts/other" }), /Canonical catalog slug is invalid/);
});
