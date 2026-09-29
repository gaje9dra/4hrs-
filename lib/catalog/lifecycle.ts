import type { ProductStatus } from "@prisma/client";
import { CatalogServiceError } from "@/lib/catalog/errors";
import { validatePublishingReadiness, type ImageInput, type ProductInput, type VariantInput } from "@/lib/catalog/validation";
import type { CatalogAuditContext, CatalogAuditClient } from "@/lib/catalog/audit";
import type { CatalogRepositoryClient } from "@/lib/catalog/repository";
import { PRODUCT_LIFECYCLE_TRANSITIONS, canTransitionProductStatus } from "@/lib/catalog/lifecycle-rules";

export type ProductLifecycleTransition = {
  from: ProductStatus;
  to: ProductStatus;
  operation: "PUBLISH" | "UNPUBLISH" | "ARCHIVE" | "RESTORE";
};

export { PRODUCT_LIFECYCLE_TRANSITIONS, canTransitionProductStatus };

export function isProductPublicStatus(status: ProductStatus): boolean {
  return status === "ACTIVE";
}

export function lifecycleOperationForTransition(from: ProductStatus, to: ProductStatus): ProductLifecycleTransition["operation"] | null {
  if (from === to) return null;
  if (to === "ACTIVE") return "PUBLISH";
  if (from === "ACTIVE" && to === "DRAFT") return "UNPUBLISH";
  if (to === "ARCHIVED") return "ARCHIVE";
  if (from === "ARCHIVED" && to === "DRAFT") return "RESTORE";
  return null;
}

export function assertProductLifecycleTransition(from: ProductStatus, to: ProductStatus): ProductLifecycleTransition | null {
  if (from === to) return null;
  if (!canTransitionProductStatus(from, to)) {
    throw new CatalogServiceError(
      "INVALID_STATUS_TRANSITION",
      "Product cannot transition from " + from + " to " + to + ".",
    );
  }
  const operation = lifecycleOperationForTransition(from, to);
  if (!operation) {
    throw new CatalogServiceError(
      "INVALID_STATUS_TRANSITION",
      "Product lifecycle transition is not supported.",
    );
  }
  return { from, to, operation };
}

export type CatalogLifecycleRepository = {
  getProductById: (id: string, client?: CatalogRepositoryClient) => Promise<{
    id: string;
    status: ProductStatus;
    [key: string]: unknown;
  } | null>;
  getProductDetails: (id: string, client?: CatalogRepositoryClient) => Promise<CatalogLifecycleProductDetails | null>;
  transitionProductStatus: (id: string, from: ProductStatus, to: ProductStatus, client?: CatalogRepositoryClient) => Promise<{
    id: string;
    status: ProductStatus;
    [key: string]: unknown;
  } | null>;
  withTransaction: <T>(callback: (transaction: CatalogRepositoryClient) => Promise<T>) => Promise<T>;
};

type CatalogLifecycleProductDetails = {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  shortDescription: string | null;
  status: ProductStatus;
  price: { toString(): string };
  compareAtPrice: { toString(): string } | null;
  currency: string;
  seoTitle: string | null;
  seoDescription: string | null;
  variants: Array<{
    id: string;
    productId: string;
    sku: string;
    displayName: string | null;
    size: string | null;
    color: string | null;
    price: { toString(): string } | null;
    compareAtPrice: { toString(): string } | null;
    status: "ACTIVE" | "INACTIVE";
    optionValues?: Array<{ optionValueId: string }>;
  }>;
  images: Array<{
    productId: string | null;
    variantId: string | null;
    url: string;
    storageReference?: string | null;
    mediaType?: "IMAGE";
    altText: string | null;
    sortOrder: number;
    isPrimary: boolean;
  }>;
};

