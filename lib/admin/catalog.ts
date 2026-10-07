import { Prisma } from "@prisma/client";
import type { AdminAuthorizationContext } from "@/lib/admin/authorization";
import { AdminError } from "@/lib/admin/errors";
import { auditAdminAction } from "@/lib/admin/audit";
import { requireHighRiskReason } from "@/lib/admin/authorization";
import { createCatalogService } from "@/lib/catalog/service";
import { CatalogServiceError } from "@/lib/catalog/errors";
import type { CatalogListOptions } from "@/lib/catalog/repository";

function service(context: AdminAuthorizationContext) {
  return createCatalogService({}, {
    source: "MANUAL",
    actorType: "USER",
    actorId: context.adminUser.id,
    correlationId: undefined,
  });
}

function serialize(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === "bigint") return value.toString();
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object") {
    if (Prisma.Decimal.isDecimal(value)) return value.toString();
    if (Array.isArray(value)) return value.map(serialize);
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) out[key] = serialize(item);
    return out;
  }
  return value;
}

export function catalogDto(value: unknown): unknown {
  return serialize(value);
}

function adminCatalogError(error: unknown): never {
  if (error instanceof AdminError) throw error;
  if (error instanceof CatalogServiceError) throw error;
  throw error;
}

export async function listCatalogProducts(context: AdminAuthorizationContext, options: CatalogListOptions) {
  try { return catalogDto(await service(context).listProducts(options)); } catch (error) { adminCatalogError(error); }
}

export async function getCatalogProduct(context: AdminAuthorizationContext, id: string) {
  try {
    const product = await service(context).getProductDetails(id);
    if (!product) throw new AdminError("NOT_FOUND", "Product was not found.");
    const mappings = await Promise.all(product.variants.map(async (variant) => ({
      variantId: variant.id,
      mappings: catalogDto(await service(context).listProviderMappings(variant.id)),
    })));
    return { product: catalogDto(product), providerMappings: mappings };
  } catch (error) { adminCatalogError(error); }
}

export async function createCatalogProduct(context: AdminAuthorizationContext, input: Parameters<ReturnType<typeof createCatalogService>["createProduct"]>[0]) {
  try {
    const product = await service(context).createProduct(input);
    await auditAdminAction(context, { action: "CATALOG_PRODUCT_CREATED", resourceType: "Product", resourceId: product.id, success: true });
    return catalogDto(product);
  } catch (error) {
    await auditAdminAction(context, { action: "CATALOG_PRODUCT_CREATE_FAILED", resourceType: "Product", success: false, metadata: { error: error instanceof Error ? error.name : "unknown" } }).catch(() => undefined);
    adminCatalogError(error);
  }
}

export async function updateCatalogProduct(context: AdminAuthorizationContext, input: Parameters<ReturnType<typeof createCatalogService>["updateProduct"]>[0]) {
  try {
    const product = await service(context).updateProduct(input);
    await auditAdminAction(context, { action: "CATALOG_PRODUCT_UPDATED", resourceType: "Product", resourceId: product.id, success: true });
    return catalogDto(product);
  } catch (error) {
    await auditAdminAction(context, { action: "CATALOG_PRODUCT_UPDATE_FAILED", resourceType: "Product", resourceId: input.id, success: false, metadata: { error: error instanceof Error ? error.name : "unknown" } }).catch(() => undefined);
    adminCatalogError(error);
  }
}

