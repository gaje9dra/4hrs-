import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import {
  CatalogServiceError,
  type CatalogErrorCode,
} from "@/lib/catalog/errors";
import * as repository from "@/lib/catalog/repository";
import {
  CatalogValidationError,
  canTransitionProductStatus,
  validateCategory,
  validateCategoryHierarchy,
  validateCollection,
  validateImage,
  validateProduct,
  validatePublishingReadiness,
  validateTag,
  validateVariant,
  validateVariantPricing,
  validateVariantUniqueness,
  normalizeTagName,
  normalizeTagSlug,
  normalizeTitle,
  normalizeSku,
  type CategoryInput,
  type CollectionInput,
  type ImageInput,
  type ProductInput,
  type VariantInput,
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
  archiveProduct: typeof repository.archiveProduct;
  createVariant: typeof repository.createVariant;
  getVariantById: typeof repository.getVariantById;
  getVariantsByProduct: typeof repository.getVariantsByProduct;
  updateVariant: typeof repository.updateVariant;
  deactivateVariant: typeof repository.deactivateVariant;
  createImage: typeof repository.createImage;
  getImageById: typeof repository.getImageById;
  updateImage: typeof repository.updateImage;
  deleteImage: typeof repository.deleteImage;
  reorderImages: typeof repository.reorderImages;
  createCategory: typeof repository.createCategory;
  getCategoryById: typeof repository.getCategoryById;
  getCategoryHierarchy: typeof repository.getCategoryHierarchy;
  updateCategory: typeof repository.updateCategory;
  archiveCategory: typeof repository.archiveCategory;
  createCollection: typeof repository.createCollection;
  getCollectionById: typeof repository.getCollectionById;
  updateCollection: typeof repository.updateCollection;
  archiveCollection: typeof repository.archiveCollection;
  createTag: typeof repository.createTag;
  getTagById: typeof repository.getTagById;
  updateTag: typeof repository.updateTag;
  deleteTag: typeof repository.deleteTag;
  attachCategory: typeof repository.attachCategory;
  detachCategory: typeof repository.detachCategory;
  attachCollection: typeof repository.attachCollection;
  detachCollection: typeof repository.detachCollection;
  attachTag: typeof repository.attachTag;
  detachTag: typeof repository.detachTag;
  replaceProductRelationships: typeof repository.replaceProductRelationships;
  withTransaction: typeof repository.withTransaction;
};

const defaultRepository: CatalogRepository = repository;

export type CreateProductInput = ProductInput & {
  variants?: VariantInput[];
  images?: ImageInput[];
  categoryIds?: string[];
  collectionIds?: string[];
  tagIds?: string[];
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
  };
}

function normalizeVariantInput(input: VariantInput): VariantInput {
  return { ...input, sku: normalizeSku(input.sku) };
}

function uniqueIds(ids: string[] | undefined): string[] | undefined {
  return ids ? [...new Set(ids)] : undefined;
}

