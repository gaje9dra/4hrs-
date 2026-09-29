import { randomUUID } from "node:crypto";
import { CatalogServiceError } from "@/lib/catalog/errors";
import * as repository from "@/lib/catalog/repository";
import { createCatalogService } from "@/lib/catalog/service";
import {
  normalizeAltText,
  normalizeSlug,
  normalizeSku,
  normalizeTagName,
  normalizeTagSlug,
  normalizeTitle,
  validateCategory,
  validateProduct,
  validateVariant,
  validateVariantUniqueness,
  type CategoryInput,
  type CollectionInput,
  type ImageInput,
  type ProductInput,
  type TagInput,
  type VariantInput,
} from "@/lib/catalog/validation";

export const CATALOG_IMPORT_VERSION = 1;
export const CATALOG_IMPORT_NAMESPACE_DEFAULT = "catalog";
export const CATALOG_IMPORT_MAX_PRODUCTS = 1000;
export const CATALOG_IMPORT_MAX_VARIANTS_PER_PRODUCT = 100;
export const CATALOG_IMPORT_MAX_MEDIA_PER_PRODUCT = 200;

export type CatalogImportReference = {
  id?: string;
  externalReference?: string;
  slug?: string;
  name?: string;
};

export type CatalogImportMerchandising = {
  position?: number;
  priority?: number;
  isFeatured?: boolean;
};

export type CatalogImportCategory = CategoryInput & {
  externalReference?: string;
  parentReference?: string;
};

export type CatalogImportCollection = CollectionInput & {
  externalReference?: string;
};

export type CatalogImportTag = TagInput & {
  externalReference?: string;
};

export type CatalogImportMedia = {
  externalReference?: string;
  url: string;
  storageReference?: string | null;
  mediaType?: "IMAGE";
  altText?: string | null;
  sortOrder?: number;
  isPrimary?: boolean;
  variantReference?: string;
  variantId?: string;
};

export type CatalogImportVariant = Omit<VariantInput, "productId" | "id"> & {
  id?: string;
  externalReference?: string;
  optionValueIds?: string[];
};

export type CatalogImportProduct = Omit<ProductInput, "id"> & {
  id?: string;
  externalReference?: string;
  variants?: CatalogImportVariant[];
  images?: CatalogImportMedia[];
  categories?: Array<CatalogImportReference & { position?: number; priority?: number; isFeatured?: boolean }>;
  collections?: Array<CatalogImportReference & CatalogImportMerchandising>;
  tags?: CatalogImportReference[];
};

export type CatalogImportPayload = {
  version?: number;
  namespace?: string;
  categories?: CatalogImportCategory[];
  collections?: CatalogImportCollection[];
  tags?: CatalogImportTag[];
  products: CatalogImportProduct[];
};

export type CatalogImportIssue = {
  recordType: "payload" | "category" | "collection" | "tag" | "product" | "variant" | "media";
  recordIndex?: number;
  recordReference?: string;
  field?: string;
  code: string;
  message: string;
  severity: "ERROR" | "WARNING";
};

export type CatalogImportAction = "CREATE" | "UPDATE" | "UNCHANGED" | "CONFLICT";

export type CatalogImportRecordPlan = {
  productIndex: number;
  action: CatalogImportAction;
  productId?: string;
  externalReference?: string;
  issues: CatalogImportIssue[];
};

export type CatalogImportResult = {
  dryRun: boolean;
  totalRecords: number;
  validRecords: number;
  invalidRecords: number;
  creates: number;
  updates: number;
  unchanged: number;
  skipped: number;
  conflicts: number;
  warnings: number;
  errors: CatalogImportIssue[];
  records: CatalogImportRecordPlan[];
};

export class CatalogImportError extends Error {
  readonly issues: CatalogImportIssue[];
  constructor(message: string, issues: CatalogImportIssue[]) {
    super(message);
    this.name = "CatalogImportError";
    this.issues = issues;
  }
}

function issue(
  recordType: CatalogImportIssue["recordType"],
  code: string,
  message: string,
  options: Partial<Pick<CatalogImportIssue, "recordIndex" | "recordReference" | "field" | "severity">> = {},
): CatalogImportIssue {
  return {
    recordType,
    code,
    message,
    severity: options.severity ?? "ERROR",
    ...options,
  };
}

