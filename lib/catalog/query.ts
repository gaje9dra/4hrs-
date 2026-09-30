import { Prisma } from "@prisma/client";
import { CatalogServiceError } from "@/lib/catalog/errors";
import * as repository from "@/lib/catalog/repository";
import { getInventoryAvailability, type InventoryAvailability } from "@/lib/inventory/repository";
import { validateMoney } from "@/lib/catalog/validation";
import { logCatalogObservation, type CatalogSurface } from "@/lib/catalog/observability";

export const CATALOG_QUERY_PAGE_DEFAULT = 24;
export const CATALOG_QUERY_PAGE_MAX = 100;
export const CATALOG_QUERY_PAGE_NUMBER_MAX = 10000;
export const CATALOG_QUERY_MAX_TAGS = 20;

export type CatalogSort =
  | "newest"
  | "oldest"
  | "price_asc"
  | "price_desc"
  | "title_asc"
  | "title_desc"
  | "updated"
  | "merchandising";

export type CatalogQuery = {
  category?: string;
  collection?: string;
  tags?: string[];
  tagMode?: "AND" | "OR";
  minPrice?: string | number;
  maxPrice?: string | number;
  inStock?: boolean;
  sort?: CatalogSort;
  page?: number;
  pageSize?: number;
};

export type CatalogAppliedQuery = {
  category?: string;
  collection?: string;
  tags: string[];
  tagMode: "AND" | "OR";
  minPrice?: string;
  maxPrice?: string;
  inStock: boolean;
  sort: CatalogSort;
  page: number;
  pageSize: number;
};

export type CatalogAvailability = {
  state: InventoryAvailability;
  availableQuantity: number | null;
};

export type CatalogListItem = {
  title: string;
  slug: string;
  primaryImage: {
    url: string;
    altText: string | null;
  } | null;
  price: string;
  compareAtPrice: string | null;
  currency: string;
  status: "ACTIVE";
  availability: InventoryAvailability;
};

export type CatalogListResult = {
  items: CatalogListItem[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    isOutOfRange: boolean;
  };
  appliedQuery: CatalogAppliedQuery;
};

export type PublishedProductResult = CatalogListItem;

export type CatalogProductMedia = {
  id: string;
  url: string;
  altText: string | null;
  sortOrder: number;
  isPrimary: boolean;
  mediaType: "IMAGE";
};

export type CatalogProductOptionValue = {
  id: string;
  displayName: string;
  normalizedValue: string;
  hex: string | null;
  swatch: string | null;
};

export type CatalogProductOption = {
  id: string;
  name: string;
  normalizedName: string;
  sortOrder: number;
  values: CatalogProductOptionValue[];
};

export type CatalogProductVariant = {
  id: string;
  displayName: string | null;
  size: string | null;
  color: string | null;
  price: string;
  compareAtPrice: string | null;
  availability: CatalogAvailability;
  media: CatalogProductMedia[];
  optionValues: Array<CatalogProductOptionValue & { optionType: { id: string; name: string; normalizedName: string } }>;
};

export type PublishedProductDetailResult = {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  shortDescription: string | null;
  price: string;
  compareAtPrice: string | null;
  currency: string;
  status: "ACTIVE";
  seoTitle: string | null;
  seoDescription: string | null;
  media: CatalogProductMedia[];
  variants: CatalogProductVariant[];
  options: CatalogProductOption[];
  categories: Array<{ id: string; name: string; slug: string; description: string | null; parentId: string | null }>;
  collections: Array<{ id: string; name: string; slug: string; description: string | null }>;
  tags: Array<{ id: string; name: string; slug: string }>;
  availability: CatalogAvailability;
};

type QueryRepository = {
  queryPublishedCatalogProducts: typeof repository.queryPublishedCatalogProducts;
  getPublishedProductBySlug: typeof repository.getPublishedProductBySlug;
  getPublishedProductDetailsBySlug: typeof repository.getPublishedProductDetailsBySlug;
  getCategoryBySlug: typeof repository.getCategoryBySlug;
  listActiveCategories: typeof repository.listActiveCategories;
  listActiveCategoriesWithPublishedProducts: typeof repository.listActiveCategoriesWithPublishedProducts;
  getCollectionBySlug: typeof repository.getCollectionBySlug;
  listActiveCollections: typeof repository.listActiveCollections;
  listActiveCollectionsWithPublishedProducts: typeof repository.listActiveCollectionsWithPublishedProducts;
  getTagBySlug: typeof repository.getTagBySlug;
  getTagsBySlugs: typeof repository.getTagsBySlugs;
  listTags: typeof repository.listTags;
};