async function lifecycle(
  context: AdminAuthorizationContext,
  id: string,
  action: "publish" | "unpublish" | "archive" | "restore",
  reason: unknown,
  expectedUpdatedAt?: unknown,
) {
  const cleanReason = requireHighRiskReason(reason);
  const expected = expectedUpdatedAt === undefined ? undefined : new Date(String(expectedUpdatedAt));
  if (expected && Number.isNaN(expected.getTime())) throw new AdminError("INVALID_REQUEST", "expectedUpdatedAt is invalid.");
  try {
    const api = service(context);
    const result = action === "publish" ? await api.publishProduct(id, expected)
      : action === "unpublish" ? await api.unpublishProduct(id, expected)
      : action === "archive" ? await api.archiveProduct(id, expected)
      : await api.restoreProduct(id, expected);
    await auditAdminAction(context, {
      action: "CATALOG_PRODUCT_" + action.toUpperCase(),
      resourceType: "Product",
      resourceId: id,
      success: true,
      reason: cleanReason,
    });
    return catalogDto(result);
  } catch (error) {
    await auditAdminAction(context, {
      action: "CATALOG_PRODUCT_" + action.toUpperCase() + "_FAILED",
      resourceType: "Product",
      resourceId: id,
      success: false,
      reason: cleanReason,
      metadata: { error: error instanceof Error ? error.name : "unknown" },
    }).catch(() => undefined);
    adminCatalogError(error);
  }
}

export const publishCatalogProduct = (c: AdminAuthorizationContext, id: string, reason: unknown, expectedUpdatedAt?: unknown) => lifecycle(c, id, "publish", reason, expectedUpdatedAt);
export const unpublishCatalogProduct = (c: AdminAuthorizationContext, id: string, reason: unknown, expectedUpdatedAt?: unknown) => lifecycle(c, id, "unpublish", reason, expectedUpdatedAt);
export const archiveCatalogProduct = (c: AdminAuthorizationContext, id: string, reason: unknown, expectedUpdatedAt?: unknown) => lifecycle(c, id, "archive", reason, expectedUpdatedAt);
export const restoreCatalogProduct = (c: AdminAuthorizationContext, id: string, reason: unknown, expectedUpdatedAt?: unknown) => lifecycle(c, id, "restore", reason, expectedUpdatedAt);

export async function createCatalogVariant(context: AdminAuthorizationContext, input: Parameters<ReturnType<typeof createCatalogService>["createVariant"]>[0]) {
  const result = await service(context).createVariant(input);
  await auditAdminAction(context, { action: "CATALOG_VARIANT_CREATED", resourceType: "ProductVariant", resourceId: result.id, success: true });
  return catalogDto(result);
}

export async function updateCatalogVariant(context: AdminAuthorizationContext, id: string, patch: Parameters<ReturnType<typeof createCatalogService>["updateVariant"]>[1]) {
  const result = await service(context).updateVariant(id, patch);
  await auditAdminAction(context, { action: "CATALOG_VARIANT_UPDATED", resourceType: "ProductVariant", resourceId: id, success: true });
  return catalogDto(result);
}

export async function deactivateCatalogVariant(context: AdminAuthorizationContext, id: string, reason: unknown) {
  const cleanReason = requireHighRiskReason(reason);
  const result = await service(context).deactivateVariant(id);
  await auditAdminAction(context, { action: "CATALOG_VARIANT_DEACTIVATED", resourceType: "ProductVariant", resourceId: id, success: true, reason: cleanReason });
  return catalogDto(result);
}

export async function listCatalogCategories(context: AdminAuthorizationContext) {
  return catalogDto(await service(context).listCategories());
}
export async function createCatalogCategory(context: AdminAuthorizationContext, input: Parameters<ReturnType<typeof createCatalogService>["createCategory"]>[0]) {
  const result = await service(context).createCategory(input);
  await auditAdminAction(context, { action: "CATALOG_CATEGORY_CREATED", resourceType: "Category", resourceId: result.id, success: true });
  return catalogDto(result);
}
export async function updateCatalogCategory(context: AdminAuthorizationContext, id: string, patch: Parameters<ReturnType<typeof createCatalogService>["updateCategory"]>[1]) {
  const result = await service(context).updateCategory(id, patch);
  await auditAdminAction(context, { action: "CATALOG_CATEGORY_UPDATED", resourceType: "Category", resourceId: id, success: true });
  return catalogDto(result);
}
export async function archiveCatalogCategory(context: AdminAuthorizationContext, id: string, reason: unknown) {
  const cleanReason = requireHighRiskReason(reason);
  const result = await service(context).archiveCategory(id);
  await auditAdminAction(context, { action: "CATALOG_CATEGORY_ARCHIVED", resourceType: "Category", resourceId: id, success: true, reason: cleanReason });
  return catalogDto(result);
}

