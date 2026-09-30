import test from "node:test";
import assert from "node:assert/strict";
import { Prisma } from "@prisma/client";
import { CatalogServiceError } from "../lib/catalog/errors.ts";
import { createCatalogQueryService } from "../lib/catalog/query.ts";
import type { CatalogQueryRepositoryOptions } from "../lib/catalog/repository.ts";

const product = {
  id: "product-1",
  title: "Oversized Graphic T-Shirt",
  slug: "oversized-graphic-t-shirt",
  price: new Prisma.Decimal("999.00"),
  compareAtPrice: new Prisma.Decimal("1299.00"),
  currency: "INR",
  status: "ACTIVE" as const,
      optionValues: [],
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
      optionValues: [],
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
  async getPublishedProductDetailsBySlug() {
    return {
      ...product,
      description: null,
      shortDescription: null,
      seoTitle: null,
      seoDescription: null,
      optionTypes: [],
      categories: [{ category: { id: "category-1", name: "T-Shirts", slug: "t-shirts", description: null, parentId: null } }],
      collections: [{ collection: { id: "collection-1", name: "New Arrivals", slug: "new-arrivals", description: null } }],
    };
  },
  async getCategoryBySlug() {
    return { id: "category-1", name: "T-Shirts", slug: "t-shirts", description: null, seoTitle: null, seoDescription: null, parentId: null, status: "ACTIVE" as const, createdAt: new Date(), updatedAt: new Date(), _count: { products: 1 } };
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
    return { id: "tag-1", name: "Streetwear", slug: "streetwear", createdAt: new Date(), updatedAt: new Date() };
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
      maxPrice: "1000.00",
      inStock: true,
    },
    sortBy: "price",
    sortDirection: "asc",
    limit: 24,
    offset: 0,
  });

  assert.equal(result.items[0].price, "899.00");
  assert.equal(result.items[0].availability, "IN_STOCK");
  assert.equal(result.items[0].id, "product-1");
  assert.equal("sku" in result.items[0], false);
  assert.deepEqual(Object.keys(result.items[0]).sort(), [
    "availability",
    "compareAtPrice",
    "currency",
    "price",
    "primaryImage",
    "slug",
    "status",
    "title",
  ]);
  assert.equal(result.pagination.totalPages, 1);
});

test("uses Decimal-safe effective variant pricing and deterministic availability", async () => {
  const service = createCatalogQueryService(queryRepository);
  const result = await service.getPublishedProductDetailsBySlug("OVERSIZED-GRAPHIC-T-SHIRT");

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
    getTagsBySlugs: async () => [],
  });

  await assert.rejects(
    missingTag.listPublishedProducts({ tags: ["missing-tag"] }),
    (error: unknown) => error instanceof CatalogServiceError && error.code === "TAG_NOT_FOUND",
  );

  const tagLookups: string[][] = [];
  const batchedTags = createCatalogQueryService({
    ...queryRepository,
    getTagsBySlugs: async (slugs) => {
      tagLookups.push(slugs);
      return slugs.map((slug) => ({ id: slug, name: slug, slug, createdAt: new Date(), updatedAt: new Date() }));
    },
  });
  await batchedTags.listPublishedProducts({ tags: ["streetwear", "graphic", "minimal"] });
  assert.deepEqual(tagLookups, [["graphic", "minimal", "streetwear"]]);
});


test("rejects excessive tag filters before repository execution", async () => {
  let called = false;
  const service = createCatalogQueryService({
    ...queryRepository,
    queryPublishedCatalogProducts: async () => {
      called = true;
      return { items: [], total: 0, limit: 24, offset: 0, hasNextPage: false };
    },
  });

  await assert.rejects(
    service.listPublishedProducts({
      tags: Array.from({ length: 21 }, (_, index) => "tag-" + index),
    }),
    (error: unknown) => error instanceof CatalogServiceError && error.code === "INVALID_QUERY",
  );
  assert.equal(called, false);
});