const defaultRepository: QueryRepository = {
  queryPublishedCatalogProducts: repository.queryPublishedCatalogProducts,
  getPublishedProductBySlug: repository.getPublishedProductBySlug,
  getPublishedProductDetailsBySlug: repository.getPublishedProductDetailsBySlug,
  getCategoryBySlug: repository.getCategoryBySlug,
  listActiveCategories: repository.listActiveCategories,
  listActiveCategoriesWithPublishedProducts: repository.listActiveCategoriesWithPublishedProducts,
  getCollectionBySlug: repository.getCollectionBySlug,
  listActiveCollections: repository.listActiveCollections,
  listActiveCollectionsWithPublishedProducts: repository.listActiveCollectionsWithPublishedProducts,
  getTagBySlug: repository.getTagBySlug,
  getTagsBySlugs: repository.getTagsBySlugs,
  listTags: repository.listTags,
};

const SORT_MAP: Record<CatalogSort, { sortBy: repository.CatalogSortField; sortDirection: repository.SortDirection }> = {
  newest: { sortBy: "createdAt", sortDirection: "desc" },
  oldest: { sortBy: "createdAt", sortDirection: "asc" },
  price_asc: { sortBy: "price", sortDirection: "asc" },
  price_desc: { sortBy: "price", sortDirection: "desc" },
  title_asc: { sortBy: "title", sortDirection: "asc" },
  title_desc: { sortBy: "title", sortDirection: "desc" },
  updated: { sortBy: "updatedAt", sortDirection: "desc" },
  merchandising: { sortBy: "merchandising", sortDirection: "asc" },
};

function invalidQuery(message: string, cause?: unknown): never {
  throw new CatalogServiceError("INVALID_QUERY", message, cause);
}

function normalizeSlug(value: string, field: string): string {
  const normalized = value.trim().toLowerCase();
  if (!normalized) invalidQuery(field + " cannot be empty.");
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(normalized)) {
    throw new CatalogServiceError("INVALID_QUERY", field + " must be a canonical catalog slug.");
  }
  return normalized;
}

function normalizeTags(tags: string[] | undefined): string[] {
  if (!tags) return [];
  const normalized = tags
    .map((tag) => normalizeSlug(tag, "tag"))
    .filter(Boolean);
  return [...new Set(normalized)];
}

function normalizeMoney(value: string | number | undefined, field: string): string | undefined {
  if (value === undefined) return undefined;
  const issues = validateMoney(value, field);
  if (issues.length) invalidQuery(issues[0].message);
  return new Prisma.Decimal(String(value)).toFixed(2);
}

function formatMoney(value: Prisma.Decimal | string | number | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  return new Prisma.Decimal(String(value)).toFixed(2);
}

function formatValidCompareAtPrice(
  sellingPrice: Prisma.Decimal | string | number,
  compareAtPrice: Prisma.Decimal | string | number | null | undefined,
): string | null {
  if (compareAtPrice === null || compareAtPrice === undefined) return null;
  const selling = new Prisma.Decimal(String(sellingPrice));
  const compareAt = new Prisma.Decimal(String(compareAtPrice));
  return compareAt.gte(selling) ? compareAt.toFixed(2) : null;
}

function normalizePage(value: number | undefined): number {
  if (value === undefined) return 1;
  if (!Number.isInteger(value) || value < 1 || value > CATALOG_QUERY_PAGE_NUMBER_MAX) {
    throw new CatalogServiceError(
      "INVALID_PAGE",
      "Page must be an integer from 1 to " + CATALOG_QUERY_PAGE_NUMBER_MAX + ".",
    );
  }
  return value;
}

function normalizePageSize(value: number | undefined): number {
  if (value === undefined) return CATALOG_QUERY_PAGE_DEFAULT;
  if (!Number.isInteger(value) || value < 1 || value > CATALOG_QUERY_PAGE_MAX) {
    throw new CatalogServiceError(
      "INVALID_PAGE",
      "Page size must be a positive integer no greater than " + CATALOG_QUERY_PAGE_MAX + ".",
    );
  }
  return value;
}

