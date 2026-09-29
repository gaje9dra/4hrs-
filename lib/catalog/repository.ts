import { Prisma, type PrismaClient } from "@prisma/client";
import { db } from "@/lib/db/client";

export const CATALOG_PAGE_DEFAULT = 24;
export const CATALOG_PAGE_MAX = 100;

export const CATALOG_SORT_FIELDS = {
  createdAt: "createdAt",
  updatedAt: "updatedAt",
  title: "title",
  price: "price",
} as const;

export type CatalogSortField = keyof typeof CATALOG_SORT_FIELDS | "merchandising";
export type SortDirection = "asc" | "desc";

export type CatalogListFilters = {
  status?: "DRAFT" | "ACTIVE" | "ARCHIVED";
  categoryId?: string;
  collectionId?: string;
  tagId?: string;
  minPrice?: string;
  maxPrice?: string;
};

export type CatalogListOptions = {
  filters?: CatalogListFilters;
  sortBy?: CatalogSortField;
  sortDirection?: SortDirection;
  limit?: number;
  offset?: number;
};

export type CatalogListResult<T> = {
  items: T[];
  total: number;
  limit: number;
  offset: number;
  hasNextPage: boolean;
};

export type CatalogRepositoryClient = PrismaClient | Prisma.TransactionClient;

const productDetailsInclude = {
  variants: { orderBy: { createdAt: "asc" as const } },
  images: { orderBy: { sortOrder: "asc" as const } },
  categories: { include: { category: true } },
  collections: { include: { collection: true } },
  tags: { include: { tag: true } },
} satisfies Prisma.ProductInclude;

const productExportInclude = {
  variants: {
    orderBy: [{ createdAt: "asc" as const }, { id: "asc" as const }],
    include: {
      optionValues: {
        include: { optionValue: { include: { optionType: true } } },
        orderBy: { optionValue: { sortOrder: "asc" as const } },
      },
    },
  },
  images: { orderBy: [{ sortOrder: "asc" as const }, { id: "asc" as const }] },
  categories: { include: { category: true }, orderBy: [{ position: "asc" as const }, { categoryId: "asc" as const }] },
  collections: { include: { collection: true }, orderBy: [{ isFeatured: "desc" as const }, { priority: "desc" as const }, { position: "asc" as const }, { collectionId: "asc" as const }] },
  tags: { include: { tag: true }, orderBy: { tagId: "asc" as const } },
  optionTypes: { include: { optionType: { include: { values: true } } }, orderBy: [{ sortOrder: "asc" as const }, { optionTypeId: "asc" as const }] },
} satisfies Prisma.ProductInclude;

const productWithVariantsInclude = {
  variants: {
    orderBy: { createdAt: "asc" as const },
    include: {
      optionValues: {
        include: { optionValue: { include: { optionType: true } } },
        orderBy: { optionValue: { sortOrder: "asc" as const } },
      },
    },
  },
} satisfies Prisma.ProductInclude;

const publishedProductWhere: Prisma.ProductWhereInput = {
  status: "ACTIVE",
  title: { not: "" },
  slug: { not: "" },
  currency: { not: "" },
  price: { gte: new Prisma.Decimal(0) },
  variants: {
    some: {
      status: "ACTIVE",
      sku: { not: "" },
    },
  },
  images: {
    some: {
      productId: { not: null },
      mediaType: "IMAGE",
    },
  },
};

function clientOrDefault(client?: CatalogRepositoryClient): CatalogRepositoryClient {
  return client ?? db;
}

function clampLimit(limit?: number): number {
  if (limit === undefined) return CATALOG_PAGE_DEFAULT;
  if (!Number.isInteger(limit) || limit < 1) throw new Error("Catalog page limit must be a positive integer.");
  return Math.min(limit, CATALOG_PAGE_MAX);
}

function normalizeOffset(offset?: number): number {
  if (offset === undefined) return 0;
  if (!Number.isInteger(offset) || offset < 0) throw new Error("Catalog page offset must be a non-negative integer.");
  return offset;
}

function buildListWhere(filters: CatalogListFilters = {}): Prisma.ProductWhereInput {
  const where: Prisma.ProductWhereInput = {};
  if (filters.status) where.status = filters.status;
  if (filters.categoryId) where.categories = { some: { categoryId: filters.categoryId } };
  if (filters.collectionId) where.collections = { some: { collectionId: filters.collectionId } };
  if (filters.tagId) where.tags = { some: { tagId: filters.tagId } };

  if (filters.minPrice !== undefined || filters.maxPrice !== undefined) {
    where.price = {
      ...(filters.minPrice !== undefined ? { gte: new Prisma.Decimal(filters.minPrice) } : {}),
      ...(filters.maxPrice !== undefined ? { lte: new Prisma.Decimal(filters.maxPrice) } : {}),
    };
  }

  return where;
}



export type CatalogQueryRepositoryFilters = {
  categorySlug?: string;
  collectionSlug?: string;
  tagSlugs?: string[];
  tagMode?: "AND" | "OR";
  minPrice?: string;
  maxPrice?: string;
  inStock?: boolean;
};

export type CatalogQueryRepositoryOptions = {
  filters?: CatalogQueryRepositoryFilters;
  sortBy?: CatalogSortField;
  sortDirection?: SortDirection;
  limit: number;
  offset: number;
};

function buildEffectiveVariantPriceWhere(
  minPrice?: string,
  maxPrice?: string,
): Prisma.ProductWhereInput | undefined {
  if (minPrice === undefined && maxPrice === undefined) return undefined;
  const variantPrice = {
    ...(minPrice !== undefined ? { gte: new Prisma.Decimal(minPrice) } : {}),
    ...(maxPrice !== undefined ? { lte: new Prisma.Decimal(maxPrice) } : {}),
  };
  return {
    OR: [
      {
        price: {
          ...(minPrice !== undefined ? { gte: new Prisma.Decimal(minPrice) } : {}),
          ...(maxPrice !== undefined ? { lte: new Prisma.Decimal(maxPrice) } : {}),
        },
        variants: { some: { status: "ACTIVE", price: null } },
      },
      { variants: { some: { status: "ACTIVE", price: variantPrice } } },
    ],
  };
}

