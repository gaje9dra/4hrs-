import type { ProductStatus } from "@prisma/client";

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
export type VariantInput = { productId: string; id?: string; sku: string; displayName?: string | null; size?: string | null; color?: string | null; price?: number | string | null; compareAtPrice?: number | string | null; status: "ACTIVE" | "INACTIVE" };
export type ImageInput = { productId?: string | null; variantId?: string | null; url: string; altText?: string | null; sortOrder: number; isPrimary: boolean };
export type CategoryInput = { id?: string; name: string; slug: string; status: "ACTIVE" | "ARCHIVED"; parentId?: string | null };
export type CollectionInput = { name: string; slug: string; status: "ACTIVE" | "ARCHIVED" };
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
export function normalizeSku(sku: string): string { return sku.trim(); }
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
export function validateVariantUniqueness(variants: VariantInput[]): ValidationIssue[] { return findDuplicateVariants(variants).map((indexes) => issue("variants[" + indexes[1] + "]", "DUPLICATE_VARIANT", "Variant duplicates another variant using normalized size and color options.")); }
export function validateVariantPricing(productPrice: number | string, variant: VariantInput): ValidationIssue[] {
  const effectivePrice = variant.price === null || variant.price === undefined ? productPrice : variant.price;
  if (variant.compareAtPrice === null || variant.compareAtPrice === undefined) return [];
  return validatePricePair(effectivePrice, variant.compareAtPrice, "price", "compareAtPrice");
}

export function validateImage(input: ImageInput): ValidationIssue[] {
  const issues: ValidationIssue[] = []; const hasProduct = Boolean(input.productId); const hasVariant = Boolean(input.variantId);
  if (hasProduct === hasVariant) issues.push(issue("ownership", "INVALID_IMAGE_OWNER", "Image must reference exactly one Product or ProductVariant."));
  if (!input.url.trim()) issues.push(issue("url", "INVALID_IMAGE_URL", "Image URL/storage reference is required.")); else { try { new URL(input.url); } catch { issues.push(issue("url", "INVALID_IMAGE_URL", "Image URL must be a valid absolute URL.")); } }
  if (!Number.isInteger(input.sortOrder) || input.sortOrder < 0) issues.push(issue("sortOrder", "INVALID_SORT_ORDER", "Image sort order must be a non-negative integer."));
  return issues;
}
export function validateImageRelationships(productId: string, images: ImageInput[], variants: Array<VariantInput & { id?: string }>): ValidationIssue[] {
  const variantIds = new Set(variants.filter((variant) => variant.productId === productId && variant.id).map((variant) => variant.id));
  return images.flatMap((image, index) => image.variantId && !variantIds.has(image.variantId) ? [issue("images[" + index + "].variantId", "INVALID_IMAGE_VARIANT", "Variant-specific image must belong to the same Product.")] : []);
}
export function validatePrimaryImages(images: ImageInput[]): ValidationIssue[] {
  const productPrimaryCount = images.filter((image) => image.productId && image.isPrimary).length;
  return productPrimaryCount > 1 ? [issue("images", "MULTIPLE_PRIMARY_IMAGES", "A Product may have at most one primary product-level image.")] : [];
}

export function validateCategory(input: CategoryInput & SeoMetadataInput): ValidationIssue[] { const issues: ValidationIssue[] = []; requireText(input.name, "name", "Category name", issues); issues.push(...validateSlug(input.slug)); issues.push(...validateSeoMetadata(input)); return issues; }
export function validateCategoryHierarchy(categoryId: string, parentId: string | null | undefined): ValidationIssue[] { return parentId === categoryId ? [issue("parentId", "SELF_PARENT", "Category cannot be its own parent.")] : []; }
export function hasCategoryCycle(categoryId: string, parentById: ReadonlyMap<string, string | null>): boolean { const visited = new Set<string>(); let current: string | null | undefined = categoryId; while (current) { if (visited.has(current)) return true; visited.add(current); current = parentById.get(current) ?? null; } return false; }
export function validateCollection(input: CollectionInput & SeoMetadataInput): ValidationIssue[] { const issues: ValidationIssue[] = []; requireText(input.name, "name", "Collection name", issues); issues.push(...validateSeoMetadata(input)); return issues; }
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
