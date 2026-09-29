import test from "node:test";
import assert from "node:assert/strict";
import { Prisma } from "@prisma/client";
import { CatalogServiceError } from "../lib/catalog/errors.ts";
import { createCatalogQueryService } from "../lib/catalog/query.ts";

const product = {
  id: "product-1",
  title: "Oversized Graphic T-Shirt",
  slug: "oversized-graphic-t-shirt",
  price: new Prisma.Decimal("999.00"),
  compareAtPrice: new Prisma.Decimal("1299.00"),
  currency: "INR",
  status: "ACTIVE" as const,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-02T00:00:00.000Z"),
  images: [
    {
      id: "image-1",
      url: "https://cdn.example.com/shirt.jpg",
      altText: "Oversized Graphic T-Shirt",
      mediaType: "IMAGE" as const,
      sortOrder: 0,
      isPrimary: true,
    },
  ],
  variants: [
    {
      id: "variant-1",
      sku: "TSHIRT-BLK-M-001",
      displayName: null,
      size: "M",
      color: "Black",
      price: new Prisma.Decimal("899.00"),
      compareAtPrice: null,
      status: "ACTIVE" as const,
      inventory: {
        trackingEnabled: true,
        onHand: 10,
        reserved: 2,
        lowStockThreshold: 2,
      },
    },
  ],
  categories: [{ category: { id: "category-1", name: "T-Shirts", slug: "t-shirts" } }],
  collections: [{ collection: { id: "collection-1", name: "New Arrivals", slug: "new-arrivals" } }],
  tags: [{ tag: { id: "tag-1", name: "Streetwear", slug: "streetwear" } }],
};

const queryRepository = {
  async queryPublishedCatalogProducts() {
    return { items: [product], total: 1, limit: 24, offset: 0, hasNextPage: false };
  },
  async getPublishedProductBySlug() {
    return product;
  },
  async getCategoryBySlug() {
    return { id: "category-1", name: "T-Shirts", slug: "t-shirts", description: null, seoTitle: null, seoDescription: null, parentId: null, status: "ACTIVE" as const, createdAt: new Date(), updatedAt: new Date() };
  },
  async listActiveCategories() {
    return [];
  },
  async getCategoryTree() {
    return [];
  },
  async getCollectionBySlug() {
    return { id: "collection-1", name: "New Arrivals", slug: "new-arrivals", description: null, seoTitle: null, seoDescription: null, status: "ACTIVE" as const, createdAt: new Date(), updatedAt: new Date() };
  },
  async listActiveCollections() {
    return [];
  },
  async getTagBySlug() {
    return { id: "tag-1", name: "Streetwear", slug: "streetwear" };
  },
  async listTags() {
    return [];
  },
};

test("normalizes public query input and returns a stable catalog contract", async () => {
  let received: unknown;
  const service = createCatalogQueryService({
    ...queryRepository,
    queryPublishedCatalogProducts: async (options) => {
      received = options;
      return { items: [product], total: 1, limit: 24, offset: 0, hasNextPage: false };
    },
  });

  const result = await service.listPublishedProducts({
    category: " T-SHIRTS ",
    collection: "NEW-ARRIVALS",
    tags: ["Streetwear", "streetwear"],
    minPrice: "800.00",
    maxPrice: 1000,
    inStock: true,
    sort: "price_asc",
  });

  assert.deepEqual(received, {
    filters: {
      categorySlug: "t-shirts",
      collectionSlug: "new-arrivals",
      tagSlugs: ["streetwear"],
      tagMode: "AND",
      minPrice: "800.00",
      maxPrice: "1000",
      inStock: true,
    },
    sortBy: "price",
    sortDirection: "asc",
    limit: 24,
    offset: 0,
  });

  assert.equal(result.items[0].price, "899.00");
  assert.equal(result.items[0].availability.state, "IN_STOCK");
  assert.equal(result.pagination.totalPages, 1);
});

test("uses Decimal-safe effective variant pricing and deterministic availability", async () => {
  const service = createCatalogQueryService(queryRepository);
  const result = await service.getPublishedProductBySlug("OVERSIZED-GRAPHIC-T-SHIRT");

  assert.equal(result.price, "899.00");
  assert.equal(result.compareAtPrice, "1299.00");
  assert.equal(result.variants[0].availability.availableQuantity, 8);
});

test("rejects invalid price ranges, sort values, and page sizes before repository execution", async () => {
  let called = false;
  const service = createCatalogQueryService({
    ...queryRepository,
    queryPublishedCatalogProducts: async () => {
      called = true;
      return { items: [], total: 0, limit: 24, offset: 0, hasNextPage: false };
    },
  });

  await assert.rejects(
    service.listPublishedProducts({ minPrice: 1000, maxPrice: 500 }),
    (error: unknown) => error instanceof CatalogServiceError && error.code === "INVALID_PRICE_RANGE",
  );

  await assert.rejects(
    service.listPublishedProducts({ sort: "not-a-sort" as never }),
    (error: unknown) => error instanceof CatalogServiceError && error.code === "INVALID_SORT",
  );

  await assert.rejects(
    service.listPublishedProducts({ pageSize: 101 }),
    (error: unknown) => error instanceof CatalogServiceError && error.code === "INVALID_PAGE",
  );

  assert.equal(called, false);
});

test("requires referenced public category, collection, and tags to exist", async () => {
  const missingCategory = createCatalogQueryService({
    ...queryRepository,
    getCategoryBySlug: async () => null,
  });

  await assert.rejects(
    missingCategory.listPublishedProducts({ category: "missing-category" }),
    (error: unknown) => error instanceof CatalogServiceError && error.code === "CATEGORY_NOT_FOUND",
  );

  const missingCollection = createCatalogQueryService({
    ...queryRepository,
    getCollectionBySlug: async () => null,
  });

  await assert.rejects(
    missingCollection.listPublishedProducts({ collection: "missing-collection" }),
    (error: unknown) => error instanceof CatalogServiceError && error.code === "COLLECTION_NOT_FOUND",
  );

  const missingTag = createCatalogQueryService({
    ...queryRepository,
    getTagBySlug: async () => null,
  });

  await assert.rejects(
    missingTag.listPublishedProducts({ tags: ["missing-tag"] }),
    (error: unknown) => error instanceof CatalogServiceError && error.code === "TAG_NOT_FOUND",
  );
});