export function normalizeCatalogQuery(query: CatalogQuery): CatalogAppliedQuery {
  const category = query.category === undefined ? undefined : normalizeSlug(query.category, "category");
  const collection = query.collection === undefined ? undefined : normalizeSlug(query.collection, "collection");
  const tags = normalizeTags(query.tags);
  if (tags.length > CATALOG_QUERY_MAX_TAGS) {
    invalidQuery("No more than " + CATALOG_QUERY_MAX_TAGS + " tags may be selected.");
  }
  const minPrice = normalizeMoney(query.minPrice, "minPrice");
  const maxPrice = normalizeMoney(query.maxPrice, "maxPrice");

  if (query.tagMode !== undefined && query.tagMode !== "AND" && query.tagMode !== "OR") {
    throw new CatalogServiceError("INVALID_QUERY", "tagMode must be AND or OR.");
  }

  if (minPrice !== undefined && maxPrice !== undefined) {
    const min = new Prisma.Decimal(minPrice);
    const max = new Prisma.Decimal(maxPrice);
    if (min.gt(max)) {
      throw new CatalogServiceError("INVALID_PRICE_RANGE", "Minimum price must be less than or equal to maximum price.");
    }
  }

  const sort = query.sort ?? "newest";
  if (!(sort in SORT_MAP)) {
    throw new CatalogServiceError("INVALID_SORT", "Unsupported catalog sort.");
  }
  if (sort === "merchandising" && !category && !collection) {
    throw new CatalogServiceError(
      "INVALID_SORT",
      "Merchandising sorting requires a category or collection filter.",
    );
  }

  return {
    category,
    collection,
    tags,
    tagMode: query.tagMode ?? "AND",
    minPrice,
    maxPrice,
    inStock: query.inStock ?? false,
    sort,
    page: normalizePage(query.page),
    pageSize: normalizePageSize(query.pageSize),
  };
}

function availabilityFromVariant(variant: {
  inventory: {
    trackingEnabled: boolean;
    onHand: number;
    reserved: number;
    lowStockThreshold: number;
  } | null;
}): CatalogAvailability {
  if (!variant.inventory) return { state: "UNTRACKED", availableQuantity: null };
  const state = getInventoryAvailability(variant.inventory);
  const availableQuantity = variant.inventory.trackingEnabled
    ? variant.inventory.onHand - variant.inventory.reserved
    : null;
  return { state, availableQuantity };
}

function mapProduct(product: {
  title: string;
  slug: string;
  price: Prisma.Decimal | string | number;
  compareAtPrice: Prisma.Decimal | string | number | null;
  currency: string;
  status: "ACTIVE" | "DRAFT" | "ARCHIVED";
  images: Array<{ id: string; url: string; altText: string | null }>;
  variants: Array<{
    id: string;
    price: Prisma.Decimal | string | number | null;
    compareAtPrice: Prisma.Decimal | string | number | null;
    inventory: {
      trackingEnabled: boolean;
      onHand: number;
      reserved: number;
      lowStockThreshold: number;
    } | null;
  }>;
}): CatalogListItem {
  const variants = product.variants.map((variant) => {
    const effectivePrice = variant.price ?? product.price;
    const availability = availabilityFromVariant(variant);
    return {
      effectivePrice: formatMoney(effectivePrice)!,
      compareAtPrice: formatMoney(variant.compareAtPrice) ?? formatMoney(product.compareAtPrice),
      availability,
    };
  });

  const cheapest = variants.reduce(
    (current, variant) =>
      current === null || new Prisma.Decimal(variant.effectivePrice).lt(new Prisma.Decimal(current.effectivePrice))
        ? variant
        : current,
    null as (typeof variants)[number] | null,
  );
  const availableVariant = variants.find((variant) =>
    variant.availability.state === "IN_STOCK" ||
    variant.availability.state === "LOW_STOCK" ||
    variant.availability.state === "UNTRACKED",
  );

  return {
    title: product.title,
    slug: product.slug,
    primaryImage: product.images[0]
      ? { url: product.images[0].url, altText: product.images[0].altText }
      : null,
    price: cheapest?.effectivePrice ?? formatMoney(product.price)!,
    compareAtPrice: cheapest?.compareAtPrice ?? formatMoney(product.compareAtPrice),
    currency: product.currency,
    status: "ACTIVE",
    availability: availableVariant?.availability.state ?? "OUT_OF_STOCK",
  };
}

