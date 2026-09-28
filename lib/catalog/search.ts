import { Prisma } from "@prisma/client";
import { CatalogServiceError } from "@/lib/catalog/errors";
import { validateMoney } from "@/lib/catalog/validation";
import * as catalogRepository from "@/lib/catalog/repository";
import {
  type CatalogAppliedQuery,
  type CatalogAvailability,
  type CatalogQuery,
  type CatalogSort,
} from "@/lib/catalog/query";
import {
  type CatalogListResult,
  type CatalogSearchMode as RepositoryCatalogSearchMode,
  type CatalogSearchRepositoryOptions,
  type PublicCatalogProductRecord,
  searchCatalogProducts,
} from "@/lib/catalog/repository";

export const CATALOG_SEARCH_QUERY_MIN = 1;
export const CATALOG_SEARCH_QUERY_MAX = 100;

export type CatalogSearchMode = RepositoryCatalogSearchMode;

export type CatalogSearchQuery = CatalogQuery & {
  query: string;
  mode?: CatalogSearchMode;
};

export type NormalizedCatalogSearchQuery = {
  query: string;
  mode: CatalogSearchMode;
  catalog: CatalogAppliedQuery;
};

export type CatalogSearchResultItem = {
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
  availability: CatalogAvailability;
  categories: Array<{ id: string; name: string; slug: string }>;
  collections: Array<{ id: string; name: string; slug: string }>;
  tags: Array<{ id: string; name: string; slug: string }>;
  internalVariants?: Array<{
    id: string;
    sku: string;
    displayName: string | null;
    size: string | null;
    color: string | null;
    effectivePrice: string;
    compareAtPrice: string | null;
    availability: CatalogAvailability;
  }>;
};

export type CatalogSearchResult = {
  items: CatalogSearchResultItem[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
  };
  appliedQuery: NormalizedCatalogSearchQuery;
};

export interface CatalogSearchProvider {
  search(request: NormalizedCatalogSearchQuery): Promise<CatalogListResult<PublicCatalogProductRecord>>;
}

export class DatabaseSearchAdapter implements CatalogSearchProvider {
  async search(request: NormalizedCatalogSearchQuery) {
    const sort: CatalogSort = request.catalog.sort;
    const sortBy: CatalogSearchRepositoryOptions["sortBy"] =
      sort === "newest" || sort === "oldest"
        ? "createdAt"
        : sort === "updated"
          ? "updatedAt"
          : sort === "title_asc" || sort === "title_desc"
            ? "title"
            : "price";

    const sortDirection: CatalogSearchRepositoryOptions["sortDirection"] =
      sort === "oldest" || sort === "title_asc" || sort === "price_asc" ? "asc" : "desc";

    return searchCatalogProducts({
      query: request.query,
      mode: request.mode,
      filters: {
        categorySlug: request.catalog.category,
        collectionSlug: request.catalog.collection,
        tagSlugs: request.catalog.tags,
        tagMode: request.catalog.tagMode,
        minPrice: request.catalog.minPrice,
        maxPrice: request.catalog.maxPrice,
        inStock: request.catalog.inStock,
      },
      sortBy,
      sortDirection,
      limit: request.catalog.pageSize,
      offset: (request.catalog.page - 1) * request.catalog.pageSize,
    });
  }
}

function normalizeSearchTerm(value: string): string {
  const normalized = value
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();

  if (!normalized) {
    throw new CatalogServiceError("INVALID_QUERY", "Search query cannot be empty.");
  }
  if (normalized.length < CATALOG_SEARCH_QUERY_MIN) {
    throw new CatalogServiceError("INVALID_QUERY", "Search query is too short.");
  }
  if (normalized.length > CATALOG_SEARCH_QUERY_MAX) {
    throw new CatalogServiceError(
      "INVALID_QUERY",
      "Search query cannot exceed " + CATALOG_SEARCH_QUERY_MAX + " characters.",
    );
  }

  return normalized.replace(/([\\%_])/g, "\\$1");
}