function buildAvailabilityWhere(inStock?: boolean): Prisma.ProductWhereInput | undefined {
  if (inStock !== true) return undefined;
  return {
    variants: {
      some: {
        status: "ACTIVE",
        OR: [
          { inventory: { is: null } },
          { inventory: { is: { trackingEnabled: false } } },
          {
            inventory: {
              is: {
                trackingEnabled: true,
                onHand: { gt: db.inventory.fields.reserved },
              },
            },
          },
        ],
      },
    },
  };
}

function buildPublicCatalogWhere(filters: CatalogQueryRepositoryFilters = {}): Prisma.ProductWhereInput {
  const and: Prisma.ProductWhereInput[] = [publishedProductWhere];

  if (filters.categorySlug) {
    and.push({ categories: { some: { category: { slug: filters.categorySlug, status: "ACTIVE" } } } });
  }
  if (filters.collectionSlug) {
    and.push({ collections: { some: { collection: { slug: filters.collectionSlug, status: "ACTIVE" } } } });
  }
  if (filters.tagSlugs?.length) {
    const tagFilters = filters.tagSlugs.map((slug) => ({ tags: { some: { tag: { slug } } } }));
    and.push(filters.tagMode === "OR" ? { OR: tagFilters } : { AND: tagFilters });
  }

  const priceWhere = buildEffectiveVariantPriceWhere(filters.minPrice, filters.maxPrice);
  if (priceWhere) and.push(priceWhere);
  const availabilityWhere = buildAvailabilityWhere(filters.inStock);
  if (availabilityWhere) and.push(availabilityWhere);

  return { AND: and };
}

const publicCatalogSelect = {
  id: true,
  title: true,
  slug: true,
  price: true,
  compareAtPrice: true,
  currency: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  images: {
    where: { productId: { not: null } },
    orderBy: [{ isPrimary: "desc" as const }, { sortOrder: "asc" as const }, { id: "asc" as const }],
    select: { id: true, url: true, mediaType: true, altText: true, sortOrder: true, isPrimary: true },
  },
  variants: {
    where: { status: "ACTIVE" },
    orderBy: [{ createdAt: "asc" as const }, { id: "asc" as const }],
    select: {
      id: true,
      sku: true,
      displayName: true,
      size: true,
      color: true,
      price: true,
      compareAtPrice: true,
      status: true,
      optionValues: {
        orderBy: { optionValue: { sortOrder: "asc" as const } },
        select: {
          optionValue: {
            select: {
              id: true,
              displayName: true,
              normalizedValue: true,
              sortOrder: true,
              hex: true,
              swatch: true,
              optionType: { select: { id: true, name: true, normalizedName: true, sortOrder: true } },
            },
          },
        },
      },
      inventory: {
        select: { trackingEnabled: true, onHand: true, reserved: true, lowStockThreshold: true },
      },
    },
  },
  categories: {
    where: { category: { status: "ACTIVE" } },
    select: { category: { select: { id: true, name: true, slug: true } } },
  },
  collections: {
    where: { collection: { status: "ACTIVE" } },
    select: { collection: { select: { id: true, name: true, slug: true } } },
  },
  tags: {
    select: { tag: { select: { id: true, name: true, slug: true } } },
  },
} satisfies Prisma.ProductSelect;

const publicCatalogListSelect = {
  ...publicCatalogSelect,
  images: {
    ...publicCatalogSelect.images,
    take: 1,
  },
} satisfies Prisma.ProductSelect;

export type PublicCatalogProductRecord = Prisma.ProductGetPayload<{
  select: typeof publicCatalogSelect;
}>;

export async function queryPublishedCatalogProducts(
  options: CatalogQueryRepositoryOptions,
  client?: CatalogRepositoryClient,
): Promise<CatalogListResult<PublicCatalogProductRecord>> {
  const repository = clientOrDefault(client);
  const limit = clampLimit(options.limit);
  const offset = normalizeOffset(options.offset);
  const where = buildPublicCatalogWhere(options.filters);
  const sortBy = options.sortBy ?? "createdAt";
  const sortDirection = options.sortDirection ?? "desc";
  if (sortBy === "merchandising") {
    const context: MerchandisingContext | undefined = options.filters?.collectionSlug ? "collection" : options.filters?.categorySlug ? "category" : undefined;
    if (!context) throw new Error("Merchandising sorting requires a collection or category filter.");
    return queryMerchandisedCatalogProducts({ ...options, context }, client);
  }
  const orderBy: Prisma.ProductOrderByWithRelationInput[] = [
    { [CATALOG_SORT_FIELDS[sortBy]]: sortDirection },
    { id: sortDirection },
  ];

  const [items, total] = await Promise.all([
    repository.product.findMany({ where, orderBy, skip: offset, take: limit, select: publicCatalogListSelect }),
    repository.product.count({ where }),
  ]);

  return { items, total, limit, offset, hasNextPage: offset + items.length < total };
}

export type CatalogSearchMode = "PUBLIC" | "INTERNAL";

export type CatalogSearchRepositoryOptions = CatalogQueryRepositoryOptions & {
  query: string;
  mode: CatalogSearchMode;
};