function validateVariantMatrix(
  product: PublishedProductDetailResult,
  variants: PublishedProductDetailResult["variants"],
) {
  const optionTypeIds = new Set(product.options.map((option) => option.id));
  const optionValueIdsByType = new Map(
    product.options.map((option) => [option.id, new Set(option.values.map((value) => value.id))]),
  );
  const seenCombinations = new Set<string>();

  for (const variant of variants) {
    const seenOptionTypes = new Set<string>();

    for (const optionValue of variant.optionValues) {
      const optionTypeId = optionValue.optionType.id;
      const allowedValues = optionValueIdsByType.get(optionTypeId);
      if (!optionTypeIds.has(optionTypeId) || !allowedValues?.has(optionValue.id) || seenOptionTypes.has(optionTypeId)) {
        throw new CatalogServiceError("CATALOG_DATA_INTEGRITY_ERROR", "Catalog variant options could not be rendered safely.");
      }
      seenOptionTypes.add(optionTypeId);
    }

    if (seenOptionTypes.size !== optionTypeIds.size) {
      throw new CatalogServiceError("CATALOG_DATA_INTEGRITY_ERROR", "Catalog variant options could not be rendered safely.");
    }

    const combination = [...optionTypeIds]
      .sort()
      .map((optionTypeId) => {
        const value = variant.optionValues.find((optionValue) => optionValue.optionType.id === optionTypeId);
        return `${optionTypeId}=${value?.id ?? ""}`;
      })
      .join("|");

    if (seenCombinations.has(combination)) {
      throw new CatalogServiceError("CATALOG_DATA_INTEGRITY_ERROR", "Catalog contains duplicate variant option combinations.");
    }
    seenCombinations.add(combination);
  }
}

