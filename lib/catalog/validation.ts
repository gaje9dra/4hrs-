import type { ProductMediaType, ProductStatus } from "@prisma/client";
import {
  CATALOG_MEDIA_ALT_TEXT_MAX_LENGTH,
  CATALOG_MEDIA_STORAGE_REFERENCE_MAX_LENGTH,
} from "@/lib/catalog/media";

export type ValidationIssue = { field: string; code: string; message: string };

export class CatalogValidationError extends Error {
  readonly issues: ValidationIssue[];
  constructor(issues: ValidationIssue[]) {
    super("Catalog validation failed.");
    this.name = "CatalogValidationError";
    this.issues = issues;
  }
}

export type ProductInput = { id?: string; title: string; slug: string; description?: string | null; shortDescription?: string | null; status: ProductStatus; price: number | string; compareAtPrice?: number | string | null; currency: string; seoTitle?: string | null; seoDescription?: string | null };
export type SeoMetadataInput = { seoTitle?: string | null; seoDescription?: string | null };
export const SEO_TITLE_MAX_LENGTH = 200;
export const SEO_DESCRIPTION_MAX_LENGTH = 500;
export type VariantOptionInput = { optionTypeId: string; optionValueId: string };
export type VariantInput = { productId: string; id?: string; sku: string; displayName?: string | null; size?: string | null; color?: string | null; optionValueIds?: string[]; price?: number | string | null; compareAtPrice?: number | string | null; status: "ACTIVE" | "INACTIVE" };
export type VariantOptionTypeInput = { id?: string; name: string; sortOrder?: number };
export type VariantOptionValueInput = { id?: string; optionTypeId: string; displayName: string; normalizedValue?: string; sortOrder?: number; hex?: string | null; swatch?: string | null };
export type ImageInput = { productId?: string | null; variantId?: string | null; url: string; storageReference?: string | null; mediaType?: ProductMediaType; altText?: string | null; sortOrder: number; isPrimary: boolean };
export type CategoryInput = { id?: string; name: string; slug: string; status: "ACTIVE" | "ARCHIVED"; parentId?: string | null; seoTitle?: string | null; seoDescription?: string | null };
export type CollectionInput = { name: string; slug: string; status: "ACTIVE" | "ARCHIVED"; seoTitle?: string | null; seoDescription?: string | null };
export type TagInput = { name: string; slug: string };
export type PublishReadinessInput = { product: ProductInput; variants: VariantInput[]; images: ImageInput[]; requireVariant?: boolean; requireProductImage?: boolean };

export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const CURRENCY_PATTERN = /^[A-Z]{3}$/;

export function slugify(value: string): string {
  const normalized = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-+/g, "-");
  if (normalized) return normalized;
  let hash = 2166136261;
  for (const character of value.normalize("NFKC")) {
    hash ^= character.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 16777619);
  }
  return "item-" + (hash >>> 0).toString(36);
}

export function normalizeSlug(slug: string): string {
  return slugify(slug.trim());
}

export function normalizeSeoText(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const normalized = normalizedText(value);
  return normalized || null;
}

export function validateSeoMetadata(input: SeoMetadataInput): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const seoTitle = normalizeSeoText(input.seoTitle);
  const seoDescription = normalizeSeoText(input.seoDescription);
  if (seoTitle && seoTitle.length > SEO_TITLE_MAX_LENGTH) {
    issues.push(issue("seoTitle", "SEO_TITLE_TOO_LONG", "SEO title exceeds the maximum supported length."));
  }
  if (seoDescription && seoDescription.length > SEO_DESCRIPTION_MAX_LENGTH) {
    issues.push(issue("seoDescription", "SEO_DESCRIPTION_TOO_LONG", "SEO description exceeds the maximum supported length."));
  }
  return issues;
}

function issue(field: string, code: string, message: string): ValidationIssue { return { field, code, message }; }
function normalizedText(value: string): string { return value.trim().replace(/\s+/g, " "); }
function requireText(value: string, field: string, label: string, issues: ValidationIssue[]): string { const normalized = normalizedText(value); if (!normalized) issues.push(issue(field, "REQUIRED", label + " is required.")); return normalized; }
function dedupeIssues(issues: ValidationIssue[]): ValidationIssue[] { const seen = new Set<string>(); return issues.filter((item) => { const key = item.field + "\u0000" + item.code + "\u0000" + item.message; if (seen.has(key)) return false; seen.add(key); return true; }); }

