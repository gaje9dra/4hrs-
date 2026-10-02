import { randomUUID } from "node:crypto";
import { toCatalogMediaDto, type CatalogMediaDto } from "@/lib/catalog/media";
import { Prisma } from "@prisma/client";
import { recordCatalogAudit, changedFields, type CatalogAuditContext, type CatalogAuditClient } from "@/lib/catalog/audit";
import { createCatalogLifecycleService } from "@/lib/catalog/lifecycle";
import {
  CatalogServiceError,
  type CatalogErrorCode,
} from "@/lib/catalog/errors";
import * as repository from "@/lib/catalog/repository";
import { createFulfillmentProviderMappingRepository } from "@/lib/fulfillment/mapping";
import {
  CatalogValidationError,
  validateCategory,
  validateCategoryHierarchy,
  validateCollection,
  validateImage,
  validateImageRelationships,
  validateImageAssetUniqueness,
  normalizeAltText,
  validateMoney,
  validateProduct,
  validatePublishingReadiness,
  validateMerchandisingMembership,
  validateMerchandisingReorder,
  validateTag,
  validateVariant,
  validateVariantPricing,
  validateVariantUniqueness,
  validateOptionType,
  validateOptionValue,
  normalizeOptionTypeName,
  normalizeOptionIdentity,
  normalizeOptionDisplayValue,
  normalizeTagName,
  normalizeTagSlug,
  normalizeTitle,
  normalizeSku,
  normalizeSlug,
  normalizeSeoText,
  type CategoryInput,
  type CollectionInput,
  type ImageInput,
  type ProductInput,
  type VariantInput,
  type VariantOptionTypeInput,
  type VariantOptionValueInput,
  type TagInput,
} from "@/lib/catalog/validation";

type CatalogRepository = {
  getProductById: typeof repository.getProductById;
  getProductBySlug: typeof repository.getProductBySlug;
  getProductWithVariants: typeof repository.getProductWithVariants;
  getProductDetails: typeof repository.getProductDetails;
  listProducts: typeof repository.listProducts;
  listPublishedProducts: typeof repository.listPublishedProducts;
  createProduct: typeof repository.createProduct;
  updateProduct: typeof repository.updateProduct;
  transitionProductStatus: typeof repository.transitionProductStatus;
  createVariant: typeof repository.createVariant;
  getVariantById: typeof repository.getVariantById;
  getVariantsByProduct: typeof repository.getVariantsByProduct;
  updateVariant: typeof repository.updateVariant;
  deactivateVariant: typeof repository.deactivateVariant;
  createOptionType: typeof repository.createOptionType;
  getOptionTypeById: typeof repository.getOptionTypeById;
  getOptionTypeByNormalizedName: typeof repository.getOptionTypeByNormalizedName;
  updateOptionType: typeof repository.updateOptionType;
  createOptionValue: typeof repository.createOptionValue;
  getOptionValueById: typeof repository.getOptionValueById;
  getOptionValueByIdentity: typeof repository.getOptionValueByIdentity;
  listOptionValues: typeof repository.listOptionValues;
  updateOptionValue: typeof repository.updateOptionValue;
  assignProductOptionType: typeof repository.assignProductOptionType;
  removeProductOptionType: typeof repository.removeProductOptionType;
  listProductOptionTypes: typeof repository.listProductOptionTypes;
  replaceVariantOptionValues: typeof repository.replaceVariantOptionValues;
  getVariantOptionValues: typeof repository.getVariantOptionValues;
  createImage: typeof repository.createImage;
  getImageById: typeof repository.getImageById;
  listProductImages: typeof repository.listProductImages;
  listVariantImages: typeof repository.listVariantImages;
  getPrimaryProductImage: typeof repository.getPrimaryProductImage;
  updateImage: typeof repository.updateImage;
  deleteImage: typeof repository.deleteImage;
  reorderImages: typeof repository.reorderImages;
  updateProductImagesPrimaryState: typeof repository.updateProductImagesPrimaryState;
  createCategory: typeof repository.createCategory;
  getCategoryById: typeof repository.getCategoryById;
  getCategoryBySlug: (slug: string, client?: repository.CatalogRepositoryClient) => Promise<{ id: string; status: "ACTIVE" | "DRAFT" | "ARCHIVED"; name: string; slug: string; description: string | null; seoTitle: string | null; seoDescription: string | null; parentId: string | null; createdAt: Date; updatedAt: Date; _count: { products: number } } | null>;
  getCategoryHierarchy: typeof repository.getCategoryHierarchy;
  updateCategory: typeof repository.updateCategory;
  archiveCategory: typeof repository.archiveCategory;
  createCollection: typeof repository.createCollection;
  getCollectionById: typeof repository.getCollectionById;
  getCollectionBySlug: (slug: string, client?: repository.CatalogRepositoryClient) => Promise<{ id: string; status: "ACTIVE" | "DRAFT" | "ARCHIVED"; name: string; slug: string; description: string | null; seoTitle: string | null; seoDescription: string | null; createdAt: Date; updatedAt: Date; _count: { products: number } } | null>;
  updateCollection: typeof repository.updateCollection;
  archiveCollection: typeof repository.archiveCollection;
  createTag: typeof repository.createTag;
  getTagById: typeof repository.getTagById;
  getTagByName: typeof repository.getTagByName;
  updateTag: typeof repository.updateTag;
  deleteTag: typeof repository.deleteTag;
  attachCategory: typeof repository.attachCategory;
  getProductCategory: typeof repository.getProductCategory;
  updateProductCategory: typeof repository.updateProductCategory;
  reorderProductCategory: typeof repository.reorderProductCategory;
  detachCategory: typeof repository.detachCategory;
  attachCollection: typeof repository.attachCollection;
  getProductCollection: typeof repository.getProductCollection;
  updateProductCollection: typeof repository.updateProductCollection;
  reorderProductCollection: typeof repository.reorderProductCollection;
  listCollectionProducts: typeof repository.listCollectionProducts;
  listCategoryProducts: typeof repository.listCategoryProducts;
  detachCollection: typeof repository.detachCollection;
  attachTag: typeof repository.attachTag;
  detachTag: typeof repository.detachTag;
  replaceProductRelationships: typeof repository.replaceProductRelationships;
  withTransaction: typeof repository.withTransaction;
};

const defaultRepository: CatalogRepository = repository;

export type CatalogMerchandisingProduct = {
  productId: string;
  position: number;
  priority: number;
  isFeatured: boolean;
  product: {
    id: string;
    title: string;
    slug: string;
    status: "DRAFT" | "ACTIVE" | "ARCHIVED";
    createdAt: Date;
    updatedAt: Date;
  };
};

export type CreateProductInput = ProductInput & {
  variants?: VariantInput[];
  images?: ImageInput[];
  categoryIds?: string[];
  collectionIds?: string[];
  tagIds?: string[];
  optionTypeIds?: string[];
};

export type UpdateProductInput = Partial<Omit<ProductInput, "id">> & {
  id: string;
  categoryIds?: string[];
  collectionIds?: string[];
  tagIds?: string[];
};

function validationError(issues: { field: string; code: string; message: string }[], code: CatalogErrorCode): never {
  const error = new CatalogValidationError(issues);
  throw new CatalogServiceError(code, error.message, error);
}

function mapDatabaseError(error: unknown): never {
  if (error instanceof CatalogServiceError) throw error;
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      const target = Array.isArray(error.meta?.target) ? error.meta?.target.join(",") : String(error.meta?.target ?? "");
      if (target.includes("slug")) throw new CatalogServiceError("DUPLICATE_SLUG", "Catalog slug already exists.", error);
      if (target.includes("sku")) throw new CatalogServiceError("DUPLICATE_SKU", "Product SKU already exists.", error);
      throw new CatalogServiceError("PRODUCT_ALREADY_EXISTS", "A catalog record with the same unique identity already exists.", error);
    }
    if (error.code === "P2025") throw new CatalogServiceError("CATALOG_DATABASE_ERROR", "The requested catalog record was not found.", error);
    if (error.code === "P2003") throw new CatalogServiceError("CATALOG_DATABASE_ERROR", "A catalog relationship references an invalid record.", error);
  }
  throw new CatalogServiceError("CATALOG_DATABASE_ERROR", "Catalog database operation failed.", error);
}

function requireId(id: string, code: CatalogErrorCode, label: string): void {
  if (!id.trim()) throw new CatalogServiceError(code, label + " is required.");
}

function decimalValue(value: number | string | null | undefined): Prisma.Decimal | null | undefined {
  if (value === null || value === undefined) return value;
  return new Prisma.Decimal(String(value));
}

function normalizeProductInput(input: ProductInput): ProductInput {
  return {
    ...input,
    title: normalizeTitle(input.title),
    slug: normalizeSlug(input.slug || input.title),
    seoTitle: normalizeSeoText(input.seoTitle),
    seoDescription: normalizeSeoText(input.seoDescription),
  };
}

function normalizeVariantInput(input: VariantInput): VariantInput {
  return {
    ...input,
    sku: normalizeSku(input.sku),
    optionValueIds: input.optionValueIds ? [...new Set(input.optionValueIds.map((value) => value.trim()).filter(Boolean))] : undefined,
  };
}