export async function listCatalogCollections(context: AdminAuthorizationContext) {
  return catalogDto(await service(context).listCollections());
}
export async function createCatalogCollection(context: AdminAuthorizationContext, input: Parameters<ReturnType<typeof createCatalogService>["createCollection"]>[0]) {
  const result = await service(context).createCollection(input);
  await auditAdminAction(context, { action: "CATALOG_COLLECTION_CREATED", resourceType: "Collection", resourceId: result.id, success: true });
  return catalogDto(result);
}
export async function updateCatalogCollection(context: AdminAuthorizationContext, id: string, patch: Parameters<ReturnType<typeof createCatalogService>["updateCollection"]>[1]) {
  const result = await service(context).updateCollection(id, patch);
  await auditAdminAction(context, { action: "CATALOG_COLLECTION_UPDATED", resourceType: "Collection", resourceId: id, success: true });
  return catalogDto(result);
}
export async function archiveCatalogCollection(context: AdminAuthorizationContext, id: string, reason: unknown) {
  const cleanReason = requireHighRiskReason(reason);
  const result = await service(context).archiveCollection(id);
  await auditAdminAction(context, { action: "CATALOG_COLLECTION_ARCHIVED", resourceType: "Collection", resourceId: id, success: true, reason: cleanReason });
  return catalogDto(result);
}

export async function addCatalogMedia(context: AdminAuthorizationContext, input: Parameters<ReturnType<typeof createCatalogService>["addImage"]>[0]) {
  const result = await service(context).addImage(input);
  await auditAdminAction(context, { action: "CATALOG_MEDIA_ADDED", resourceType: "Media", resourceId: result.id, success: true });
  return catalogDto(result);
}
export async function removeCatalogMedia(context: AdminAuthorizationContext, id: string, reason: unknown) {
  const cleanReason = requireHighRiskReason(reason);
  const result = await service(context).removeImage(id);
  await auditAdminAction(context, { action: "CATALOG_MEDIA_REMOVED", resourceType: "Media", resourceId: id, success: true, reason: cleanReason });
  return catalogDto(result);
}
export async function setCatalogPrimaryMedia(context: AdminAuthorizationContext, id: string) {
  const result = await service(context).assignPrimaryImage(id);
  await auditAdminAction(context, { action: "CATALOG_MEDIA_PRIMARY_SET", resourceType: "Media", resourceId: id, success: true });
  return catalogDto(result);
}

export async function listVariantProviderMappings(context: AdminAuthorizationContext, variantId: string) {
  return catalogDto(await service(context).listProviderMappings(variantId));
}
export async function upsertVariantProviderMapping(context: AdminAuthorizationContext, input: Parameters<ReturnType<typeof createCatalogService>["upsertProviderMapping"]>[0], reason: unknown) {
  const cleanReason = requireHighRiskReason(reason);
  const result = await service(context).upsertProviderMapping(input);
  await auditAdminAction(context, { action: "CATALOG_PROVIDER_MAPPING_UPDATED", resourceType: "ProductVariant", resourceId: input.variantId, success: true, reason: cleanReason, metadata: { providerId: input.providerId } });
  return catalogDto(result);
}
export async function removeVariantProviderMapping(context: AdminAuthorizationContext, variantId: string, providerId: string, reason: unknown) {
  const cleanReason = requireHighRiskReason(reason);
  const result = await service(context).removeProviderMapping(variantId, providerId);
  await auditAdminAction(context, { action: "CATALOG_PROVIDER_MAPPING_REMOVED", resourceType: "ProductVariant", resourceId: variantId, success: true, reason: cleanReason, metadata: { providerId } });
  return catalogDto(result);
}
