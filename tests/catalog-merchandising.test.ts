import test from "node:test";
import assert from "node:assert/strict";
import { createCatalogService } from "../lib/catalog/service.ts";
import { createCatalogQueryService } from "../lib/catalog/query.ts";
import { CatalogServiceError } from "../lib/catalog/errors.ts";
import {
  validateMerchandisingMembership,
  validateMerchandisingReorder,
} from "../lib/catalog/validation.ts";

test("merchandising membership validation accepts deterministic position, priority and featured state", () => {
  assert.deepEqual(
    validateMerchandisingMembership({
      productId: "product-1",
      collectionId: "collection-1",
      position: 20,
      priority: 5,
      isFeatured: true,
    }),
    [],
  );
});

test("merchandising membership validation rejects negative position and dual owners", () => {
  const issues = validateMerchandisingMembership({
    productId: "product-1",
    collectionId: "collection-1",
    categoryId: "category-1",
    position: -1,
  });
  assert.ok(issues.some((issue) => issue.code === "INVALID_MERCHANDISING_OWNER"));
  assert.ok(issues.some((issue) => issue.code === "INVALID_POSITION"));
});

test("merchandising reorder validation rejects duplicate products and invalid positions", () => {
  const issues = validateMerchandisingReorder([
    { productId: "product-1", position: 0 },
    { productId: "product-1", position: -1 },
  ]);
  assert.ok(issues.some((issue) => issue.code === "DUPLICATE_PRODUCT"));
  assert.ok(issues.some((issue) => issue.code === "INVALID_POSITION"));
});

test("CatalogService prevents duplicate collection membership and supports deterministic updates", async () => {
  const calls: Array<Record<string, unknown>> = [];
  const service = createCatalogService({
    getProductById: async () => ({ id: "product-1" }),
    getCollectionById: async () => ({ id: "collection-1", status: "ACTIVE" }),
    getProductCollection: async () => ({ productId: "product-1", collectionId: "collection-1", position: 0, priority: 0, isFeatured: false }),
    updateProductCollection: async (_productId: string, _collectionId: string, data: Record<string, unknown>) => {
      calls.push(data);
      return { productId: "product-1", collectionId: "collection-1", ...data };
    },
  } as unknown as Parameters<typeof createCatalogService>[0]);

  await assert.rejects(
    service.attachCollection("product-1", "collection-1", { position: 10 }),
    (error: unknown) =>
      error instanceof CatalogServiceError &&
      error.code === "INVALID_COLLECTION",
  );

  const updated = await service.updateCollectionMembership("product-1", "collection-1", {
    position: 20,
    priority: 3,
    isFeatured: true,
  });

  assert.equal(updated.position, 20);
  assert.deepEqual(calls, [{ position: 20, priority: 3, isFeatured: true }]);
});

test("CatalogService reorders a collection transactionally", async () => {
  const transactionCalls: unknown[] = [];
  const service = createCatalogService({
    getCollectionById: async () => ({ id: "collection-1", status: "ACTIVE" }),
    getProductCollection: async (productId: string) => ({ productId, collectionId: "collection-1" }),
    withTransaction: async (callback: (tx: unknown) => Promise<unknown>) => {
      const tx = {};
      return callback(tx);
    },
    reorderProductCollection: async (_collectionId: string, updates: unknown[], tx: unknown) => {
      transactionCalls.push({ updates, tx });
      return updates;
    },
  } as unknown as Parameters<typeof createCatalogService>[0]);

  const result = await service.reorderCollectionProducts("collection-1", [
    { productId: "product-1", position: 20 },
    { productId: "product-2", position: 40 },
  ]);

  assert.equal((result as unknown[]).length, 2);
  assert.equal(transactionCalls.length, 1);
});

test("catalog query service accepts merchandising sorting only with a category or collection", async () => {
  const queries: unknown[] = [];
  const queryService = createCatalogQueryService({
    getCategoryBySlug: async () => ({ id: "category-1", name: "T-Shirts", slug: "t-shirts", description: null, seoTitle: null, seoDescription: null, parentId: null, status: "ACTIVE" as const, createdAt: new Date(), updatedAt: new Date() }),
    getCollectionBySlug: async () => ({ id: "collection-1", name: "New Arrivals", slug: "new-arrivals", description: null, seoTitle: null, seoDescription: null, status: "ACTIVE" as const, createdAt: new Date(), updatedAt: new Date() }),
    getTagBySlug: async () => ({ id: "tag-1", name: "Streetwear", slug: "streetwear", createdAt: new Date(), updatedAt: new Date() }),
    queryPublishedCatalogProducts: async (options: unknown) => {
      queries.push(options);
      return { items: [], total: 0, limit: 24, offset: 0, hasNextPage: false };
    },
  });

  const result = await queryService.listPublishedProducts({
    collection: "streetwear",
    sort: "merchandising",
  });

  assert.equal(result.pagination.total, 0);
  assert.equal((queries[0] as { sortBy: string }).sortBy, "merchandising");

  await assert.rejects(
    queryService.listPublishedProducts({ sort: "merchandising" }),
    (error: unknown) =>
      error instanceof CatalogServiceError &&
      error.code === "INVALID_SORT",
  );
});

test("merchandising membership is provider-neutral", async () => {
  const service = createCatalogService({
    getProductById: async () => ({ id: "product-1" }),
    getCollectionById: async () => ({ id: "collection-1", status: "ACTIVE" }),
    getProductCollection: async () => null,
    attachCollection: async (_productId: string, _collectionId: string, data: Record<string, unknown>) => data,
  } as unknown as Parameters<typeof createCatalogService>[0]);

  const result = await service.attachCollection("product-1", "collection-1", {
    position: 10,
    priority: 2,
    isFeatured: true,
  });

  assert.deepEqual(result, { position: 10, priority: 2, isFeatured: true });
});
