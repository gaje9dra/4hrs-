import { cache } from "react";
import { unstable_cache } from "next/cache";
import { createCatalogQueryService, type CatalogAppliedQuery, type CatalogQuery, type PublishedProductDetailResult } from "@/lib/catalog/query";
import { createCatalogSearchService, type CatalogSearchQuery } from "@/lib/catalog/search";
import { productPath } from "@/lib/catalog/routes";
import { CatalogServiceError } from "@/lib/catalog/errors";
import { logCatalogObservation, type CatalogSurface } from "@/lib/catalog/observability";
import { logger } from "@/lib/observability/logger";
import { logPrismaPoolMetrics } from "@/lib/db/client";

const catalog = createCatalogQueryService();
const search = createCatalogSearchService();

// Taxonomy changes are infrequent. Share these small public lookups across
// requests to avoid repeating the same database reads on every storefront route.
// A short TTL bounds staleness while keeping navigation and filter data fresh.
const getActiveCategories = unstable_cache(
  () => catalog.listActiveCategories(),
  ["storefront-active-categories-v1"],
  { revalidate: 30, tags: ["storefront-taxonomy"] },
);
const getActiveCategoriesWithPublishedProducts = unstable_cache(
  () => catalog.listActiveCategoriesWithPublishedProducts(),
  ["storefront-populated-categories-v1"],
  { revalidate: 30, tags: ["storefront-taxonomy"] },
);
const getActiveCollections = unstable_cache(
  () => catalog.listActiveCollections(),
  ["storefront-active-collections-v1"],
  { revalidate: 30, tags: ["storefront-taxonomy"] },
);
const getActiveCollectionsWithPublishedProducts = unstable_cache(
  () => catalog.listActiveCollectionsWithPublishedProducts(),
  ["storefront-populated-collections-v1"],
  { revalidate: 30, tags: ["storefront-taxonomy"] },
);
const getActiveTags = unstable_cache(
  () => catalog.listTags(),
  ["storefront-active-tags-v1"],
  { revalidate: 30, tags: ["storefront-taxonomy"] },
);

export type StorefrontProductCard = {
  id: string;
  title: string;
  slug: string;
  href: string;
  image: { url: string; altText: string | null } | null;
  images: Array<{ url: string; altText: string | null }>;
  price: string;
  compareAtPrice: string | null;
  currency: string;
  availability: "IN_STOCK" | "LOW_STOCK" | "OUT_OF_STOCK" | "UNTRACKED";
};

export type StorefrontAvailability = { state: "IN_STOCK" | "LOW_STOCK" | "OUT_OF_STOCK" | "UNTRACKED" };

type PublicStorefrontVariant = Omit<PublishedProductDetailResult["variants"][number], "availability"> & {
  availability: StorefrontAvailability;
};

export type StorefrontProductDetail = Omit<PublishedProductDetailResult, "availability" | "variants"> & {
  availability: StorefrontAvailability;
  variants: PublicStorefrontVariant[];
};


export type StorefrontCategory = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  status: "ACTIVE";
  hasPublishedProducts: boolean;
  breadcrumbs: Array<{ name: string; slug: string }>;
};

export type StorefrontCategoryOption = Pick<StorefrontCategory, "name" | "slug">;
export type StorefrontCollectionOption = Pick<StorefrontCollection, "name" | "slug">;
export type StorefrontTag = { name: string; slug: string };

export type StorefrontCollection = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  status: "ACTIVE";
  hasPublishedProducts: boolean;
};

export type StorefrontProductList = {
  items: StorefrontProductCard[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    isOutOfRange?: boolean;
  };
  appliedQuery: CatalogAppliedQuery;
};

function toProductCard(product: {
  id: string;
  title: string;
  slug: string;
  primaryImage: { url: string; altText: string | null } | null;
  images: Array<{ url: string; altText: string | null }>;
  price: string;
  compareAtPrice: string | null;
  currency: string;
  availability: "IN_STOCK" | "LOW_STOCK" | "OUT_OF_STOCK" | "UNTRACKED";
}): StorefrontProductCard {
  return {
    id: product.id,
    title: product.title,
    slug: product.slug,
    href: productPath(product),
    image: product.primaryImage,
    images: product.images,
    price: product.price,
    compareAtPrice: product.compareAtPrice,
    currency: product.currency,
    availability: product.availability,
  };
}