export function normalizeTitle(title: string): string { return normalizedText(title); }
export function normalizeSku(sku: string): string { return normalizedText(sku); }
export function normalizeOptionTypeName(name: string): string { return normalizedText(name); }
export function normalizeOptionIdentity(value: string): string { return slugify(value); }
export function normalizeOptionDisplayValue(value: string): string { return normalizedText(value); }
export function normalizeAltText(value: string | null | undefined): string | null { if (value === null || value === undefined) return null; const normalized = normalizedText(value); return normalized || null; }
export function validateOptionType(input: VariantOptionTypeInput): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  requireText(input.name, "name", "Option type name", issues);
  const sortOrder = input.sortOrder ?? 0;
  if (!Number.isInteger(sortOrder) || sortOrder < 0) issues.push(issue("sortOrder", "INVALID_SORT_ORDER", "Option type sort order must be a non-negative integer."));
  return dedupeIssues(issues);
}
export function validateOptionValue(input: VariantOptionValueInput): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (!input.optionTypeId.trim()) issues.push(issue("optionTypeId", "INVALID_OPTION_TYPE", "Option value must reference a valid option type."));
  requireText(input.displayName, "displayName", "Option value display name", issues);
  if (!input.normalizedValue.trim()) issues.push(issue("normalizedValue", "INVALID_NORMALIZED_VALUE", "Option value normalized identity is required."));
  if (!SLUG_PATTERN.test(input.normalizedValue)) issues.push(issue("normalizedValue", "INVALID_NORMALIZED_VALUE", "Option value normalized identity must be lowercase and URL-safe."));
  const sortOrder = input.sortOrder ?? 0;
  if (!Number.isInteger(sortOrder) || sortOrder < 0) issues.push(issue("sortOrder", "INVALID_SORT_ORDER", "Option value sort order must be a non-negative integer."));
  return dedupeIssues(issues);
}
export function validateProductOptionAssignments(assignments: VariantOptionInput[]): ValidationIssue[] {
  const seenTypes = new Set<string>();
  return assignments.flatMap((assignment, index) => {
    const issues: ValidationIssue[] = [];
    if (!assignment.optionTypeId.trim()) issues.push(issue("options[" + index + "].optionTypeId", "INVALID_OPTION_TYPE", "Option type is required."));
    if (!assignment.optionValueId.trim()) issues.push(issue("options[" + index + "].optionValueId", "INVALID_OPTION_VALUE", "Option value is required."));
    if (seenTypes.has(assignment.optionTypeId)) issues.push(issue("options[" + index + "]", "DUPLICATE_OPTION_TYPE", "A variant cannot contain two values from the same option type."));
    seenTypes.add(assignment.optionTypeId);
    return issues;
  });
}
export function findDuplicateOptionCombinations(variants: Array<VariantInput & { optionValueIds?: string[] }>): number[][] {
  const groups = new Map<string, number[]>();
  variants.forEach((variant, index) => {
    const values = [...new Set((variant.optionValueIds ?? []).map((value) => value.trim()).filter(Boolean))].sort();
    const key = values.length ? values.join("\u0000") : variantOptionKey(variant);
    const indexes = groups.get(key) ?? [];
    indexes.push(index);
    groups.set(key, indexes);
  });
  return [...groups.values()].filter((indexes) => indexes.length > 1);
}

export function normalizeTagName(name: string): string { return normalizedText(name); }
export function normalizeTagSlug(slug: string): string { return slug.trim().toLowerCase(); }

export function validateSlug(slug: string, field = "slug"): ValidationIssue[] { return SLUG_PATTERN.test(slug) ? [] : [issue(field, "INVALID_SLUG", "Slug must be lowercase, URL-safe, and use single hyphen separators.")]; }
export function validateCurrency(currency: string): ValidationIssue[] { return CURRENCY_PATTERN.test(currency) ? [] : [issue("currency", "INVALID_CURRENCY", "Currency must be a three-letter uppercase code.")]; }

export function validateMoney(value: number | string, field: string): ValidationIssue[] {
  const amount = typeof value === "string" ? Number(value) : value;
  if (!Number.isFinite(amount) || amount < 0) return [issue(field, "INVALID_PRICE", "Price must be zero or greater.")];
  const text = String(value); const decimalPlaces = text.includes(".") ? text.split(".")[1]?.length ?? 0 : 0;
  return decimalPlaces > 2 ? [issue(field, "INVALID_MONEY_PRECISION", "Money values may have at most two decimal places.")] : [];
}

