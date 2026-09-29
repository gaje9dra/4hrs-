import { CatalogServiceError } from "@/lib/catalog/errors";
import { createCatalogService } from "@/lib/catalog/service";
import * as repository from "@/lib/catalog/repository";
import {
  validateProduct,
  type ProductInput,
} from "@/lib/catalog/validation";

export type CatalogBulkOperation =
  | { type: "VALIDATE_PRODUCT"; product: ProductInput }
  | { type: "ARCHIVE_PRODUCT"; productId: string }
  | { type: "PUBLISH_PRODUCT"; productId: string }
  | { type: "ASSIGN_CATEGORY"; productId: string; categoryId: string; position?: number; priority?: number; isFeatured?: boolean }
  | { type: "ASSIGN_COLLECTION"; productId: string; collectionId: string; position?: number; priority?: number; isFeatured?: boolean }
  | { type: "ASSIGN_TAG"; productId: string; tagId: string };

export type CatalogBulkOperationResult = {
  index: number;
  type: CatalogBulkOperation["type"];
  success: boolean;
  skipped: boolean;
  created?: boolean;
  issues: Array<{ field: string; code: string; message: string }>;
};

export type CatalogBulkResult = {
  total: number;
  succeeded: number;
  failed: number;
  skipped: number;
  results: CatalogBulkOperationResult[];
};

export async function executeCatalogBulkOperations(
  operations: CatalogBulkOperation[],
  options: { continueOnError?: boolean } = {},
): Promise<CatalogBulkResult> {
  const continueOnError = options.continueOnError ?? true;
  const service = createCatalogService({}, { source: "BULK_OPERATION", actorType: "PROCESS" });
  const results: CatalogBulkOperationResult[] = [];

  for (const [index, operation] of operations.entries()) {
    try {
      switch (operation.type) {
        case "VALIDATE_PRODUCT": {
          const issues = validateProduct(operation.product);
          results.push({ index, type: operation.type, success: issues.length === 0, skipped: false, issues });
          break;
        }
        case "ARCHIVE_PRODUCT":
          await service.archiveProduct(operation.productId);
          results.push({ index, type: operation.type, success: true, skipped: false, issues: [] });
          break;
        case "PUBLISH_PRODUCT":
          await service.publishProduct(operation.productId);
          results.push({ index, type: operation.type, success: true, skipped: false, issues: [] });
          break;
        case "ASSIGN_CATEGORY": {
          const existing = await repository.getProductCategory(operation.productId, operation.categoryId);
          if (existing) {
            await service.updateCategoryMembership(operation.productId, operation.categoryId, {
              position: operation.position,
              priority: operation.priority,
              isFeatured: operation.isFeatured,
            });
          } else {
            await service.attachCategory(operation.productId, operation.categoryId, {
              position: operation.position,
              priority: operation.priority,
              isFeatured: operation.isFeatured,
            });
          }
          results.push({ index, type: operation.type, success: true, skipped: false, issues: [] });
          break;
        }
        case "ASSIGN_COLLECTION": {
          const existing = await repository.getProductCollection(operation.productId, operation.collectionId);
          if (existing) {
            await service.updateCollectionMembership(operation.productId, operation.collectionId, {
              position: operation.position,
              priority: operation.priority,
              isFeatured: operation.isFeatured,
            });
          } else {
            await service.attachCollection(operation.productId, operation.collectionId, {
              position: operation.position,
              priority: operation.priority,
              isFeatured: operation.isFeatured,
            });
          }
          results.push({ index, type: operation.type, success: true, skipped: false, issues: [] });
          break;
        }
        case "ASSIGN_TAG":
          await service.attachTag(operation.productId, operation.tagId);
          results.push({ index, type: operation.type, success: true, skipped: false, issues: [] });
          break;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Bulk operation failed.";
      const code = error instanceof CatalogServiceError ? error.code : "CATALOG_DATABASE_ERROR";
      results.push({
        index,
        type: operation.type,
        success: false,
        skipped: !continueOnError,
        issues: [{ field: "operation", code, message }],
      });
      if (!continueOnError) {
        for (let remaining = index + 1; remaining < operations.length; remaining += 1) {
          results.push({
            index: remaining,
            type: operations[remaining].type,
            success: false,
            skipped: true,
            issues: [],
          });
        }
        break;
      }
    }
  }

  return {
    total: operations.length,
    succeeded: results.filter((result) => result.success).length,
    failed: results.filter((result) => !result.success && !result.skipped).length,
    skipped: results.filter((result) => result.skipped).length,
    results,
  };
}