test("pagination metadata identifies pages beyond the final result page", async () => {
  const service = createCatalogQueryService({
    ...queryRepository,
    queryPublishedCatalogProducts: async (options) => ({
      items: [],
      total: 49,
      limit: options.limit,
      offset: options.offset,
      hasNextPage: false,
    }),
  });

  const result = await service.listPublishedProducts({ page: 3, pageSize: 24 });
  assert.equal(result.pagination.totalPages, 3);
  assert.equal(result.pagination.isOutOfRange, false);

  const outOfRange = await service.listPublishedProducts({ page: 4, pageSize: 24 });
  assert.equal(outOfRange.pagination.totalPages, 3);
  assert.equal(outOfRange.pagination.isOutOfRange, true);
  assert.deepEqual(outOfRange.items, []);
});

test("an empty catalog is not treated as an out-of-range page", async () => {
  const service = createCatalogQueryService({
    ...queryRepository,
    queryPublishedCatalogProducts: async (options) => ({
      items: [],
      total: 0,
      limit: options.limit,
      offset: options.offset,
      hasNextPage: false,
    }),
  });

  const result = await service.listPublishedProducts({ page: 2, pageSize: 24 });
  assert.equal(result.pagination.totalPages, 0);
  assert.equal(result.pagination.isOutOfRange, false);
});

test("pagination preserves the complete canonical filter and sort contract", async () => {
  let received: CatalogQueryRepositoryOptions | undefined;
  const service = createCatalogQueryService({
    ...queryRepository,
    queryPublishedCatalogProducts: async (options) => {
      received = options;
      return { items: [], total: 73, limit: options.limit, offset: options.offset, hasNextPage: true };
    },
  });

  const result = await service.listPublishedProducts({
    category: "T-SHIRTS",
    collection: "SUMMER-EDIT",
    tags: ["graphic", "streetwear"],
    tagMode: "OR",
    minPrice: "500",
    maxPrice: "1500",
    inStock: true,
    sort: "price_desc",
    page: 3,
    pageSize: 24,
  });

  assert.equal(result.pagination.page, 3);
  assert.equal(result.pagination.pageSize, 24);
  assert.equal(result.pagination.total, 73);
  assert.equal(result.pagination.totalPages, 4);
  assert.equal(result.pagination.hasNextPage, true);
  assert.equal(result.pagination.isOutOfRange, false);
  assert.ok(received);
  assert.equal(received.offset, 48);
  assert.equal(received.limit, 24);
  assert.deepEqual(received.filters, {
    categorySlug: "t-shirts",
    collectionSlug: "summer-edit",
    tagSlugs: ["graphic", "streetwear"],
    tagMode: "OR",
    minPrice: "500.00",
    maxPrice: "1500.00",
    inStock: true,
  });
  assert.equal(received.sortBy, "price");
  assert.equal(received.sortDirection, "desc");
});

test("maximum page size remains bounded by the shared pagination contract", async () => {
  let received: CatalogQueryRepositoryOptions | undefined;
  const service = createCatalogQueryService({
    ...queryRepository,
    queryPublishedCatalogProducts: async (options) => {
      received = options;
      return { items: [], total: 0, limit: options.limit, offset: options.offset, hasNextPage: false };
    },
  });

  await service.listPublishedProducts({ page: 1, pageSize: 100 });
  assert.ok(received);
  assert.equal(received.limit, 100);

  await assert.rejects(
    service.listPublishedProducts({ page: 1, pageSize: 101 }),
    (error: unknown) => error instanceof CatalogServiceError && error.code === "INVALID_PAGE",
  );
});


test("page numbers use the same maximum in the service contract", async () => {
  const service = createCatalogQueryService(queryRepository);
  await assert.rejects(
    service.listPublishedProducts({ page: 10001 }),
    (error: unknown) => error instanceof CatalogServiceError && error.code === "INVALID_PAGE",
  );
});