export function createCatalogQueryService(customRepository: Partial<QueryRepository> = {}) {
  const repo = { ...defaultRepository, ...customRepository };

  return {
    async listPublishedProducts(query: CatalogQuery = {}, observation?: { surface: CatalogSurface }): Promise<CatalogListResult> {
      const startedAt = Date.now();
      let appliedQuery: CatalogAppliedQuery | undefined;

      try {
        appliedQuery = normalizeCatalogQuery(query);

        const [category, collection, tags] = await Promise.all([
          appliedQuery.category ? repo.getCategoryBySlug(appliedQuery.category) : Promise.resolve(null),
          appliedQuery.collection ? repo.getCollectionBySlug(appliedQuery.collection) : Promise.resolve(null),
          appliedQuery.tags.length ? repo.getTagsBySlugs(appliedQuery.tags) : Promise.resolve([]),
        ]);

        if (appliedQuery.category && !category) {
          throw new CatalogServiceError("CATEGORY_NOT_FOUND", "Category was not found.");
        }
        if (appliedQuery.collection && !collection) {
          throw new CatalogServiceError("COLLECTION_NOT_FOUND", "Collection was not found.");
        }
        if (tags.length !== appliedQuery.tags.length) {
          const found = new Set(tags.map((tag) => tag.slug));
          const missingTag = appliedQuery.tags.find((tag) => !found.has(tag));
          throw new CatalogServiceError("TAG_NOT_FOUND", "Tag was not found: " + missingTag + ".");
        }

        const sort = SORT_MAP[appliedQuery.sort];
        const offset = (appliedQuery.page - 1) * appliedQuery.pageSize;
        if (!Number.isSafeInteger(offset)) {
          throw new CatalogServiceError("INVALID_PAGE", "Requested page is too large.");
        }

        const result = await repo.queryPublishedCatalogProducts({
          filters: {
            categorySlug: appliedQuery.category,
            collectionSlug: appliedQuery.collection,
            tagSlugs: appliedQuery.tags,
            tagMode: appliedQuery.tagMode,
            minPrice: appliedQuery.minPrice,
            maxPrice: appliedQuery.maxPrice,
            inStock: appliedQuery.inStock,
          },
          sortBy: sort.sortBy,
          sortDirection: sort.sortDirection,
          limit: appliedQuery.pageSize,
          offset,
        });

        const calculatedTotalPages = result.total === 0 ? 0 : Math.ceil(result.total / appliedQuery.pageSize);
        const totalPages = Math.min(calculatedTotalPages, CATALOG_QUERY_PAGE_NUMBER_MAX);
        const isOutOfRange = result.total > 0 && appliedQuery.page > totalPages;
        const items = result.items.map((item) => {
          try {
            return mapProduct(item);
          } catch (error) {
            throw new CatalogServiceError(
              "CATALOG_DATA_INTEGRITY_ERROR",
              "Catalog data could not be rendered safely.",
              error,
            );
          }
        });

        return {
          items,
          pagination: {
            page: appliedQuery.page,
            pageSize: appliedQuery.pageSize,
            total: result.total,
            totalPages,
            hasNextPage: result.hasNextPage && appliedQuery.page < totalPages,
            isOutOfRange,
          },
          appliedQuery,
        };
      } catch (error) {
        const classification =
          error instanceof CatalogServiceError
            ? error.code === "CATEGORY_NOT_FOUND" || error.code === "COLLECTION_NOT_FOUND" || error.code === "TAG_NOT_FOUND"
              ? "not_found"
              : error.code.startsWith("INVALID_")
                ? "invalid_query"
                : error.code === "CATALOG_DATABASE_ERROR"
                  ? "database_failure"
                  : error.code === "CATALOG_DATA_INTEGRITY_ERROR"
                    ? "catalog_data_integrity"
                    : "unexpected_application_failure"
            : "database_failure";

        if (observation) {
          logCatalogObservation({
            surface: observation.surface,
            operation: "listPublishedProducts",
            classification,
            durationMs: Date.now() - startedAt,
            query: appliedQuery,
          });
        }

        if (error instanceof CatalogServiceError) throw error;
        throw new CatalogServiceError("CATALOG_DATABASE_ERROR", "Catalog data could not be loaded.", error);
      }
    },

    async getPublishedProductDetailsBySlug(slug: string): Promise<PublishedProductDetailResult> {
      const normalizedSlug = normalizeSlug(slug, "slug");
      const product = await repo.getPublishedProductDetailsBySlug(normalizedSlug);
      if (!product) throw new CatalogServiceError("PRODUCT_NOT_FOUND", "Published product was not found.");

      const variants = product.variants.map((variant) => {
        const effectivePrice = variant.price ?? product.price;
        return {
          id: variant.id,
          displayName: variant.displayName,
          size: variant.size,
          color: variant.color,
          price: formatMoney(effectivePrice)!,
          compareAtPrice:
            formatValidCompareAtPrice(effectivePrice, variant.compareAtPrice) ??
            formatValidCompareAtPrice(effectivePrice, product.compareAtPrice),
          availability: availabilityFromVariant(variant),
          media: variant.images,
          optionValues: variant.optionValues.map(({ optionValue }) => ({
            id: optionValue.id,
            displayName: optionValue.displayName,
            normalizedValue: optionValue.normalizedValue,
            hex: optionValue.hex,
            swatch: optionValue.swatch,
            optionType: {
              id: optionValue.optionType.id,
              name: optionValue.optionType.name,
              normalizedName: optionValue.optionType.normalizedName,
            },
          })),
        };
      });

      const mappedProduct: PublishedProductDetailResult = {
        id: product.id,
        title: product.title,
        slug: product.slug,
        description: product.description,
        shortDescription: product.shortDescription,
        price: formatMoney(product.price)!,
        compareAtPrice: formatValidCompareAtPrice(product.price, product.compareAtPrice),
        currency: product.currency,
        status: "ACTIVE",
        seoTitle: product.seoTitle,
        seoDescription: product.seoDescription,
        media: product.images,
        variants,
        options: product.optionTypes.map(({ optionType, sortOrder }) => ({
          id: optionType.id,
          name: optionType.name,
          normalizedName: optionType.normalizedName,
          sortOrder,
          values: optionType.values,
        })),
        categories: product.categories.map(({ category }) => category),
        collections: product.collections.map(({ collection }) => collection),
        tags: product.tags.map(({ tag }) => tag),
        availability: { state: "OUT_OF_STOCK", availableQuantity: null },
      };
      validateVariantMatrix(mappedProduct, variants);

      const cheapestVariant = variants.reduce(
        (current, variant) =>
          current === null || new Prisma.Decimal(variant.price).lt(new Prisma.Decimal(current.price))
            ? variant
            : current,
        null as (typeof variants)[number] | null,
      );
      const availableVariant = variants.find((variant) =>
        variant.availability.state === "IN_STOCK" ||
        variant.availability.state === "LOW_STOCK" ||
        variant.availability.state === "UNTRACKED",
      );

      return {
        id: product.id,
        title: product.title,
        slug: product.slug,
        description: product.description,
        shortDescription: product.shortDescription,
        price: cheapestVariant?.price ?? formatMoney(product.price)!,
        compareAtPrice:
          cheapestVariant?.compareAtPrice ??
          formatValidCompareAtPrice(product.price, product.compareAtPrice),
        currency: product.currency,
        status: "ACTIVE",
        seoTitle: product.seoTitle,
        seoDescription: product.seoDescription,
        media: product.images,
        variants,
        options: product.optionTypes.map(({ optionType, sortOrder }) => ({
          id: optionType.id,
          name: optionType.name,
          normalizedName: optionType.normalizedName,
          sortOrder,
          values: optionType.values,
        })),
        categories: product.categories.map(({ category }) => category),
        collections: product.collections.map(({ collection }) => collection),
        tags: product.tags.map(({ tag }) => tag),
        availability: availableVariant?.availability ?? { state: "OUT_OF_STOCK", availableQuantity: 0 },
      };
    },

    async getPublishedProductBySlug(slug: string): Promise<PublishedProductResult> {
      const normalizedSlug = normalizeSlug(slug, "slug");
      const product = await repo.getPublishedProductBySlug(normalizedSlug);
      if (!product) throw new CatalogServiceError("PRODUCT_NOT_FOUND", "Published product was not found.");
      return mapProduct(product);
    },

    async listActiveCategories() {
      return repo.listActiveCategories();
    },

    async listActiveCategoriesWithPublishedProducts() {
      return repo.listActiveCategoriesWithPublishedProducts();
    },

    async getCategoryTree() {
      const categories = await repo.listActiveCategories();
      const nodes = new Map(categories.map((category) => [category.id, { ...category, children: [] as Array<unknown> }]));
      const roots: Array<(typeof nodes extends Map<string, infer V> ? V : never)> = [];
      for (const category of categories) {
        const node = nodes.get(category.id)!;
        if (category.parentId && nodes.has(category.parentId)) {
          const parent = nodes.get(category.parentId)!;
          (parent.children as Array<typeof node>).push(node);
        } else {
          roots.push(node);
        }
      }
      return roots;
    },

    async getCategoryBySlug(slug: string) {
      const normalizedSlug = normalizeSlug(slug, "category");
      const category = await repo.getCategoryBySlug(normalizedSlug);
      if (!category || category.status !== "ACTIVE") {
        throw new CatalogServiceError("CATEGORY_NOT_FOUND", "Category was not found.");
      }
      return category;
    },

    async listActiveCollections() {
      return repo.listActiveCollections();
    },

    async listActiveCollectionsWithPublishedProducts() {
      return repo.listActiveCollectionsWithPublishedProducts();
    },

    async getCollectionBySlug(slug: string) {
      const normalizedSlug = normalizeSlug(slug, "collection");
      const collection = await repo.getCollectionBySlug(normalizedSlug);
      if (!collection || collection.status !== "ACTIVE") {
        throw new CatalogServiceError("COLLECTION_NOT_FOUND", "Collection was not found.");
      }
      return collection;
    },

    async listTags() {
      return repo.listTags();
    },

    async getTagBySlug(slug: string) {
      const normalizedSlug = normalizeSlug(slug, "tag");
      const tag = await repo.getTagBySlug(normalizedSlug);
      if (!tag) throw new CatalogServiceError("TAG_NOT_FOUND", "Tag was not found.");
      return tag;
    },
  };
}

export type CatalogQueryService = ReturnType<typeof createCatalogQueryService>;