export function validatePricePair(price: number | string, compareAtPrice: number | string | null | undefined, priceField = "price", compareField = "compareAtPrice"): ValidationIssue[] {
  const issues = [...validateMoney(price, priceField)];
  if (compareAtPrice !== null && compareAtPrice !== undefined) {
    issues.push(...validateMoney(compareAtPrice, compareField));
    const selling = Number(price); const compareAt = Number(compareAtPrice);
    if (Number.isFinite(selling) && Number.isFinite(compareAt) && compareAt < selling) issues.push(issue(compareField, "INVALID_COMPARE_AT_PRICE", "Compare-at price must be greater than or equal to selling price."));
  }
  return issues;
}

export function validateProduct(input: ProductInput): ValidationIssue[] {
  const issues: ValidationIssue[] = []; requireText(input.title, "title", "Title", issues); issues.push(...validateSlug(input.slug)); issues.push(...validateCurrency(input.currency)); issues.push(...validatePricePair(input.price, input.compareAtPrice)); issues.push(...validateSeoMetadata(input));
  if (!["DRAFT", "ACTIVE", "ARCHIVED"].includes(input.status)) issues.push(issue("status", "INVALID_STATUS", "Product status is invalid."));
  return dedupeIssues(issues);
}
export function validateSku(sku: string): ValidationIssue[] { return normalizeSku(sku) ? [] : [issue("sku", "INVALID_SKU", "SKU must not be empty.")]; }

export function validateVariant(input: VariantInput): ValidationIssue[] {
  const issues: ValidationIssue[] = []; if (!input.productId.trim()) issues.push(issue("productId", "INVALID_PRODUCT", "Variant must reference a valid Product."));
  issues.push(...validateSku(input.sku));
  if (input.price !== null && input.price !== undefined) issues.push(...validatePricePair(input.price, input.compareAtPrice));
  else if (input.compareAtPrice !== null && input.compareAtPrice !== undefined) issues.push(...validateMoney(input.compareAtPrice, "compareAtPrice"));
  if (!["ACTIVE", "INACTIVE"].includes(input.status)) issues.push(issue("status", "INVALID_STATUS", "Variant status is invalid."));
  return dedupeIssues(issues);
}

function normalizeOption(value: string | null | undefined): string { return value === null || value === undefined ? "" : normalizedText(value).toLowerCase(); }
function variantOptionKey(variant: VariantInput): string { return normalizeOption(variant.size) + "\u0000" + normalizeOption(variant.color); }
export function findDuplicateVariants(variants: VariantInput[]): number[][] { const groups = new Map<string, number[]>(); variants.forEach((variant, index) => { const indexes = groups.get(variantOptionKey(variant)) ?? []; indexes.push(index); groups.set(variantOptionKey(variant), indexes); }); return [...groups.values()].filter((indexes) => indexes.length > 1); }
export function validateVariantUniqueness(variants: VariantInput[]): ValidationIssue[] {
  const optionDuplicates = findDuplicateOptionCombinations(variants);
  return optionDuplicates.map((indexes) => issue(
    "variants[" + indexes[1] + "]",
    "DUPLICATE_VARIANT",
    "Variant duplicates another variant using the canonical option combination.",
  ));
}
export function validateVariantPricing(productPrice: number | string, variant: VariantInput): ValidationIssue[] {
  const effectivePrice = variant.price === null || variant.price === undefined ? productPrice : variant.price;
  if (variant.compareAtPrice === null || variant.compareAtPrice === undefined) return [];
  return validatePricePair(effectivePrice, variant.compareAtPrice, "price", "compareAtPrice");
}