async function validateVariantOptionValues(
  repo: CatalogRepository,
  productId: string,
  optionValueIds: string[] | undefined,
  allowedOptionTypeIds?: string[],
): Promise<{ optionValueIds: string[]; issues: { field: string; code: string; message: string }[] }> {
  const ids = [...new Set(optionValueIds ?? [])];
  if (!ids.length) return { optionValueIds: [], issues: [] };
  const assigned = allowedOptionTypeIds ? [] : await repo.listProductOptionTypes(productId);
  const assignedTypeIds = new Set(allowedOptionTypeIds ?? assigned.map((item) => item.optionTypeId));
  const seenTypes = new Set<string>();
  const issues: { field: string; code: string; message: string }[] = [];
  for (const [index, id] of ids.entries()) {
    const value = await repo.getOptionValueById(id);
    if (!value) {
      issues.push({ field: "optionValueIds[" + index + "]", code: "INVALID_OPTION_VALUE", message: "Variant references an unknown option value." });
      continue;
    }
    if (!assignedTypeIds.has(value.optionTypeId)) {
      issues.push({ field: "optionValueIds[" + index + "]", code: "OPTION_NOT_ASSIGNED", message: "Variant option value belongs to an option type not assigned to the Product." });
    }
    if (seenTypes.has(value.optionTypeId)) {
      issues.push({ field: "optionValueIds[" + index + "]", code: "DUPLICATE_OPTION_TYPE", message: "A variant may contain only one value from each option type." });
    }
    seenTypes.add(value.optionTypeId);
  }
  return { optionValueIds: ids, issues };
}

function uniqueIds(ids: string[] | undefined): string[] | undefined {
  return ids ? [...new Set(ids)] : undefined;
}