function text(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function normalizeReference(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized || undefined;
}

function normalizeImportProduct(input: CatalogImportProduct): CatalogImportProduct {
  return {
    ...input,
    id: normalizeReference(input.id),
    externalReference: normalizeReference(input.externalReference),
    title: normalizeTitle(input.title),
    slug: normalizeSlug(input.slug || input.title),
    description: input.description?.trim() || null,
    shortDescription: input.shortDescription?.trim() || null,
    currency: input.currency.trim().toUpperCase(),
    seoTitle: input.seoTitle?.trim() || null,
    seoDescription: input.seoDescription?.trim() || null,
    variants: (input.variants ?? []).map((variant) => ({
      ...variant,
      id: normalizeReference(variant.id),
      externalReference: normalizeReference(variant.externalReference),
      sku: normalizeSku(variant.sku),
      displayName: variant.displayName?.trim() || null,
      size: variant.size?.trim() || null,
      color: variant.color?.trim() || null,
      optionValueIds: variant.optionValueIds ? [...new Set(variant.optionValueIds.map((id) => id.trim()).filter(Boolean))] : [],
    })),
    images: (input.images ?? []).map((media) => ({
      ...media,
      externalReference: normalizeReference(media.externalReference),
      url: media.url.trim(),
      storageReference: media.storageReference?.trim() || null,
      altText: normalizeAltText(media.altText),
      sortOrder: media.sortOrder ?? 0,
      isPrimary: media.isPrimary ?? false,
      variantReference: normalizeReference(media.variantReference),
      variantId: normalizeReference(media.variantId),
    })),
    categories: (input.categories ?? []).map((ref) => ({
      ...ref,
      id: normalizeReference(ref.id),
      externalReference: normalizeReference(ref.externalReference),
      slug: ref.slug ? normalizeSlug(ref.slug, "category") : undefined,
      name: ref.name?.trim(),
      position: ref.position ?? 0,
      priority: ref.priority ?? 0,
      isFeatured: ref.isFeatured ?? false,
    })),
    collections: (input.collections ?? []).map((ref) => ({
      ...ref,
      id: normalizeReference(ref.id),
      externalReference: normalizeReference(ref.externalReference),
      slug: ref.slug ? normalizeSlug(ref.slug, "collection") : undefined,
      name: ref.name?.trim(),
      position: ref.position ?? 0,
      priority: ref.priority ?? 0,
      isFeatured: ref.isFeatured ?? false,
    })),
    tags: (input.tags ?? []).map((ref) => ({
      ...ref,
      id: normalizeReference(ref.id),
      externalReference: normalizeReference(ref.externalReference),
      slug: ref.slug ? normalizeTagSlug(ref.slug) : undefined,
      name: ref.name ? normalizeTagName(ref.name) : undefined,
    })),
  };
}

function normalizePayload(input: CatalogImportPayload): CatalogImportPayload {
  return {
    ...input,
    version: input.version ?? CATALOG_IMPORT_VERSION,
    namespace: normalizeReference(input.namespace) ?? CATALOG_IMPORT_NAMESPACE_DEFAULT,
    categories: input.categories ?? [],
    collections: input.collections ?? [],
    tags: input.tags ?? [],
    products: input.products.map(normalizeImportProduct),
  };
}

function validatePayloadShape(payload: CatalogImportPayload): CatalogImportIssue[] {
  const issues: CatalogImportIssue[] = [];
  if (payload.version !== CATALOG_IMPORT_VERSION) {
    issues.push(issue("payload", "UNSUPPORTED_VALUE", "Unsupported catalog import version."));
  }
  if (!payload.namespace || !/^[a-zA-Z0-9._:-]{1,80}$/.test(payload.namespace)) {
    issues.push(issue("payload", "INVALID_NAMESPACE", "Import namespace must contain only bounded identifier characters."));
  }
  if (!Array.isArray(payload.products)) {
    issues.push(issue("payload", "INVALID_PRODUCT", "Import payload must contain a products array."));
    return issues;
  }
  if (payload.products.length > CATALOG_IMPORT_MAX_PRODUCTS) {
    issues.push(issue("payload", "INPUT_TOO_LARGE", "Import exceeds the maximum product count of " + CATALOG_IMPORT_MAX_PRODUCTS + "."));
  }
  payload.products.forEach((product, index) => {
    if (product.variants && product.variants.length > CATALOG_IMPORT_MAX_VARIANTS_PER_PRODUCT) {
      issues.push(issue("product", "INPUT_TOO_LARGE", "Product exceeds the maximum variant count.", { recordIndex: index, recordReference: product.externalReference ?? product.id }));
    }
    if (product.images && product.images.length > CATALOG_IMPORT_MAX_MEDIA_PER_PRODUCT) {
      issues.push(issue("product", "INPUT_TOO_LARGE", "Product exceeds the maximum media count.", { recordIndex: index, recordReference: product.externalReference ?? product.id }));
    }
  });
  return issues;
}

function parsePayload(input: CatalogImportPayload | string): CatalogImportPayload {
  if (typeof input !== "string") return input;
  try {
    return JSON.parse(input) as CatalogImportPayload;
  } catch {
    throw new CatalogImportError("Malformed catalog import JSON.", [
      issue("payload", "MALFORMED_INPUT", "Catalog import input is not valid JSON."),
    ]);
  }
}

function mapValidationIssue(recordType: CatalogImportIssue["recordType"], recordIndex: number, item: { field: string; code: string; message: string }): CatalogImportIssue {
  return issue(recordType, item.code, item.message, {
    recordIndex,
    field: item.field,
  });
}

async function resolveCategory(
  ref: CatalogImportReference,
  categoriesByKey: Map<string, string>,
): Promise<string | undefined> {
  const keys = [ref.id, ref.externalReference, ref.slug, ref.name].filter(Boolean) as string[];
  for (const key of keys) {
    const resolved = categoriesByKey.get(key);
    if (resolved) return resolved;
  }
  for (const key of [ref.id, ref.slug]) {
    if (!key) continue;
    const record = await repository.getCategoryById(key).catch(() => null);
    if (record) return record.id;
  }
  if (ref.slug) {
    const record = await repository.getCategoryBySlug(ref.slug);
    if (record) return record.id;
  }
  return undefined;
}

async function resolveCollection(
  ref: CatalogImportReference,
  collectionsByKey: Map<string, string>,
): Promise<string | undefined> {
  const keys = [ref.id, ref.externalReference, ref.slug, ref.name].filter(Boolean) as string[];
  for (const key of keys) {
    const resolved = collectionsByKey.get(key);
    if (resolved) return resolved;
  }
  if (ref.id) {
    const record = await repository.getCollectionById(ref.id).catch(() => null);
    if (record) return record.id;
  }
  if (ref.slug) {
    const record = await repository.getCollectionBySlug(ref.slug);
    if (record) return record.id;
  }
  return undefined;
}

async function resolveTag(
  ref: CatalogImportReference,
  tagsByKey: Map<string, string>,
): Promise<string | undefined> {
  const keys = [ref.id, ref.externalReference, ref.slug, ref.name].filter(Boolean) as string[];
  for (const key of keys) {
    const resolved = tagsByKey.get(key);
    if (resolved) return resolved;
  }
  if (ref.id) {
    const record = await repository.getTagById(ref.id).catch(() => null);
    if (record) return record.id;
  }
  if (ref.slug) {
    const record = await repository.getTagBySlug(ref.slug);
    if (record) return record.id;
  }
  if (ref.name) {
    const record = await repository.getTagByName(ref.name);
    if (record) return record.id;
  }
  return undefined;
}

async function resolveProduct(
  product: CatalogImportProduct,
  namespace: string,
): Promise<{ id?: string; conflict?: CatalogImportIssue }> {
  const byId = product.id ? await repository.getProductById(product.id).catch(() => null) : null;
  const byIdentity = product.externalReference
    ? await repository.getImportIdentity("PRODUCT", namespace, product.externalReference)
    : null;
  const bySlug = await repository.getProductBySlug(product.slug);

  if (byId && byIdentity && byIdentity.canonicalId !== byId.id) {
    return {
      conflict: issue("product", "CONFLICT", "Internal product ID and external reference resolve to different canonical products."),
    };
  }
  if (byIdentity && bySlug && byIdentity.canonicalId !== bySlug.id) {
    return {
      conflict: issue("product", "CONFLICT", "External reference and slug resolve to different canonical products."),
    };
  }
  const id = byId?.id ?? byIdentity?.canonicalId ?? bySlug?.id;
  return { id };
}

async function ensureCategories(
  payload: CatalogImportPayload,
  dryRun: boolean,
  namespace: string,
): Promise<{ idsByKey: Map<string, string>; issues: CatalogImportIssue[] }> {
  const idsByKey = new Map<string, string>();
  const issues: CatalogImportIssue[] = [];
  const pending = new Map<string, CatalogImportCategory>();
  for (const [index, category] of (payload.categories ?? []).entries()) {
    const key = category.externalReference ?? category.id ?? category.slug;
    if (!key) {
      issues.push(issue("category", "INVALID_CATEGORY", "Category requires id, externalReference, or slug.", { recordIndex: index }));
      continue;
    }
    if (pending.has(key)) {
      issues.push(issue("category", "CONFLICT", "Duplicate category reference in import payload.", { recordIndex: index, recordReference: key }));
      continue;
    }
    pending.set(key, category);
  }

  const resolving = new Set<string>();
  const resolved = new Set<string>();

  const visit = async (key: string): Promise<string | undefined> => {
    if (resolved.has(key)) return idsByKey.get(key);
    const category = pending.get(key);
    if (!category) return idsByKey.get(key);
    if (resolving.has(key)) {
      issues.push(issue("category", "INVALID_CATEGORY", "Category hierarchy contains a cycle.", { recordReference: key }));
      return undefined;
    }
    resolving.add(key);

    const parentReference = category.parentReference;
    let parentId: string | null = category.parentId ?? null;
    if (parentReference) {
      parentId = (await visit(parentReference)) ?? null;
      if (!parentId) {
        const existingParent = await repository.getCategoryById(parentReference).catch(() => null);
        parentId = existingParent?.id ?? null;
      }
      if (!parentId) {
        issues.push(issue("category", "MISSING_REFERENCE", "Category parent reference could not be resolved.", { recordReference: key }));
      }
    }

    let existing = category.id ? await repository.getCategoryById(category.id).catch(() => null) : null;
    if (!existing && category.slug) existing = await repository.getCategoryBySlug(normalizeSlug(category.slug, "category"));
    if (!existing && category.externalReference) {
      const identity = await repository.getImportIdentity("PRODUCT", namespace, "category:" + category.externalReference);
      if (identity) existing = await repository.getCategoryById(identity.canonicalId).catch(() => null);
    }

    if (dryRun) {
      const id = existing?.id ?? category.id ?? randomUUID();
      for (const candidate of [key, category.id, category.slug, category.externalReference, category.name].filter(Boolean) as string[]) idsByKey.set(candidate, id);
      resolved.add(key);
      resolving.delete(key);
      return id;
    }

    const service = createCatalogService();
    let record;
    if (existing) {
      record = await service.updateCategory(existing.id, {
        name: category.name,
        slug: category.slug,
        status: category.status,
        parentId,
        seoTitle: category.seoTitle,
        seoDescription: category.seoDescription,
      });
    } else {
      record = await service.createCategory({ ...category, parentId });
    }
    for (const candidate of [key, category.id, category.slug, category.externalReference, category.name].filter(Boolean) as string[]) idsByKey.set(candidate, record.id);
    resolved.add(key);
    resolving.delete(key);
    return record.id;
  };

  for (const key of pending.keys()) await visit(key);
  return { idsByKey, issues };
}

async function ensureCollections(
  payload: CatalogImportPayload,
  dryRun: boolean,
): Promise<{ idsByKey: Map<string, string>; issues: CatalogImportIssue[] }> {
  const idsByKey = new Map<string, string>();
  const issues: CatalogImportIssue[] = [];
  const service = createCatalogService();
  for (const [index, collection] of (payload.collections ?? []).entries()) {
    const key = collection.externalReference ?? collection.id ?? collection.slug;
    if (!key) {
      issues.push(issue("collection", "INVALID_COLLECTION", "Collection requires id, externalReference, or slug.", { recordIndex: index }));
      continue;
    }
    let existing = collection.id ? await repository.getCollectionById(collection.id).catch(() => null) : null;
    if (!existing && collection.slug) existing = await repository.getCollectionBySlug(normalizeSlug(collection.slug, "collection"));
    if (dryRun) {
      const id = existing?.id ?? collection.id ?? randomUUID();
      for (const candidate of [key, collection.id, collection.slug, collection.externalReference, collection.name].filter(Boolean) as string[]) idsByKey.set(candidate, id);
      continue;
    }
    const record = existing
      ? await service.updateCollection(existing.id, collection)
      : await service.createCollection(collection);
    for (const candidate of [key, collection.id, collection.slug, collection.externalReference, collection.name].filter(Boolean) as string[]) idsByKey.set(candidate, record.id);
  }
  return { idsByKey, issues };
}

async function ensureTags(
  payload: CatalogImportPayload,
  dryRun: boolean,
): Promise<{ idsByKey: Map<string, string>; issues: CatalogImportIssue[] }> {
  const idsByKey = new Map<string, string>();
  const issues: CatalogImportIssue[] = [];
  const service = createCatalogService();
  for (const [index, tag] of (payload.tags ?? []).entries()) {
    const key = tag.externalReference ?? tag.id ?? tag.slug ?? tag.name;
    if (!key) {
      issues.push(issue("tag", "INVALID_TAG", "Tag requires id, externalReference, slug, or name.", { recordIndex: index }));
      continue;
    }
    let existing = tag.id ? await repository.getTagById(tag.id).catch(() => null) : null;
    if (!existing && tag.slug) existing = await repository.getTagBySlug(normalizeTagSlug(tag.slug));
    if (!existing && tag.name) existing = await repository.getTagByName(normalizeTagName(tag.name));
    if (dryRun) {
      const id = existing?.id ?? tag.id ?? randomUUID();
      for (const candidate of [key, tag.id, tag.slug, tag.externalReference, tag.name].filter(Boolean) as string[]) idsByKey.set(candidate, id);
      continue;
    }
    const record = existing
      ? await service.updateTag(existing.id, tag)
      : await service.createTag(tag);
    for (const candidate of [key, tag.id, tag.slug, tag.externalReference, tag.name].filter(Boolean) as string[]) idsByKey.set(candidate, record.id);
  }
  return { idsByKey, issues };
}

function compareScalar(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function productInputProjection(product: CatalogImportProduct, resolvedCategoryIds: string[], resolvedCollectionIds: string[], resolvedTagIds: string[]) {
  return {
    title: product.title,
    slug: product.slug,
    description: product.description ?? null,
    shortDescription: product.shortDescription ?? null,
    status: product.status,
    price: String(product.price),
    compareAtPrice: product.compareAtPrice == null ? null : String(product.compareAtPrice),
    currency: product.currency,
    seoTitle: product.seoTitle ?? null,
    seoDescription: product.seoDescription ?? null,
    categoryIds: [...resolvedCategoryIds].sort(),
    collectionIds: [...resolvedCollectionIds].sort(),
    tagIds: [...resolvedTagIds].sort(),
  };
}

function existingProductProjection(product: Awaited<ReturnType<typeof repository.getProductDetails>>) {
  if (!product) return null;
  return {
    title: product.title,
    slug: product.slug,
    description: product.description ?? null,
    shortDescription: product.shortDescription ?? null,
    status: product.status,
    price: product.price.toString(),
    compareAtPrice: product.compareAtPrice?.toString() ?? null,
    currency: product.currency,
    seoTitle: product.seoTitle ?? null,
    seoDescription: product.seoDescription ?? null,
    categoryIds: product.categories.map((item) => item.categoryId).sort(),
    collectionIds: product.collections.map((item) => item.collectionId).sort(),
    tagIds: product.tags.map((item) => item.tagId).sort(),
  };
}

async function planProducts(
  payload: CatalogImportPayload,
  namespace: string,
  categoryIds: Map<string, string>,
  collectionIds: Map<string, string>,
  tagIds: Map<string, string>,
): Promise<CatalogImportRecordPlan[]> {
  const plans: CatalogImportRecordPlan[] = [];
  for (const [index, raw] of payload.products.entries()) {
    const product = normalizeImportProduct(raw);
    const issues: CatalogImportIssue[] = [];
    issues.push(...validateProduct(product).map((item) => mapValidationIssue("product", index, item)));

    const resolvedCategories: string[] = [];
    for (const ref of product.categories ?? []) {
      const id = await resolveCategory(ref, categoryIds);
      if (!id) issues.push(issue("product", "MISSING_REFERENCE", "Category reference could not be resolved.", { recordIndex: index, field: "categories", recordReference: ref.externalReference ?? ref.slug ?? ref.id }));
      else resolvedCategories.push(id);
    }
    const resolvedCollections: string[] = [];
    for (const ref of product.collections ?? []) {
      const id = await resolveCollection(ref, collectionIds);
      if (!id) issues.push(issue("product", "MISSING_REFERENCE", "Collection reference could not be resolved.", { recordIndex: index, field: "collections", recordReference: ref.externalReference ?? ref.slug ?? ref.id }));
      else resolvedCollections.push(id);
    }
    const resolvedTags: string[] = [];
    for (const ref of product.tags ?? []) {
      const id = await resolveTag(ref, tagIds);
      if (!id) issues.push(issue("product", "MISSING_REFERENCE", "Tag reference could not be resolved.", { recordIndex: index, field: "tags", recordReference: ref.externalReference ?? ref.slug ?? ref.id }));
      else resolvedTags.push(id);
    }

    const variants = (product.variants ?? []).map((variant) => ({ ...variant, productId: product.id ?? "" }));
    issues.push(...variants.flatMap((variant, variantIndex) =>
      validateVariant(variant).map((item) => mapValidationIssue("variant", index, { ...item, field: "variants[" + variantIndex + "]." + item.field })),
    ));
    issues.push(...validateVariantUniqueness(variants).map((item) => mapValidationIssue("variant", index, item)));

    const seenExternal = new Set<string>();
    for (const [variantIndex, variant] of product.variants?.entries() ?? []) {
      if (variant.externalReference) {
        if (seenExternal.has(variant.externalReference)) issues.push(issue("variant", "CONFLICT", "Duplicate variant external reference in product.", { recordIndex: index, field: "variants[" + variantIndex + "].externalReference", recordReference: variant.externalReference }));
        seenExternal.add(variant.externalReference);
      }
    }

    for (const media of product.images ?? []) {
      if (!media.url.trim() && !media.storageReference) {
        issues.push(issue("media", "INVALID_MEDIA", "Media requires a URL or storage reference.", { recordIndex: index, field: "images" }));
      }
    }

    const resolution = await resolveProduct(product, namespace);
    if (resolution.conflict) issues.push({ ...resolution.conflict, recordIndex: index, recordReference: product.externalReference ?? product.id ?? product.slug });

    const existing = resolution.id ? await repository.getProductDetails(resolution.id) : null;
    const projection = existing ? existingProductProjection(existing) : null;
    const incomingProjection = productInputProjection(product, resolvedCategories, resolvedCollections, resolvedTags);
    const action: CatalogImportAction = issues.length
      ? "CONFLICT"
      : !existing
        ? "CREATE"
        : compareScalar(projection, incomingProjection) && !(product.variants?.length || product.images?.length)
          ? "UNCHANGED"
          : "UPDATE";

    plans.push({
      productIndex: index,
      action,
      productId: resolution.id,
      externalReference: product.externalReference,
      issues,
    });
  }
  return plans;
}

async function persistProduct(
  product: CatalogImportProduct,
  plan: CatalogImportRecordPlan,
  categoryIds: Map<string, string>,
  collectionIds: Map<string, string>,
  tagIds: Map<string, string>,
  namespace: string,
): Promise<void> {
  const service = createCatalogService();
  const resolvedCategories = (product.categories ?? []).map((ref) => resolveCategory(ref, categoryIds)).filter(Boolean) as Promise<string>[];
  const categoryIdList = (await Promise.all(resolvedCategories));
  const collectionIdList = (await Promise.all((product.collections ?? []).map((ref) => resolveCollection(ref, collectionIds)))).filter(Boolean) as string[];
  const tagIdList = (await Promise.all((product.tags ?? []).map((ref) => resolveTag(ref, tagIds)))).filter(Boolean) as string[];

  let productId = plan.productId;
  if (!productId) {
    const created = await service.createProduct({
      ...product,
      id: undefined,
      categoryIds: [...new Set(categoryIdList)],
      collectionIds: [...new Set(collectionIdList)],
      tagIds: [...new Set(tagIdList)],
      variants: (product.variants ?? []).map((variant) => ({ ...variant, productId: "" })),
      images: [],
    });
    productId = created.id;
  } else {
    await service.updateProduct({
      id: productId,
      title: product.title,
      slug: product.slug,
      description: product.description,
      shortDescription: product.shortDescription,
      status: product.status,
      price: product.price,
      compareAtPrice: product.compareAtPrice,
      currency: product.currency,
      seoTitle: product.seoTitle,
      seoDescription: product.seoDescription,
      categoryIds: [...new Set(categoryIdList)],
      collectionIds: [...new Set(collectionIdList)],
      tagIds: [...new Set(tagIdList)],
    });
  }

  const memberships = product.collections ?? [];
  for (const membership of memberships) {
    const collectionId = await resolveCollection(membership, collectionIds);
    if (!collectionId) continue;
    await service.updateCollectionMembership(productId, collectionId, {
      position: membership.position,
      priority: membership.priority,
      isFeatured: membership.isFeatured,
    }).catch(async () => {
      await service.attachCollection(productId!, collectionId, {
        position: membership.position,
        priority: membership.priority,
        isFeatured: membership.isFeatured,
      });
    });
  }
  for (const membership of product.categories ?? []) {
    const categoryId = await resolveCategory(membership, categoryIds);
    if (!categoryId) continue;
    await service.updateCategoryMembership(productId, categoryId, {
      position: membership.position,
      priority: membership.priority,
      isFeatured: membership.isFeatured,
    }).catch(async () => {
      await service.attachCategory(productId!, categoryId, {
        position: membership.position,
        priority: membership.priority,
        isFeatured: membership.isFeatured,
      });
    });
  }

  const existingVariants = await repository.getVariantsByProduct(productId);
  for (const rawVariant of product.variants ?? []) {
    const variant = { ...rawVariant, productId };
    let existing = rawVariant.id ? await repository.getVariantById(rawVariant.id) : null;
    if (!existing && rawVariant.externalReference) {
      const identity = await repository.getImportIdentity("VARIANT", namespace, rawVariant.externalReference);
      if (identity) existing = await repository.getVariantById(identity.canonicalId);
    }
    if (!existing) existing = existingVariants.find((item) => item.sku === rawVariant.sku) ?? null;

    const saved = existing
      ? await service.updateVariant(existing.id, rawVariant)
      : await service.createVariant(variant);
    if (rawVariant.externalReference) {
      await repository.createImportIdentity({
        entityType: "VARIANT",
        namespace,
        externalReference: rawVariant.externalReference,
        canonicalId: saved.id,
      }).catch(() => undefined);
    }
  }

  for (const media of product.images ?? []) {
    const variantId = media.variantId ?? (
      media.variantReference
        ? ((product.variants ?? []).find((variant) => variant.externalReference === media.variantReference)?.id)
        : undefined
    );
    const input: ImageInput = {
      productId: variantId ? null : productId,
      variantId: variantId ?? null,
      url: media.url,
      storageReference: media.storageReference,
      mediaType: media.mediaType,
      altText: media.altText,
      sortOrder: media.sortOrder ?? 0,
      isPrimary: media.isPrimary ?? false,
    };
    const existingImages = variantId
      ? await repository.listVariantImages(variantId)
      : await repository.listProductImages(productId);
    const existingImage = existingImages.find((item) =>
      item.url === input.url ||
      (input.storageReference && item.storageReference === input.storageReference),
    );
    if (!existingImage) await service.addImage(input);
    else if (input.isPrimary || input.altText !== existingImage.altText || input.sortOrder !== existingImage.sortOrder) {
      await service.updateImage(existingImage.id, {
        altText: input.altText,
        sortOrder: input.sortOrder,
        isPrimary: input.isPrimary,
        url: input.url,
      });
    }
  }

  if (product.externalReference) {
    const existingIdentity = await repository.getImportIdentity("PRODUCT", namespace, product.externalReference);
    if (!existingIdentity) {
      await repository.createImportIdentity({
        entityType: "PRODUCT",
        namespace,
        externalReference: product.externalReference,
        canonicalId: productId,
      });
    } else if (existingIdentity.canonicalId !== productId) {
      throw new CatalogImportError("Import identity conflict.", [
        issue("product", "CONFLICT", "External reference is already bound to another Product.", { recordReference: product.externalReference }),
      ]);
    }
  }
}

export function createCatalogImportService() {
  return {
    async preview(input: CatalogImportPayload | string): Promise<CatalogImportResult> {
      const parsed = parsePayload(input);
      const normalized = normalizePayload(parsed);
      const shapeIssues = validatePayloadShape(normalized);
      const categoryResult = await ensureCategories(normalized, true, normalized.namespace!);
      const collectionResult = await ensureCollections(normalized, true);
      const tagResult = await ensureTags(normalized, true);
      const plans = await planProducts(normalized, normalized.namespace!, categoryResult.idsByKey, collectionResult.idsByKey, tagResult.idsByKey);
      const errors = [...shapeIssues, ...categoryResult.issues, ...collectionResult.issues, ...tagResult.issues, ...plans.flatMap((plan) => plan.issues)];
      return summarizeResult(true, plans, errors);
    },

    async import(input: CatalogImportPayload | string): Promise<CatalogImportResult> {
      const parsed = parsePayload(input);
      const normalized = normalizePayload(parsed);
      const shapeIssues = validatePayloadShape(normalized);
      if (shapeIssues.length) return summarizeResult(false, [], shapeIssues);

      const preview = await this.preview(normalized);
      if (preview.errors.length) return { ...preview, dryRun: false };

      const categoryResult = await ensureCategories(normalized, false, normalized.namespace!);
      const collectionResult = await ensureCollections(normalized, false);
      const tagResult = await ensureTags(normalized, false);
      const errors = [...categoryResult.issues, ...collectionResult.issues];
      if (errors.length) return { ...summarizeResult(false, preview.records, errors), dryRun: false };

      const plans = await planProducts(normalized, normalized.namespace!, categoryResult.idsByKey, collectionResult.idsByKey, tagResult.idsByKey);
      const executionErrors: CatalogImportIssue[] = [];
      for (const plan of plans) {
        if (plan.action === "CONFLICT" || !plan.productId && plan.action !== "CREATE") continue;
        try {
          await persistProduct(normalized.products[plan.productIndex], plan, categoryResult.idsByKey, collectionResult.idsByKey, tagResult.idsByKey, normalized.namespace!);
        } catch (error) {
          const message = error instanceof CatalogServiceError || error instanceof CatalogImportError ? error.message : "Catalog import persistence failed.";
          executionErrors.push(issue("product", "PERSISTENCE_ERROR", message, { recordIndex: plan.productIndex, recordReference: plan.externalReference }));
        }
      }
      return summarizeResult(false, plans, executionErrors);
    },
  };
}

function summarizeResult(
  dryRun: boolean,
  plans: CatalogImportRecordPlan[],
  errors: CatalogImportIssue[],
): CatalogImportResult {
  return {
    dryRun,
    totalRecords: plans.length,
    validRecords: plans.filter((plan) => plan.action !== "CONFLICT").length,
    invalidRecords: plans.filter((plan) => plan.action === "CONFLICT").length,
    creates: plans.filter((plan) => plan.action === "CREATE").length,
    updates: plans.filter((plan) => plan.action === "UPDATE").length,
    unchanged: plans.filter((plan) => plan.action === "UNCHANGED").length,
    skipped: 0,
    conflicts: plans.filter((plan) => plan.action === "CONFLICT").length,
    warnings: errors.filter((error) => error.severity === "WARNING").length,
    errors,
    records: plans,
  };
}

export function parseCatalogImportJson(input: string): CatalogImportPayload {
  return parsePayload(input);
}