function buildCatalogSearchWhere(
  options: CatalogSearchRepositoryOptions,
): Prisma.ProductWhereInput {
  const base =
    options.mode === "PUBLIC"
      ? buildPublicCatalogWhere(options.filters)
      : buildInternalCatalogWhere(options.filters);

  const query = options.query;
  const searchableFields: Prisma.ProductWhereInput[] = [
    { title: { contains: query, mode: "insensitive" } },
    { shortDescription: { contains: query, mode: "insensitive" } },
    { description: { contains: query, mode: "insensitive" } },
    { slug: { contains: query, mode: "insensitive" } },
    {
      tags: {
        some: { tag: { name: { contains: query, mode: "insensitive" } } },
      },
    },
    {
      categories: {
        some: { category: { name: { contains: query, mode: "insensitive" } } },
      },
    },
    {
      collections: {
        some: { collection: { name: { contains: query, mode: "insensitive" } } },
      },
    },
    {
      variants: {
        some: {
          OR: [
            { displayName: { contains: query, mode: "insensitive" } },
            { size: { contains: query, mode: "insensitive" } },
            { color: { contains: query, mode: "insensitive" } },
            { optionValues: { some: { optionValue: { displayName: { contains: query, mode: "insensitive" } } } } },
            { optionValues: { some: { optionValue: { optionType: { name: { contains: query, mode: "insensitive" } } } } } },
          ],
        },
      },
    },
  ];

  if (options.mode === "INTERNAL") {
    searchableFields.push(
      { variants: { some: { sku: { contains: query, mode: "insensitive" } } } },
    );
  }

  return { AND: [base, { OR: searchableFields }] };
}

function buildInternalCatalogWhere(
  filters: CatalogQueryRepositoryFilters = {},
): Prisma.ProductWhereInput {
  const and: Prisma.ProductWhereInput[] = [];

  if (filters.categorySlug) {
    and.push({ categories: { some: { category: { slug: filters.categorySlug } } } });
  }
  if (filters.collectionSlug) {
    and.push({ collections: { some: { collection: { slug: filters.collectionSlug } } } });
  }
  if (filters.tagSlugs?.length) {
    const tagFilters = filters.tagSlugs.map((slug) => ({ tags: { some: { tag: { slug } } } }));
    and.push(filters.tagMode === "OR" ? { OR: tagFilters } : { AND: tagFilters });
  }

  const priceWhere = buildEffectiveVariantPriceWhere(filters.minPrice, filters.maxPrice);
  if (priceWhere) and.push(priceWhere);

  const availabilityWhere = buildAvailabilityWhere(filters.inStock);
  if (availabilityWhere) and.push(availabilityWhere);

  return and.length ? { AND: and } : {};
}

export async function searchCatalogProducts(
  options: CatalogSearchRepositoryOptions,
  client?: CatalogRepositoryClient,
): Promise<CatalogListResult<PublicCatalogProductRecord>> {
  const repository = clientOrDefault(client);
  const limit = clampLimit(options.limit);
  const offset = normalizeOffset(options.offset);
  const where = buildCatalogSearchWhere(options);
  const sortBy = options.sortBy ?? "createdAt";
  const sortDirection = options.sortDirection ?? "desc";
  if (sortBy === "merchandising") {
    return searchMerchandisedCatalogProducts(options, client);
  }
  const orderBy: Prisma.ProductOrderByWithRelationInput[] = [
    { [CATALOG_SORT_FIELDS[sortBy]]: sortDirection },
    { id: sortDirection },
  ];

  const [items, total] = await Promise.all([
    repository.product.findMany({
      where,
      orderBy,
      skip: offset,
      take: limit,
      select: publicCatalogListSelect,
    }),
    repository.product.count({ where }),
  ]);

  return { items, total, limit, offset, hasNextPage: offset + items.length < total };
}

export type MerchandisingContext = "collection" | "category";

export type MerchandisingQueryOptions = CatalogQueryRepositoryOptions & {
  context: MerchandisingContext;
};

function merchandisingContextSlug(options: CatalogQueryRepositoryOptions, context: MerchandisingContext): string {
  const slug = context === "collection" ? options.filters?.collectionSlug : options.filters?.categorySlug;
  if (!slug) throw new Error("Merchandising sorting requires a collection or category filter.");
  return slug;
}

function buildMerchandisingProductWhere(
  options: CatalogQueryRepositoryOptions,
): Prisma.ProductWhereInput {
  return buildPublicCatalogWhere(options.filters);
}

export async function queryMerchandisedCatalogProducts(
  options: MerchandisingQueryOptions,
  client?: CatalogRepositoryClient,
): Promise<CatalogListResult<PublicCatalogProductRecord>> {
  const repository = clientOrDefault(client);
  const limit = clampLimit(options.limit);
  const offset = normalizeOffset(options.offset);
  const slug = merchandisingContextSlug(options, options.context);
  const productWhere = buildMerchandisingProductWhere(options);
  if (options.context === "collection") {
    const relationWhere = {
      collection: { slug, status: "ACTIVE" as const },
      product: productWhere,
    };
    const [items, total] = await Promise.all([
      repository.productCollection.findMany({
        where: relationWhere,
        orderBy: [
          { isFeatured: "desc" },
          { priority: "desc" },
          { position: "asc" },
          { product: { createdAt: "desc" } },
          { product: { title: "asc" } },
          { productId: "asc" },
        ],
        skip: offset,
        take: limit,
        select: { product: { select: publicCatalogListSelect } },
      }),
      repository.productCollection.count({ where: relationWhere }),
    ]);
    return {
      items: items.map((item) => item.product),
      total,
      limit,
      offset,
      hasNextPage: offset + items.length < total,
    };
  }

  const relationWhere = {
    category: { slug, status: "ACTIVE" as const },
    product: productWhere,
  };
  const [items, total] = await Promise.all([
    repository.productCategory.findMany({
      where: relationWhere,
      orderBy: [
        { isFeatured: "desc" },
        { priority: "desc" },
        { position: "asc" },
        { product: { createdAt: "desc" } },
        { product: { title: "asc" } },
        { productId: "asc" },
      ],
      skip: offset,
      take: limit,
      select: { product: { select: publicCatalogListSelect } },
    }),
    repository.productCategory.count({ where: relationWhere }),
  ]);
  return {
    items: items.map((item) => item.product),
    total,
    limit,
    offset,
    hasNextPage: offset + items.length < total,
  };
}