export function createCatalogService(
  customRepository: Partial<CatalogRepository> = {},
  auditContext: CatalogAuditContext = {},
) {
  const repo: CatalogRepository = { ...defaultRepository, ...customRepository };
  const audit = (
    event: Omit<Parameters<typeof recordCatalogAudit>[0], keyof CatalogAuditContext>,
    client?: CatalogAuditClient,
  ) => recordCatalogAudit({ ...auditContext, ...event }, client);
  const lifecycle = createCatalogLifecycleService(repo, audit, auditContext);

  const service = {
    async createProduct(input: CreateProductInput) {
      const product = normalizeProductInput(input);
      const variants = (input.variants ?? []).map(normalizeVariantInput);
      const images = input.images ?? [];
      const categoryIds = uniqueIds(input.categoryIds);
      const collectionIds = uniqueIds(input.collectionIds);
      const tagIds = uniqueIds(input.tagIds);
      const optionTypeIds = uniqueIds(input.optionTypeIds);

      const productIssues = validateProduct(product);
      const optionTypeRecords = await Promise.all((optionTypeIds ?? []).map((id) => repo.getOptionTypeById(id)));
      const missingOptionTypeIssues = (optionTypeRecords ?? []).flatMap((record, index) =>
        record ? [] : [{ field: "optionTypeIds[" + index + "]", code: "OPTION_TYPE_NOT_FOUND", message: "Product option type was not found." }],
      );
      if (missingOptionTypeIssues.length) validationError(missingOptionTypeIssues, "INVALID_VARIANT");
      const variantIssues = [
        ...variants.flatMap((variant, index) =>
          validateVariant(variant).map((item) => ({ ...item, field: "variants[" + index + "]." + item.field })),
        ),
        ...validateVariantUniqueness(variants),
      ];
      const imageIssues = [
        ...images.flatMap((image, index) =>
          validateImage(image).map((item) => ({ ...item, field: "images[" + index + "]." + item.field })),
        ),
        ...validatePrimaryProductImages(images),
        ...validateImageAssetUniqueness(images),
      ];
      if (productIssues.length || variantIssues.length || imageIssues.length) {
        validationError([...productIssues, ...variantIssues, ...imageIssues], "INVALID_PRODUCT");
      }

      const productId = product.id ?? randomUUID();
      const normalizedVariants = variants.map((variant) => ({
        ...variant,
        id: variant.id ?? randomUUID(),
      }));
      const variantOptionChecks = await Promise.all(
        normalizedVariants.map((variant) => validateVariantOptionValues(repo, productId, variant.optionValueIds, optionTypeIds)),
      );
      const variantOptionIssues = variantOptionChecks.flatMap((check, index) =>
        check.issues.map((item) => ({ ...item, field: "variants[" + index + "]." + item.field })),
      );
      if (variantOptionIssues.length) validationError(variantOptionIssues, "INVALID_VARIANT");
      const normalizedImages = images.map((image) => ({
        ...image,
        productId: image.productId ?? (image.variantId ? null : productId),
        variantId: image.variantId ?? null,
        url: image.url.trim(),
        storageReference: image.storageReference?.trim() || null,
        mediaType: image.mediaType ?? "IMAGE",
        altText: normalizeAltText(image.altText),
      }));
      const imageOwnershipIssues = normalizedImages.flatMap((image, index) =>
        image.productId && image.productId !== productId
          ? [{ field: "images[" + index + "].productId", code: "INVALID_IMAGE_PRODUCT", message: "Image must belong to the Product being created." }]
          : [],
      );
      if (imageOwnershipIssues.length) validationError(imageOwnershipIssues, "INVALID_IMAGE_RELATIONSHIP");

      const variantRelationshipIssues = validateImageRelationships(
        productId,
        normalizedImages,
        normalizedVariants,
      );
      if (variantRelationshipIssues.length) validationError(variantRelationshipIssues, "INVALID_IMAGE_RELATIONSHIP");

      const existingSlug = await repo.getProductBySlug(product.slug);
      if (existingSlug) throw new CatalogServiceError("DUPLICATE_SLUG", "Catalog slug already exists.");
      if (product.status === "ACTIVE") {
        const readiness = validatePublishingReadiness({
          product,
          variants: normalizedVariants,
          images: normalizedImages,
        });
        if (readiness.length) validationError(readiness, "PRODUCT_NOT_PUBLISHABLE");
      }

      const requestedStatus = product.status;
      const persistedStatus = requestedStatus === "ACTIVE" || requestedStatus === "ARCHIVED" ? "DRAFT" : requestedStatus;

      try {
        const created = await repo.withTransaction(async (tx) => {
          const created = await repo.createProduct({
            id: productId,
            title: product.title,
            slug: product.slug,
            description: product.description ?? null,
            shortDescription: product.shortDescription ?? null,
            status: persistedStatus,
            price: decimalValue(product.price)!,
            compareAtPrice: decimalValue(product.compareAtPrice) ?? null,
            currency: product.currency,
            seoTitle: product.seoTitle ?? null,
            seoDescription: product.seoDescription ?? null,
          }, tx);

          for (const [index, optionTypeId] of (optionTypeIds ?? []).entries()) {
            const relationship = await repo.assignProductOptionType(productId, optionTypeId, index, tx);
            await audit({
              entityType: "PRODUCT",
              entityId: productId,
              operation: "RELATIONSHIP_ADD",
              metadata: { optionTypeId, sortOrder: index, relationship },
            }, tx);
          }

          for (const variant of normalizedVariants) {
            const variantId = variant.id!;
            await repo.createVariant({
              id: variantId,
              product: { connect: { id: productId } },
              sku: variant.sku,
              displayName: variant.displayName ?? null,
              size: variant.size ?? null,
              color: variant.color ?? null,
              price: decimalValue(variant.price) ?? null,
              compareAtPrice: decimalValue(variant.compareAtPrice) ?? null,
              status: variant.status,
            }, tx);
            const optionCheck = variantOptionChecks[normalizedVariants.indexOf(variant)];
            await repo.replaceVariantOptionValues(variantId, optionCheck.optionValueIds, tx);
            if (optionCheck.optionValueIds.length) {
              await audit({
                entityType: "VARIANT",
                entityId: variantId,
                operation: "RELATIONSHIP_ADD",
                metadata: { optionValueIds: optionCheck.optionValueIds },
              }, tx);
            }
          }

          for (const image of normalizedImages) {
            const createdImage = await repo.createImage({
              product: image.productId ? { connect: { id: image.productId } } : undefined,
              variant: image.variantId ? { connect: { id: image.variantId } } : undefined,
              url: image.url.trim(),
              storageReference: image.storageReference?.trim() || null,
              mediaType: image.mediaType ?? "IMAGE",
              altText: normalizeAltText(image.altText),
              sortOrder: image.sortOrder,
              isPrimary: image.isPrimary,
            }, tx);
            await audit({ entityType: "MEDIA", entityId: createdImage.id, operation: "CREATE", afterState: createdImage }, tx);
          }

          for (const categoryId of categoryIds ?? []) {
            await repo.attachCategory(productId, categoryId, {}, tx);
            await audit({ entityType: "PRODUCT_CATEGORY", entityId: productId, operation: "RELATIONSHIP_ADD", metadata: { categoryId } }, tx);
          }
          for (const collectionId of collectionIds ?? []) {
            await repo.attachCollection(productId, collectionId, {}, tx);
            await audit({ entityType: "PRODUCT_COLLECTION", entityId: productId, operation: "RELATIONSHIP_ADD", metadata: { collectionId } }, tx);
          }
          for (const tagId of tagIds ?? []) {
            await repo.attachTag(productId, tagId, tx);
            await audit({ entityType: "PRODUCT_TAG", entityId: productId, operation: "RELATIONSHIP_ADD", metadata: { tagId } }, tx);
          }

          await audit({
            entityType: "PRODUCT",
            entityId: productId,
            operation: "CREATE",
            afterState: created,
            metadata: { variantCount: normalizedVariants.length, mediaCount: normalizedImages.length },
          }, tx);
          for (const variant of normalizedVariants) {
            await audit({ entityType: "VARIANT", entityId: variant.id!, operation: "CREATE", afterState: variant }, tx);
          }
          return created;
        });

        if (requestedStatus === "ACTIVE") return lifecycle.publishProduct(productId);
        if (requestedStatus === "ARCHIVED") return lifecycle.archiveProduct(productId);
        return created;
      } catch (error) {
        mapDatabaseError(error);
      }
    },

    async getProductById(id: string) {
      requireId(id, "PRODUCT_NOT_FOUND", "Product ID");
      const product = await repo.getProductById(id);
      if (!product) throw new CatalogServiceError("PRODUCT_NOT_FOUND", "Product was not found.");
      return product;
    },

    async getProductBySlug(slug: string) {
      requireId(slug, "PRODUCT_NOT_FOUND", "Product slug");
      const product = await repo.getProductBySlug(slug);
      if (!product) throw new CatalogServiceError("PRODUCT_NOT_FOUND", "Product was not found.");
      return product;
    },

    async getProductWithVariants(id: string) {
      requireId(id, "PRODUCT_NOT_FOUND", "Product ID");
      const product = await repo.getProductWithVariants(id);
      if (!product) throw new CatalogServiceError("PRODUCT_NOT_FOUND", "Product was not found.");
      return product;
    },

    async getProductDetails(id: string) {
      requireId(id, "PRODUCT_NOT_FOUND", "Product ID");
      const product = await repo.getProductDetails(id);
      if (!product) throw new CatalogServiceError("PRODUCT_NOT_FOUND", "Product was not found.");
      return product;
    },

    async updateProduct(input: UpdateProductInput) {
      requireId(input.id, "PRODUCT_NOT_FOUND", "Product ID");
      const existing = await this.getProductById(input.id);
      const merged: ProductInput = normalizeProductInput({
        id: existing.id,
        title: input.title ?? existing.title,
        slug: input.slug ?? existing.slug,
        description: input.description === undefined ? existing.description : input.description,
        shortDescription: input.shortDescription === undefined ? existing.shortDescription : input.shortDescription,
        status: input.status ?? existing.status,
        price: input.price ?? existing.price.toString(),
        compareAtPrice: input.compareAtPrice === undefined ? existing.compareAtPrice?.toString() ?? null : input.compareAtPrice,
        currency: input.currency ?? existing.currency,
        seoTitle: input.seoTitle === undefined ? existing.seoTitle : input.seoTitle,
        seoDescription: input.seoDescription === undefined ? existing.seoDescription : input.seoDescription,
      });

      const issues = validateProduct(merged);
      if (merged.status !== existing.status) {
        throw new CatalogServiceError(
          "INVALID_STATUS_TRANSITION",
          "Product status must be changed through the lifecycle service.",
        );
      }
      if (existing.status === "ACTIVE" && merged.slug !== existing.slug) {
        throw new CatalogServiceError(
          "INVALID_PRODUCT",
          "Published Product slugs cannot change without a redirect strategy.",
        );
      }
      if (issues.length) validationError(issues, "INVALID_PRODUCT");

      if (merged.slug !== existing.slug) {
        const slugOwner = await repo.getProductBySlug(merged.slug);
        if (slugOwner && slugOwner.id !== existing.id) {
          throw new CatalogServiceError("DUPLICATE_SLUG", "Catalog slug already exists.");
        }
      }

      try {
        const updated = await repo.withTransaction(async (tx) => {
          if (merged.status === "ACTIVE") {
            const currentDetails = await repo.getProductDetails(input.id, tx);
            if (!currentDetails) throw new CatalogServiceError("PRODUCT_NOT_FOUND", "Product was not found.");
            const readiness = validatePublishingReadiness({
              product: {
                id: currentDetails.id,
                title: merged.title,
                slug: merged.slug,
                description: merged.description,
                shortDescription: merged.shortDescription,
                status: merged.status,
                price: String(merged.price),
                compareAtPrice: merged.compareAtPrice,
                currency: merged.currency,
                seoTitle: merged.seoTitle,
                seoDescription: merged.seoDescription,
              },
              variants: currentDetails.variants.map((variant) => ({
                id: variant.id,
                productId: variant.productId,
                sku: variant.sku,
                displayName: variant.displayName,
                size: variant.size,
                color: variant.color,
                price: variant.price?.toString() ?? null,
                compareAtPrice: variant.compareAtPrice?.toString() ?? null,
                status: variant.status,
              })),
              images: currentDetails.images.map((image) => ({
                productId: image.productId,
                variantId: image.variantId,
                url: image.url,
                altText: image.altText,
                sortOrder: image.sortOrder,
                isPrimary: image.isPrimary,
              })),
            });
            if (readiness.length) validationError(readiness, "PRODUCT_NOT_PUBLISHABLE");
          }

          const result = await repo.updateProduct(input.id, {
            title: merged.title,
            slug: merged.slug,
            description: merged.description,
            shortDescription: merged.shortDescription,
            price: decimalValue(merged.price)!,
            compareAtPrice: decimalValue(merged.compareAtPrice) ?? null,
            currency: merged.currency,
            seoTitle: merged.seoTitle,
            seoDescription: merged.seoDescription,
          }, tx);

          if (input.categoryIds || input.collectionIds || input.tagIds) {
            const beforeRelationships = await repo.getProductDetails(input.id, tx);
            await repo.replaceProductRelationships(input.id, {
              categoryIds: uniqueIds(input.categoryIds),
              collectionIds: uniqueIds(input.collectionIds),
              tagIds: uniqueIds(input.tagIds),
            }, tx);
            const afterRelationships = await repo.getProductDetails(input.id, tx);
            const beforeCategories = new Set((beforeRelationships?.categories ?? []).map((item) => item.categoryId));
            const afterCategories = new Set((afterRelationships?.categories ?? []).map((item) => item.categoryId));
            const beforeCollections = new Set((beforeRelationships?.collections ?? []).map((item) => item.collectionId));
            const afterCollections = new Set((afterRelationships?.collections ?? []).map((item) => item.collectionId));
            const beforeTags = new Set((beforeRelationships?.tags ?? []).map((item) => item.tagId));
            const afterTags = new Set((afterRelationships?.tags ?? []).map((item) => item.tagId));
            for (const categoryId of afterCategories) if (!beforeCategories.has(categoryId)) await audit({ entityType: "PRODUCT_CATEGORY", entityId: input.id, operation: "RELATIONSHIP_ADD", metadata: { categoryId } }, tx);
            for (const categoryId of beforeCategories) if (!afterCategories.has(categoryId)) await audit({ entityType: "PRODUCT_CATEGORY", entityId: input.id, operation: "RELATIONSHIP_REMOVE", metadata: { categoryId } }, tx);
            for (const collectionId of afterCollections) if (!beforeCollections.has(collectionId)) await audit({ entityType: "PRODUCT_COLLECTION", entityId: input.id, operation: "RELATIONSHIP_ADD", metadata: { collectionId } }, tx);
            for (const collectionId of beforeCollections) if (!afterCollections.has(collectionId)) await audit({ entityType: "PRODUCT_COLLECTION", entityId: input.id, operation: "RELATIONSHIP_REMOVE", metadata: { collectionId } }, tx);
            for (const tagId of afterTags) if (!beforeTags.has(tagId)) await audit({ entityType: "PRODUCT_TAG", entityId: input.id, operation: "RELATIONSHIP_ADD", metadata: { tagId } }, tx);
            for (const tagId of beforeTags) if (!afterTags.has(tagId)) await audit({ entityType: "PRODUCT_TAG", entityId: input.id, operation: "RELATIONSHIP_REMOVE", metadata: { tagId } }, tx);
          }
          await audit({
            entityType: "PRODUCT",
            entityId: input.id,
            operation: "UPDATE",
            changedFields: changedFields(existing as unknown as Record<string, unknown>, result as unknown as Record<string, unknown>),
            beforeState: existing,
            afterState: result,
            metadata: {
              relationshipReplacement: Boolean(input.categoryIds || input.collectionIds || input.tagIds),
            },
          }, tx);
          return result;
        });
        return updated;
      } catch (error) {
        mapDatabaseError(error);
      }
    },

    async archiveProduct(id: string) {
      return lifecycle.archiveProduct(id);
    },

    async publishProduct(id: string) {
      if (Object.keys(customRepository).length === 0) {
        const variants = await repo.getVariantsByProduct(id);
        const activeVariants = variants.filter((variant) => variant.status === "ACTIVE");
        const mappings = createFulfillmentProviderMappingRepository();
        for (const variant of activeVariants) {
          const mapping = await mappings.getByVariantAndProvider(variant.id, "qikink");
          if (!mapping?.active || !mapping.providerSku.trim()) {
            throw new CatalogServiceError(
              "NOT_PUBLICATION_READY",
              "Every active ProductVariant requires an active Qikink provider mapping before publication.",
            );
          }
        }
      }
      return lifecycle.publishProduct(id);
    },

    async unpublishProduct(id: string) {
      return lifecycle.unpublishProduct(id);
    },

    async restoreProduct(id: string) {
      return lifecycle.restoreProduct(id);
    },

    async createOptionType(input: VariantOptionTypeInput) {
      const normalizedName = normalizeOptionTypeName(input.name).toLowerCase();
      const issues = validateOptionType(input);
      if (issues.length) validationError(issues, "INVALID_VARIANT");
      if (await repo.getOptionTypeByNormalizedName(normalizedName)) {
        throw new CatalogServiceError("DUPLICATE_OPTION_TYPE", "Option type already exists.");
      }
      try {
        return await repo.withTransaction(async (tx) => {
          const created = await repo.createOptionType({
            id: input.id ?? randomUUID(),
            name: normalizeOptionTypeName(input.name),
            normalizedName,
            sortOrder: input.sortOrder ?? 0,
          }, tx);
          await audit({ entityType: "OPTION_TYPE", entityId: created.id, operation: "CREATE", afterState: created }, tx);
          return created;
        });
      } catch (error) { mapDatabaseError(error); }
    },

    async updateOptionType(id: string, patch: Partial<Omit<VariantOptionTypeInput, "id">>) {
      requireId(id, "VARIANT_NOT_FOUND", "Option type ID");
      const existing = await repo.getOptionTypeById(id);
      if (!existing) throw new CatalogServiceError("OPTION_TYPE_NOT_FOUND", "Option type was not found.");
      const name = patch.name === undefined ? existing.name : normalizeOptionTypeName(patch.name);
      const normalizedName = normalizeOptionTypeName(name).toLowerCase();
      const issues = validateOptionType({ id, name, sortOrder: patch.sortOrder ?? existing.sortOrder });
      if (issues.length) validationError(issues, "INVALID_VARIANT");
      const duplicate = await repo.getOptionTypeByNormalizedName(normalizedName);
      if (duplicate && duplicate.id !== id) throw new CatalogServiceError("DUPLICATE_OPTION_TYPE", "Option type already exists.");
      return repo.withTransaction(async (tx) => {
        const updated = await repo.updateOptionType(id, { name, normalizedName, sortOrder: patch.sortOrder ?? existing.sortOrder }, tx);
        await audit({ entityType: "OPTION_TYPE", entityId: id, operation: "UPDATE", changedFields: changedFields(existing as unknown as Record<string, unknown>, updated as unknown as Record<string, unknown>), beforeState: existing, afterState: updated }, tx);
        return updated;
      });
    },

    async createOptionValue(input: VariantOptionValueInput) {
      const normalizedValue = normalizeOptionIdentity(input.normalizedValue || input.displayName);
      const displayName = normalizeOptionDisplayValue(input.displayName);
      const issues = validateOptionValue({ ...input, displayName, normalizedValue });
      if (issues.length) validationError(issues, "INVALID_VARIANT");
      const optionType = await repo.getOptionTypeById(input.optionTypeId);
      if (!optionType) throw new CatalogServiceError("OPTION_TYPE_NOT_FOUND", "Option type was not found.");
      const duplicate = await repo.getOptionValueByIdentity(input.optionTypeId, normalizedValue);
      if (duplicate) throw new CatalogServiceError("DUPLICATE_OPTION_VALUE", "Option value already exists for this option type.");
      try {
        return await repo.withTransaction(async (tx) => {
          const created = await repo.createOptionValue({
            id: input.id ?? randomUUID(),
            optionType: { connect: { id: input.optionTypeId } },
            displayName,
            normalizedValue,
            sortOrder: input.sortOrder ?? 0,
            hex: input.hex ?? null,
            swatch: input.swatch ?? null,
          }, tx);
          await audit({ entityType: "OPTION_VALUE", entityId: created.id, operation: "CREATE", afterState: created }, tx);
          return created;
        });
      } catch (error) { mapDatabaseError(error); }
    },

    async updateOptionValue(id: string, patch: Partial<Omit<VariantOptionValueInput, "id" | "optionTypeId">>) {
      requireId(id, "VARIANT_NOT_FOUND", "Option value ID");
      const existing = await repo.getOptionValueById(id);
      if (!existing) throw new CatalogServiceError("OPTION_VALUE_NOT_FOUND", "Option value was not found.");
      const displayName = patch.displayName === undefined ? existing.displayName : normalizeOptionDisplayValue(patch.displayName);
      const normalizedValue = normalizeOptionIdentity(patch.normalizedValue ?? displayName);
      const issues = validateOptionValue({
        id,
        optionTypeId: existing.optionTypeId,
        displayName,
        normalizedValue,
        sortOrder: patch.sortOrder ?? existing.sortOrder,
        hex: patch.hex === undefined ? existing.hex : patch.hex,
        swatch: patch.swatch === undefined ? existing.swatch : patch.swatch,
      });
      if (issues.length) validationError(issues, "INVALID_VARIANT");
      const duplicate = await repo.getOptionValueByIdentity(existing.optionTypeId, normalizedValue);
      if (duplicate && duplicate.id !== id) throw new CatalogServiceError("DUPLICATE_OPTION_VALUE", "Option value already exists for this option type.");
      return repo.withTransaction(async (tx) => {
        const updated = await repo.updateOptionValue(id, {
          displayName,
          normalizedValue,
          sortOrder: patch.sortOrder ?? existing.sortOrder,
          hex: patch.hex === undefined ? existing.hex : patch.hex,
          swatch: patch.swatch === undefined ? existing.swatch : patch.swatch,
        }, tx);
        await audit({ entityType: "OPTION_VALUE", entityId: id, operation: "UPDATE", changedFields: changedFields(existing as unknown as Record<string, unknown>, updated as unknown as Record<string, unknown>), beforeState: existing, afterState: updated }, tx);
        return updated;
      });
    },

    async assignProductOptionType(productId: string, optionTypeId: string, sortOrder = 0) {
      await this.getProductById(productId);
      const optionType = await repo.getOptionTypeById(optionTypeId);
      if (!optionType) throw new CatalogServiceError("OPTION_TYPE_NOT_FOUND", "Option type was not found.");
      if (!Number.isInteger(sortOrder) || sortOrder < 0) validationError([{ field: "sortOrder", code: "INVALID_SORT_ORDER", message: "Option order must be a non-negative integer." }], "INVALID_VARIANT");
      return repo.withTransaction(async (tx) => {
        const result = await repo.assignProductOptionType(productId, optionTypeId, sortOrder, tx);
        await audit({ entityType: "PRODUCT", entityId: productId, operation: "RELATIONSHIP_ADD", metadata: { optionTypeId, sortOrder } }, tx);
        return result;
      });
    },

    async removeProductOptionType(productId: string, optionTypeId: string) {
      await this.getProductById(productId);
      const variants = await repo.getVariantsByProduct(productId);
      const optionValues = await Promise.all(variants.map((variant) => repo.getVariantOptionValues(variant.id)));
      if (optionValues.some((values) => values.some((value) => value.optionValue.optionTypeId === optionTypeId))) {
        throw new CatalogServiceError("INVALID_VARIANT", "Cannot remove an option type that is used by an existing variant.");
      }
      return repo.withTransaction(async (tx) => {
        const result = await repo.removeProductOptionType(productId, optionTypeId, tx);
        await audit({ entityType: "PRODUCT", entityId: productId, operation: "RELATIONSHIP_REMOVE", metadata: { optionTypeId } }, tx);
        return result;
      });
    },

    async getProductOptionTypes(productId: string) {
      await this.getProductById(productId);
      return repo.listProductOptionTypes(productId);
    },

    async createVariant(input: VariantInput) {
      const variant = normalizeVariantInput(input);
      const issues = validateVariant(variant);
      const product = await repo.getProductById(variant.productId);
      if (!product) throw new CatalogServiceError("PRODUCT_NOT_FOUND", "Product was not found.");
      const optionValueIds = variant.optionValueIds ?? [];
      const optionCheck = await validateVariantOptionValues(repo, variant.productId, optionValueIds);
      issues.push(...optionCheck.issues);
      const existingVariants = await repo.getVariantsByProduct(variant.productId);
      if (existingVariants.some((item) => item.sku === variant.sku)) {
        throw new CatalogServiceError("DUPLICATE_SKU", "Product SKU already exists.");
      }
      const existingVariantsWithOptions = await Promise.all(existingVariants.map(async (item) => ({
        productId: item.productId,
        id: item.id,
        sku: item.sku,
        displayName: item.displayName,
        size: item.size,
        color: item.color,
        optionValueIds: optionValueIds.length
          ? (await repo.getVariantOptionValues(item.id)).map((value) => value.optionValueId)
          : [],
        price: item.price?.toString() ?? null,
        compareAtPrice: item.compareAtPrice?.toString() ?? null,
        status: item.status,
      })));
      if (validateVariantUniqueness([
        ...existingVariantsWithOptions,
        variant,
      ]).length) {
        issues.push({ field: "variant", code: "DUPLICATE_VARIANT", message: "Variant duplicates an existing size/color combination." });
      }
      issues.push(...validateVariantPricing(product.price.toString(), variant));
      if (issues.length) validationError(issues, "INVALID_VARIANT");
      try {
        const created = await repo.withTransaction(async (tx) => {
          const result = await repo.createVariant({
          id: variant.id ?? randomUUID(),
          product: { connect: { id: variant.productId } },
          sku: variant.sku,
          displayName: variant.displayName ?? null,
          size: variant.size ?? null,
          color: variant.color ?? null,
          price: decimalValue(variant.price) ?? null,
          compareAtPrice: decimalValue(variant.compareAtPrice) ?? null,
          status: variant.status,
        }, tx);
          await repo.replaceVariantOptionValues(result.id, optionCheck.optionValueIds, tx);
          await audit({ entityType: "VARIANT", entityId: result.id, operation: "CREATE", afterState: result }, tx);
          if (optionCheck.optionValueIds.length) {
            await audit({ entityType: "VARIANT", entityId: result.id, operation: "RELATIONSHIP_ADD", metadata: { optionValueIds: optionCheck.optionValueIds } }, tx);
          }
          return result;
        });
        return created;
      } catch (error) { mapDatabaseError(error); }
    },

    async updateVariant(id: string, patch: Partial<Omit<VariantInput, "id" | "productId">>) {
      requireId(id, "VARIANT_NOT_FOUND", "Variant ID");
      const existing = await repo.getVariantById(id);
      if (!existing) throw new CatalogServiceError("VARIANT_NOT_FOUND", "Variant was not found.");
      const merged: VariantInput = {
        productId: existing.productId,
        id: existing.id,
        sku: patch.sku ?? existing.sku,
        displayName: patch.displayName === undefined ? existing.displayName : patch.displayName,
        size: patch.size === undefined ? existing.size : patch.size,
        color: patch.color === undefined ? existing.color : patch.color,
        price: patch.price === undefined ? existing.price?.toString() ?? null : patch.price,
        compareAtPrice: patch.compareAtPrice === undefined ? existing.compareAtPrice?.toString() ?? null : patch.compareAtPrice,
        status: patch.status ?? existing.status,
        optionValueIds: patch.optionValueIds === undefined ? undefined : patch.optionValueIds,
      };
      const issues = validateVariant(merged);
      const product = await repo.getProductById(existing.productId);
      if (!product) throw new CatalogServiceError("PRODUCT_NOT_FOUND", "Parent Product was not found.");
      issues.push(...validateVariantPricing(product.price.toString(), merged));
      const existingOptionValues = await repo.getVariantOptionValues(id);
      const optionCheck = await validateVariantOptionValues(
        repo,
        existing.productId,
        merged.optionValueIds === undefined
          ? existingOptionValues.map((value) => value.optionValueId)
          : merged.optionValueIds,
      );
      issues.push(...optionCheck.issues);
      const siblings = await repo.getVariantsByProduct(existing.productId);
      const siblingsWithOptions = await Promise.all(
        siblings.filter((item) => item.id !== id).map(async (item) => ({
          productId: item.productId,
          id: item.id,
          sku: item.sku,
          size: item.size,
          color: item.color,
          optionValueIds: (await repo.getVariantOptionValues(item.id)).map((value) => value.optionValueId),
          displayName: item.displayName,
          price: item.price?.toString() ?? null,
          compareAtPrice: item.compareAtPrice?.toString() ?? null,
          status: item.status,
        })),
      );
      const duplicates = validateVariantUniqueness([
        ...siblingsWithOptions,
        merged,
      ]);
      issues.push(...duplicates);
      if (issues.length) validationError(issues, "INVALID_VARIANT");
      try {
        const updated = await repo.withTransaction(async (tx) => {
          const result = await repo.updateVariant(id, {
          sku: merged.sku,
          displayName: merged.displayName,
          size: merged.size,
          color: merged.color,
          price: decimalValue(merged.price) ?? null,
          compareAtPrice: decimalValue(merged.compareAtPrice) ?? null,
          status: merged.status,
        }, tx);
          await repo.replaceVariantOptionValues(id, optionCheck.optionValueIds, tx);
          await audit({
            entityType: "VARIANT",
            entityId: id,
            operation: "UPDATE",
            changedFields: changedFields(existing as unknown as Record<string, unknown>, result as unknown as Record<string, unknown>),
            beforeState: existing,
            afterState: result,
            metadata: { optionValueIds: optionCheck.optionValueIds },
          }, tx);
          return result;
        });
        return updated;
      } catch (error) { mapDatabaseError(error); }
    },

    async deactivateVariant(id: string) {
      const existing = await repo.getVariantById(id);
      if (!existing) throw new CatalogServiceError("VARIANT_NOT_FOUND", "Variant was not found.");
      try {
        return await repo.withTransaction(async (tx) => {
          const updated = await repo.deactivateVariant(id, tx);
          await audit({ entityType: "VARIANT", entityId: id, operation: "ARCHIVE", beforeState: existing, afterState: updated }, tx);
          return updated;
        });
      } catch (error) { mapDatabaseError(error); }
    },

    async getVariantsForProduct(productId: string) {
      await this.getProductById(productId);
      return repo.getVariantsByProduct(productId);
    },

    async addImage(input: ImageInput) {
      const issues = validateImage(input);
      if (input.productId) {
        const product = await repo.getProductById(input.productId);
        if (!product) throw new CatalogServiceError("PRODUCT_NOT_FOUND", "Product was not found.");
      }
      if (input.variantId) {
        const variant = await repo.getVariantById(input.variantId);
        if (!variant) throw new CatalogServiceError("VARIANT_NOT_FOUND", "Variant was not found.");
        if (input.productId && variant.productId !== input.productId) issues.push({ field: "variantId", code: "INVALID_IMAGE_VARIANT", message: "Variant-specific image must belong to the same Product." });
      }
      if (issues.length) validationError(issues, "INVALID_IMAGE_RELATIONSHIP");
      const ownerImages = input.productId
        ? await repo.listProductImages(input.productId)
        : await repo.listVariantImages(input.variantId!);
      const normalizedUrl = input.url.trim();
      const normalizedReference = input.storageReference?.trim() || null;
      if (ownerImages.some((image) =>
        (normalizedReference !== null && image.storageReference === normalizedReference) ||
        image.url === normalizedUrl
      )) {
        throw new CatalogServiceError("INVALID_IMAGE_RELATIONSHIP", "The same media asset is already associated with this owner.");
      }
      try {
        return await repo.withTransaction(async (tx) => {
          if (input.isPrimary && input.productId) {
            await repo.updateProductImagesPrimaryState(input.productId, null, tx);
          }
          const created = await repo.createImage({
            product: input.productId ? { connect: { id: input.productId } } : undefined,
            variant: input.variantId ? { connect: { id: input.variantId } } : undefined,
            url: input.url.trim(),
            storageReference: input.storageReference?.trim() || null,
            mediaType: input.mediaType ?? "IMAGE",
            altText: normalizeAltText(input.altText),
            sortOrder: input.sortOrder,
            isPrimary: input.isPrimary,
          }, tx);
          await audit({ entityType: "MEDIA", entityId: created.id, operation: "CREATE", afterState: created }, tx);
          return created;
        });
      } catch (error) { mapDatabaseError(error); }
    },

    async updateImage(id: string, patch: Partial<Omit<ImageInput, "productId" | "variantId">>) {
      const existing = await repo.getImageById(id);
      if (!existing) throw new CatalogServiceError("IMAGE_NOT_FOUND", "Image was not found.");
      const next = {
        productId: existing.productId,
        variantId: existing.variantId,
        url: patch.url ?? existing.url,
        storageReference: existing.storageReference,
        mediaType: existing.mediaType,
        altText: patch.altText === undefined ? existing.altText : normalizeAltText(patch.altText),
        sortOrder: patch.sortOrder ?? existing.sortOrder,
        isPrimary: patch.isPrimary ?? existing.isPrimary,
      };
      const issues = validateImage(next);
      if (issues.length) validationError(issues, "INVALID_IMAGE_RELATIONSHIP");
      const ownerImages = next.productId
        ? await repo.listProductImages(next.productId)
        : await repo.listVariantImages(next.variantId!);
      const normalizedUrl = next.url.trim();
      const normalizedReference = next.storageReference?.trim() || null;
      if (ownerImages.some((image) =>
        image.id !== id &&
        ((normalizedReference !== null && image.storageReference === normalizedReference) || image.url === normalizedUrl)
      )) {
        throw new CatalogServiceError("INVALID_IMAGE_RELATIONSHIP", "The same media asset is already associated with this owner.");
      }
      try {
        return await repo.withTransaction(async (tx) => {
          if (next.isPrimary && next.productId) await repo.updateProductImagesPrimaryState(next.productId, id, tx);
          const updated = await repo.updateImage(id, {
            url: next.url.trim(),
            storageReference: next.storageReference?.trim() || null,
            mediaType: next.mediaType,
            altText: next.altText,
            sortOrder: next.sortOrder,
            isPrimary: next.isPrimary,
          }, tx);
          await audit({ entityType: "MEDIA", entityId: id, operation: "UPDATE", changedFields: changedFields(existing as unknown as Record<string, unknown>, updated as unknown as Record<string, unknown>), beforeState: existing, afterState: updated }, tx);
          return updated;
        });
      } catch (error) { mapDatabaseError(error); }
    },

    async reorderImages(updates: Array<{ id: string; sortOrder: number }>) {
      const issues = updates.flatMap((item, index) => !Number.isInteger(item.sortOrder) || item.sortOrder < 0
        ? [{ field: "[" + index + "].sortOrder", code: "INVALID_SORT_ORDER", message: "Image sort order must be a non-negative integer." }]
        : []);
      const images = await Promise.all(updates.map((item) => repo.getImageById(item.id)));
      images.forEach((image, index) => {
        if (!image) issues.push({ field: "[" + index + "].id", code: "IMAGE_NOT_FOUND", message: "Image was not found." });
      });
      const existingImages = images.filter((image): image is NonNullable<typeof image> => Boolean(image));
      const ownerKeys = new Set(existingImages.map((image) =>
        image.productId ? "product:" + image.productId : "variant:" + image.variantId,
      ));
      if (ownerKeys.size > 1) {
        issues.push({ field: "updates", code: "INVALID_IMAGE_RELATIONSHIP", message: "Images from different Products or variants cannot be reordered together." });
      }
      if (issues.length) validationError(issues, "INVALID_IMAGE_RELATIONSHIP");
      try {
        return await repo.withTransaction(async (tx) => {
          const updated = await repo.reorderImages(updates, tx);
          for (const item of updates) {
            const image = images.find((candidate) => candidate?.id === item.id);
            if (image) await audit({ entityType: "MEDIA", entityId: item.id, operation: "REORDER", changedFields: ["sortOrder"], beforeState: { sortOrder: image.sortOrder }, afterState: { sortOrder: item.sortOrder } }, tx);
          }
          return updated;
        });
      } catch (error) { mapDatabaseError(error); }
    },

    async getProductMedia(productId: string): Promise<CatalogMediaDto[]> {
      await this.getProductById(productId);
      const images = await repo.listProductImages(productId);
      return images.map((image) => toCatalogMediaDto(image));
    },

    async getVariantMedia(variantId: string): Promise<CatalogMediaDto[]> {
      const variant = await repo.getVariantById(variantId);
      if (!variant) throw new CatalogServiceError("VARIANT_NOT_FOUND", "Variant was not found.");
      const images = await repo.listVariantImages(variantId);
      return images.map((image) => toCatalogMediaDto(image));
    },

    async getPrimaryProductMedia(productId: string): Promise<CatalogMediaDto | null> {
      await this.getProductById(productId);
      const image = await repo.getPrimaryProductImage(productId);
      return image ? toCatalogMediaDto(image) : null;
    },

    async removeImage(id: string) {
      const existing = await repo.getImageById(id);
      if (!existing) throw new CatalogServiceError("IMAGE_NOT_FOUND", "Image was not found.");
      try {
        return await repo.withTransaction(async (tx) => {
          const deleted = await repo.deleteImage(id, tx);
          await audit({ entityType: "MEDIA", entityId: id, operation: "DELETE", beforeState: existing }, tx);
          return deleted;
        });
      } catch (error) { mapDatabaseError(error); }
    },

    async assignPrimaryImage(id: string) {
      const image = await repo.getImageById(id);
      if (!image) throw new CatalogServiceError("IMAGE_NOT_FOUND", "Image was not found.");
      if (!image.productId) throw new CatalogServiceError("INVALID_IMAGE_RELATIONSHIP", "Only product-level images can be assigned as the primary catalog image.");
      try {
        return await repo.withTransaction(async (tx) => {
          await repo.updateProductImagesPrimaryState(image.productId!, id, tx);
          const updated = await repo.updateImage(id, { isPrimary: true }, tx);
          await audit({ entityType: "MEDIA", entityId: id, operation: "UPDATE", changedFields: ["isPrimary"], beforeState: image, afterState: updated }, tx);
          return updated;
        });
      } catch (error) { mapDatabaseError(error); }
    },

    async createCategory(input: CategoryInput) {
      const normalizedInput = { ...input, name: normalizeTitle(input.name), slug: normalizeSlug(input.slug || input.name), seoTitle: normalizeSeoText(input.seoTitle), seoDescription: normalizeSeoText(input.seoDescription) };
      const issues = [...validateCategory(normalizedInput), ...validateCategoryHierarchy(input.id ?? "", input.parentId)];
      if (issues.length) validationError(issues, "INVALID_CATEGORY");
      const existingSlug = await repo.getCategoryBySlug(normalizedInput.slug);
      if (existingSlug) throw new CatalogServiceError("DUPLICATE_SLUG", "Catalog slug already exists.");
      if (input.parentId) {
        const parent = await repo.getCategoryById(input.parentId);
        if (!parent) throw new CatalogServiceError("CATEGORY_NOT_FOUND", "Parent category was not found.");
      }
      try {
        return await repo.withTransaction(async (tx) => {
          const created = await repo.createCategory({
            id: input.id ?? randomUUID(),
            name: normalizedInput.name,
            slug: normalizedInput.slug,
            status: input.status,
            seoTitle: normalizedInput.seoTitle,
            seoDescription: normalizedInput.seoDescription,
            parent: input.parentId ? { connect: { id: input.parentId } } : undefined,
          }, tx);
          await audit({ entityType: "CATEGORY", entityId: created.id, operation: "CREATE", afterState: created }, tx);
          return created;
        });
      } catch (error) { mapDatabaseError(error); }
    },

    async updateCategory(id: string, patch: Partial<Omit<CategoryInput, "id">>) {
      const existing = await repo.getCategoryById(id);
      if (!existing) throw new CatalogServiceError("CATEGORY_NOT_FOUND", "Category was not found.");
      const next = {
        id,
        name: normalizeTitle(patch.name ?? existing.name),
        slug: normalizeSlug(patch.slug ?? existing.slug),
        status: patch.status ?? existing.status,
        parentId: patch.parentId === undefined ? existing.parentId : patch.parentId,
        seoTitle: normalizeSeoText(patch.seoTitle === undefined ? existing.seoTitle : patch.seoTitle),
        seoDescription: normalizeSeoText(patch.seoDescription === undefined ? existing.seoDescription : patch.seoDescription),
      };
      const issues = [...validateCategory(next), ...validateCategoryHierarchy(id, next.parentId)];
      if (existing.status === "ACTIVE" && next.slug !== existing.slug) {
        issues.push({ field: "slug", code: "SLUG_CHANGE_REQUIRES_REDIRECT", message: "Published Category slugs cannot change without a redirect strategy." });
      }

      if (issues.length) validationError(issues, "INVALID_CATEGORY");
      if (next.slug !== existing.slug) {
        const slugOwner = await repo.getCategoryBySlug(next.slug);
        if (slugOwner && slugOwner.id !== id) throw new CatalogServiceError("DUPLICATE_SLUG", "Catalog slug already exists.");
      }
      if (next.parentId) {
        const parent = await repo.getCategoryById(next.parentId);
        if (!parent) throw new CatalogServiceError("CATEGORY_NOT_FOUND", "Parent category was not found.");
        if (next.status === "ACTIVE" && parent.status !== "ACTIVE") {
          throw new CatalogServiceError("INVALID_CATEGORY", "An active category cannot use an archived parent.");
        }
        const hierarchy = await repo.getCategoryHierarchy();
        const parentById = new Map(hierarchy.map((category) => [category.id, category.parentId]));
        parentById.set(id, next.parentId);
        if (hasCycle(id, parentById)) throw new CatalogServiceError("INVALID_CATEGORY", "Category hierarchy cannot contain a cycle.");
      }
      try {
        return await repo.withTransaction(async (tx) => {
          const updated = await repo.updateCategory(id, {
            name: normalizeTitle(next.name),
            slug: normalizeSlug(next.slug || next.name),
            seoTitle: normalizeSeoText(next.seoTitle),
            seoDescription: normalizeSeoText(next.seoDescription),
            status: next.status,
            parent: next.parentId ? { connect: { id: next.parentId } } : { disconnect: true },
          }, tx);
          await audit({
            entityType: "CATEGORY",
            entityId: id,
            operation: "UPDATE",
            changedFields: changedFields(existing as unknown as Record<string, unknown>, updated as unknown as Record<string, unknown>),
            beforeState: existing,
            afterState: updated,
          }, tx);
          return updated;
        });
      } catch (error) { mapDatabaseError(error); }
    },

    async archiveCategory(id: string) {
      const existing = await repo.getCategoryById(id);
      if (!existing) throw new CatalogServiceError("CATEGORY_NOT_FOUND", "Category was not found.");
      const hierarchy = await repo.getCategoryHierarchy();
      if (hierarchy.some((category) => category.parentId === id && category.status === "ACTIVE")) {
        throw new CatalogServiceError("INVALID_CATEGORY", "Cannot archive a category while it has active child categories.");
      }
      try {
        return await repo.withTransaction(async (tx) => {
          const updated = await repo.archiveCategory(id, tx);
          await audit({ entityType: "CATEGORY", entityId: id, operation: "ARCHIVE", beforeState: existing, afterState: updated }, tx);
          return updated;
        });
      } catch (error) { mapDatabaseError(error); }
    },

    async getCategory(id: string) {
      const category = await repo.getCategoryById(id);
      if (!category) throw new CatalogServiceError("CATEGORY_NOT_FOUND", "Category was not found.");
      return category;
    },

    async getCategoryHierarchy() { return repo.getCategoryHierarchy(); },

    async createCollection(input: CollectionInput) {
      const normalizedInput = { ...input, name: normalizeTitle(input.name), slug: normalizeSlug(input.slug || input.name), seoTitle: normalizeSeoText(input.seoTitle), seoDescription: normalizeSeoText(input.seoDescription) };
      const issues = validateCollection(normalizedInput);
      if (issues.length) validationError(issues, "INVALID_COLLECTION");
      const existingSlug = await repo.getCollectionBySlug(normalizedInput.slug);
      if (existingSlug) throw new CatalogServiceError("DUPLICATE_SLUG", "Catalog slug already exists.");
      try {
        return await repo.withTransaction(async (tx) => {
          const created = await repo.createCollection({ name: normalizedInput.name, slug: normalizedInput.slug, seoTitle: normalizedInput.seoTitle, seoDescription: normalizedInput.seoDescription, status: normalizedInput.status }, tx);
          await audit({ entityType: "COLLECTION", entityId: created.id, operation: "CREATE", afterState: created }, tx);
          return created;
        });
      }
      catch (error) { mapDatabaseError(error); }
    },

    async updateCollection(id: string, patch: Partial<Omit<CollectionInput, "name" | "slug">> & { name?: string; slug?: string }) {
      const existing = await repo.getCollectionById(id);
      if (!existing) throw new CatalogServiceError("COLLECTION_NOT_FOUND", "Collection was not found.");
      const next = { name: normalizeTitle(patch.name ?? existing.name), slug: normalizeSlug(patch.slug ?? existing.slug), status: patch.status ?? existing.status, seoTitle: normalizeSeoText(patch.seoTitle === undefined ? existing.seoTitle : patch.seoTitle), seoDescription: normalizeSeoText(patch.seoDescription === undefined ? existing.seoDescription : patch.seoDescription) };
      const issues = validateCollection(next);
      if (next.slug !== existing.slug) {
        const slugOwner = await repo.getCollectionBySlug(next.slug);
        if (slugOwner && slugOwner.id !== id) throw new CatalogServiceError("DUPLICATE_SLUG", "Catalog slug already exists.");
      }
      if (existing.status === "ACTIVE" && next.slug !== existing.slug) {
        issues.push({ field: "slug", code: "SLUG_CHANGE_REQUIRES_REDIRECT", message: "Published Collection slugs cannot change without a redirect strategy." });
      }
      if (issues.length) validationError(issues, "INVALID_COLLECTION");
      try {
        return await repo.withTransaction(async (tx) => {
          const updated = await repo.updateCollection(id, { name: next.name, slug: next.slug, seoTitle: next.seoTitle, seoDescription: next.seoDescription, status: next.status }, tx);
          await audit({ entityType: "COLLECTION", entityId: id, operation: "UPDATE", changedFields: changedFields(existing as unknown as Record<string, unknown>, updated as unknown as Record<string, unknown>), beforeState: existing, afterState: updated }, tx);
          return updated;
        });
      }
      catch (error) { mapDatabaseError(error); }
    },

    async archiveCollection(id: string) {
      const existing = await repo.getCollectionById(id);
      if (!existing) throw new CatalogServiceError("COLLECTION_NOT_FOUND", "Collection was not found.");
      try {
        return await repo.withTransaction(async (tx) => {
          const updated = await repo.archiveCollection(id, tx);
          await audit({ entityType: "COLLECTION", entityId: id, operation: "ARCHIVE", beforeState: existing, afterState: updated }, tx);
          return updated;
        });
      } catch (error) { mapDatabaseError(error); }
    },

    async getCollection(id: string) {
      const collection = await repo.getCollectionById(id);
      if (!collection) throw new CatalogServiceError("COLLECTION_NOT_FOUND", "Collection was not found.");
      return collection;
    },

    async attachCollection(
      productId: string,
      collectionId: string,
      options: { position?: number; priority?: number; isFeatured?: boolean } = {},
    ) {
      const issues = validateMerchandisingMembership({ productId, collectionId, ...options });
      if (issues.length) validationError(issues, "INVALID_COLLECTION");
      await this.getProductById(productId);
      const collection = await repo.getCollectionById(collectionId);
      if (!collection) throw new CatalogServiceError("COLLECTION_NOT_FOUND", "Collection was not found.");
      const existing = await repo.getProductCollection(productId, collectionId);
      if (existing) throw new CatalogServiceError("INVALID_COLLECTION", "Product is already a member of this collection.");
      try {
        return await repo.withTransaction(async (tx) => {
          const result = await repo.attachCollection(productId, collectionId, options, tx);
          await audit({ entityType: "PRODUCT_COLLECTION", entityId: productId, operation: "RELATIONSHIP_ADD", afterState: result, metadata: { collectionId } }, tx);
          return result;
        });
      } catch (error) { mapDatabaseError(error); }
    },

    async updateCollectionMembership(
      productId: string,
      collectionId: string,
      patch: { position?: number; priority?: number; isFeatured?: boolean },
    ) {
      const existing = await repo.getProductCollection(productId, collectionId);
      if (!existing) throw new CatalogServiceError("INVALID_COLLECTION", "Product is not a member of this collection.");
      const issues = validateMerchandisingMembership({ productId, collectionId, ...patch });
      if (issues.length) validationError(issues, "INVALID_COLLECTION");
      try {
        return await repo.withTransaction(async (tx) => {
          const result = await repo.updateProductCollection(productId, collectionId, patch, tx);
          await audit({ entityType: "PRODUCT_COLLECTION", entityId: productId, operation: "UPDATE", changedFields: changedFields(existing as unknown as Record<string, unknown>, result as unknown as Record<string, unknown>), beforeState: existing, afterState: result, metadata: { collectionId } }, tx);
          return result;
        });
      } catch (error) { mapDatabaseError(error); }
    },

    async reorderCollectionProducts(
      collectionId: string,
      updates: Array<{ productId: string; position: number; priority?: number; isFeatured?: boolean }>,
    ) {
      const issues = validateMerchandisingReorder(updates);
      if (issues.length) validationError(issues, "INVALID_COLLECTION");
      const collection = await repo.getCollectionById(collectionId);
      if (!collection) throw new CatalogServiceError("COLLECTION_NOT_FOUND", "Collection was not found.");
      const memberships = await Promise.all(updates.map((update) => repo.getProductCollection(update.productId, collectionId)));
      memberships.forEach((membership, index) => {
        if (!membership) issues.push({
          field: "updates[" + index + "].productId",
          code: "PRODUCT_NOT_IN_COLLECTION",
          message: "Product is not a member of this collection.",
        });
      });
      if (issues.length) validationError(issues, "INVALID_COLLECTION");
      try {
        return await repo.withTransaction(async (tx) => {
          const result = await repo.reorderProductCollection(collectionId, updates, tx);
          for (const update of updates) {
            await audit({ entityType: "PRODUCT_COLLECTION", entityId: update.productId, operation: "REORDER", changedFields: ["position", "priority", "isFeatured"], afterState: update, metadata: { collectionId } }, tx);
          }
          return result;
        });
      } catch (error) { mapDatabaseError(error); }
    },

    async listCollectionProducts(collectionId: string) {
      const collection = await repo.getCollectionById(collectionId);
      if (!collection) throw new CatalogServiceError("COLLECTION_NOT_FOUND", "Collection was not found.");
      const rows = await repo.listCollectionProducts(collectionId);
      return rows.map((row) => ({
        productId: row.productId,
        position: row.position,
        priority: row.priority,
        isFeatured: row.isFeatured,
        product: {
          id: row.product.id,
          title: row.product.title,
          slug: row.product.slug,
          status: row.product.status,
          createdAt: row.product.createdAt,
          updatedAt: row.product.updatedAt,
        },
      })) as CatalogMerchandisingProduct[];
    },

    async detachCollection(productId: string, collectionId: string) {
      try {
        return await repo.withTransaction(async (tx) => {
          const result = await repo.detachCollection(productId, collectionId, tx);
          await audit({ entityType: "PRODUCT_COLLECTION", entityId: productId, operation: "RELATIONSHIP_REMOVE", metadata: { collectionId } }, tx);
          return result;
        });
      } catch (error) { mapDatabaseError(error); }
    },

    async createTag(input: TagInput) {
      const normalized = { name: normalizeTagName(input.name), slug: normalizeTagSlug(input.slug) };
      const issues = validateTag(normalized);
      if (issues.length) validationError(issues, "INVALID_TAG");
      const duplicate = await repo.getTagByName(normalized.name);
      if (duplicate) throw new CatalogServiceError("INVALID_TAG", "A logical tag with the same normalized name already exists.");
      try {
        return await repo.withTransaction(async (tx) => {
          const created = await repo.createTag({ name: normalized.name, slug: normalized.slug }, tx);
          await audit({ entityType: "TAG", entityId: created.id, operation: "CREATE", afterState: created }, tx);
          return created;
        });
      }
      catch (error) { mapDatabaseError(error); }
    },

    async updateTag(id: string, patch: Partial<TagInput>) {
      const existing = await repo.getTagById(id);
      if (!existing) throw new CatalogServiceError("TAG_NOT_FOUND", "Tag was not found.");
      const next = { name: normalizeTagName(patch.name ?? existing.name), slug: normalizeTagSlug(patch.slug ?? existing.slug) };
      const issues = validateTag(next);
      if (issues.length) validationError(issues, "INVALID_TAG");
      const duplicate = await repo.getTagByName(next.name);
      if (duplicate && duplicate.id !== id) throw new CatalogServiceError("INVALID_TAG", "A logical tag with the same normalized name already exists.");
      try {
        return await repo.withTransaction(async (tx) => {
          const updated = await repo.updateTag(id, next, tx);
          await audit({ entityType: "TAG", entityId: id, operation: "UPDATE", changedFields: changedFields(existing as unknown as Record<string, unknown>, updated as unknown as Record<string, unknown>), beforeState: existing, afterState: updated }, tx);
          return updated;
        });
      } catch (error) { mapDatabaseError(error); }
    },

    async deleteTag(id: string) {
      const existing = await repo.getTagById(id);
      if (!existing) throw new CatalogServiceError("TAG_NOT_FOUND", "Tag was not found.");
      try {
        return await repo.withTransaction(async (tx) => {
          const deleted = await repo.deleteTag(id, tx);
          await audit({ entityType: "TAG", entityId: id, operation: "DELETE", beforeState: existing }, tx);
          return deleted;
        });
      } catch (error) { mapDatabaseError(error); }
    },

    async getTag(id: string) {
      const tag = await repo.getTagById(id);
      if (!tag) throw new CatalogServiceError("TAG_NOT_FOUND", "Tag was not found.");
      return tag;
    },

    async attachTag(productId: string, tagId: string) {
      await this.getProductById(productId);
      const tag = await repo.getTagById(tagId);
      if (!tag) throw new CatalogServiceError("TAG_NOT_FOUND", "Tag was not found.");
      try {
        return await repo.withTransaction(async (tx) => {
          const result = await repo.attachTag(productId, tagId, tx);
          await audit({ entityType: "PRODUCT_TAG", entityId: productId, operation: "RELATIONSHIP_ADD", metadata: { tagId } }, tx);
          return result;
        });
      } catch (error) { mapDatabaseError(error); }
    },

    async detachTag(productId: string, tagId: string) {
      try {
        return await repo.withTransaction(async (tx) => {
          const result = await repo.detachTag(productId, tagId, tx);
          await audit({ entityType: "PRODUCT_TAG", entityId: productId, operation: "RELATIONSHIP_REMOVE", metadata: { tagId } }, tx);
          return result;
        });
      } catch (error) { mapDatabaseError(error); }
    },

    async attachCategory(
      productId: string,
      categoryId: string,
      options: { position?: number; priority?: number; isFeatured?: boolean } = {},
    ) {
      const issues = validateMerchandisingMembership({ productId, categoryId, ...options });
      if (issues.length) validationError(issues, "INVALID_CATEGORY");
      await this.getProductById(productId);
      const category = await repo.getCategoryById(categoryId);
      if (!category) throw new CatalogServiceError("CATEGORY_NOT_FOUND", "Category was not found.");
      const existing = await repo.getProductCategory(productId, categoryId);
      if (existing) throw new CatalogServiceError("INVALID_CATEGORY", "Product is already assigned to this category.");
      try {
        return await repo.withTransaction(async (tx) => {
          const result = await repo.attachCategory(productId, categoryId, options, tx);
          await audit({ entityType: "PRODUCT_CATEGORY", entityId: productId, operation: "RELATIONSHIP_ADD", afterState: result, metadata: { categoryId } }, tx);
          return result;
        });
      } catch (error) { mapDatabaseError(error); }
    },

    async updateCategoryMembership(
      productId: string,
      categoryId: string,
      patch: { position?: number; priority?: number; isFeatured?: boolean },
    ) {
      const existing = await repo.getProductCategory(productId, categoryId);
      if (!existing) throw new CatalogServiceError("INVALID_CATEGORY", "Product is not assigned to this category.");
      const issues = validateMerchandisingMembership({ productId, categoryId, ...patch });
      if (issues.length) validationError(issues, "INVALID_CATEGORY");
      try {
        return await repo.withTransaction(async (tx) => {
          const result = await repo.updateProductCategory(productId, categoryId, patch, tx);
          await audit({ entityType: "PRODUCT_CATEGORY", entityId: productId, operation: "UPDATE", changedFields: changedFields(existing as unknown as Record<string, unknown>, result as unknown as Record<string, unknown>), beforeState: existing, afterState: result, metadata: { categoryId } }, tx);
          return result;
        });
      } catch (error) { mapDatabaseError(error); }
    },

    async reorderCategoryProducts(
      categoryId: string,
      updates: Array<{ productId: string; position: number; priority?: number; isFeatured?: boolean }>,
    ) {
      const issues = validateMerchandisingReorder(updates);
      if (issues.length) validationError(issues, "INVALID_CATEGORY");
      const category = await repo.getCategoryById(categoryId);
      if (!category) throw new CatalogServiceError("CATEGORY_NOT_FOUND", "Category was not found.");
      const memberships = await Promise.all(updates.map((update) => repo.getProductCategory(update.productId, categoryId)));
      memberships.forEach((membership, index) => {
        if (!membership) issues.push({
          field: "updates[" + index + "].productId",
          code: "PRODUCT_NOT_IN_CATEGORY",
          message: "Product is not assigned to this category.",
        });
      });
      if (issues.length) validationError(issues, "INVALID_CATEGORY");
      try {
        return await repo.withTransaction(async (tx) => {
          const result = await repo.reorderProductCategory(categoryId, updates, tx);
          for (const update of updates) {
            await audit({ entityType: "PRODUCT_CATEGORY", entityId: update.productId, operation: "REORDER", changedFields: ["position", "priority", "isFeatured"], afterState: update, metadata: { categoryId } }, tx);
          }
          return result;
        });
      } catch (error) { mapDatabaseError(error); }
    },

    async detachCategory(productId: string, categoryId: string) {
      try {
        return await repo.withTransaction(async (tx) => {
          const result = await repo.detachCategory(productId, categoryId, tx);
          await audit({ entityType: "PRODUCT_CATEGORY", entityId: productId, operation: "RELATIONSHIP_REMOVE", metadata: { categoryId } }, tx);
          return result;
        });
      } catch (error) { mapDatabaseError(error); }
    },

    async listProducts(options: repository.CatalogListOptions = {}) {
      validateListOptions(options);
      return repo.listProducts(options);
    },

    async listPublishedProducts(options: Omit<repository.CatalogListOptions, "filters"> = {}) {
      validateListOptions(options);
      return repo.listPublishedProducts(options);
    },

    async isPublishable(id: string) {
      const readiness = await lifecycle.validatePublicationReadiness(id);
      if (readiness.length || Object.keys(customRepository).length > 0) return readiness;
      const variants = await repo.getVariantsByProduct(id);
      const mappings = createFulfillmentProviderMappingRepository();
      const missing = [];
      for (const variant of variants.filter((item) => item.status === "ACTIVE")) {
        const mapping = await mappings.getByVariantAndProvider(variant.id, "qikink");
        if (!mapping?.active || !mapping.providerSku.trim()) {
          missing.push({ field: "variants", code: "QIKINK_MAPPING_REQUIRED", message: "Every active ProductVariant requires an active Qikink provider mapping before publication." });
        }
      }
      return missing;
    },
  };

  return service;
}

