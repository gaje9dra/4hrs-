import { Prisma } from "@prisma/client";
import { CatalogServiceError } from "@/lib/catalog/errors";
import * as repository from "@/lib/catalog/repository";
import { getInventoryAvailability, type InventoryAvailability } from "@/lib/inventory/repository";
import { validateMoney } from "@/lib/catalog/validation";

export const CATALOG_QUERY_PAGE_DEFAULT = 24;
export const CATALOG_QUERY_PAGE_MAX = 100;

export type CatalogSort =
  | "newest"
  | "oldest"
  | "price_asc"
  | "price_desc"
  | "title_asc"
  | "title_desc"
  | "updated";

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

export type CatalogVariantSummary = {
  id: string;
  sku: string;
  displayName: string | null;
  size: string | null;
  color: string | null;
  effectivePrice: string;
  compareAtPrice: string | null;
  availability: CatalogAvailability;
};

export type CatalogListItem = {
  id: string;
  title: string;
  slug: string;
  primaryImage: {
    id: string;
    url: string;
    altText: string | null;
  } | null;
  price: string;
  compareAtPrice: string | null;
  currency: string;
  status: "ACTIVE";
  variants: CatalogVariantSummary[];
  categories: Array<{ id: string; name: string; slug: string }>;
  collections: Array<{ id: string; name: string; slug: string }>;
  tags: Array<{ id: string; name: string; slug: string }>;
  availability: CatalogAvailability;
};

export type CatalogListResult = {
  items: CatalogListItem[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
  };
  appliedQuery: CatalogAppliedQuery;
};

export type PublishedProductResult = CatalogListItem;

type QueryRepository = {
  queryPublishedCatalogProducts: typeof repository.queryPublishedCatalogProducts;
  getPublishedProductBySlug: typeof repository.getPublishedProductBySlug;
  getCategoryBySlug: typeof repository.getCategoryBySlug;
  listActiveCategories: typeof repository.listActiveCategories;
  getCategoryTree: typeof repository.getCategoryTree;
  getCollectionBySlug: typeof repository.getCollectionBySlug;
  listActiveCollections: typeof repository.listActiveCollections;
  getTagBySlug: typeof repository.getTagBySlug;
  listTags: typeof repository.listTags;
};

const defaultRepository: QueryRepository = {
  queryPublishedCatalogProducts: repository.queryPublishedCatalogProducts,
  getPublishedProductBySlug: repository.getPublishedProductBySlug,
  getCategoryBySlug: repository.getCategoryBySlug,
  listActiveCategories: repository.listActiveCategories,
  getCategoryTree: repository.getCategoryTree,
  getCollectionBySlug: repository.getCollectionBySlug,
  listActiveCollections: repository.listActiveCollections,
  getTagBySlug: repository.getTagBySlug,
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
  return String(value);
}

function normalizePage(value: number | undefined): number {
  if (value === undefined) return 1;
  if (!Number.isInteger(value) || value < 1) {
    throw new CatalogServiceError("INVALID_PAGE", "Page must be a positive integer.");
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

function normalizeQuery(query: CatalogQuery): CatalogAppliedQuery {
  const category = query.category === undefined ? undefined : normalizeSlug(query.category, "category");
  const collection = query.collection === undefined ? undefined : normalizeSlug(query.collection, "collection");
  const tags = normalizeTags(query.tags);
  const minPrice = normalizeMoney(query.minPrice, "minPrice");
  const maxPrice = normalizeMoney(query.maxPrice, "maxPrice");

  if (query.tagMode !== undefined && query.tagMode !== "AND" && query.tagMode !== "OR") {\n    throw new CatalogServiceError("INVALID_QUERY", "tagMode must be AND or OR.");\n  }\n\n  if (minPrice !== undefined && maxPrice !== undefined) {
    const min = Number(minPrice);
    const max = Number(maxPrice);
    if (min > max) {
      throw new CatalogServiceError("INVALID_PRICE_RANGE", "Minimum price must be less than or equal to maximum price.");
    }
  }

  const sort = query.sort ?? "newest";
  if (!(sort in SORT_MAP)) {
    throw new CatalogServiceError("INVALID_SORT", "Unsupported catalog sort.");
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

function mapProduct(product: Awaited<ReturnType<QueryRepository["getPublishedProductBySlug"]>> extends infer T
  ? Exclude<T, null>
  : never): CatalogListItem {
  const variants = product.variants.map((variant) => {
    const effectivePrice = variant.price ?? product.price;
    const availability = availabilityFromVariant(variant);
    return {
      id: variant.id,
      sku: variant.sku,
      displayName: variant.displayName,
      size: variant.size,
      color: variant.color,
      effectivePrice: effectivePrice.toString(),
      compareAtPrice: variant.compareAtPrice?.toString() ?? product.compareAtPrice?.toString() ?? null,
      availability,
    };
  });

  const cheapest = variants.reduce((current, variant) =>
    current === null || new Prisma.Decimal(variant.effectivePrice).lt(new Prisma.Decimal(current.effectivePrice)) ? variant : current,
    null as CatalogVariantSummary | null,
  );

  const availableVariant = variants.find((variant) =>
    variant.availability.state === "IN_STOCK" || variant.availability.state === "LOW_STOCK" || variant.availability.state === "UNTRACKED",
  );
  const availability = availableVariant?.availability ?? {
    state: "OUT_OF_STOCK" as const,
    availableQuantity: 0,
  };

  return {
    id: product.id,
    title: product.title,
    slug: product.slug,
    primaryImage: product.images[0]
      ? { id: product.images[0].id, url: product.images[0].url, altText: product.images[0].altText }
      : null,
    price: cheapest?.effectivePrice ?? product.price.toString(),
    compareAtPrice: cheapest?.compareAtPrice ?? product.compareAtPrice?.toString() ?? null,
    currency: product.currency,
    status: "ACTIVE",
    variants,
    categories: product.categories.map(({ category }) => category),
    collections: product.collections.map(({ collection }) => collection),
    tags: product.tags.map(({ tag }) => tag),
    availability,
  };
}

export function createCatalogQueryService(customRepository: Partial<QueryRepository> = {}) {
  const repo = { ...defaultRepository, ...customRepository };

  return {
    async listPublishedProducts(query: CatalogQuery = {}): Promise<CatalogListResult> {
      const appliedQuery = normalizeQuery(query);

      if (appliedQuery.category && !(await repo.getCategoryBySlug(appliedQuery.category))) {
        throw new CatalogServiceError("CATEGORY_NOT_FOUND", "Category was not found.");
      }
      if (appliedQuery.collection && !(await repo.getCollectionBySlug(appliedQuery.collection))) {
        throw new CatalogServiceError("COLLECTION_NOT_FOUND", "Collection was not found.");
      }
      for (const tag of appliedQuery.tags) {
        if (!(await repo.getTagBySlug(tag))) {
          throw new CatalogServiceError("TAG_NOT_FOUND", "Tag was not found: " + tag + ".");
        }
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

      const totalPages = result.total === 0 ? 0 : Math.ceil(result.total / appliedQuery.pageSize);
      return {
        items: result.items.map(mapProduct),
        pagination: {
          page: appliedQuery.page,
          pageSize: appliedQuery.pageSize,
          total: result.total,
          totalPages,
          hasNextPage: result.hasNextPage,
        },
        appliedQuery,
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

    async getCategoryTree() {
      return repo.getCategoryTree();
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