test("logs sanitized failure diagnostics without raw repository errors", async () => {
  const originalError = console.error;
  const logs: string[] = [];
  console.error = (...args: unknown[]) => logs.push(args.join(" "));
  try {
    const service = createCatalogQueryService({
      ...queryRepository,
      queryPublishedCatalogProducts: async () => {
        throw new Error("SQL password=secret token=abc");
      },
    });
    await assert.rejects(
      service.listPublishedProducts(
        { category: "t-shirts", sort: "price_desc", page: 2, pageSize: 24 },
        { surface: "category" },
      ),
      (error: unknown) => error instanceof CatalogServiceError && error.code === "CATALOG_DATABASE_ERROR",
    );
  } finally {
    console.error = originalError;
  }

  assert.equal(logs.length, 1);
  assert.match(logs[0], /"surface":"category"/);
  assert.match(logs[0], /"operation":"listPublishedProducts"/);
  assert.match(logs[0], /"classification":"database_failure"/);
  assert.match(logs[0], /"page":2/);
  assert.equal(logs[0].includes("password"), false);
  assert.equal(logs[0].includes("secret"), false);
  assert.equal(logs[0].includes("token"), false);
  assert.equal(logs[0].includes("SQL"), false);
});

test("does not emit operational error logging for expected empty results", async () => {
  const originalError = console.error;
  const originalWarn = console.warn;
  let errorCalls = 0;
  let warnCalls = 0;
  console.error = () => { errorCalls += 1; };
  console.warn = () => { warnCalls += 1; };
  try {
    const service = createCatalogQueryService({
      ...queryRepository,
      queryPublishedCatalogProducts: async (options) => ({
        items: [],
        total: 0,
        limit: options.limit,
        offset: options.offset,
        hasNextPage: false,
      }),
    });
    const result = await service.listPublishedProducts({}, { surface: "shop" });
    assert.equal(result.items.length, 0);
  } finally {
    console.error = originalError;
    console.warn = originalWarn;
  }
  assert.equal(errorCalls, 0);
  assert.equal(warnCalls, 0);
});


test("rejects non-canonical slugs and oversized pagination before repository execution", async () => {
  let called = false;
  const service = createCatalogQueryService({
    ...queryRepository,
    queryPublishedCatalogProducts: async () => {
      called = true;
      return { items: [], total: 0, limit: 24, offset: 0, hasNextPage: false };
    },
  });

  await assert.rejects(
    service.listPublishedProducts({ category: "../admin" }),
    (error: unknown) => error instanceof CatalogServiceError && error.code === "INVALID_QUERY",
  );
  await assert.rejects(
    service.listPublishedProducts({ collection: "Hidden Collection" }),
    (error: unknown) => error instanceof CatalogServiceError && error.code === "INVALID_QUERY",
  );
  await assert.rejects(
    service.listPublishedProducts({ page: 10001 }),
    (error: unknown) => error instanceof CatalogServiceError && error.code === "INVALID_PAGE",
  );
  assert.equal(called, false);
});

test("does not resolve inactive category or collection through public discovery", async () => {
  const inactiveCategory = createCatalogQueryService({
    ...queryRepository,
    getCategoryBySlug: async () => ({
      id: "hidden-category",
      name: "Hidden",
      slug: "hidden",
      description: null,
      seoTitle: null,
      seoDescription: null,
      parentId: null,
      status: "ARCHIVED" as const,
      createdAt: new Date(),
      updatedAt: new Date(),
      _count: { products: 0 },
    }),
  });
  await assert.rejects(
    inactiveCategory.listPublishedProducts({ category: "hidden" }),
    (error: unknown) => error instanceof CatalogServiceError && error.code === "CATEGORY_NOT_FOUND",
  );

  const inactiveCollection = createCatalogQueryService({
    ...queryRepository,
    getCollectionBySlug: async () => ({
      id: "hidden-collection",
      name: "Hidden",
      slug: "hidden",
      description: null,
      seoTitle: null,
      seoDescription: null,
      status: "ARCHIVED" as const,
      createdAt: new Date(),
      updatedAt: new Date(),
    }),
  });
  await assert.rejects(
    inactiveCollection.listPublishedProducts({ collection: "hidden" }),
    (error: unknown) => error instanceof CatalogServiceError && error.code === "COLLECTION_NOT_FOUND",
  );
});