export async function getStorefrontProducts(query: CatalogQuery = {}, surface: CatalogSurface = "shop"): Promise<StorefrontProductList> {
  const startedAt = Date.now();
  try {
    const result = await catalog.listPublishedProducts(query, { surface });
    const durationMs = Date.now() - startedAt;
    if (durationMs >= 500) {
      console.warn(JSON.stringify({ event: "storefront.catalog.fetch.slow", surface, operation: "listPublishedProducts", durationMs, page: query.page ?? 1, pageSize: query.pageSize ?? 24 }));
    }
    return {
      items: result.items.map(toProductCard),
      pagination: result.pagination,
      appliedQuery: result.appliedQuery,
    };
  } catch (error) {
    if (!(error instanceof CatalogServiceError)) {
      logCatalogObservation({
        surface,
        operation: "getStorefrontProducts",
        classification: "unexpected_application_failure",
        durationMs: Date.now() - startedAt,
      });
    }
    throw error;
  }
}

/**
 * Homepage product cards never use catalog pagination totals. Use the dedicated
 * bounded query so a cache fill does not issue a second COUNT(*) statement.
 */
export async function getStorefrontHomeProducts(limit = 12): Promise<StorefrontProductCard[]> {
  const products = await catalog.listHomepageProducts(limit);
  return products.map(toProductCard);
}

export async function getStorefrontProduct(slug: string): Promise<StorefrontProductDetail> {
  const startedAt = Date.now();
  const product = await catalog.getPublishedProductDetailsBySlug(slug);
  const durationMs = Date.now() - startedAt;
  if (durationMs >= 500) {
    console.warn(JSON.stringify({ event: "storefront.product-detail.fetch.slow", durationMs }));
  }
  return {
    ...product,
    availability: { state: product.availability.state },
    variants: product.variants.map((variant) => ({
      ...variant,
      availability: { state: variant.availability.state },
    })),
  };
}

async function buildCategoryBreadcrumbs(category: Awaited<ReturnType<typeof catalog.getCategoryBySlug>>) {
  const categories = await getActiveCategories();
  const byId = new Map(categories.map((item) => [item.id, item]));
  const breadcrumbs: Array<{ name: string; slug: string }> = [];
  let current: Awaited<ReturnType<typeof catalog.getCategoryBySlug>> | undefined = category;

  while (current) {
    breadcrumbs.unshift({ name: current.name, slug: current.slug });
    if (!current.parentId) break;
    current = byId.get(current.parentId) as typeof current | undefined;
    if (!current) break;
  }

  return breadcrumbs;
}

export const getStorefrontCategory = cache(async function getStorefrontCategory(slug: string): Promise<StorefrontCategory> {
  const startedAt = Date.now();
  try {
    const category = await catalog.getCategoryBySlug(slug);
    if (!category || category.status !== "ACTIVE") {
      logCatalogObservation({ surface: "category", operation: "resolveCategory", classification: "not_found", durationMs: Date.now() - startedAt });
      throw new CatalogServiceError("CATEGORY_NOT_FOUND", "Category was not found.");
    }
    return {
      id: category.id,
      name: category.name,
      slug: category.slug,
      description: category.description,
      seoTitle: category.seoTitle,
      seoDescription: category.seoDescription,
      status: "ACTIVE",
      hasPublishedProducts: (await getActiveCategoriesWithPublishedProducts()).some((item) => item.id === category.id),
      breadcrumbs: await buildCategoryBreadcrumbs(category),
    };
  } catch (error) {
    if (error instanceof CatalogServiceError && error.code === "CATEGORY_NOT_FOUND") throw error;
    logCatalogObservation({ surface: "category", operation: "resolveCategory", classification: "database_failure", durationMs: Date.now() - startedAt });
    throw error;
  }
});

