import * as repository from "@/lib/catalog/repository";

export type CatalogExportFilters = {
  ids?: string[];
  categoryId?: string;
  collectionId?: string;
  status?: "DRAFT" | "ACTIVE" | "ARCHIVED";
  modifiedAfter?: Date;
};

export type CatalogExportMedia = {
  id: string;
  url: string;
  storageReference: string | null;
  mediaType: string;
  altText: string | null;
  sortOrder: number;
  isPrimary: boolean;
  variantId: string | null;
};

export type CatalogExportVariant = {
  id: string;
  externalReference?: string;
  sku: string;
  displayName: string | null;
  size: string | null;
  color: string | null;
  price: string | null;
  compareAtPrice: string | null;
  status: string;
  optionValueIds: string[];
  optionValues: Array<{
    optionTypeNormalizedName: string;
    normalizedValue: string;
    displayName: string;
  }>;
};

export type CatalogExportProduct = {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  shortDescription: string | null;
  status: string;
  price: string;
  compareAtPrice: string | null;
  currency: string;
  seoTitle: string | null;
  seoDescription: string | null;
  createdAt: string;
  updatedAt: string;
  variants: CatalogExportVariant[];
  media: CatalogExportMedia[];
  categories: Array<{
    id: string;
    name: string;
    slug: string;
    position: number;
    priority: number;
    isFeatured: boolean;
  }>;
  collections: Array<{
    id: string;
    name: string;
    slug: string;
    position: number;
    priority: number;
    isFeatured: boolean;
  }>;
  tags: Array<{ id: string; name: string; slug: string }>;
  optionTypes: Array<{
    id: string;
    name: string;
    normalizedName: string;
    sortOrder: number;
    values: Array<{
      id: string;
      displayName: string;
      normalizedValue: string;
      sortOrder: number;
      hex: string | null;
      swatch: string | null;
    }>;
  }>;
};

export type CatalogExportPayload = {
  version: 1;
  exportedAt: string;
  products: CatalogExportProduct[];
};

function mapProduct(product: Awaited<ReturnType<typeof repository.listProductsForExport>>[number]): CatalogExportProduct {
  return {
    id: product.id,
    title: product.title,
    slug: product.slug,
    description: product.description,
    shortDescription: product.shortDescription,
    status: product.status,
    price: product.price.toString(),
    compareAtPrice: product.compareAtPrice?.toString() ?? null,
    currency: product.currency,
    seoTitle: product.seoTitle,
    seoDescription: product.seoDescription,
    createdAt: product.createdAt.toISOString(),
    updatedAt: product.updatedAt.toISOString(),
    variants: product.variants.map((variant) => ({
      id: variant.id,
      sku: variant.sku,
      displayName: variant.displayName,
      size: variant.size,
      color: variant.color,
      price: variant.price?.toString() ?? null,
      compareAtPrice: variant.compareAtPrice?.toString() ?? null,
      status: variant.status,
      optionValueIds: variant.optionValues.map((item) => item.optionValueId),
      optionValues: variant.optionValues.map((item) => ({
        optionTypeNormalizedName: item.optionValue.optionType.normalizedName,
        normalizedValue: item.optionValue.normalizedValue,
        displayName: item.optionValue.displayName,
      })),
    })),
    media: product.images.map((image) => ({
      id: image.id,
      url: image.url,
      storageReference: image.storageReference,
      mediaType: image.mediaType,
      altText: image.altText,
      sortOrder: image.sortOrder,
      isPrimary: image.isPrimary,
      variantId: image.variantId,
    })),
    categories: product.categories.map((item) => ({
      id: item.category.id,
      name: item.category.name,
      slug: item.category.slug,
      position: item.position,
      priority: item.priority,
      isFeatured: item.isFeatured,
    })),
    collections: product.collections.map((item) => ({
      id: item.collection.id,
      name: item.collection.name,
      slug: item.collection.slug,
      position: item.position,
      priority: item.priority,
      isFeatured: item.isFeatured,
    })),
    tags: product.tags.map((item) => ({
      id: item.tag.id,
      name: item.tag.name,
      slug: item.tag.slug,
    })),
    optionTypes: product.optionTypes.map((item) => ({
      id: item.optionType.id,
      name: item.optionType.name,
      normalizedName: item.optionType.normalizedName,
      sortOrder: item.sortOrder,
      values: item.optionType.values
        .slice()
        .sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id))
        .map((value) => ({
          id: value.id,
          displayName: value.displayName,
          normalizedValue: value.normalizedValue,
          sortOrder: value.sortOrder,
          hex: value.hex,
          swatch: value.swatch,
        })),
    })),
  };
}

export async function exportCatalog(filters: CatalogExportFilters = {}): Promise<CatalogExportPayload> {
  const products = await repository.listProductsForExport(filters);
  return {
    version: 1,
    exportedAt: new Date(0).toISOString(),
    products: products.map(mapProduct),
  };
}

export async function exportCatalogJson(filters: CatalogExportFilters = {}): Promise<string> {
  const payload = await exportCatalog(filters);
  return JSON.stringify(payload, null, 2) + "\n";
}