function toSearchItem(
  product: PublicCatalogProductRecord,
  mode: CatalogSearchMode,
): CatalogSearchResultItem {
  const variants = product.variants.map((variant) => {
    const effectivePrice = variant.price ?? product.price;
    const availableQuantity = variant.inventory?.trackingEnabled
      ? variant.inventory.onHand - variant.inventory.reserved
      : null;
    const availability =
      !variant.inventory
        ? { state: "UNTRACKED" as const, availableQuantity: null }
        : {
            state: getAvailabilityState(variant.inventory),
            availableQuantity,
          };

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

  const price = variants.reduce(
    (current, variant) =>
      current === null ||
      new Prisma.Decimal(variant.effectivePrice).lt(new Prisma.Decimal(current.effectivePrice))
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
    primaryImage: product.images[0]
      ? {
          id: product.images[0].id,
          url: product.images[0].url,
          altText: product.images[0].altText,
        }
      : null,
    price: price?.effectivePrice ?? product.price.toString(),
    compareAtPrice: price?.compareAtPrice ?? product.compareAtPrice?.toString() ?? null,
    currency: product.currency,
    availability: availableVariant?.availability ?? { state: "OUT_OF_STOCK", availableQuantity: 0 },
    categories: product.categories.map(({ category }) => category),
    collections: product.collections.map(({ collection }) => collection),
    tags: product.tags.map(({ tag }) => tag),
    ...(mode === "INTERNAL" ? { internalVariants: variants } : {}),
  };
}

function getAvailabilityState(inventory: {
  trackingEnabled: boolean;
  onHand: number;
  reserved: number;
  lowStockThreshold: number;
}): CatalogAvailability["state"] {
  if (!inventory.trackingEnabled) return "UNTRACKED";
  const available = inventory.onHand - inventory.reserved;
  if (available <= 0) return "OUT_OF_STOCK";
  if (available <= inventory.lowStockThreshold) return "LOW_STOCK";
  return "IN_STOCK";
}

function normalizeCatalogSearchQuery(input: CatalogSearchQuery): NormalizedCatalogSearchQuery {
  if (typeof input.query !== "string") {
    throw new CatalogServiceError("INVALID_QUERY", "Search query must be a string.");
  }

  const query = normalizeSearchTerm(input.query);
  const mode = input.mode ?? "PUBLIC";
  if (mode !== "PUBLIC" && mode !== "INTERNAL") {
    throw new CatalogServiceError("INVALID_QUERY", "Search mode must be PUBLIC or INTERNAL.");
  }

  const catalogQuery: CatalogQuery = { ...input };
  delete catalogQuery.query;
  delete catalogQuery.mode;

  return {
    query,
    mode,
    catalog: {
      ...normalizeCatalogQuery(catalogQuery),
    },
  };
}

function normalizeCatalogQuery(input: CatalogQuery): CatalogAppliedQuery {
  const category = input.category === undefined ? undefined : normalizeSlug(input.category, "category");
  const collection = input.collection === undefined ? undefined : normalizeSlug(input.collection, "collection");
  const tags = (input.tags ?? [])
    .map((tag) => normalizeSlug(tag, "tag"))
    .filter(Boolean);
  const uniqueTags = [...new Set(tags)];
  const minPrice = input.minPrice === undefined ? undefined : normalizeMoney(input.minPrice, "minPrice");
  const maxPrice = input.maxPrice === undefined ? undefined : normalizeMoney(input.maxPrice, "maxPrice");

  if (input.tagMode !== undefined && input.tagMode !== "AND" && input.tagMode !== "OR") {
    throw new CatalogServiceError("INVALID_QUERY", "tagMode must be AND or OR.");
  }

  if (minPrice !== undefined && maxPrice !== undefined &&
      new Prisma.Decimal(minPrice).gt(new Prisma.Decimal(maxPrice))) {
    throw new CatalogServiceError(
      "INVALID_PRICE_RANGE",
      "Minimum price must be less than or equal to maximum price.",
    );
  }

  const sort = input.sort ?? "newest";
  if (!["newest", "oldest", "price_asc", "price_desc", "title_asc", "title_desc", "updated"].includes(sort)) {
    throw new CatalogServiceError("INVALID_SORT", "Unsupported catalog sort.");
  }

  const page = input.page ?? 1;
  if (!Number.isInteger(page) || page < 1) {
    throw new CatalogServiceError("INVALID_PAGE", "Page must be a positive integer.");
  }

  const pageSize = input.pageSize ?? 24;
  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100) {
    throw new CatalogServiceError("INVALID_PAGE", "Page size must be a positive integer no greater than 100.");
  }

  return {
    category,
    collection,
    tags: uniqueTags,
    tagMode: input.tagMode ?? "AND",
    minPrice,
    maxPrice,
    inStock: input.inStock ?? false,
    sort,
    page,
    pageSize,
  };
}

function normalizeSlug(value: string, field: string): string {
  const normalized = value.trim().toLowerCase();
  if (!normalized) throw new CatalogServiceError("INVALID_QUERY", field + " cannot be empty.");
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(normalized)) {
    throw new CatalogServiceError("INVALID_QUERY", field + " must be a canonical catalog slug.");
  }
  return normalized;
}

