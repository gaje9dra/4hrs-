export type CatalogRouteEntity = { slug: string };

export type CatalogRouteType = "product" | "category" | "collection";

const routePrefix: Record<CatalogRouteType, string> = {
  product: "/product",
  category: "/categories",
  collection: "/collections",
};

function safeSlug(slug: string): string {
  const normalized = slug.trim().toLowerCase();
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(normalized)) {
    throw new Error("Canonical catalog slug is invalid.");
  }
  return normalized;
}

function entityPath(type: CatalogRouteType, entity: CatalogRouteEntity): string {
  return routePrefix[type] + "/" + encodeURIComponent(safeSlug(entity.slug));
}

export function productPath(product: CatalogRouteEntity): string {
  return entityPath("product", product);
}

export function categoryPath(category: CatalogRouteEntity): string {
  return entityPath("category", category);
}

export function collectionPath(collection: CatalogRouteEntity): string {
  return entityPath("collection", collection);
}

export function catalogBaseUrl(): string {
  const raw = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (!raw) throw new Error("NEXT_PUBLIC_SITE_URL is required to construct canonical catalog URLs.");

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("NEXT_PUBLIC_SITE_URL must be an absolute HTTPS URL.");
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("NEXT_PUBLIC_SITE_URL must use HTTP or HTTPS.");
  }
  if (url.username || url.password || url.search || url.hash) {
    throw new Error("NEXT_PUBLIC_SITE_URL must not contain credentials, query parameters, or fragments.");
  }

  return url.toString().replace(/\/$/, "");
}

export function canonicalCatalogUrl(type: CatalogRouteType, entity: CatalogRouteEntity): string {
  return catalogBaseUrl() + entityPath(type, entity);
}

export function productCanonicalUrl(product: CatalogRouteEntity): string {
  return canonicalCatalogUrl("product", product);
}

export function categoryCanonicalUrl(category: CatalogRouteEntity): string {
  return canonicalCatalogUrl("category", category);
}

export function collectionCanonicalUrl(collection: CatalogRouteEntity): string {
  return canonicalCatalogUrl("collection", collection);
}
