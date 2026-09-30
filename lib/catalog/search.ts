import { Prisma } from "@prisma/client";
import { CatalogServiceError } from "@/lib/catalog/errors";
import { logCatalogObservation } from "@/lib/catalog/observability";
import * as catalogRepository from "@/lib/catalog/repository";
import {
  type CatalogAppliedQuery,
  type CatalogAvailability,
  type CatalogListItem,
  type CatalogQuery,
  type CatalogSort,
  normalizeCatalogQuery,
} from "@/lib/catalog/query";
import {
  type RepositoryCatalogListResult,
  type RepositoryCatalogSearchMode,
  type CatalogSearchRepositoryOptions,
  type PublicCatalogProductRecord,
  type PublicCatalogProductListRecord,
  searchCatalogProducts,
} from "@/lib/catalog/repository";

export const CATALOG_SEARCH_QUERY_MIN = 1;
export const CATALOG_SEARCH_QUERY_MAX = 100;
export const CATALOG_SEARCH_SLOW_THRESHOLD_MS = 1000;

export type CatalogSearchMode = RepositoryCatalogSearchMode;

export type CatalogSearchQuery = CatalogQuery & {
  query: string;
  mode?: CatalogSearchMode;
};

export type NormalizedCatalogSearchQuery = {
  query: string;
  mode: CatalogSearchMode;
  catalog: CatalogAppliedQuery;
  ranking: "relevance" | "catalog";
};

export type CatalogSearchResultItem = {
  id?: string;
  title: string;
  slug: string;
  primaryImage: {
    id?: string;
    url: string;
    altText: string | null;
  } | null;
  price: string;
  compareAtPrice: string | null;
  currency: string;
  availability: CatalogAvailability;
  categories?: Array<{ id: string; name: string; slug: string }>;
  collections?: Array<{ id: string; name: string; slug: string }>;
  tags?: Array<{ id: string; name: string; slug: string }>;
  internalVariants?: Array<{
    id: string;
    sku: string;
    displayName: string | null;
    size: string | null;
    color: string | null;
    optionValues: Array<{
      id: string;
      displayName: string;
      normalizedValue: string;
      optionType: { id: string; name: string; normalizedName: string };
    }>;
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
    isOutOfRange: boolean;
  };
  appliedQuery: NormalizedCatalogSearchQuery;
};

export interface CatalogSearchProvider {
  search(request: NormalizedCatalogSearchQuery): Promise<RepositoryCatalogListResult<PublicCatalogProductRecord | PublicCatalogProductListRecord>>;
}