export async function searchMerchandisedCatalogProducts(
  options: CatalogSearchRepositoryOptions,
  client?: CatalogRepositoryClient,
): Promise<CatalogListResult<PublicCatalogProductRecord>> {
  const repository = clientOrDefault(client);
  const limit = clampLimit(options.limit);
  const offset = normalizeOffset(options.offset);
  const filters = options.filters ?? {};
  const context: MerchandisingContext | undefined = filters.collectionSlug ? "collection" : filters.categorySlug ? "category" : undefined;
  if (!context) throw new Error("Merchandising sorting requires a collection or category filter.");
  const slug = merchandisingContextSlug(options, context);
  const productWhere = buildCatalogSearchWhere(options);
  if (context === "collection") {
    const relationWhere = {
      collection: { slug, status: "ACTIVE" as const },
      product: productWhere,
    };
    const [items, total] = await Promise.all([
      repository.productCollection.findMany({
        where: relationWhere,
        orderBy: [
          { isFeatured: "desc" },
          { priority: "desc" },
          { position: "asc" },
          { product: { createdAt: "desc" } },
          { product: { title: "asc" } },
          { productId: "asc" },
        ],
        skip: offset,
        take: limit,
        select: { product: { select: publicCatalogListSelect } },
      }),
      repository.productCollection.count({ where: relationWhere }),
    ]);
    return { items: items.map((item) => item.product), total, limit, offset, hasNextPage: offset + items.length < total };
  }

  const relationWhere = {
    category: { slug, status: "ACTIVE" as const },
    product: productWhere,
  };
  const [items, total] = await Promise.all([
    repository.productCategory.findMany({
      where: relationWhere,
      orderBy: [
        { isFeatured: "desc" },
        { priority: "desc" },
        { position: "asc" },
        { product: { createdAt: "desc" } },
        { product: { title: "asc" } },
        { productId: "asc" },
      ],
      skip: offset,
      take: limit,
      select: { product: { select: publicCatalogListSelect } },
    }),
    repository.productCategory.count({ where: relationWhere }),
  ]);
  return { items: items.map((item) => item.product), total, limit, offset, hasNextPage: offset + items.length < total };
}

export async function getPublishedProductBySlug(slug: string, client?: CatalogRepositoryClient) {
  return clientOrDefault(client).product.findFirst({
    where: { ...publishedProductWhere, slug },
    select: publicCatalogSelect,
  });
}

const publicProductDetailSelect = {
  id: true,
  title: true,
  slug: true,
  description: true,
  shortDescription: true,
  price: true,
  compareAtPrice: true,
  currency: true,
  status: true,
  seoTitle: true,
  seoDescription: true,
  images: {
    where: { productId: { not: null } },
    orderBy: [{ isPrimary: "desc" as const }, { sortOrder: "asc" as const }, { id: "asc" as const }],
    select: { id: true, url: true, mediaType: true, altText: true, sortOrder: true, isPrimary: true },
  },
  variants: {
    where: { status: "ACTIVE" },
    orderBy: [{ createdAt: "asc" as const }, { id: "asc" as const }],
    select: {
      id: true,
      displayName: true,
      size: true,
      color: true,
      price: true,
      compareAtPrice: true,
      images: {
        orderBy: [{ sortOrder: "asc" as const }, { id: "asc" as const }],
        select: { id: true, url: true, mediaType: true, altText: true, sortOrder: true, isPrimary: true },
      },
      optionValues: {
        orderBy: { optionValue: { sortOrder: "asc" as const } },
        select: {
          optionValue: {
            select: {
              id: true,
              displayName: true,
              normalizedValue: true,
              hex: true,
              swatch: true,
              optionType: { select: { id: true, name: true, normalizedName: true, sortOrder: true } },
            },
          },
        },
      },
      inventory: {
        select: { trackingEnabled: true, onHand: true, reserved: true, lowStockThreshold: true },
      },
    },
  },
  optionTypes: {
    orderBy: [{ sortOrder: "asc" as const }, { optionType: { normalizedName: "asc" as const } }],
    select: {
      sortOrder: true,
      optionType: {
        select: {
          id: true,
          name: true,
          normalizedName: true,
          sortOrder: true,
          values: {
            orderBy: [{ sortOrder: "asc" as const }, { displayName: "asc" as const }, { id: "asc" as const }],
            select: { id: true, displayName: true, normalizedValue: true, hex: true, swatch: true, sortOrder: true },
          },
        },
      },
    },
  },
  categories: {
    where: { category: { status: "ACTIVE" } },
    select: { category: { select: { id: true, name: true, slug: true, description: true, parentId: true } } },
  },
  collections: {
    where: { collection: { status: "ACTIVE" } },
    orderBy: [{ isFeatured: "desc" as const }, { priority: "desc" as const }, { position: "asc" as const }, { collectionId: "asc" as const }],
    select: { collection: { select: { id: true, name: true, slug: true, description: true } } },
  },
  tags: {
    select: { tag: { select: { id: true, name: true, slug: true } } },
  },
} satisfies Prisma.ProductSelect;

export type PublicCatalogProductDetailRecord = Prisma.ProductGetPayload<{
  select: typeof publicProductDetailSelect;
}>;

export async function getPublishedProductDetailsBySlug(slug: string, client?: CatalogRepositoryClient) {
  return clientOrDefault(client).product.findFirst({
    where: { ...publishedProductWhere, slug },
    select: publicProductDetailSelect,
  });
}

export async function getCategoryBySlug(slug: string, client?: CatalogRepositoryClient) {
  return clientOrDefault(client).category.findUnique({ where: { slug } });
}

