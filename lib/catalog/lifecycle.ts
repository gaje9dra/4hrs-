import type { ProductStatus } from "@prisma/client";
import { CatalogServiceError } from "@/lib/catalog/errors";
import { validatePublishingReadiness, type ImageInput, type ProductInput, type VariantInput } from "@/lib/catalog/validation";
import type { CatalogAuditContext } from "@/lib/catalog/audit";

export type ProductLifecycleTransition = {
  from: ProductStatus;
  to: ProductStatus;
  operation: "PUBLISH" | "UNPUBLISH" | "ARCHIVE" | "RESTORE";
};

export const PRODUCT_LIFECYCLE_TRANSITIONS: Readonly<Record<ProductStatus, readonly ProductStatus[]>> = {
  DRAFT: ["DRAFT", "ACTIVE", "ARCHIVED"],
  ACTIVE: ["ACTIVE", "DRAFT", "ARCHIVED"],
  ARCHIVED: ["ARCHIVED", "DRAFT"],
};

export function isProductPublicStatus(status: ProductStatus): boolean {
  return status === "ACTIVE";
}

export function canTransitionProductStatus(from: ProductStatus, to: ProductStatus): boolean {
  return PRODUCT_LIFECYCLE_TRANSITIONS[from].includes(to);
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
  getProductById: (id: string, client?: unknown) => Promise<any>;
  getProductDetails: (id: string, client?: unknown) => Promise<any>;
  transitionProductStatus: (id: string, from: ProductStatus, to: ProductStatus, client?: unknown) => Promise<any>;
  withTransaction: <T>(callback: (transaction: unknown) => Promise<T>) => Promise<T>;
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
  client?: unknown,
) => Promise<unknown>;

function toReadinessInput(product: any): {
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
    variants: product.variants.map((variant: any) => ({
      id: variant.id,
      productId: variant.productId,
      sku: variant.sku,
      displayName: variant.displayName,
      size: variant.size,
      color: variant.color,
      price: variant.price?.toString() ?? null,
      compareAtPrice: variant.compareAtPrice?.toString() ?? null,
      status: variant.status,
      optionValueIds: variant.optionValues?.map((item: any) => item.optionValueId) ?? undefined,
    })),
    images: product.images.map((image: any) => ({
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

export function validateProductPublicationReadiness(product: any) {
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