export class DatabaseSearchAdapter implements CatalogSearchProvider {
  async search(request: NormalizedCatalogSearchQuery) {
    const sort: CatalogSort = request.catalog.sort;
    const sortBy: CatalogSearchRepositoryOptions["sortBy"] =
      sort === "merchandising"
        ? "merchandising"
        : sort === "newest" || sort === "oldest"
          ? "createdAt"
          : sort === "updated"
            ? "updatedAt"
            : sort === "title_asc" || sort === "title_desc"
              ? "title"
              : "price";

    const sortDirection: CatalogSearchRepositoryOptions["sortDirection"] =
      sort === "merchandising" || sort === "oldest" || sort === "title_asc" || sort === "price_asc" ? "asc" : "desc";

    return searchCatalogProducts({
      query: request.query,
      mode: request.mode,
      relevance: request.ranking === "relevance",
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

export function normalizeCatalogSearchQueryParameter(value: string): string {
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

  return normalized;
}

function normalizeSearchTerm(value: string): string {
  return normalizeCatalogSearchQueryParameter(value).replace(/([\\%_])/g, "\\$1");
}

function toSearchItem(product: PublicCatalogProductRecord | PublicCatalogProductListRecord, mode: CatalogSearchMode): CatalogSearchResultItem {
  if (mode === "PUBLIC") {
    const variants = product.variants.map((variant) => ({
      effectivePrice: formatMoney(variant.price ?? product.price)!,
      compareAtPrice: formatMoney(variant.compareAtPrice) ?? formatMoney(product.compareAtPrice),
      availability: variant.inventory
        ? { state: getAvailabilityState(variant.inventory), availableQuantity: variant.inventory.trackingEnabled ? variant.inventory.onHand - variant.inventory.reserved : null }
        : { state: "UNTRACKED" as const, availableQuantity: null },
    }));
    const price = variants.reduce((current, variant) => current === null || new Prisma.Decimal(variant.effectivePrice).lt(new Prisma.Decimal(current.effectivePrice)) ? variant : current, null as (typeof variants)[number] | null);
    const availableVariant = variants.find((variant) => variant.availability.state === "IN_STOCK" || variant.availability.state === "LOW_STOCK" || variant.availability.state === "UNTRACKED");
    return {
      title: product.title, slug: product.slug,
      primaryImage: product.images[0] ? { url: product.images[0].url, altText: product.images[0].altText } : null,
      price: price?.effectivePrice ?? formatMoney(product.price)!,
      compareAtPrice: price?.compareAtPrice ?? formatMoney(product.compareAtPrice),
      currency: product.currency,
      availability: availableVariant?.availability ?? { state: "OUT_OF_STOCK", availableQuantity: 0 },
    };
  }
  const fullProduct = product as PublicCatalogProductRecord;
  const variants = fullProduct.variants.map((variant) => {
    const effectivePrice = variant.price ?? fullProduct.price;
    const availableQuantity = variant.inventory?.trackingEnabled ? variant.inventory.onHand - variant.inventory.reserved : null;
    const availability = !variant.inventory ? { state: "UNTRACKED" as const, availableQuantity: null } : { state: getAvailabilityState(variant.inventory), availableQuantity };
    return {
      id: variant.id, sku: variant.sku, displayName: variant.displayName, size: variant.size, color: variant.color,
      optionValues: variant.optionValues.map(({ optionValue }) => ({ id: optionValue.id, displayName: optionValue.displayName, normalizedValue: optionValue.normalizedValue, optionType: { id: optionValue.optionType.id, name: optionValue.optionType.name, normalizedName: optionValue.optionType.normalizedName } })),
      effectivePrice: formatMoney(effectivePrice)!,
      compareAtPrice: formatMoney(variant.compareAtPrice) ?? formatMoney(fullProduct.compareAtPrice),
      availability,
    };
  });
  const price = variants.reduce((current, variant) => current === null || new Prisma.Decimal(variant.effectivePrice).lt(new Prisma.Decimal(current.effectivePrice)) ? variant : current, null as (typeof variants)[number] | null);
  const availableVariant = variants.find((variant) => variant.availability.state === "IN_STOCK" || variant.availability.state === "LOW_STOCK" || variant.availability.state === "UNTRACKED");
  return {
    id: fullProduct.id, title: fullProduct.title, slug: fullProduct.slug,
    primaryImage: fullProduct.images[0] ? { id: fullProduct.images[0].id, url: fullProduct.images[0].url, altText: fullProduct.images[0].altText } : null,
    price: price?.effectivePrice ?? formatMoney(fullProduct.price)!,
    compareAtPrice: price?.compareAtPrice ?? formatMoney(fullProduct.compareAtPrice),
    currency: fullProduct.currency,
    availability: availableVariant?.availability ?? { state: "OUT_OF_STOCK", availableQuantity: 0 },
    categories: fullProduct.categories.map(({ category }) => category),
    collections: fullProduct.collections.map(({ collection }) => collection),
    tags: fullProduct.tags.map(({ tag }) => tag),
    internalVariants: variants,
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

  const catalogQuery: CatalogQuery = {
    category: input.category,
    collection: input.collection,
    tags: input.tags,
    tagMode: input.tagMode,
    minPrice: input.minPrice,
    maxPrice: input.maxPrice,
    inStock: input.inStock,
    sort: input.sort,
    page: input.page,
    pageSize: input.pageSize,
  };

  return {
    query,
    mode,
    catalog: normalizeCatalogQuery(catalogQuery),
    ranking: input.sort === undefined ? "relevance" : "catalog",
  };
}




function formatMoney(value: Prisma.Decimal | string | number | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  return new Prisma.Decimal(String(value)).toFixed(2);
}

export function createCatalogSearchService(options: {
  provider?: CatalogSearchProvider;
  lookup?: {
    getCategoryBySlug: (slug: string) => Promise<unknown>;
    getCollectionBySlug: (slug: string) => Promise<unknown>;
    getTagsBySlugs: (slugs: string[]) => Promise<Array<{ slug: string }>>;
  };
} = {}) {
  const provider = options.provider ?? new DatabaseSearchAdapter();
  const lookup = options.lookup ?? {
    getCategoryBySlug: catalogRepository.getCategoryBySlug,
    getCollectionBySlug: catalogRepository.getCollectionBySlug,
    getTagsBySlugs: async (slugs) => catalogRepository.getTagsBySlugs(slugs),
  };

  return {
    async search(input: CatalogSearchQuery): Promise<CatalogSearchResult> {
      const startedAt = Date.now();
      let normalized: NormalizedCatalogSearchQuery | undefined;

      try {
        normalized = normalizeCatalogSearchQuery(input);
        const [category, collection, tags] = await Promise.all([
          normalized.catalog.category ? lookup.getCategoryBySlug(normalized.catalog.category) : Promise.resolve(null),
          normalized.catalog.collection ? lookup.getCollectionBySlug(normalized.catalog.collection) : Promise.resolve(null),
          normalized.catalog.tags.length ? lookup.getTagsBySlugs(normalized.catalog.tags) : Promise.resolve([]),
        ]);
        const categoryStatus = category as { status?: string } | null;
        const collectionStatus = collection as { status?: string } | null;
        if (normalized.catalog.category && (!categoryStatus || categoryStatus.status === "ARCHIVED" || categoryStatus.status === "DRAFT")) {
          throw new CatalogServiceError("CATEGORY_NOT_FOUND", "Category was not found.");
        }
        if (normalized.catalog.collection && (!collectionStatus || collectionStatus.status === "ARCHIVED" || collectionStatus.status === "DRAFT")) {
          throw new CatalogServiceError("COLLECTION_NOT_FOUND", "Collection was not found.");
        }
        if (normalized.catalog.tags.length) {
          const availableTags = new Set(tags.map((tag) => tag.slug));
          const missingTag = normalized.catalog.tags.find((tag) => !availableTags.has(tag));
          if (missingTag) throw new CatalogServiceError("TAG_NOT_FOUND", "Tag was not found: " + missingTag + ".");
        }

        if (!normalized) throw new Error("Normalized search query is unavailable.");
        const current = normalized;
        const result = await provider.search(current);
        const totalPages = result.total === 0 ? 0 : Math.min(Math.ceil(result.total / current.catalog.pageSize), 10000);
        const isOutOfRange = result.total > 0 && current.catalog.page > totalPages;
        const items = result.items.map((item) => toSearchItem(item, current.mode));
        const durationMs = Date.now() - startedAt;
        if (durationMs >= CATALOG_SEARCH_SLOW_THRESHOLD_MS) {
          logCatalogObservation({
            surface: "search",
            operation: "search",
            classification: "slow_search",
            durationMs,
            query: current.catalog,
          });
        }
        return {
          items,
          pagination: {
            page: current.catalog.page,
            pageSize: current.catalog.pageSize,
            total: result.total,
            totalPages,
            hasNextPage: !isOutOfRange && current.catalog.page < totalPages && result.hasNextPage,
            isOutOfRange,
          },
          appliedQuery: current,
        };
      } catch (error) {
        if (error instanceof CatalogServiceError) {
          const classification =
            error.code === "CATEGORY_NOT_FOUND" ||
            error.code === "COLLECTION_NOT_FOUND" ||
            error.code === "TAG_NOT_FOUND"
              ? "not_found"
              : error.code === "INVALID_QUERY" ||
                  error.code === "INVALID_PAGE" ||
                  error.code === "INVALID_SORT" ||
                  error.code === "INVALID_PRICE_RANGE"
                ? "invalid_query"
                : error.code === "CATALOG_DATABASE_ERROR"
                  ? "database_failure"
                  : error.code === "CATALOG_DATA_INTEGRITY_ERROR"
                    ? "catalog_data_integrity"
                    : "unexpected_application_failure";

          logCatalogObservation({
            surface: "search",
            operation: "search",
            classification,
            durationMs: Date.now() - startedAt,
            query: normalized?.catalog,
          });
          throw error;
        }

        logCatalogObservation({
          surface: "search",
          operation: "search",
          classification: "database_failure",
          durationMs: Date.now() - startedAt,
          query: normalized?.catalog,
        });
        throw new CatalogServiceError("CATALOG_DATABASE_ERROR", "Catalog search failed.", error);
      }
    },

    async searchPublic(input: Omit<CatalogSearchQuery, "mode">): Promise<{ items: CatalogListItem[]; pagination: CatalogSearchResult["pagination"]; appliedQuery: NormalizedCatalogSearchQuery }> {
      const result = await this.search({ ...input, mode: "PUBLIC" });
      return {
        items: result.items.map((item) => ({
          id: item.id ?? "",
          title: item.title,
          slug: item.slug,
          primaryImage: item.primaryImage ? { url: item.primaryImage.url, altText: item.primaryImage.altText } : null,
          price: item.price,
          compareAtPrice: item.compareAtPrice,
          currency: item.currency,
          status: "ACTIVE",
          availability: item.availability.state,
        })),
        pagination: result.pagination,
        appliedQuery: result.appliedQuery,
      };
    },

    async searchInternal(input: Omit<CatalogSearchQuery, "mode">): Promise<CatalogSearchResult> {
      return this.search({ ...input, mode: "INTERNAL" });
    },
  };
}