export const getStorefrontCollection = cache(async function getStorefrontCollection(slug: string): Promise<StorefrontCollection> {
  const startedAt = Date.now();
  try {
    const collection = await catalog.getCollectionBySlug(slug);
    if (!collection || collection.status !== "ACTIVE") {
      logCatalogObservation({ surface: "collection", operation: "resolveCollection", classification: "not_found", durationMs: Date.now() - startedAt });
      throw new CatalogServiceError("COLLECTION_NOT_FOUND", "Collection was not found.");
    }
    return {
      id: collection.id,
      name: collection.name,
      slug: collection.slug,
      description: collection.description,
      seoTitle: collection.seoTitle,
      seoDescription: collection.seoDescription,
      status: "ACTIVE",
      hasPublishedProducts: (await getActiveCollectionsWithPublishedProducts()).some((item) => item.id === collection.id),
    };
  } catch (error) {
    if (error instanceof CatalogServiceError && error.code === "COLLECTION_NOT_FOUND") throw error;
    logCatalogObservation({ surface: "collection", operation: "resolveCollection", classification: "database_failure", durationMs: Date.now() - startedAt });
    throw error;
  }
});

export async function getStorefrontNavigationTaxonomy() {
  const [categories, collections] = await Promise.all([
    getActiveCategories(),
    getActiveCollections(),
  ]);
  return { categories, collections };
}

export async function getStorefrontTags(): Promise<StorefrontTag[]> {
  return (await getActiveTags()).map(({ name, slug }) => ({ name, slug }));
}

export async function getStorefrontListingFilters(surface: CatalogSurface = "shop") {
  const startedAt = Date.now();
  try {
    const [categories, collections, tags] = await Promise.all([
      getActiveCategories(),
      getActiveCollections(),
      getActiveTags(),
    ]);
    return {
      categories: categories.map(({ name, slug }) => ({ name, slug })),
      collections: collections.map(({ name, slug }) => ({ name, slug })),
      tags: tags.map(({ name, slug }) => ({ name, slug })),
    };
  } catch (error) {
    logCatalogObservation({
      surface,
      operation: "loadListingFilters",
      classification: error instanceof CatalogServiceError ? "unexpected_application_failure" : "database_failure",
      durationMs: Date.now() - startedAt,
    });
    throw error;
  }
}

export async function getStorefrontCategoryProducts(slug: string, query: Omit<CatalogQuery, "category"> = {}) {
  return getStorefrontProducts({ ...query, category: slug, sort: query.sort ?? "merchandising" });
}

export async function getStorefrontCollectionProducts(slug: string, query: Omit<CatalogQuery, "collection"> = {}) {
  return getStorefrontProducts({ ...query, collection: slug, sort: query.sort ?? "merchandising" });
}

export type StorefrontHomeData = {
  heroProducts: StorefrontProductCard[];
  featuredProducts: StorefrontProductCard[];
  newArrivals: StorefrontProductCard[];
  categories: Array<{ id: string; name: string; slug: string; description: string | null }>;
  collections: Array<{ id: string; name: string; slug: string; description: string | null }>;
};

async function measureHomepageOperation<T>(
  operation: "hero_products" | "active_categories" | "populated_collections" | "featured_collection_products",
  run: () => Promise<T>,
): Promise<T> {
  const startedAt = Date.now();
  try {
    const result = await run();
    const durationMs = Date.now() - startedAt;
    if (durationMs >= 1000) void logPrismaPoolMetrics("homepage-operation:" + operation);
    if (durationMs >= 250) {
      logger.warn("storefront.homepage.operation.slow", {
        resourceType: "database",
        outcome: "success",
        durationMs,
      }, { operation, thresholdMs: 250 });
    }
    return result;
  } catch (error) {
    const durationMs = Date.now() - startedAt;
    if (durationMs >= 250) {
      logger.error("storefront.homepage.operation.failed_slow", {
        resourceType: "database",
        outcome: "failure",
        durationMs,
        errorCode: error instanceof Error && /\bP2024\b/.test(error.message) ? "P2024" : "DATABASE_OPERATION_FAILED",
      }, { operation });
    }
    throw error;
  }
}