export async function listActiveCategories(client?: CatalogRepositoryClient) {
  return clientOrDefault(client).category.findMany({
    where: { status: "ACTIVE" },
    orderBy: [{ parentId: "asc" }, { name: "asc" }, { id: "asc" }],
    select: { id: true, name: true, slug: true, description: true, seoTitle: true, seoDescription: true, parentId: true, status: true },
  });
}

export async function getCategoryTree(client?: CatalogRepositoryClient) {
  return clientOrDefault(client).category.findMany({
    where: { status: "ACTIVE" },
    orderBy: [{ parentId: "asc" }, { name: "asc" }, { id: "asc" }],
    include: { children: { where: { status: "ACTIVE" }, orderBy: [{ name: "asc" }, { id: "asc" }] } },
  });
}

export async function getCollectionBySlug(slug: string, client?: CatalogRepositoryClient) {
  return clientOrDefault(client).collection.findUnique({ where: { slug } });
}

export async function listActiveCollections(client?: CatalogRepositoryClient) {
  return clientOrDefault(client).collection.findMany({
    where: { status: "ACTIVE" },
    orderBy: [{ name: "asc" }, { id: "asc" }],
    select: { id: true, name: true, slug: true, description: true, seoTitle: true, seoDescription: true, status: true },
  });
}

export async function getTagBySlug(slug: string, client?: CatalogRepositoryClient) {
  return clientOrDefault(client).tag.findUnique({ where: { slug } });
}

export async function listTags(client?: CatalogRepositoryClient) {
  return clientOrDefault(client).tag.findMany({
    orderBy: [{ name: "asc" }, { id: "asc" }],
    select: { id: true, name: true, slug: true },
  });
}

export async function listProductsForExport(
  options: {
    ids?: string[];
    categoryId?: string;
    collectionId?: string;
    status?: "DRAFT" | "ACTIVE" | "ARCHIVED";
    modifiedAfter?: Date;
  } = {},
  client?: CatalogRepositoryClient,
) {
  const repository = clientOrDefault(client);
  const where: Prisma.ProductWhereInput = {
    ...(options.ids?.length ? { id: { in: options.ids } } : {}),
    ...(options.categoryId ? { categories: { some: { categoryId: options.categoryId } } } : {}),
    ...(options.collectionId ? { collections: { some: { collectionId: options.collectionId } } } : {}),
    ...(options.status ? { status: options.status } : {}),
    ...(options.modifiedAfter ? { updatedAt: { gt: options.modifiedAfter } } : {}),
  };
  return repository.product.findMany({
    where,
    orderBy: [{ id: "asc" }],
    include: productExportInclude,
  });
}

export async function getProductById(id: string, client?: CatalogRepositoryClient) {
  return clientOrDefault(client).product.findUnique({ where: { id } });
}

export async function getProductBySlug(slug: string, client?: CatalogRepositoryClient) {
  return clientOrDefault(client).product.findUnique({ where: { slug } });
}

export async function getProductWithVariants(id: string, client?: CatalogRepositoryClient) {
  return clientOrDefault(client).product.findUnique({
    where: { id },
    include: productWithVariantsInclude,
  });
}

export async function getProductDetails(id: string, client?: CatalogRepositoryClient) {
  return clientOrDefault(client).product.findUnique({
    where: { id },
    include: productDetailsInclude,
  });
}

export async function listPublishedProducts(
  options: Omit<CatalogListOptions, "filters"> = {},
  client?: CatalogRepositoryClient,
) {
  const repository = clientOrDefault(client);
  const limit = clampLimit(options.limit);
  const offset = normalizeOffset(options.offset);
  const sortBy = options.sortBy ?? "createdAt";
  const sortDirection = options.sortDirection ?? "desc";
  if (sortBy === "merchandising") {
    throw new Error("Merchandising sorting requires a category or collection query.");
  }
  const orderBy: Prisma.ProductOrderByWithRelationInput[] = [
    { [CATALOG_SORT_FIELDS[sortBy]]: sortDirection },
    { id: sortDirection },
  ];
  const [items, total] = await Promise.all([
    repository.product.findMany({
      where: publishedProductWhere,
      orderBy,
      skip: offset,
      take: limit,
      include: {
        variants: { where: { status: "ACTIVE" }, orderBy: { createdAt: "asc" } },
        images: {
          where: {
            OR: [
              { productId: { not: null } },
              { variant: { status: "ACTIVE" } },
            ],
          },
          orderBy: { sortOrder: "asc" },
        },
      },
    }),
    repository.product.count({ where: publishedProductWhere }),
  ]);
  return { items, total, limit, offset, hasNextPage: offset + items.length < total };
}

export async function listProducts(
  options: CatalogListOptions = {},
  client?: CatalogRepositoryClient,
  baseWhere?: Prisma.ProductWhereInput,
): Promise<CatalogListResult<Awaited<ReturnType<typeof getProductById>>>> {
  const repository = clientOrDefault(client);
  const limit = clampLimit(options.limit);
  const offset = normalizeOffset(options.offset);
  const filtersWhere = buildListWhere(options.filters);
  const where: Prisma.ProductWhereInput = {
    ...baseWhere,
    ...filtersWhere,
  };

  const sortBy = options.sortBy ?? "createdAt";
  const sortDirection = options.sortDirection ?? "desc";
  if (sortBy === "merchandising") {
    throw new Error("Merchandising sorting requires a category or collection query.");
  }
  const orderBy: Prisma.ProductOrderByWithRelationInput[] = [
    { [CATALOG_SORT_FIELDS[sortBy]]: sortDirection },
    { id: sortDirection },
  ];

  const [items, total] = await Promise.all([
    repository.product.findMany({ where, orderBy, skip: offset, take: limit }),
    repository.product.count({ where }),
  ]);

  return { items, total, limit, offset, hasNextPage: offset + items.length < total };
}

export async function createProduct(data: Prisma.ProductCreateInput, client?: CatalogRepositoryClient) {
  return clientOrDefault(client).product.create({ data });
}