export type CatalogLifecycleAudit = (
  event: {
    entityType: "PRODUCT";
    entityId: string;
    operation: "PUBLISH" | "UNPUBLISH" | "ARCHIVE" | "RESTORE";
    changedFields?: string[];
    beforeState?: unknown;
    afterState?: unknown;
    metadata?: Record<string, unknown>;
  },
  client?: CatalogAuditClient,
) => Promise<unknown>;

function toReadinessInput(product: CatalogLifecycleProductDetails){
  product: ProductInput;
  variants: VariantInput[];
  images: ImageInput[];
} {
  return {
    product: {
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
    },
    variants: product.variants.map((variant) => ({
      id: variant.id,
      productId: variant.productId,
      sku: variant.sku,
      displayName: variant.displayName,
      size: variant.size,
      color: variant.color,
      price: variant.price?.toString() ?? null,
      compareAtPrice: variant.compareAtPrice?.toString() ?? null,
      status: variant.status,
      optionValueIds: variant.optionValues?.map((item) => item.optionValueId) ?? undefined,
    })),
    images: product.images.map((image) => ({
      productId: image.productId,
      variantId: image.variantId,
      url: image.url,
      storageReference: image.storageReference,
      mediaType: image.mediaType,
      altText: image.altText,
      sortOrder: image.sortOrder,
      isPrimary: image.isPrimary,
    })),
  };
}

export function validateProductPublicationReadiness(product: CatalogLifecycleProductDetails) {
  const issues = validatePublishingReadiness(toReadinessInput(product));
  return issues;
}

export function createCatalogLifecycleService(
  repository: CatalogLifecycleRepository,
  audit: CatalogLifecycleAudit,
  _context: CatalogAuditContext = {},
) {
  async function transitionProduct(productId: string, target: ProductStatus) {
    const initial = await repository.getProductById(productId);
    if (!initial) throw new CatalogServiceError("PRODUCT_NOT_FOUND", "Product was not found.");

    const transition = assertProductLifecycleTransition(initial.status, target);
    if (!transition) return initial;

    return repository.withTransaction(async (tx) => {
      const latest = await repository.getProductById(productId, tx);
      if (!latest) throw new CatalogServiceError("PRODUCT_NOT_FOUND", "Product was not found.");

      const latestTransition = assertProductLifecycleTransition(latest.status, target);
      if (!latestTransition) return latest;

      if (target === "ACTIVE") {
        const details = await repository.getProductDetails(productId, tx);
        if (!details) throw new CatalogServiceError("PRODUCT_NOT_FOUND", "Product was not found.");
        const readiness = validateProductPublicationReadiness(details);
        if (readiness.length) {
          throw new CatalogServiceError(
            "NOT_PUBLICATION_READY",
            "Product is not ready for publication.",
            { issues: readiness },
          );
        }
      }

      const updated = await repository.transitionProductStatus(
        productId,
        latest.status,
        target,
        tx,
      );
      if (!updated) {
        throw new CatalogServiceError(
          "INVALID_STATUS_TRANSITION",
          "Product changed state before the lifecycle transition could be committed.",
        );
      }

      await audit({
        entityType: "PRODUCT",
        entityId: productId,
        operation: latestTransition.operation,
        changedFields: ["status"],
        beforeState: latest,
        afterState: updated,
      }, tx);

      return updated;
    });
  }

  return {
    validatePublicationReadiness: async (productId: string) => {
      const product = await repository.getProductDetails(productId);
      if (!product) throw new CatalogServiceError("PRODUCT_NOT_FOUND", "Product was not found.");
      const issues = validateProductPublicationReadiness(product);
      return { publishable: issues.length === 0, issues };
    },
    publishProduct: (productId: string) => transitionProduct(productId, "ACTIVE"),
    unpublishProduct: (productId: string) => transitionProduct(productId, "DRAFT"),
    archiveProduct: (productId: string) => transitionProduct(productId, "ARCHIVED"),
    restoreProduct: (productId: string) => transitionProduct(productId, "DRAFT"),
  };
}