function normalizeMoney(value: string | number, field: string): string {
  const issues = validateMoney(value, field);
  if (issues.length) {
    throw new CatalogServiceError("INVALID_QUERY", issues[0].message);
  }
  return String(value);
}

export function createCatalogSearchService(options: {
  provider?: CatalogSearchProvider;
  lookup?: {
    getCategoryBySlug: (slug: string) => Promise<unknown>;
    getCollectionBySlug: (slug: string) => Promise<unknown>;
    listTags: () => Promise<Array<{ slug: string }>>;
  };
} = {}) {
  const provider = options.provider ?? new DatabaseSearchAdapter();
  const lookup = options.lookup ?? {
    getCategoryBySlug: catalogRepository.getCategoryBySlug,
    getCollectionBySlug: catalogRepository.getCollectionBySlug,
    listTags: async () => catalogRepository.listTags(),
  };

  return {
    async search(input: CatalogSearchQuery): Promise<CatalogSearchResult> {
      const normalized = normalizeCatalogSearchQuery(input);

      {
        if (normalized.catalog.category && !(await lookup.getCategoryBySlug(normalized.catalog.category))) {
          throw new CatalogServiceError("CATEGORY_NOT_FOUND", "Category was not found.");
        }
        if (normalized.catalog.collection && !(await lookup.getCollectionBySlug(normalized.catalog.collection))) {
          throw new CatalogServiceError("COLLECTION_NOT_FOUND", "Collection was not found.");
        }
        if (normalized.catalog.tags.length) {
          const availableTags = new Set((await lookup.listTags()).map((tag) => tag.slug));
          const missingTag = normalized.catalog.tags.find((tag) => !availableTags.has(tag));
          if (missingTag) {
            throw new CatalogServiceError("TAG_NOT_FOUND", "Tag was not found: " + missingTag + ".");
          }
        }
      }

      try {
        const result = await provider.search(normalized);
        return {
          items: result.items.map((item) => toSearchItem(item, normalized.mode)),
          pagination: {
            page: normalized.catalog.page,
            pageSize: normalized.catalog.pageSize,
            total: result.total,
            totalPages: result.total === 0 ? 0 : Math.ceil(result.total / normalized.catalog.pageSize),
            hasNextPage: result.hasNextPage,
          },
          appliedQuery: normalized,
        };
      } catch (error) {
        if (error instanceof CatalogServiceError) throw error;
        throw new CatalogServiceError("CATALOG_DATABASE_ERROR", "Catalog search failed.", error);
      }
    },

    async searchPublic(input: Omit<CatalogSearchQuery, "mode">): Promise<CatalogSearchResult> {
      return this.search({ ...input, mode: "PUBLIC" });
    },

    async searchInternal(input: Omit<CatalogSearchQuery, "mode">): Promise<CatalogSearchResult> {
      return this.search({ ...input, mode: "INTERNAL" });
    },
  };
}
