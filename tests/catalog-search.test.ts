import test from "node:test";
import assert from "node:assert/strict";
import { Prisma } from "@prisma/client";
import { CatalogServiceError } from "../lib/catalog/errors.ts";
import {
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
      displayName: "Black / M",
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

const lookup = {
  getCategoryBySlug: async () => ({ id: "category-1" }),
  getCollectionBySlug: async () => ({ id: "collection-1" }),
  getTagsBySlugs: async () => [{ slug: "streetwear" }],
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
  await assert.rejects(
    service.searchPublic({ query: "shirt", page: 10001 }),
    (error: unknown) => error instanceof CatalogServiceError && error.code === "INVALID_PAGE",
  );
  assert.equal(called, false);
});



test("public search accepts the lightweight repository projection without reading internal fields", async () => {
  const lightweight = {
    title: product.title,
    slug: product.slug,
    price: product.price,
    compareAtPrice: product.compareAtPrice,
    currency: product.currency,
    status: "ACTIVE" as const,
    images: [{ url: product.images[0].url, altText: product.images[0].altText }],
    variants: [{ price: product.variants[0].price, compareAtPrice: product.variants[0].compareAtPrice, inventory: product.variants[0].inventory }],
  };
  const provider: CatalogSearchProvider = {
    async search() {
      return { items: [lightweight], total: 1, limit: 24, offset: 0, hasNextPage: false };
    },
  };
  const service = createCatalogSearchService({ provider, lookup });
  const result = await service.searchPublic({ query: "oversized" });
  assert.equal(result.items[0].slug, product.slug);
  assert.equal(result.items[0].price, "899.00");
  assert.equal(result.items[0].availability, "IN_STOCK");
  assert.equal("id" in result.items[0], false);
});

test("search reference validation batches category, collection, and tag lookups", async () => {
  const calls: string[] = [];
  const service = createCatalogSearchService({
    provider: makeProvider(),
    lookup: {
      getCategoryBySlug: async () => { calls.push("category"); return { status: "ACTIVE" }; },
      getCollectionBySlug: async () => { calls.push("collection"); return { status: "ACTIVE" }; },
      getTagsBySlugs: async (slugs) => { calls.push("tags:" + slugs.join(",")); return slugs.map((slug) => ({ slug })); },
    },
  });
  await service.searchPublic({ query: "shirt", category: "t-shirts", collection: "new-arrivals", tags: ["streetwear"] });
  assert.deepEqual(calls.sort(), ["category", "collection", "tags:streetwear"].sort());
});

test("public search returns a stable storefront-safe contract without SKU fields", async () => {
  const service = createCatalogSearchService({ provider: makeProvider(), lookup });
  const result = await service.searchPublic({ query: "oversized" });

  assert.equal(result.items[0].title, "Oversized Graphic T-Shirt");
  assert.equal(result.items[0].price, "899.00");
  assert.equal(result.items[0].availability, "IN_STOCK");
  assert.equal("internalVariants" in result.items[0], false);
  assert.equal("id" in result.items[0], false);
  assert.equal("sku" in result.items[0], false);
  assert.equal("categories" in result.items[0], false);
  assert.equal("collections" in result.items[0], false);
  assert.equal("tags" in result.items[0], false);
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
      minPrice: "800.00",
      maxPrice: "1000.00",
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
      getTagsBySlugs: async () => [],
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
  assert.match(where, /"productId":\{"not":null\}/);
  assert.match(where, /"mediaType":"IMAGE"/);
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

  const publicClient = {
    product: {
      findMany: async (args: { where: unknown }) => {
        publicWhere = args.where;
        return [];
      },
      count: async () => 0,
    },
  } as never;

  const internalClient = {
    product: {
      findMany: async (args: { where: unknown }) => {
        internalWhere = args.where;
        return [];
      },
      count: async () => 0,
    },
  } as never;

  await searchCatalogProducts({
    query: "sku-123",
    mode: "PUBLIC",
    limit: 24,
    offset: 0,
  }, publicClient);

  await searchCatalogProducts({
    query: "sku-123",
    mode: "INTERNAL",
    limit: 24,
    offset: 0,
  }, internalClient);

  const publicText = JSON.stringify(publicWhere);
  const internalText = JSON.stringify(internalWhere);
  assert.doesNotMatch(publicText, /"sku"/);
  assert.match(internalText, /"sku"/);
});


test("search pagination identifies out-of-range pages using the canonical bounded contract", async () => {
  const provider: CatalogSearchProvider = {
    async search() {
      return { items: [], total: 25, limit: 24, offset: 48, hasNextPage: false };
    },
  };
  const service = createCatalogSearchService({ provider, lookup });
  const result = await service.searchPublic({ query: "shirt", page: 3, pageSize: 24 });
  assert.equal(result.pagination.totalPages, 2);
  assert.equal(result.pagination.isOutOfRange, true);
  assert.equal(result.pagination.hasNextPage, false);
});

test("public search lookup rejects inactive category and collection references", async () => {
  const service = createCatalogSearchService({
    provider: makeProvider(),
    lookup: {
      getCategoryBySlug: async () => ({ id: "hidden", status: "ARCHIVED" }),
      getCollectionBySlug: async () => ({ id: "hidden", status: "ARCHIVED" }),
      getTagsBySlugs: async () => [],
    },
  });

  await assert.rejects(
    service.searchPublic({ query: "shirt", category: "hidden" }),
    (error: unknown) => error instanceof CatalogServiceError && error.code === "CATEGORY_NOT_FOUND",
  );
  await assert.rejects(
    service.searchPublic({ query: "shirt", collection: "hidden" }),
    (error: unknown) => error instanceof CatalogServiceError && error.code === "COLLECTION_NOT_FOUND",
  );
});

test("search failure diagnostics are sanitized and attributed to the search surface", async () => {
  const originalError = console.error;
  const logs: string[] = [];
  console.error = (...args: unknown[]) => logs.push(args.join(" "));
  try {
    const service = createCatalogSearchService({
      provider: {
        async search() {
          throw new Error("SQL password=secret token=abc");
        },
      },
      lookup,
    });
    await assert.rejects(
      service.searchPublic({ query: "shirt" }),
      (error: unknown) => error instanceof CatalogServiceError && error.code === "CATALOG_DATABASE_ERROR",
    );
  } finally {
    console.error = originalError;
  }

  assert.equal(logs.length, 1);
  assert.match(logs[0], /"surface":"search"/);
  assert.match(logs[0], /"classification":"database_failure"/);
  assert.equal(logs[0].includes("password"), false);
  assert.equal(logs[0].includes("secret"), false);
  assert.equal(logs[0].includes("token"), false);
  assert.equal(logs[0].includes("SQL"), false);
});

test("search preserves legitimate Unicode while normalizing whitespace and casing", async () => {
  let received: unknown;
  const provider: CatalogSearchProvider = {
    async search(request) {
      received = request.query;
      return { items: [], total: 0, limit: 24, offset: 0, hasNextPage: false };
    },
  };
  const service = createCatalogSearchService({ provider, lookup });
  await service.searchPublic({ query: "  CAFE   ÉTÉ  " });
  assert.equal(received, "cafe été");
});

test("search rejects control-heavy and malformed query input before repository execution", async () => {
  let called = false;
  const provider: CatalogSearchProvider = {
    async search() {
      called = true;
      return { items: [], total: 0, limit: 24, offset: 0, hasNextPage: false };
    },
  };
  const service = createCatalogSearchService({ provider, lookup });
  await service.searchPublic({ query: "\u0000\u0001   " });
  assert.equal(called, false);
});
