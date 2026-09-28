import {
  validateCategory,
  validateCollection,
  validateProduct,
  normalizeSeoText,
  type ProductInput,
  type CategoryInput,
  type CollectionInput,
} from "@/lib/catalog/validation";
import {
  categoryCanonicalUrl,
  collectionCanonicalUrl,
  productCanonicalUrl,
  type CatalogRouteEntity,
} from "@/lib/catalog/routes";

export type CatalogSeoEntity = CatalogRouteEntity & {
  seoTitle?: string | null;
  seoDescription?: string | null;
};

export type ProductSeoEntity = CatalogSeoEntity & {
  title: string;
  description?: string | null;
  shortDescription?: string | null;
  status: "DRAFT" | "ACTIVE" | "ARCHIVED";
  price: unknown;
  currency: string;
  compareAtPrice?: unknown;
};

export type CategorySeoEntity = CatalogSeoEntity & {
  name: string;
  description?: string | null;
  status: "ACTIVE" | "ARCHIVED";
  parentId?: string | null;
};

export type CollectionSeoEntity = CatalogSeoEntity & {
  name: string;
  description?: string | null;
  status: "ACTIVE" | "ARCHIVED";
};

export type CatalogIndexability = {
  indexable: boolean;
  robots: "index,follow" | "noindex,nofollow";
  reason:
    | "PUBLISHED"
    | "DRAFT"
    | "ARCHIVED"
    | "INVALID";
};

export type CatalogSeoMetadata = {
  title: string;
  description: string;
  canonicalUrl: string;
  indexability: CatalogIndexability;
};

function seoTitle(custom: string | null | undefined, fallback: string): string {
  return normalizeSeoText(custom) ?? fallback.trim();
}

function seoDescription(custom: string | null | undefined, fallback: string): string {
  return normalizeSeoText(custom) ?? fallback.trim();
}

export function getProductIndexability(product: ProductSeoEntity): CatalogIndexability {
  if (product.status !== "ACTIVE") {
    return {
      indexable: false,
      robots: "noindex,nofollow",
      reason: product.status === "DRAFT" ? "DRAFT" : "ARCHIVED",
    };
  }

  const issues = validateProduct({
    id: product.id,
    title: product.title,
    slug: product.slug,
    description: product.description,
    shortDescription: product.shortDescription,
    status: product.status,
    price: String(product.price),
    compareAtPrice: product.compareAtPrice === null || product.compareAtPrice === undefined ? null : String(product.compareAtPrice),
    currency: product.currency,
    seoTitle: product.seoTitle,
    seoDescription: product.seoDescription,
  });

  return issues.length
    ? { indexable: false, robots: "noindex,nofollow", reason: "INVALID" }
    : { indexable: true, robots: "index,follow", reason: "PUBLISHED" };
}

export function getCategoryIndexability(category: CategorySeoEntity): CatalogIndexability {
  if (category.status !== "ACTIVE") {
    return {
      indexable: false,
      robots: "noindex,nofollow",
      reason: "ARCHIVED",
    };
  }

  const issues = validateCategory(category);
  return issues.length
    ? { indexable: false, robots: "noindex,nofollow", reason: "INVALID" }
    : { indexable: true, robots: "index,follow", reason: "PUBLISHED" };
}

export function getCollectionIndexability(collection: CollectionSeoEntity): CatalogIndexability {
  if (collection.status !== "ACTIVE") {
    return {
      indexable: false,
      robots: "noindex,nofollow",
      reason: "ARCHIVED",
    };
  }

  const issues = validateCollection(collection);
  return issues.length
    ? { indexable: false, robots: "noindex,nofollow", reason: "INVALID" }
    : { indexable: true, robots: "index,follow", reason: "PUBLISHED" };
}

export function getProductSeoMetadata(product: ProductSeoEntity): CatalogSeoMetadata | null {
  const indexability = getProductIndexability(product);
  if (!indexability.indexable) return null;

  return {
    title: seoTitle(product.seoTitle, product.title),
    description: seoDescription(
      product.seoDescription,
      product.shortDescription ?? product.description ?? product.title,
    ),
    canonicalUrl: productCanonicalUrl(product),
    indexability,
  };
}

export function getCategorySeoMetadata(category: CategorySeoEntity): CatalogSeoMetadata | null {
  const indexability = getCategoryIndexability(category);
  if (!indexability.indexable) return null;

  return {
    title: seoTitle(category.seoTitle, category.name),
    description: seoDescription(
      category.seoDescription,
      category.description ?? "Browse " + category.name + " products.",
    ),
    canonicalUrl: categoryCanonicalUrl(category),
    indexability,
  };
}

export function getCollectionSeoMetadata(collection: CollectionSeoEntity): CatalogSeoMetadata | null {
  const indexability = getCollectionIndexability(collection);
  if (!indexability.indexable) return null;

  return {
    title: seoTitle(collection.seoTitle, collection.name),
    description: seoDescription(
      collection.seoDescription,
      collection.description ?? "Explore " + collection.name + ".",
    ),
    canonicalUrl: collectionCanonicalUrl(collection),
    indexability,
  };
}

export function getPublicCatalogSeoMetadata(
  entity:
    | ProductSeoEntity
    | CategorySeoEntity
    | CollectionSeoEntity,
): CatalogSeoMetadata | null {
  if ("title" in entity) return getProductSeoMetadata(entity);
  if ("name" in entity && "parentId" in entity) return getCategorySeoMetadata(entity);
  return getCollectionSeoMetadata(entity);
}

export type PublicCatalogSeoContract = {
  title: string;
  description: string;
  canonicalUrl: string;
  indexable: true;
  robots: "index,follow";
};

export function toPublicCatalogSeoContract(
  metadata: CatalogSeoMetadata | null,
): PublicCatalogSeoContract | null {
  if (!metadata || !metadata.indexability.indexable) return null;
  return {
    title: metadata.title,
    description: metadata.description,
    canonicalUrl: metadata.canonicalUrl,
    indexable: true,
    robots: "index,follow",
  };
}
