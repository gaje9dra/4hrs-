import test from "node:test";
import assert from "node:assert/strict";
import { Prisma } from "@prisma/client";
import { CatalogServiceError } from "../lib/catalog/errors.ts";
import {
  DatabaseSearchAdapter,
  createCatalogSearchService,
  type CatalogSearchProvider,
} from "../lib/catalog/search.ts";
import { searchCatalogProducts } from "../lib/catalog/repository.ts";

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
      sortOrder: 0,
      isPrimary: true,
    },
  ],
  variants: [
    {
      id: "variant-1",
      sku: "TSHIRT-BLK-M-001",
      displayName: "Black / M",
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

const lookup = {
  getCategoryBySlug: async () => ({ id: "category-1" }),
  getCollectionBySlug: async () => ({ id: "collection-1" }),
  getTagBySlug: async () => ({ id: "tag-1" }),
};

function makeProvider(result = [product]): CatalogSearchProvider {
  return {
    async search() {
      return {
        items: result as never,
        total: result.length,
        limit: 24,
        offset: 0,
        hasNextPage: false,
      };
    },
  };
}

test("normalizes whitespace, casing, filters, pagination, and literal LIKE wildcards", async () => {
  let received: unknown;
  const provider: CatalogSearchProvider = {
    async search(request) {
      received = request;
      return { items: [], total: 0, limit: 12, offset: 12, hasNextPage: false };
    },
  };

  const service = createCatalogSearchService({ provider, lookup });
  const result = await service.searchPublic({
    query: "  Oversized_%  ",
    category: " T-SHIRTS ",
    collection: "NEW-ARRIVALS",
    tags: ["Streetwear", "streetwear"],
    tagMode: "OR",
    minPrice: "800.00",
    maxPrice: "1200.00",
    inStock: true,
    sort: "price_desc",
    page: 2,
    pageSize: 12,
  });

  assert.deepEqual(received, {
    query: "oversized\\_\\%",
    mode: "PUBLIC",
    catalog: {
      category: "t-shirts",
      collection: "new-arrivals",
      tags: ["streetwear"],
      tagMode: "OR",
      minPrice: "800.00",
      maxPrice: "1200.00",
      inStock: true,
      sort: "price_desc",
      page: 2,
      pageSize: 12,
    },
  });
  assert.equal(result.appliedQuery.query, "oversized\\_\\%");
  assert.equal(result.appliedQuery.mode, "PUBLIC");
});

test("rejects empty, overlong, and invalid search input before provider execution", async () => {
  let called = false;
  const provider: CatalogSearchProvider = {
    async search() {
      called = true;
      return { items: [], total: 0, limit: 24, offset: 0, hasNextPage: false };
    },
  };
  const service = createCatalogSearchService({ provider, lookup });

  await assert.rejects(
    service.searchPublic({ query: "   " }),
    (error: unknown) => error instanceof CatalogServiceError && error.code === "INVALID_QUERY",
  );
  await assert.rejects(
    service.searchPublic({ query: "x".repeat(101) }),
    (error: unknown) => error instanceof CatalogServiceError && error.code === "INVALID_QUERY",
  );
  await assert.rejects(
    service.searchPublic({ query: "shirt", pageSize: 101 }),
    (error: unknown) => error instanceof CatalogServiceError && error.code === "INVALID_PAGE",
  );
  assert.equal(called, false);
});

test("public search returns a stable storefront-safe contract without SKU fields", async () => {
  const service = createCatalogSearchService({ provider: makeProvider(), lookup });
  const result = await service.searchPublic({ query: "oversized" });

  assert.equal(result.items[0].title, "Oversized Graphic T-Shirt");
  assert.equal(result.items[0].price, "899.00");
  assert.equal(result.items[0].availability.state, "IN_STOCK");
  assert.equal("internalVariants" in result.items[0], false);
});

test("internal search can expose variant SKU metadata while public search cannot", async () => {
  const service = createCatalogSearchService({ provider: makeProvider(), lookup });
  const result = await service.searchInternal({ query: "TSHIRT-BLK-M-001" });

  assert.equal(result.items[0].internalVariants?.[0].sku, "TSHIRT-BLK-M-001");
  assert.equal(result.appliedQuery.mode, "INTERNAL");
});

test("search maps exact, partial, tag, category, collection, and descriptive matches through one provider contract", async () => {
  const calls: string[] = [];
  const provider: CatalogSearchProvider = {
    async search(request) {
      calls.push(request.query);
      return { items: [product], total: 1, limit: 24, offset: 0, hasNextPage: false };
    },
  };
  const service = createCatalogSearchService({ provider, lookup });

  for (const query of [
    "Oversized Graphic T-Shirt",
    "graphic",
    "streetwear",
    "t-shirts",
    "new arrivals",
    "oversized",
  ]) {
    const result = await service.searchPublic({ query });
    assert.equal(result.items.length, 1);
  }

  assert.deepEqual(calls, [
    "oversized graphic t-shirt",
    "graphic",
    "streetwear",
    "t-shirts",
    "new arrivals",
    "oversized",
  ]);
});

test("search + filters compose in a single normalized request", async () => {
  let received: unknown;
  const provider: CatalogSearchProvider = {
    async search(request) {
      received = request;
      return { items: [product], total: 1, limit: 24, offset: 0, hasNextPage: false };
    },
  };
  const service = createCatalogSearchService({ provider, lookup });

  await service.searchPublic({
    query: "oversized",
    category: "t-shirts",
    collection: "new-arrivals",
    tags: ["streetwear"],
    inStock: true,
    minPrice: "800",
    maxPrice: "1000",
    sort: "newest",
  });

  assert.deepEqual(received, {
    query: "oversized",
    mode: "PUBLIC",
    catalog: {
      category: "t-shirts",
      collection: "new-arrivals",
      tags: ["streetwear"],
      tagMode: "AND",
      minPrice: "800",
      maxPrice: "1000",
      inStock: true,
      sort: "newest",
      page: 1,
      pageSize: 24,
    },
  });
});

test("missing public references are rejected using the existing catalog error architecture", async () => {
  const provider = makeProvider();
  const service = createCatalogSearchService({
    provider,
    lookup: {
      getCategoryBySlug: async () => null,
      getCollectionBySlug: async () => null,
      getTagBySlug: async () => null,
    },
  });

  await assert.rejects(
    service.searchPublic({ query: "shirt", category: "missing" }),
    (error: unknown) => error instanceof CatalogServiceError && error.code === "CATEGORY_NOT_FOUND",
  );
});

test("provider failures are mapped without exposing raw database/provider errors", async () => {
  const provider: CatalogSearchProvider = {
    async search() {
      throw new Error("raw database failure");
    },
  };
  const service = createCatalogSearchService({ provider, lookup });

  await assert.rejects(
    service.searchPublic({ query: "shirt" }),
    (error: unknown) =>
      error instanceof CatalogServiceError &&
      error.code === "CATALOG_DATABASE_ERROR" &&
      error.message === "Catalog search failed.",
  );
});

test("database adapter composes public visibility and all search/filter predicates in one repository query", async () => {
  let captured: { where?: unknown; orderBy?: unknown } = {};
  const fakeClient = {
    product: {
      findMany: async (args: { where: unknown; orderBy: unknown }) => {
        captured = args;
        return [];
      },
      count: async () => 0,
    },
  } as never;

  await searchCatalogProducts({
    query: "oversized",
    mode: "PUBLIC",
    filters: {
      categorySlug: "t-shirts",
      collectionSlug: "new-arrivals",
      tagSlugs: ["streetwear"],
      tagMode: "AND",
      minPrice: "800",
      maxPrice: "1200",
      inStock: true,
    },
    sortBy: "price",
    sortDirection: "desc",
    limit: 24,
    offset: 0,
  }, fakeClient);

  const where = JSON.stringify(captured.where);
  assert.match(where, /"status":"ACTIVE"/);
  assert.match(where, /oversized/);
  assert.match(where, /t-shirts/);
  assert.match(where, /new-arrivals/);
  assert.match(where, /streetwear/);
  assert.match(where, /800/);
  assert.match(where, /1200/);
  assert.match(where, /inStock|trackingEnabled/);
  assert.deepEqual(captured.orderBy, [{ price: "desc" }, { id: "desc" }]);
});

test("database adapter keeps SKU search internal-only", async () => {
  let publicWhere: unknown;
  let internalWhere: unknown;
  const fakeClient = {
    product: {
      findMany: async (args: { where: unknown }) => {
        if (!publicWhere) publicWhere = args.where;
        else internalWhere = args.where;
        return [];
      },
      count: async () => 0,
    },
  } as never;

  const adapter = new DatabaseSearchAdapter();
  await adapter.search({
    query: "sku-123",
    mode: "PUBLIC",
    catalog: {
      category: undefined,
      collection: undefined,
      tags: [],
      tagMode: "AND",
      minPrice: undefined,
      maxPrice: undefined,
      inStock: false,
      sort: "newest",
      page: 1,
      pageSize: 24,
    },
  });
  await searchCatalogProducts({
    query: "sku-123",
    mode: "INTERNAL",
    limit: 24,
    offset: 0,
  }, fakeClient);

  const publicText = JSON.stringify(publicWhere);
  const internalText = JSON.stringify(internalWhere);
  assert.doesNotMatch(publicText, /"sku"/);
  assert.match(internalText, /"sku"/);
});
