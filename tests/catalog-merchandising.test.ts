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
      productId: "11111111-1111-4111-8111-111111111111",
      collectionId: "22222222-2222-4222-8222-222222222222",
      position: 20,
      priority: 5,
      isFeatured: true,
    }),
    [],
  );
});

test("merchandising membership validation rejects negative position and dual owners", () => {
  const issues = validateMerchandisingMembership({
    productId: "11111111-1111-4111-8111-111111111111",
    collectionId: "22222222-2222-4222-8222-222222222222",
    categoryId: "category-1",
    position: -1,
  });
  assert.ok(issues.some((issue) => issue.code === "INVALID_MERCHANDISING_OWNER"));
  assert.ok(issues.some((issue) => issue.code === "INVALID_POSITION"));
});

test("merchandising reorder validation rejects duplicate products and invalid positions", () => {
  const issues = validateMerchandisingReorder([
    { productId: "11111111-1111-4111-8111-111111111111", position: 0 },
    { productId: "11111111-1111-4111-8111-111111111111", position: -1 },
  ]);
  assert.ok(issues.some((issue) => issue.code === "DUPLICATE_PRODUCT"));
  assert.ok(issues.some((issue) => issue.code === "INVALID_POSITION"));
});

test("CatalogService prevents duplicate collection membership and supports deterministic updates", async () => {
  const calls: Array<Record<string, unknown>> = [];
  const service = createCatalogService({
    getProductById: async () => ({ id: "11111111-1111-4111-8111-111111111111" }),
    getCollectionById: async () => ({ id: "22222222-2222-4222-8222-222222222222", status: "ACTIVE" }),
    getProductCollection: async () => ({ productId: "11111111-1111-4111-8111-111111111111", collectionId: "22222222-2222-4222-8222-222222222222", position: 0, priority: 0, isFeatured: false }),
    updateProductCollection: async (_productId: string, _collectionId: string, data: Record<string, unknown>) => {
      calls.push(data);
      return { productId: "11111111-1111-4111-8111-111111111111", collectionId: "22222222-2222-4222-8222-222222222222", ...data };
    },
  } as unknown as Parameters<typeof createCatalogService>[0]);

  await assert.rejects(
    service.attachCollection("11111111-1111-4111-8111-111111111111", "22222222-2222-4222-8222-222222222222", { position: 10 }),
    (error: unknown) =>
      error instanceof CatalogServiceError &&
      error.code === "INVALID_COLLECTION",
  );

  const updated = await service.updateCollectionMembership("11111111-1111-4111-8111-111111111111", "22222222-2222-4222-8222-222222222222", {
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
    getCollectionById: async () => ({ id: "22222222-2222-4222-8222-222222222222", status: "ACTIVE" }),
    getProductCollection: async (productId: string) => ({ productId, collectionId: "22222222-2222-4222-8222-222222222222" }),
    withTransaction: async (callback: (tx: unknown) => Promise<unknown>) => {
      const tx = {};
      return callback(tx);
    },
    reorderProductCollection: async (_collectionId: string, updates: unknown[], tx: unknown) => {
      transactionCalls.push({ updates, tx });
      return updates;
    },
  } as unknown as Parameters<typeof createCatalogService>[0]);

  const result = await service.reorderCollectionProducts("22222222-2222-4222-8222-222222222222", [
    { productId: "11111111-1111-4111-8111-111111111111", position: 20 },
    { productId: "33333333-3333-4333-8333-333333333333", position: 40 },
  ]);

  assert.equal((result as unknown[]).length, 2);
  assert.equal(transactionCalls.length, 1);
});

test("catalog query service accepts merchandising sorting only with a category or collection", async () => {
  const queries: unknown[] = [];
  const queryService = createCatalogQueryService({
    getCategoryBySlug: async () => ({ id: "category-1", name: "T-Shirts", slug: "t-shirts", description: null, seoTitle: null, seoDescription: null, parentId: null, status: "ACTIVE" as const, createdAt: new Date(), updatedAt: new Date(), _count: { products: 1 } }),
    getCollectionBySlug: async () => ({ id: "22222222-2222-4222-8222-222222222222", name: "New Arrivals", slug: "new-arrivals", description: null, seoTitle: null, seoDescription: null, status: "ACTIVE" as const, createdAt: new Date(), updatedAt: new Date(), _count: { products: 1 } }),
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
    getProductById: async () => ({ id: "11111111-1111-4111-8111-111111111111" }),
    getCollectionById: async () => ({ id: "22222222-2222-4222-8222-222222222222", status: "ACTIVE" }),
    getProductCollection: async () => null,
    attachCollection: async (_productId: string, _collectionId: string, data: Record<string, unknown>) => data,
  } as unknown as Parameters<typeof createCatalogService>[0]);

  const result = await service.attachCollection("11111111-1111-4111-8111-111111111111", "22222222-2222-4222-8222-222222222222", {
    position: 10,
    priority: 2,
    isFeatured: true,
  });

  assert.deepEqual(result, { position: 10, priority: 2, isFeatured: true });
});