export async function getStorefrontHomeCatalogData(): Promise<StorefrontHomeData> {
  const startedAt = Date.now();
  // The homepage needs a small, representative set for its hero carousel.
  // Loading every catalog page here makes homepage latency and database work grow
  // with the entire inventory, even though only a few products are displayed.
  const [heroProductSlice, categories, collections] = await Promise.all([
    measureHomepageOperation("hero_products", () => getStorefrontHomeProducts(12)),
    measureHomepageOperation("active_categories", () => getActiveCategories()),
    measureHomepageOperation("populated_collections", () => getActiveCollectionsWithPublishedProducts()),
  ]);

  const heroProducts = heroProductSlice.filter((product) => product.image !== null);

  const featuredCollection = collections[0] ?? null;
  const featuredResult = featuredCollection
    ? await measureHomepageOperation("featured_collection_products", () =>
        getStorefrontCollectionProducts(featuredCollection.slug, {
          pageSize: 4,
          sort: "merchandising",
        }))
    : null;

  const featuredSlugs = new Set(featuredResult?.items.map((product) => product.slug) ?? []);

  const durationMs = Date.now() - startedAt;
  if (durationMs >= 250) {
    logger.warn("storefront.home-catalog.fetch.slow", {
      resourceType: "database",
      outcome: "success",
      durationMs,
    }, {
      heroCount: heroProducts.length,
      featuredCount: featuredResult?.items.length ?? 0,
      featuredCollectionPresent: featuredCollection !== null,
      thresholdMs: 250,
    });
  }

  return {
    heroProducts,
    featuredProducts: featuredResult?.items ?? [],
    newArrivals: heroProductSlice.filter((product) => !featuredSlugs.has(product.slug)).slice(0, 4),
    categories: categories.slice(0, 6).map(({ id, name, slug, description }) => ({ id, name, slug, description })),
    collections: collections.slice(0, 3).map(({ id, name, slug, description }) => ({ id, name, slug, description })),
  };
}

export async function searchStorefrontProducts(query: CatalogSearchQuery): Promise<StorefrontProductList> {
  const result = await search.searchPublic(query);
  return {
    items: result.items.map(toProductCard),
    pagination: result.pagination,
    appliedQuery: result.appliedQuery.catalog,
  };
}

export function getStorefrontProductSeoInput(product: StorefrontProductDetail) {
  return {
    id: product.id,
    slug: product.slug,
    title: product.title,
    description: product.description,
    shortDescription: product.shortDescription,
    status: product.status,
    price: product.price,
    compareAtPrice: product.compareAtPrice,
    currency: product.currency,
    seoTitle: product.seoTitle,
    seoDescription: product.seoDescription,
  };
}


export async function getStorefrontRelatedProducts(product: StorefrontProductDetail): Promise<StorefrontProductCard[]> {
  const collection = [...product.collections].sort((a, b) => a.slug.localeCompare(b.slug))[0];
  const category = [...product.categories].sort((a, b) => a.slug.localeCompare(b.slug))[0];
  if (!collection && !category) return [];

  const [collectionResult, categoryResult] = await Promise.all([
    collection
      ? getStorefrontCollectionProducts(collection.slug, { pageSize: 8, sort: "merchandising" })
      : Promise.resolve(null),
    category
      ? getStorefrontCategoryProducts(category.slug, { pageSize: 8, sort: "merchandising" })
      : Promise.resolve(null),
  ]);

  const related: StorefrontProductCard[] = [];
  const seen = new Set<string>([product.slug]);

  for (const item of [
    ...(collectionResult?.items ?? []),
    ...(categoryResult?.items ?? []),
  ]) {
    if (seen.has(item.slug)) continue;
    seen.add(item.slug);
    related.push(item);
    if (related.length === 4) break;
  }

  return related;
}
