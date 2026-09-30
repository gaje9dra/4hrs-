import { createCatalogQueryService, type CatalogAppliedQuery, type CatalogQuery, type PublishedProductDetailResult } from "@/lib/catalog/query";
import { createCatalogSearchService, type CatalogSearchQuery } from "@/lib/catalog/search";
import { productPath } from "@/lib/catalog/routes";

const catalog = createCatalogQueryService();
const search = createCatalogSearchService();

export type StorefrontProductCard = {
  id: string;
  title: string;
  slug: string;
  href: string;
  image: { url: string; altText: string | null } | null;
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
  parentId: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  status: "ACTIVE";
  breadcrumbs: Array<{ name: string; slug: string }>;
};

export type StorefrontCollection = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  status: "ACTIVE";
};

export type StorefrontTag = {
  id: string;
  name: string;
  slug: string;
};

export type StorefrontProductList = {
  items: StorefrontProductCard[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
  };
  appliedQuery: CatalogAppliedQuery;
};

function toProductCard(product: {
  id: string;
  title: string;
  slug: string;
  primaryImage: { url: string; altText: string | null } | null;
  price: string;
  compareAtPrice: string | null;
  currency: string;
  availability: { state: "IN_STOCK" | "LOW_STOCK" | "OUT_OF_STOCK" | "UNTRACKED" };
}): StorefrontProductCard {
  return {
    id: product.id,
    title: product.title,
    slug: product.slug,
    href: productPath(product),
    image: product.primaryImage,
    price: product.price,
    compareAtPrice: product.compareAtPrice,
    currency: product.currency,
    availability: product.availability.state,
  };
}

export async function getStorefrontProducts(query: CatalogQuery = {}): Promise<StorefrontProductList> {
  const result = await catalog.listPublishedProducts(query);
  return {
    items: result.items.map(toProductCard),
    pagination: result.pagination,
    appliedQuery: result.appliedQuery,
  };
}

export async function getStorefrontProduct(slug: string): Promise<StorefrontProductDetail> {
  const product = await catalog.getPublishedProductDetailsBySlug(slug);
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
  const categories = await catalog.listActiveCategories();
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

export async function getStorefrontCategory(slug: string): Promise<StorefrontCategory> {
  const category = await catalog.getCategoryBySlug(slug);
  return {
    id: category.id,
    name: category.name,
    slug: category.slug,
    description: category.description,
    parentId: category.parentId,
    seoTitle: category.seoTitle,
    seoDescription: category.seoDescription,
    status: "ACTIVE",
    breadcrumbs: await buildCategoryBreadcrumbs(category),
  };
}

export async function getStorefrontCollection(slug: string): Promise<StorefrontCollection> {
  const collection = await catalog.getCollectionBySlug(slug);
  return {
    id: collection.id,
    name: collection.name,
    slug: collection.slug,
    description: collection.description,
    seoTitle: collection.seoTitle,
    seoDescription: collection.seoDescription,
    status: "ACTIVE",
  };
}

export async function getStorefrontTags(): Promise<StorefrontTag[]> {
  return catalog.listTags();
}

export async function getStorefrontListingFilters() {
  const [categories, collections, tags] = await Promise.all([
    catalog.listActiveCategories(),
    catalog.listActiveCollections(),
    catalog.listTags(),
  ]);
  return { categories, collections, tags };
}

export async function getStorefrontCategoryProducts(slug: string, query: Omit<CatalogQuery, "category"> = {}) {
  return getStorefrontProducts({ ...query, category: slug, sort: query.sort ?? "merchandising" });
}

export async function getStorefrontCollectionProducts(slug: string, query: Omit<CatalogQuery, "collection"> = {}) {
  return getStorefrontProducts({ ...query, collection: slug, sort: query.sort ?? "merchandising" });
}

export type StorefrontHomeData = {
  featuredProducts: StorefrontProductCard[];
  newArrivals: StorefrontProductCard[];
  categories: Array<{ id: string; name: string; slug: string; description: string | null }>;
  collections: Array<{ id: string; name: string; slug: string; description: string | null }>;
};

export async function getStorefrontHomeCatalogData(): Promise<StorefrontHomeData> {
  const [newArrivalResult, categories, collections] = await Promise.all([
    getStorefrontProducts({ pageSize: 8, sort: "newest" }),
    catalog.listActiveCategoriesWithPublishedProducts(),
    catalog.listActiveCollectionsWithPublishedProducts(),
  ]);

  const featuredCollection = collections[0] ?? null;
  const featuredResult = featuredCollection
    ? await getStorefrontCollectionProducts(featuredCollection.slug, {
        pageSize: 4,
        sort: "merchandising",
      })
    : null;

  const featuredIds = new Set(featuredResult?.items.map((product) => product.id) ?? []);

  return {
    featuredProducts: featuredResult?.items ?? [],
    newArrivals: newArrivalResult.items.filter((product) => !featuredIds.has(product.id)).slice(0, 4),
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
  const seen = new Set<string>([product.id]);

  for (const item of [
    ...(collectionResult?.items ?? []),
    ...(categoryResult?.items ?? []),
  ]) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    related.push(item);
    if (related.length === 4) break;
  }

  return related;
}
