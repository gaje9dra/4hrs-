import type { Prisma, PrismaClient } from "@prisma/client";
import { db } from "@/lib/db/client";

export const CATALOG_PAGE_DEFAULT = 24;
export const CATALOG_PAGE_MAX = 100;

export const CATALOG_SORT_FIELDS = {
  createdAt: "createdAt",
  updatedAt: "updatedAt",
  title: "title",
  price: "price",
} as const;

export type CatalogSortField = keyof typeof CATALOG_SORT_FIELDS;
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

const productWithVariantsInclude = {
  variants: { orderBy: { createdAt: "asc" as const } },
} satisfies Prisma.ProductInclude;

const publishedProductWhere: Prisma.ProductWhereInput = {
  status: "ACTIVE",
  variants: { some: { status: "ACTIVE" } },
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
  const orderBy = { [CATALOG_SORT_FIELDS[sortBy]]: sortDirection } as Prisma.ProductOrderByWithRelationInput;

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

export async function archiveProduct(id: string, client?: CatalogRepositoryClient) {
  return updateProduct(id, { status: "ARCHIVED" }, client);
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

export async function updateTag(id: string, data: Prisma.TagUpdateInput, client?: CatalogRepositoryClient) {
  return clientOrDefault(client).tag.update({ where: { id }, data });
}

export async function deleteTag(id: string, client?: CatalogRepositoryClient) {
  return clientOrDefault(client).tag.delete({ where: { id } });
}

export async function attachCategory(productId: string, categoryId: string, client?: CatalogRepositoryClient) {
  return clientOrDefault(client).productCategory.create({ data: { productId, categoryId } });
}

export async function detachCategory(productId: string, categoryId: string, client?: CatalogRepositoryClient) {
  return clientOrDefault(client).productCategory.delete({ where: { productId_categoryId: { productId, categoryId } } });
}

export async function attachCollection(productId: string, collectionId: string, client?: CatalogRepositoryClient) {
  return clientOrDefault(client).productCollection.create({ data: { productId, collectionId } });
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
  const repository = clientOrDefault(client);
  const operations: Prisma.PrismaPromise<unknown>[] = [];

  if (relationships.categoryIds) {
    operations.push(repository.productCategory.deleteMany({ where: { productId } }));
    operations.push(...[...new Set(relationships.categoryIds)].map((categoryId) =>
      repository.productCategory.create({ data: { productId, categoryId } }),
    ));
  }
  if (relationships.collectionIds) {
    operations.push(repository.productCollection.deleteMany({ where: { productId } }));
    operations.push(...[...new Set(relationships.collectionIds)].map((collectionId) =>
      repository.productCollection.create({ data: { productId, collectionId } }),
    ));
  }
  if (relationships.tagIds) {
    operations.push(repository.productTag.deleteMany({ where: { productId } }));
    operations.push(...[...new Set(relationships.tagIds)].map((tagId) =>
      repository.productTag.create({ data: { productId, tagId } }),
    ));
  }

  if (operations.length > 0) await repository.$transaction(operations);
}

export async function withTransaction<T>(
  callback: (transaction: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  return db.$transaction(callback);
}

export async function deleteProductImage(id: string, client?: CatalogRepositoryClient) {
  return deleteImage(id, client);
}