export async function updateProduct(id: string, data: Prisma.ProductUpdateInput, client?: CatalogRepositoryClient) {
  return clientOrDefault(client).product.update({ where: { id }, data });
}

export async function transitionProductStatus(
  id: string,
  from: "DRAFT" | "ACTIVE" | "ARCHIVED",
  to: "DRAFT" | "ACTIVE" | "ARCHIVED",
  client?: CatalogRepositoryClient,
) {
  const repository = clientOrDefault(client);
  const result = await repository.product.updateMany({
    where: { id, status: from },
    data: { status: to },
  });
  if (result.count !== 1) return null;
  return repository.product.findUnique({ where: { id } });
}

export async function createOptionType(data: Prisma.VariantOptionTypeCreateInput, client?: CatalogRepositoryClient) {
  return clientOrDefault(client).variantOptionType.create({ data });
}
export async function getOptionTypeById(id: string, client?: CatalogRepositoryClient) {
  return clientOrDefault(client).variantOptionType.findUnique({ where: { id } });
}
export async function getOptionTypeByNormalizedName(normalizedName: string, client?: CatalogRepositoryClient) {
  return clientOrDefault(client).variantOptionType.findUnique({ where: { normalizedName } });
}
export async function updateOptionType(id: string, data: Prisma.VariantOptionTypeUpdateInput, client?: CatalogRepositoryClient) {
  return clientOrDefault(client).variantOptionType.update({ where: { id }, data });
}
export async function createOptionValue(data: Prisma.VariantOptionValueCreateInput, client?: CatalogRepositoryClient) {
  return clientOrDefault(client).variantOptionValue.create({ data });
}
export async function getOptionValueByIdentity(optionTypeId: string, normalizedValue: string, client?: CatalogRepositoryClient) {
  return clientOrDefault(client).variantOptionValue.findUnique({
    where: { optionTypeId_normalizedValue: { optionTypeId, normalizedValue } },
    include: { optionType: true },
  });
}
export async function getOptionValueById(id: string, client?: CatalogRepositoryClient) {
  return clientOrDefault(client).variantOptionValue.findUnique({ where: { id }, include: { optionType: true } });
}
export async function listOptionValues(optionTypeId: string, client?: CatalogRepositoryClient) {
  return clientOrDefault(client).variantOptionValue.findMany({
    where: { optionTypeId },
    orderBy: [{ sortOrder: "asc" }, { displayName: "asc" }, { id: "asc" }],
  });
}
export async function updateOptionValue(id: string, data: Prisma.VariantOptionValueUpdateInput, client?: CatalogRepositoryClient) {
  return clientOrDefault(client).variantOptionValue.update({ where: { id }, data });
}
export async function assignProductOptionType(productId: string, optionTypeId: string, sortOrder = 0, client?: CatalogRepositoryClient) {
  return clientOrDefault(client).productOptionType.upsert({
    where: { productId_optionTypeId: { productId, optionTypeId } },
    create: { productId, optionTypeId, sortOrder },
    update: { sortOrder },
  });
}
export async function removeProductOptionType(productId: string, optionTypeId: string, client?: CatalogRepositoryClient) {
  return clientOrDefault(client).productOptionType.delete({
    where: { productId_optionTypeId: { productId, optionTypeId } },
  });
}
export async function listProductOptionTypes(productId: string, client?: CatalogRepositoryClient) {
  return clientOrDefault(client).productOptionType.findMany({
    where: { productId },
    include: { optionType: { include: { values: { orderBy: [{ sortOrder: "asc" }, { displayName: "asc" }, { id: "asc" }] } } } },
    orderBy: [{ sortOrder: "asc" }, { optionType: { normalizedName: "asc" } }],
  });
}
export async function replaceVariantOptionValues(
  variantId: string,
  optionValueIds: string[],
  client?: CatalogRepositoryClient,
) {
  const repository = clientOrDefault(client);
  await repository.productVariantOptionValue.deleteMany({ where: { variantId } });
  if (optionValueIds.length) {
    await repository.productVariantOptionValue.createMany({
      data: [...new Set(optionValueIds)].map((optionValueId) => ({ variantId, optionValueId })),
      skipDuplicates: true,
    });
  }
}
export async function getVariantOptionValues(variantId: string, client?: CatalogRepositoryClient) {
  return clientOrDefault(client).productVariantOptionValue.findMany({
    where: { variantId },
    include: { optionValue: { include: { optionType: true } } },
    orderBy: { optionValue: { sortOrder: "asc" } },
  });
}

export async function createVariant(data: Prisma.ProductVariantCreateInput, client?: CatalogRepositoryClient) {
  return clientOrDefault(client).productVariant.create({ data });
}

export async function getVariantById(id: string, client?: CatalogRepositoryClient) {
  return clientOrDefault(client).productVariant.findUnique({ where: { id } });
}

export async function getVariantsByProduct(productId: string, client?: CatalogRepositoryClient) {
  return clientOrDefault(client).productVariant.findMany({
    where: { productId },
    orderBy: { createdAt: "asc" },
    include: {
      optionValues: {
        include: { optionValue: { include: { optionType: true } } },
        orderBy: { optionValue: { sortOrder: "asc" } },
      },
    },
  });
}

export async function updateVariant(id: string, data: Prisma.ProductVariantUpdateInput, client?: CatalogRepositoryClient) {
  return clientOrDefault(client).productVariant.update({ where: { id }, data });
}

export async function deactivateVariant(id: string, client?: CatalogRepositoryClient) {
  return updateVariant(id, { status: "INACTIVE" }, client);
}

export async function createImage(data: Prisma.ProductImageCreateInput, client?: CatalogRepositoryClient) {
  return clientOrDefault(client).productImage.create({ data });
}

export async function getImageById(id: string, client?: CatalogRepositoryClient) {
  return clientOrDefault(client).productImage.findUnique({ where: { id } });
}