export function validateImage(input: ImageInput): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const hasProduct = Boolean(input.productId);
  const hasVariant = Boolean(input.variantId);
  if (hasProduct === hasVariant) {
    issues.push(issue("ownership", "INVALID_IMAGE_OWNER", "Image must reference exactly one Product or ProductVariant."));
  }
  if (input.isPrimary && !hasProduct) {
    issues.push(issue("isPrimary", "INVALID_PRIMARY_IMAGE_OWNER", "Only product-level media can be primary."));
  }

  const url = input.url.trim();
  if (!url) {
    issues.push(issue("url", "INVALID_IMAGE_URL", "Image URL is required."));
  } else {
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
        issues.push(issue("url", "INVALID_IMAGE_URL", "Image URL must use HTTP or HTTPS."));
      }
    } catch {
      issues.push(issue("url", "INVALID_IMAGE_URL", "Image URL must be a valid absolute URL."));
    }
  }

  if (input.storageReference !== null && input.storageReference !== undefined) {
    const reference = input.storageReference.trim();
    if (!reference || /[\u0000-\u001F\u007F\s]/.test(reference)) {
      issues.push(issue("storageReference", "INVALID_ASSET_REFERENCE", "Storage reference must be a non-empty safe value without whitespace or control characters."));
    } else if (reference.length > CATALOG_MEDIA_STORAGE_REFERENCE_MAX_LENGTH) {
      issues.push(issue("storageReference", "ASSET_REFERENCE_TOO_LONG", "Storage reference exceeds the maximum supported length."));
    }
  }

  const mediaType = input.mediaType ?? "IMAGE";
  if (mediaType !== "IMAGE") {
    issues.push(issue("mediaType", "UNSUPPORTED_MEDIA_TYPE", "Only image media is supported by the current catalog."));
  }

  if (input.altText !== null && input.altText !== undefined) {
    const altText = normalizeAltText(input.altText);
    if (altText && /[<>]/.test(altText)) {
      issues.push(issue("altText", "INVALID_ALT_TEXT", "Alt text must not contain markup."));
    }
    if (altText && altText.length > CATALOG_MEDIA_ALT_TEXT_MAX_LENGTH) {
      issues.push(issue("altText", "ALT_TEXT_TOO_LONG", "Alt text exceeds the maximum supported length."));
    }
  }

  if (!Number.isInteger(input.sortOrder) || input.sortOrder < 0) {
    issues.push(issue("sortOrder", "INVALID_SORT_ORDER", "Image sort order must be a non-negative integer."));
  }
  return dedupeIssues(issues);
}
export function validateImageRelationships(productId: string, images: ImageInput[], variants: Array<VariantInput & { id?: string }>): ValidationIssue[] {
  const variantIds = new Set(variants.filter((variant) => variant.productId === productId && variant.id).map((variant) => variant.id));
  return images.flatMap((image, index) => image.variantId && !variantIds.has(image.variantId) ? [issue("images[" + index + "].variantId", "INVALID_IMAGE_VARIANT", "Variant-specific image must belong to the same Product.")] : []);
}
export function validatePrimaryImages(images: ImageInput[]): ValidationIssue[] {
  const productPrimaryCount = images.filter((image) => image.productId && image.isPrimary).length;
  return productPrimaryCount > 1 ? [issue("images", "MULTIPLE_PRIMARY_IMAGES", "A Product may have at most one primary product-level image.")] : [];
}

export function validateImageAssetUniqueness(images: ImageInput[]): ValidationIssue[] {
  const seenUrls = new Map<string, number>();
  const seenReferences = new Map<string, number>();
  const issues: ValidationIssue[] = [];

  images.forEach((image, index) => {
    const owner = image.productId
      ? "product:" + image.productId
      : "variant:" + (image.variantId ?? "");
    const urlKey = owner + "\u0000" + image.url.trim();
    const previousUrl = seenUrls.get(urlKey);
    if (previousUrl !== undefined) {
      issues.push(issue("images[" + index + "]", "DUPLICATE_MEDIA", "Media duplicates images[" + previousUrl + "] for the same owner."));
    } else {
      seenUrls.set(urlKey, index);
    }

    const reference = image.storageReference?.trim();
    if (reference) {
      const referenceKey = owner + "\u0000" + reference;
      const previousReference = seenReferences.get(referenceKey);
      if (previousReference !== undefined) {
        issues.push(issue("images[" + index + "]", "DUPLICATE_MEDIA", "Media storage reference duplicates images[" + previousReference + "] for the same owner."));
      } else {
        seenReferences.set(referenceKey, index);
      }
    }
  });

  return dedupeIssues(issues);
}