export function createCatalogService(customRepository: Partial<CatalogRepository> = {}) {
  const repo: CatalogRepository = { ...defaultRepository, ...customRepository };

  const service = {
    async createProduct(input: CreateProductInput) {
      const product = normalizeProductInput(input);
      const variants = (input.variants ?? []).map(normalizeVariantInput);
      const images = input.images ?? [];
      const categoryIds = uniqueIds(input.categoryIds);
      const collectionIds = uniqueIds(input.collectionIds);
      const tagIds = uniqueIds(input.tagIds);

      const productIssues = validateProduct(product);
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
      ];
      if (productIssues.length || variantIssues.length || imageIssues.length) {
        validationError([...productIssues, ...variantIssues, ...imageIssues], "INVALID_PRODUCT");
      }

      const productId = product.id ?? randomUUID();
      const variantIds = new Map<string, string>();
      variants.forEach((variant) => variantIds.set(variant.sku, variant.id ?? randomUUID()));
      const normalizedVariants = variants.map((variant) => ({
        ...variant,
        id: variant.id ?? randomUUID(),
      }));
      const normalizedImages = images.map((image) => ({
        ...image,
        productId: image.productId ?? (image.variantId ? null : productId),
        variantId: image.variantId ?? null,
      }));

      const variantRelationshipIssues = validateImageRelationships(
        productId,
        normalizedImages,
        normalizedVariants,
      );
      if (variantRelationshipIssues.length) validationError(variantRelationshipIssues, "INVALID_IMAGE_RELATIONSHIP");

      if (product.status === "ACTIVE") {
        const readiness = validatePublishingReadiness({
          product,
          variants: normalizedVariants,
          images: normalizedImages,
        });
        if (readiness.length) validationError(readiness, "PRODUCT_NOT_PUBLISHABLE");
      }

      try {
        return await repo.withTransaction(async (tx) => {
          const created = await repo.createProduct({
            id: productId,
            title: product.title,
            slug: product.slug,
            description: product.description ?? null,
            shortDescription: product.shortDescription ?? null,
            status: product.status,
            price: decimalValue(product.price)!,
            compareAtPrice: decimalValue(product.compareAtPrice) ?? null,
            currency: product.currency,
            seoTitle: product.seoTitle ?? null,
            seoDescription: product.seoDescription ?? null,
          }, tx);

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
          }

          for (const image of normalizedImages) {
            await repo.createImage({
              product: image.productId ? { connect: { id: image.productId } } : undefined,
              variant: image.variantId ? { connect: { id: image.variantId } } : undefined,
              url: image.url,
              altText: image.altText ?? null,
              sortOrder: image.sortOrder,
              isPrimary: image.isPrimary,
            }, tx);
          }

          for (const categoryId of categoryIds ?? []) await repo.attachCategory(productId, categoryId, tx);
          for (const collectionId of collectionIds ?? []) await repo.attachCollection(productId, collectionId, tx);
          for (const tagId of tagIds ?? []) await repo.attachTag(productId, tagId, tx);

          return created;
        });
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
      if (!canTransitionProductStatus(existing.status, merged.status)) {
        issues.push({ field: "status", code: "INVALID_STATUS_TRANSITION", message: "Product status transition is not allowed." });
      }
      if (issues.length) validationError(issues, "INVALID_PRODUCT");

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
            status: merged.status,
            price: decimalValue(merged.price)!,
            compareAtPrice: decimalValue(merged.compareAtPrice) ?? null,
            currency: merged.currency,
            seoTitle: merged.seoTitle,
            seoDescription: merged.seoDescription,
          }, tx);

          if (input.categoryIds || input.collectionIds || input.tagIds) {
            await repo.replaceProductRelationships(input.id, {
              categoryIds: uniqueIds(input.categoryIds),
              collectionIds: uniqueIds(input.collectionIds),
              tagIds: uniqueIds(input.tagIds),
            }, tx);
          }
          return result;
        });
        return updated;
      } catch (error) {
        mapDatabaseError(error);
      }
    },

    async archiveProduct(id: string) {
      const existing = await this.getProductById(id);
      if (!canTransitionProductStatus(existing.status, "ARCHIVED")) {
        throw new CatalogServiceError("INVALID_STATUS", "Product cannot be archived from its current status.");
      }
      try { return await repo.archiveProduct(id); } catch (error) { mapDatabaseError(error); }
    },

    async publishProduct(id: string) {
      const product = await this.getProductDetails(id);
      if (product.status === "ARCHIVED") {
        throw new CatalogServiceError("PRODUCT_NOT_PUBLISHABLE", "Archived products cannot be published.");
      }
      const variants = product.variants;
      const images = product.images.map((image) => ({
        productId: image.productId,
        variantId: image.variantId,
        url: image.url,
        altText: image.altText,
        sortOrder: image.sortOrder,
        isPrimary: image.isPrimary,
      }));
      const readiness = validatePublishingReadiness({
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
        variants: variants.map((variant) => ({
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
        images,
      });
      if (readiness.length) validationError(readiness, "PRODUCT_NOT_PUBLISHABLE");

      try {
        return await repo.withTransaction(async (tx) => {
          const latest = await repo.getProductById(id, tx);
          if (!latest) throw new CatalogServiceError("PRODUCT_NOT_FOUND", "Product was not found.");
          if (!canTransitionProductStatus(latest.status, "ACTIVE")) {
            throw new CatalogServiceError("PRODUCT_NOT_PUBLISHABLE", "Product cannot transition to ACTIVE.");
          }
          const latestDetails = await repo.getProductDetails(id, tx);
          if (!latestDetails) throw new CatalogServiceError("PRODUCT_NOT_FOUND", "Product was not found.");
          const readiness = validatePublishingReadiness({
            product: {
              id: latestDetails.id,
              title: latestDetails.title,
              slug: latestDetails.slug,
              description: latestDetails.description,
              shortDescription: latestDetails.shortDescription,
              status: latestDetails.status,
              price: latestDetails.price.toString(),
              compareAtPrice: latestDetails.compareAtPrice?.toString() ?? null,
              currency: latestDetails.currency,
              seoTitle: latestDetails.seoTitle,
              seoDescription: latestDetails.seoDescription,
            },
            variants: latestDetails.variants.map((variant) => ({
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
            images: latestDetails.images.map((image) => ({
              productId: image.productId,
              variantId: image.variantId,
              url: image.url,
              altText: image.altText,
              sortOrder: image.sortOrder,
              isPrimary: image.isPrimary,
            })),
          });
          if (readiness.length) validationError(readiness, "PRODUCT_NOT_PUBLISHABLE");
          return repo.updateProduct(id, { status: "ACTIVE" }, tx);
        });
      } catch (error) {
        mapDatabaseError(error);
      }
    },

    async createVariant(input: VariantInput) {
      const variant = normalizeVariantInput(input);
      const issues = validateVariant(variant);
      const product = await repo.getProductById(variant.productId);
      if (!product) throw new CatalogServiceError("PRODUCT_NOT_FOUND", "Product was not found.");
      const existingVariants = await repo.getVariantsByProduct(variant.productId);
      if (existingVariants.some((item) => item.sku === variant.sku)) {
        throw new CatalogServiceError("DUPLICATE_SKU", "Product SKU already exists.");
      }
      if (validateVariantUniqueness([
        ...existingVariants.map((item) => ({
          productId: item.productId,
          id: item.id,
          sku: item.sku,
          displayName: item.displayName,
          size: item.size,
          color: item.color,
          price: item.price?.toString() ?? null,
          compareAtPrice: item.compareAtPrice?.toString() ?? null,
          status: item.status,
        })),
        variant,
      ]).length) {
        issues.push({ field: "variant", code: "DUPLICATE_VARIANT", message: "Variant duplicates an existing size/color combination." });
      }
      issues.push(...validateVariantPricing(product.price.toString(), variant));
      if (issues.length) validationError(issues, "INVALID_VARIANT");
      try {
        return await repo.createVariant({
          id: variant.id ?? randomUUID(),
          product: { connect: { id: variant.productId } },
          sku: variant.sku,
          displayName: variant.displayName ?? null,
          size: variant.size ?? null,
          color: variant.color ?? null,
          price: decimalValue(variant.price) ?? null,
          compareAtPrice: decimalValue(variant.compareAtPrice) ?? null,
          status: variant.status,
        });
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
      };
      const issues = validateVariant(merged);
      const product = await repo.getProductById(existing.productId);
      if (!product) throw new CatalogServiceError("PRODUCT_NOT_FOUND", "Parent Product was not found.");
      issues.push(...validateVariantPricing(product.price.toString(), merged));
      const siblings = await repo.getVariantsByProduct(existing.productId);
      const duplicates = validateVariantUniqueness([
        ...siblings.filter((item) => item.id !== id).map((item) => ({
          productId: item.productId, id: item.id, sku: item.sku, size: item.size, color: item.color,
          displayName: item.displayName, price: item.price?.toString() ?? null, compareAtPrice: item.compareAtPrice?.toString() ?? null, status: item.status,
        })),
        merged,
      ]);
      issues.push(...duplicates);
      if (issues.length) validationError(issues, "INVALID_VARIANT");
      try {
        return await repo.updateVariant(id, {
          sku: merged.sku,
          displayName: merged.displayName,
          size: merged.size,
          color: merged.color,
          price: decimalValue(merged.price) ?? null,
          compareAtPrice: decimalValue(merged.compareAtPrice) ?? null,
          status: merged.status,
        });
      } catch (error) { mapDatabaseError(error); }
    },

    async deactivateVariant(id: string) {
      const existing = await repo.getVariantById(id);
      if (!existing) throw new CatalogServiceError("VARIANT_NOT_FOUND", "Variant was not found.");
      try { return await repo.deactivateVariant(id); } catch (error) { mapDatabaseError(error); }
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
      try {
        return await repo.withTransaction(async (tx) => {
          if (input.isPrimary && input.productId) {
            await repo.updateProductImagesPrimaryState(input.productId, null, tx);
          }
          return repo.createImage({
            product: input.productId ? { connect: { id: input.productId } } : undefined,
            variant: input.variantId ? { connect: { id: input.variantId } } : undefined,
            url: input.url,
            altText: input.altText ?? null,
            sortOrder: input.sortOrder,
            isPrimary: input.isPrimary,
          }, tx);
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
        altText: patch.altText === undefined ? existing.altText : patch.altText,
        sortOrder: patch.sortOrder ?? existing.sortOrder,
        isPrimary: patch.isPrimary ?? existing.isPrimary,
      };
      const issues = validateImage(next);
      if (issues.length) validationError(issues, "INVALID_IMAGE_RELATIONSHIP");
      try {
        return await repo.withTransaction(async (tx) => {
          if (next.isPrimary && next.productId) await repo.updateProductImagesPrimaryState(next.productId, id, tx);
          return repo.updateImage(id, {
            url: next.url,
            altText: next.altText,
            sortOrder: next.sortOrder,
            isPrimary: next.isPrimary,
          }, tx);
        });
      } catch (error) { mapDatabaseError(error); }
    },

    async reorderImages(updates: Array<{ id: string; sortOrder: number }>) {
      const issues = updates.flatMap((item, index) => !Number.isInteger(item.sortOrder) || item.sortOrder < 0
        ? [{ field: "[" + index + "].sortOrder", code: "INVALID_SORT_ORDER", message: "Image sort order must be a non-negative integer." }]
        : []);
      if (issues.length) validationError(issues, "INVALID_IMAGE_RELATIONSHIP");
      try { return await repo.withTransaction((tx) => repo.reorderImages(updates, tx)); }
      catch (error) { mapDatabaseError(error); }
    },

    async removeImage(id: string) {
      const existing = await repo.getImageById(id);
      if (!existing) throw new CatalogServiceError("IMAGE_NOT_FOUND", "Image was not found.");
      try { return await repo.deleteImage(id); } catch (error) { mapDatabaseError(error); }
    },

    async assignPrimaryImage(id: string) {
      const image = await repo.getImageById(id);
      if (!image) throw new CatalogServiceError("IMAGE_NOT_FOUND", "Image was not found.");
      if (!image.productId) throw new CatalogServiceError("INVALID_IMAGE_RELATIONSHIP", "Only product-level images can be assigned as the primary catalog image.");
      try {
        return await repo.withTransaction(async (tx) => {
          await repo.updateProductImagesPrimaryState(image.productId!, id, tx);
          return repo.updateImage(id, { isPrimary: true }, tx);
        });
      } catch (error) { mapDatabaseError(error); }
    },

    async createCategory(input: CategoryInput) {
      const issues = [...validateCategory(input), ...validateCategoryHierarchy(input.id ?? "", input.parentId)];
      if (issues.length) validationError(issues, "INVALID_CATEGORY");
      if (input.parentId) {
        const parent = await repo.getCategoryById(input.parentId);
        if (!parent) throw new CatalogServiceError("CATEGORY_NOT_FOUND", "Parent category was not found.");
      }
      try {
        return await repo.createCategory({
          id: input.id ?? randomUUID(),
          name: normalizeTitle(input.name),
          slug: input.slug,
          status: input.status,
          parent: input.parentId ? { connect: { id: input.parentId } } : undefined,
        });
      } catch (error) { mapDatabaseError(error); }
    },

    async updateCategory(id: string, patch: Partial<Omit<CategoryInput, "id">>) {
      const existing = await repo.getCategoryById(id);
      if (!existing) throw new CatalogServiceError("CATEGORY_NOT_FOUND", "Category was not found.");
      const next = {
        id,
        name: patch.name ?? existing.name,
        slug: patch.slug ?? existing.slug,
        status: patch.status ?? existing.status,
        parentId: patch.parentId === undefined ? existing.parentId : patch.parentId,
      };
      const issues = [...validateCategory(next), ...validateCategoryHierarchy(id, next.parentId)];
      if (issues.length) validationError(issues, "INVALID_CATEGORY");
      if (next.parentId) {
        const parent = await repo.getCategoryById(next.parentId);
        if (!parent) throw new CatalogServiceError("CATEGORY_NOT_FOUND", "Parent category was not found.");
        const hierarchy = await repo.getCategoryHierarchy();
        const parentById = new Map(hierarchy.map((category) => [category.id, category.parentId]));
        parentById.set(id, next.parentId);
        if (hasCycle(id, parentById)) throw new CatalogServiceError("INVALID_CATEGORY", "Category hierarchy cannot contain a cycle.");
      }
      try {
        return await repo.updateCategory(id, { name: normalizeTitle(next.name), slug: next.slug, status: next.status, parent: next.parentId ? { connect: { id: next.parentId } } : { disconnect: true } });
      } catch (error) { mapDatabaseError(error); }
    },

    async archiveCategory(id: string) {
      const existing = await repo.getCategoryById(id);
      if (!existing) throw new CatalogServiceError("CATEGORY_NOT_FOUND", "Category was not found.");
      try { return await repo.archiveCategory(id); } catch (error) { mapDatabaseError(error); }
    },

    async getCategory(id: string) {
      const category = await repo.getCategoryById(id);
      if (!category) throw new CatalogServiceError("CATEGORY_NOT_FOUND", "Category was not found.");
      return category;
    },

    async getCategoryHierarchy() { return repo.getCategoryHierarchy(); },

    async createCollection(input: CollectionInput) {
      const issues = validateCollection(input);
      if (issues.length) validationError(issues, "INVALID_COLLECTION");
      try { return await repo.createCollection({ name: normalizeTitle(input.name), slug: input.slug, status: input.status }); }
      catch (error) { mapDatabaseError(error); }
    },

    async updateCollection(id: string, patch: Partial<Omit<CollectionInput, "name" | "slug">> & { name?: string; slug?: string }) {
      const existing = await repo.getCollectionById(id);
      if (!existing) throw new CatalogServiceError("COLLECTION_NOT_FOUND", "Collection was not found.");
      const next = { name: patch.name ?? existing.name, slug: patch.slug ?? existing.slug, status: patch.status ?? existing.status };
      const issues = validateCollection(next);
      if (issues.length) validationError(issues, "INVALID_COLLECTION");
      try { return await repo.updateCollection(id, { name: normalizeTitle(next.name), slug: next.slug, status: next.status }); }
      catch (error) { mapDatabaseError(error); }
    },

    async archiveCollection(id: string) {
      const existing = await repo.getCollectionById(id);
      if (!existing) throw new CatalogServiceError("COLLECTION_NOT_FOUND", "Collection was not found.");
      try { return await repo.archiveCollection(id); } catch (error) { mapDatabaseError(error); }
    },

    async getCollection(id: string) {
      const collection = await repo.getCollectionById(id);
      if (!collection) throw new CatalogServiceError("COLLECTION_NOT_FOUND", "Collection was not found.");
      return collection;
    },

    async attachCollection(productId: string, collectionId: string) {
      await this.getProductById(productId);
      const collection = await repo.getCollectionById(collectionId);
      if (!collection) throw new CatalogServiceError("COLLECTION_NOT_FOUND", "Collection was not found.");
      try { return await repo.attachCollection(productId, collectionId); } catch (error) { mapDatabaseError(error); }
    },

    async detachCollection(productId: string, collectionId: string) {
      try { return await repo.detachCollection(productId, collectionId); } catch (error) { mapDatabaseError(error); }
    },

    async createTag(input: TagInput) {
      const normalized = { name: normalizeTagName(input.name), slug: normalizeTagSlug(input.slug) };
      const issues = validateTag(normalized);
      if (issues.length) validationError(issues, "INVALID_TAG");
      try { return await repo.createTag({ name: normalized.name, slug: normalized.slug }); }
      catch (error) { mapDatabaseError(error); }
    },

    async updateTag(id: string, patch: Partial<TagInput>) {
      const existing = await repo.getTagById(id);
      if (!existing) throw new CatalogServiceError("TAG_NOT_FOUND", "Tag was not found.");
      const next = { name: normalizeTagName(patch.name ?? existing.name), slug: normalizeTagSlug(patch.slug ?? existing.slug) };
      const issues = validateTag(next);
      if (issues.length) validationError(issues, "INVALID_TAG");
      try { return await repo.updateTag(id, next); } catch (error) { mapDatabaseError(error); }
    },

    async deleteTag(id: string) {
      const existing = await repo.getTagById(id);
      if (!existing) throw new CatalogServiceError("TAG_NOT_FOUND", "Tag was not found.");
      try { return await repo.deleteTag(id); } catch (error) { mapDatabaseError(error); }
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
      try { return await repo.attachTag(productId, tagId); } catch (error) { mapDatabaseError(error); }
    },

    async detachTag(productId: string, tagId: string) {
      try { return await repo.detachTag(productId, tagId); } catch (error) { mapDatabaseError(error); }
    },

    async attachCategory(productId: string, categoryId: string) {
      await this.getProductById(productId);
      const category = await repo.getCategoryById(categoryId);
      if (!category) throw new CatalogServiceError("CATEGORY_NOT_FOUND", "Category was not found.");
      try { return await repo.attachCategory(productId, categoryId); } catch (error) { mapDatabaseError(error); }
    },

    async detachCategory(productId: string, categoryId: string) {
      try { return await repo.detachCategory(productId, categoryId); } catch (error) { mapDatabaseError(error); }
    },

    async listProducts(options: repository.CatalogListOptions = {}) {
      return repo.listProducts(options);
    },

    async listPublishedProducts(options: Omit<repository.CatalogListOptions, "filters"> = {}) {
      return repo.listPublishedProducts(options);
    },

    async isPublishable(id: string) {
      const product = await repo.getProductDetails(id);
      if (!product) throw new CatalogServiceError("PRODUCT_NOT_FOUND", "Product was not found.");
      const issues = validatePublishingReadiness({
        product: {
          id: product.id, title: product.title, slug: product.slug, description: product.description,
          shortDescription: product.shortDescription, status: product.status, price: product.price.toString(),
          compareAtPrice: product.compareAtPrice?.toString() ?? null, currency: product.currency,
          seoTitle: product.seoTitle, seoDescription: product.seoDescription,
        },
        variants: product.variants.map((variant) => ({
          id: variant.id, productId: variant.productId, sku: variant.sku, displayName: variant.displayName,
          size: variant.size, color: variant.color, price: variant.price?.toString() ?? null,
          compareAtPrice: variant.compareAtPrice?.toString() ?? null, status: variant.status,
        })),
        images: product.images.map((image) => ({
          productId: image.productId, variantId: image.variantId, url: image.url,
          altText: image.altText, sortOrder: image.sortOrder, isPrimary: image.isPrimary,
        })),
      });
      return { publishable: issues.length === 0, issues };
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

function validatePrimaryProductImages(images: ImageInput[]) {
  const productPrimaries = images.filter((image) => image.productId && image.isPrimary);
  return productPrimaries.length > 1
    ? [{ field: "images", code: "MULTIPLE_PRIMARY_IMAGES", message: "A Product may have at most one primary product-level image." }]
    : [];
}
