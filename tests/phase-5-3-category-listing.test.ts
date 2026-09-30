import test from "node:test";
import assert from "node:assert/strict";
import { CatalogServiceError } from "../lib/catalog/errors.ts";
import { createCatalogQueryService } from "../lib/catalog/query.ts";
import { categoryPath } from "../lib/catalog/routes.ts";
import type { CatalogQueryRepositoryOptions } from "../lib/catalog/repository.ts";

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
  let received: CatalogQueryRepositoryOptions | undefined;
  const service = createCatalogQueryService({
    ...repo,
    queryPublishedCatalogProducts: async (options) => { received = options; return { items: [], total: 0, limit: 24, offset: 24, hasNextPage: false }; },
  });
  await service.listPublishedProducts({ category: "t-shirts", sort: "merchandising", page: 2 });
  assert.ok(received);
  assert.deepEqual(received.filters?.categorySlug, "t-shirts");
  assert.equal(received.sortBy, "merchandising");
  assert.ok(received);
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

test("collection resolution accepts active collections and distinguishes empty collections", async () => {
  const collectionRepo = {
    ...repo,
    getCollectionBySlug: async (slug: string) =>
      slug === "missing"
        ? null
        : {
            id: "collection-1",
            name: "Summer Edit",
            slug: "summer-edit",
            description: "Summer collection",
            seoTitle: "Summer Edit",
            seoDescription: "Summer edit",
            status: slug === "archived" ? "ARCHIVED" as const : "ACTIVE" as const,
            _count: { products: slug === "empty" ? 0 : 2 },
          },
  };
  const service = createCatalogQueryService(collectionRepo);
  const active = await service.listPublishedProducts({ collection: "summer-edit", sort: "merchandising" });
  assert.equal(active.pagination.total, 0);
  await assert.rejects(
    service.listPublishedProducts({ collection: "missing" }),
    (error: unknown) => error instanceof CatalogServiceError && error.code === "COLLECTION_NOT_FOUND",
  );
});

test("collection context remains authoritative for pagination and merchandising order", async () => {
  let received: CatalogQueryRepositoryOptions | undefined;
  const collectionRepo = {
    ...repo,
    getCollectionBySlug: async () => ({
      id: "collection-1",
      name: "Summer Edit",
      slug: "summer-edit",
      description: null,
      seoTitle: null,
      seoDescription: null,
      status: "ACTIVE" as const,
      _count: { products: 3 },
    }),
    queryPublishedCatalogProducts: async (options: CatalogQueryRepositoryOptions) => {
      received = options;
      return { items: [], total: 0, limit: 24, offset: 24, hasNextPage: false };
    },
  };
  const service = createCatalogQueryService(collectionRepo);
  await service.listPublishedProducts({
    collection: "summer-edit",
    page: 2,
    sort: "merchandising",
    category: "other-category",
  });
  if (!received) throw new Error("Expected query options to be captured.");
  assert.equal(received.filters?.collectionSlug, "summer-edit");
  assert.equal(received.filters?.categorySlug, "other-category");
  assert.equal(received.offset, 24);
  assert.equal(received.sortBy, "merchandising");
});

test("collection canonical URL uses the singular route", async () => {
  assert.equal(
    (await import("../lib/catalog/routes.ts")).collectionPath({ slug: " SUMMER-EDIT " }),
    "/collection/summer-edit",
  );
});
