import { createCatalogQueryService, type CatalogAppliedQuery, type CatalogQuery, type PublishedProductDetailResult } from "@/lib/catalog/query";
import { createCatalogSearchService, type CatalogSearchQuery } from "@/lib/catalog/search";

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

export type StorefrontProductDetail = PublishedProductDetailResult;

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
    href: "/products/" + encodeURIComponent(product.slug),
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
  return catalog.getPublishedProductDetailsBySlug(slug);
}

async function buildCategoryBreadcrumbs(category: Awaited<ReturnType<typeof catalog.getCategoryBySlug>>) {
  const categories = await catalog.listActiveCategories();
  const byId = new Map(categories.map((item) => [item.id, item]));
  const breadcrumbs: Array<{ name: string; slug: string }> = [];
  let current = category;

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

export async function getStorefrontCategoryProducts(slug: string, query: Omit<CatalogQuery, "category"> = {}) {
  return getStorefrontProducts({ ...query, category: slug, sort: query.sort ?? "merchandising" });
}

export async function getStorefrontCollectionProducts(slug: string, query: Omit<CatalogQuery, "collection"> = {}) {
  return getStorefrontProducts({ ...query, collection: slug, sort: query.sort ?? "merchandising" });
}

export async function searchStorefrontProducts(query: CatalogSearchQuery) {
  const result = await search.searchPublic(query);
  return {
    ...result,
    items: result.items.map(toProductCard),
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