export function validateCategory(input: CategoryInput & SeoMetadataInput): ValidationIssue[] { const issues: ValidationIssue[] = []; requireText(input.name, "name", "Category name", issues); issues.push(...validateSlug(input.slug)); issues.push(...validateSeoMetadata(input)); return issues; }
export function validateCategoryHierarchy(categoryId: string, parentId: string | null | undefined): ValidationIssue[] { return parentId === categoryId ? [issue("parentId", "SELF_PARENT", "Category cannot be its own parent.")] : []; }
export function hasCategoryCycle(categoryId: string, parentById: ReadonlyMap<string, string | null>): boolean { const visited = new Set<string>(); let current: string | null | undefined = categoryId; while (current) { if (visited.has(current)) return true; visited.add(current); current = parentById.get(current) ?? null; } return false; }
export function validateCollection(input: CollectionInput & SeoMetadataInput): ValidationIssue[] { const issues: ValidationIssue[] = []; requireText(input.name, "name", "Collection name", issues); issues.push(...validateSlug(input.slug)); issues.push(...validateSeoMetadata(input)); return issues; }
export function validateTag(input: TagInput): ValidationIssue[] { const issues: ValidationIssue[] = []; requireText(input.name, "name", "Tag name", issues); issues.push(...validateSlug(normalizeTagSlug(input.slug))); return issues; }
export function validateUniqueNormalizedTags(tags: TagInput[]): ValidationIssue[] { const seen = new Map<string, number>(); const issues: ValidationIssue[] = []; tags.forEach((tag, index) => { const key = normalizeTagName(tag.name).toLowerCase(); const previous = seen.get(key); if (previous !== undefined) issues.push(issue("tags[" + index + "]", "DUPLICATE_LOGICAL_TAG", "Tag duplicates tags[" + previous + "] after case/whitespace normalization.")); else seen.set(key, index); }); return issues; }
export function validateJunctionUniqueness(pairs: Array<{ leftId: string; rightId: string }>, field: string): ValidationIssue[] { const seen = new Set<string>(); const issues: ValidationIssue[] = []; pairs.forEach((pair, index) => { const key = pair.leftId + "\u0000" + pair.rightId; if (seen.has(key)) issues.push(issue(field + "[" + index + "]", "DUPLICATE_RELATIONSHIP", "Duplicate catalog relationship.")); seen.add(key); }); return issues; }

export function validatePublishingReadiness(input: PublishReadinessInput): ValidationIssue[] {
  const issues = [...validateProduct(input.product), ...validateVariantUniqueness(input.variants)];
  input.variants.forEach((variant, index) => {
    issues.push(...validateVariant(variant).map((item) => ({ ...item, field: "variants[" + index + "]." + item.field })));
    issues.push(...validateVariantPricing(input.product.price, variant).map((item) => ({ ...item, field: "variants[" + index + "]." + item.field })));
  });
  const activeVariants = input.variants.filter((variant) => variant.status === "ACTIVE");
  if (input.requireVariant !== false && activeVariants.length === 0) issues.push(issue("variants", "VARIANT_REQUIRED", "At least one active ProductVariant is required for a sellable fashion product."));
  const productImages = input.images.filter((image) => input.product.id ? image.productId === input.product.id : Boolean(image.productId));
  if (input.requireProductImage !== false && productImages.length === 0) issues.push(issue("images", "PRODUCT_IMAGE_REQUIRED", "At least one product-level image is required for publishing."));
  input.images.forEach((image, index) => issues.push(...validateImage(image).map((item) => ({ ...item, field: "images[" + index + "]." + item.field }))));
  if (input.product.id) issues.push(...validateImageRelationships(input.product.id, input.images, input.variants));
  issues.push(...validatePrimaryImages(input.images));
  return dedupeIssues(issues);
}

export function canTransitionProductStatus(from: ProductStatus, to: ProductStatus): boolean {
  const allowed: Record<ProductStatus, readonly ProductStatus[]> = { DRAFT: ["DRAFT", "ACTIVE", "ARCHIVED"], ACTIVE: ["ACTIVE", "ARCHIVED"], ARCHIVED: ["ARCHIVED"] };
  return allowed[from].includes(to);
}
export function getEffectivePrice(productPrice: number | string, variantPrice?: number | string | null): number { const effective = variantPrice === null || variantPrice === undefined ? Number(productPrice) : Number(variantPrice); if (!Number.isFinite(effective) || effective < 0) throw new CatalogValidationError([issue("price", "INVALID_PRICE", "Effective price must be zero or greater.")]); return effective; }