function hasCycle(categoryId: string, parentById: ReadonlyMap<string, string | null>): boolean {
  const visited = new Set<string>();
  let current: string | null | undefined = categoryId;
  while (current) {
    if (visited.has(current)) return true;
    visited.add(current);
    current = parentById.get(current) ?? null;
  }
  return false;
}

function validateListOptions(options: repository.CatalogListOptions): void {
  const issues = [];
  const filters = options.filters;
  if (filters?.minPrice !== undefined) issues.push(...validateMoney(filters.minPrice, "filters.minPrice"));
  if (filters?.maxPrice !== undefined) issues.push(...validateMoney(filters.maxPrice, "filters.maxPrice"));
  if (filters?.minPrice !== undefined && filters?.maxPrice !== undefined) {
    try {
      if (new Prisma.Decimal(filters.minPrice).gt(new Prisma.Decimal(filters.maxPrice))) {
        issues.push({ field: "filters", code: "INVALID_PRICE_RANGE", message: "Minimum price must be less than or equal to maximum price." });
      }
    } catch {
      // validateMoney above reports malformed decimal input.
    }
  }
  if (issues.length) validationError(issues, "INVALID_PRODUCT");
}

function validatePrimaryProductImages(images: ImageInput[]) {
  const productPrimaries = images.filter((image) => image.productId && image.isPrimary);
  return productPrimaries.length > 1
    ? [{ field: "images", code: "MULTIPLE_PRIMARY_IMAGES", message: "A Product may have at most one primary product-level image." }]
    : [];
}