export async function listProductImages(productId: string, client?: CatalogRepositoryClient) {
  return clientOrDefault(client).productImage.findMany({
    where: { productId },
    orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }, { id: "asc" }],
  });
}

export async function listVariantImages(variantId: string, client?: CatalogRepositoryClient) {
  return clientOrDefault(client).productImage.findMany({
    where: { variantId },
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
  });
}

export async function getPrimaryProductImage(productId: string, client?: CatalogRepositoryClient) {
  return clientOrDefault(client).productImage.findFirst({
    where: { productId, isPrimary: true },
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
  });
}

export async function updateImage(id: string, data: Prisma.ProductImageUpdateInput, client?: CatalogRepositoryClient) {
  return clientOrDefault(client).productImage.update({ where: { id }, data });
}

export async function deleteImage(id: string, client?: CatalogRepositoryClient) {
  return clientOrDefault(client).productImage.delete({ where: { id } });
}

export async function updateProductImagesPrimaryState(
  productId: string,
  exceptImageId: string | null,
  client?: CatalogRepositoryClient,
) {
  const repository = clientOrDefault(client);
  return repository.productImage.updateMany({
    where: {
      productId,
      isPrimary: true,
      ...(exceptImageId ? { id: { not: exceptImageId } } : {}),
    },
    data: { isPrimary: false },
  });
}

export async function reorderImages(
  updates: Array<{ id: string; sortOrder: number }>,
  client?: CatalogRepositoryClient,
) {
  const repository = clientOrDefault(client);
  return Promise.all(updates.map(({ id, sortOrder }) =>
    repository.productImage.update({ where: { id }, data: { sortOrder } }),
  ));
}

export async function createCategory(data: Prisma.CategoryCreateInput, client?: CatalogRepositoryClient) {
  return clientOrDefault(client).category.create({ data });
}

export async function getCategoryById(id: string, client?: CatalogRepositoryClient) {
  return clientOrDefault(client).category.findUnique({ where: { id } });
}

export async function getCategoryHierarchy(client?: CatalogRepositoryClient) {
  return clientOrDefault(client).category.findMany({
    orderBy: [{ parentId: "asc" }, { name: "asc" }],
    include: { children: true },
  });
}

export async function updateCategory(id: string, data: Prisma.CategoryUpdateInput, client?: CatalogRepositoryClient) {
  return clientOrDefault(client).category.update({ where: { id }, data });
}

export async function archiveCategory(id: string, client?: CatalogRepositoryClient) {
  return updateCategory(id, { status: "ARCHIVED" }, client);
}

export async function createCollection(data: Prisma.CollectionCreateInput, client?: CatalogRepositoryClient) {
  return clientOrDefault(client).collection.create({ data });
}

export async function getCollectionById(id: string, client?: CatalogRepositoryClient) {
  return clientOrDefault(client).collection.findUnique({ where: { id } });
}

export async function updateCollection(id: string, data: Prisma.CollectionUpdateInput, client?: CatalogRepositoryClient) {
  return clientOrDefault(client).collection.update({ where: { id }, data });
}

export async function archiveCollection(id: string, client?: CatalogRepositoryClient) {
  return updateCollection(id, { status: "ARCHIVED" }, client);
}

export async function createTag(data: Prisma.TagCreateInput, client?: CatalogRepositoryClient) {
  return clientOrDefault(client).tag.create({ data });
}

export async function getTagById(id: string, client?: CatalogRepositoryClient) {
  return clientOrDefault(client).tag.findUnique({ where: { id } });
}

export async function getTagByName(name: string, client?: CatalogRepositoryClient) {
  return clientOrDefault(client).tag.findFirst({
    where: { name: { equals: name, mode: "insensitive" } },
  });
}

export async function updateTag(id: string, data: Prisma.TagUpdateInput, client?: CatalogRepositoryClient) {
  return clientOrDefault(client).tag.update({ where: { id }, data });
}

export async function deleteTag(id: string, client?: CatalogRepositoryClient) {
  return clientOrDefault(client).tag.delete({ where: { id } });
}

export async function attachCategory(
  productId: string,
  categoryId: string,
  data: { position?: number; priority?: number; isFeatured?: boolean } = {},
  client?: CatalogRepositoryClient,
) {
  return clientOrDefault(client).productCategory.create({
    data: {
      productId,
      categoryId,
      position: data.position ?? 0,
      priority: data.priority ?? 0,
      isFeatured: data.isFeatured ?? false,
    },
  });
}

export async function getProductCategory(productId: string, categoryId: string, client?: CatalogRepositoryClient) {
  return clientOrDefault(client).productCategory.findUnique({
    where: { productId_categoryId: { productId, categoryId } },
  });
}

export async function updateProductCategory(
  productId: string,
  categoryId: string,
  data: { position?: number; priority?: number; isFeatured?: boolean },
  client?: CatalogRepositoryClient,
) {
  return clientOrDefault(client).productCategory.update({
    where: { productId_categoryId: { productId, categoryId } },
    data,
  });
}

export async function detachCategory(productId: string, categoryId: string, client?: CatalogRepositoryClient) {
  return clientOrDefault(client).productCategory.delete({ where: { productId_categoryId: { productId, categoryId } } });
}

export async function attachCollection(
  productId: string,
  collectionId: string,
  data: { position?: number; priority?: number; isFeatured?: boolean } = {},
  client?: CatalogRepositoryClient,
) {
  return clientOrDefault(client).productCollection.create({
    data: {
      productId,
      collectionId,
      position: data.position ?? 0,
      priority: data.priority ?? 0,
      isFeatured: data.isFeatured ?? false,
    },
  });
}

export async function getProductCollection(productId: string, collectionId: string, client?: CatalogRepositoryClient) {
  return clientOrDefault(client).productCollection.findUnique({
    where: { productId_collectionId: { productId, collectionId } },
  });
}

export async function updateProductCollection(
  productId: string,
  collectionId: string,
  data: { position?: number; priority?: number; isFeatured?: boolean },
  client?: CatalogRepositoryClient,
) {
  return clientOrDefault(client).productCollection.update({
    where: { productId_collectionId: { productId, collectionId } },
    data,
  });
}

export async function listCollectionProducts(
  collectionId: string,
  client?: CatalogRepositoryClient,
) {
  return clientOrDefault(client).productCollection.findMany({
    where: { collectionId },
    orderBy: [
      { isFeatured: "desc" },
      { priority: "desc" },
      { position: "asc" },
      { product: { createdAt: "desc" } },
      { product: { title: "asc" } },
      { productId: "asc" },
    ],
    include: { product: true },
  });
}

export async function listCategoryProducts(
  categoryId: string,
  client?: CatalogRepositoryClient,
) {
  return clientOrDefault(client).productCategory.findMany({
    where: { categoryId },
    orderBy: [
      { isFeatured: "desc" },
      { priority: "desc" },
      { position: "asc" },
      { product: { createdAt: "desc" } },
      { product: { title: "asc" } },
      { productId: "asc" },
    ],
    include: { product: true },
  });
}

export async function reorderProductCollection(
  collectionId: string,
  updates: Array<{ productId: string; position: number; priority?: number; isFeatured?: boolean }>,
  client?: CatalogRepositoryClient,
) {
  const repository = clientOrDefault(client);
  return Promise.all(updates.map((update) =>
    repository.productCollection.update({
      where: { productId_collectionId: { productId: update.productId, collectionId } },
      data: {
        position: update.position,
        ...(update.priority === undefined ? {} : { priority: update.priority }),
        ...(update.isFeatured === undefined ? {} : { isFeatured: update.isFeatured }),
      },
    }),
  ));
}

export async function reorderProductCategory(
  categoryId: string,
  updates: Array<{ productId: string; position: number; priority?: number; isFeatured?: boolean }>,
  client?: CatalogRepositoryClient,
) {
  const repository = clientOrDefault(client);
  return Promise.all(updates.map((update) =>
    repository.productCategory.update({
      where: { productId_categoryId: { productId: update.productId, categoryId } },
      data: {
        position: update.position,
        ...(update.priority === undefined ? {} : { priority: update.priority }),
        ...(update.isFeatured === undefined ? {} : { isFeatured: update.isFeatured }),
      },
    }),
  ));
}



export async function detachCollection(productId: string, collectionId: string, client?: CatalogRepositoryClient) {
  return clientOrDefault(client).productCollection.delete({ where: { productId_collectionId: { productId, collectionId } } });
}

export async function attachTag(productId: string, tagId: string, client?: CatalogRepositoryClient) {
  return clientOrDefault(client).productTag.create({ data: { productId, tagId } });
}

export async function detachTag(productId: string, tagId: string, client?: CatalogRepositoryClient) {
  return clientOrDefault(client).productTag.delete({ where: { productId_tagId: { productId, tagId } } });
}

export async function replaceProductRelationships(
  productId: string,
  relationships: { categoryIds?: string[]; collectionIds?: string[]; tagIds?: string[] },
  client?: CatalogRepositoryClient,
) {
  const run = async (tx: CatalogRepositoryClient) => {
    if (relationships.categoryIds) {
      const desired = [...new Set(relationships.categoryIds)];
      const existing = await tx.productCategory.findMany({ where: { productId } });
      const existingIds = new Set(existing.map((item) => item.categoryId));
      await tx.productCategory.deleteMany({
        where: desired.length ? { productId, categoryId: { notIn: desired } } : { productId },
      });
      await Promise.all(desired.filter((categoryId) => !existingIds.has(categoryId)).map((categoryId) =>
        tx.productCategory.create({ data: { productId, categoryId } }),
      ));
    }

    if (relationships.collectionIds) {
      const desired = [...new Set(relationships.collectionIds)];
      const existing = await tx.productCollection.findMany({ where: { productId } });
      const existingIds = new Set(existing.map((item) => item.collectionId));
      await tx.productCollection.deleteMany({
        where: desired.length ? { productId, collectionId: { notIn: desired } } : { productId },
      });
      await Promise.all(desired.filter((collectionId) => !existingIds.has(collectionId)).map((collectionId) =>
        tx.productCollection.create({ data: { productId, collectionId } }),
      ));
    }

    if (relationships.tagIds) {
      const desired = [...new Set(relationships.tagIds)];
      await tx.productTag.deleteMany({
        where: desired.length ? { productId, tagId: { notIn: desired } } : { productId },
      });
      const existing = await tx.productTag.findMany({ where: { productId } });
      const existingIds = new Set(existing.map((item) => item.tagId));
      await Promise.all(desired.filter((tagId) => !existingIds.has(tagId)).map((tagId) =>
        tx.productTag.create({ data: { productId, tagId } }),
      ));
    }
  };

  if (client) {
    await run(client);
  } else {
    await db.$transaction(run);
  }
}

export async function withTransaction<T>(
  callback: (transaction: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  return db.$transaction(callback);
}

export async function getImportIdentity(
  entityType: "PRODUCT" | "VARIANT",
  namespace: string,
  externalReference: string,
  client?: CatalogRepositoryClient,
) {
  return clientOrDefault(client).catalogImportIdentity.findUnique({
    where: { entityType_namespace_externalReference: { entityType, namespace, externalReference } },
  });
}

export async function createImportIdentity(
  data: {
    entityType: "PRODUCT" | "VARIANT";
    namespace: string;
    externalReference: string;
    canonicalId: string;
  },
  client?: CatalogRepositoryClient,
) {
  return clientOrDefault(client).catalogImportIdentity.create({ data });
}


export async function deleteProductImage(id: string, client?: CatalogRepositoryClient) {
  return deleteImage(id, client);
}
