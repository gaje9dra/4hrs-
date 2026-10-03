import { Prisma, type ContentStatus, type ContentType } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db/client";
import { normalizeLocale, isSupportedLocale, type SupportedLocale } from "@/lib/i18n/registry";
import { auditAdminAction, type AdminAuthorizationContext } from "@/lib/admin/audit";
import { incrementMetric } from "@/lib/observability/metrics";

export type ContentReferenceType = "PRODUCT" | "CATEGORY" | "COLLECTION";
export type ContentReference = { type: ContentReferenceType; id: string };

export type ContentBlock =
  | { type: "heading"; level: 2 | 3; text: string }
  | { type: "paragraph"; text: string }
  | { type: "image"; mediaId: string; altText: string; decorative?: boolean }
  | { type: "link"; label: string; href: string }
  | { type: "cta"; label: string; href: string }
  | { type: "product"; productId: string }
  | { type: "category"; categoryId: string }
  | { type: "collection"; collectionId: string };

export type ContentSnapshot = {
  type: ContentType;
  internalName: string;
  slug: string | null;
  locale: SupportedLocale;
  title: string;
  summary: string | null;
  body: ContentBlock[];
  seoTitle: string | null;
  seoDescription: string | null;
  canonicalUrl: string | null;
  robots: string | null;
  openGraphTitle: string | null;
  openGraphDescription: string | null;
  mediaReferences: string[];
  linkedReferences: ContentReference[];
  publicationStartAt: string | null;
  publicationEndAt: string | null;
  translationStatus: "ORIGINAL" | "IN_PROGRESS" | "CURRENT" | "STALE";
  sourceContentId: string | null;
  sourceVersion: number | null;
};

export type ContentInput = Omit<ContentSnapshot, "locale"> & { locale: unknown };

export class ContentError extends Error {
  constructor(
    public readonly code:
      | "INVALID_CONTENT"
      | "NOT_FOUND"
      | "CONFLICT"
      | "INVALID_TRANSITION"
      | "NOT_READY"
      | "UNAUTHORIZED_REFERENCE"
      | "DATABASE_ERROR",
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "ContentError";
  }
}

const TYPES = new Set<ContentType>([
  "HOMEPAGE_SECTION","LANDING_PAGE","COLLECTION_PAGE","CATEGORY_EDITORIAL",
  "PRODUCT_EDITORIAL","PROMOTIONAL_BANNER","CONTENT_BLOCK",
]);
const STATUSES = new Set<ContentStatus>(["DRAFT","IN_REVIEW","APPROVED","SCHEDULED","PUBLISHED","UNPUBLISHED","ARCHIVED"]);
const ROBOTS = new Set(["index,follow","noindex,nofollow"]);
const MAX_BLOCKS = 100;
const MAX_MEDIA = 40;
const MAX_REFERENCES = 40;
const MAX_BODY_BYTES = 64_000;

function text(value: unknown, field: string, max: number, required = false): string | null {
  if (typeof value !== "string") {
    if (required) throw new ContentError("INVALID_CONTENT", field + " is required.");
    return null;
  }
  const normalized = value.replace(/[\u0000-\u001F\u007F]/g, " ").trim().replace(/\s+/g, " ");
  if (required && !normalized) throw new ContentError("INVALID_CONTENT", field + " is required.");
  if (normalized.length > max) throw new ContentError("INVALID_CONTENT", field + " is too long.");
  return normalized || null;
}

function safeHref(value: unknown, field: string): string {
  const href = text(value, field, 2048, true)!;
  if (href.startsWith("/")) {
    if (href.startsWith("//") || /[\u0000-\u001F\u007F]/.test(href)) throw new ContentError("INVALID_CONTENT", field + " is unsafe.");
    return href;
  }
  let url: URL;
  try { url = new URL(href); } catch { throw new ContentError("INVALID_CONTENT", field + " must be a safe URL."); }
  if (url.protocol !== "https:" && url.protocol !== "http:") throw new ContentError("INVALID_CONTENT", field + " must use HTTP(S).");
  if (url.username || url.password) throw new ContentError("INVALID_CONTENT", field + " must not contain credentials.");
  return url.toString();
}

function parseDate(value: string | null, field: string): Date | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new ContentError("INVALID_CONTENT", field + " must be an ISO timestamp.");
  return date;
}

function validateBlocks(value: unknown): ContentBlock[] {
  if (!Array.isArray(value) || value.length > MAX_BLOCKS) throw new ContentError("INVALID_CONTENT", "Content blocks are invalid or exceed the maximum.");
  return value.map((raw, index) => {
    if (!raw || typeof raw !== "object" || Array.isArray(raw) || typeof (raw as { type?: unknown }).type !== "string") {
      throw new ContentError("INVALID_CONTENT", "Content block " + index + " is invalid.");
    }
    const block = raw as Record<string, unknown>;
    const kind = block.type;
    if (kind === "heading") {
      const level = block.level;
      if (level !== 2 && level !== 3) throw new ContentError("INVALID_CONTENT", "Heading level is invalid.");
      return { type: "heading", level, text: text(block.text, "heading.text", 500, true)! };
    }
    if (kind === "paragraph") return { type: "paragraph", text: text(block.text, "paragraph.text", 5000, true)! };
    if (kind === "image") {
      const mediaId = text(block.mediaId, "image.mediaId", 64, true)!;
      const altText = text(block.altText, "image.altText", 200, block.decorative !== true)!;
      if (block.decorative !== undefined && typeof block.decorative !== "boolean") throw new ContentError("INVALID_CONTENT", "image.decorative must be boolean.");
      return { type: "image", mediaId, altText: altText ?? "", decorative: block.decorative === true };
    }
    if (kind === "link" || kind === "cta") {
      const label = text(block.label, kind + ".label", 160, true)!;
      const href = safeHref(block.href, kind + ".href");
      return kind === "cta" ? { type: "cta", label, href } : { type: "link", label, href };
    }
    if (kind === "product") return { type: "product", productId: text(block.productId, "product.productId", 64, true)! };
    if (kind === "category") return { type: "category", categoryId: text(block.categoryId, "category.categoryId", 64, true)! };
    if (kind === "collection") return { type: "collection", collectionId: text(block.collectionId, "collection.collectionId", 64, true)! };
    throw new ContentError("INVALID_CONTENT", "Unsupported content block type.");
  });
}

function validateReferences(value: unknown): ContentReference[] {
  if (!Array.isArray(value) || value.length > MAX_REFERENCES) throw new ContentError("INVALID_CONTENT", "linkedReferences is invalid.");
  return value.map((raw, index) => {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new ContentError("INVALID_CONTENT", "Reference " + index + " is invalid.");
    const item = raw as Record<string, unknown>;
    if (item.type !== "PRODUCT" && item.type !== "CATEGORY" && item.type !== "COLLECTION") throw new ContentError("INVALID_CONTENT", "Reference type is invalid.");
    return { type: item.type, id: text(item.id, "reference.id", 64, true)! };
  });
}

export function validateContentInput(input: ContentInput): ContentSnapshot {
  if (!TYPES.has(input.type)) throw new ContentError("INVALID_CONTENT", "Content type is invalid.");
  const locale = normalizeLocale(input.locale);
  if (!isSupportedLocale(input.locale)) throw new ContentError("INVALID_CONTENT", "Locale is not supported.");
  const internalName = text(input.internalName, "internalName", 160, true)!;
  const slug = input.slug === null ? null : text(input.slug, "slug", 200);
  if (slug && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) throw new ContentError("INVALID_CONTENT", "Slug must be lowercase and URL-safe.");
  if (input.type === "LANDING_PAGE" && !slug) throw new ContentError("INVALID_CONTENT", "Landing pages require a public slug.");
  if (input.type !== "LANDING_PAGE" && input.slug && !slug) throw new ContentError("INVALID_CONTENT", "Slug is invalid.");
  const title = text(input.title, "title", 200, true)!;
  const summary = text(input.summary, "summary", 500);
  const body = validateBlocks(input.body);
  const seoTitle = text(input.seoTitle, "seoTitle", 200);
  const seoDescription = text(input.seoDescription, "seoDescription", 500);
  const canonicalUrl = input.canonicalUrl === null ? null : safeHref(input.canonicalUrl, "canonicalUrl");
  const robots = input.robots === null ? null : text(input.robots, "robots", 64);
  if (robots && !ROBOTS.has(robots)) throw new ContentError("INVALID_CONTENT", "robots directive is invalid.");
  const openGraphTitle = text(input.openGraphTitle, "openGraphTitle", 200);
  const openGraphDescription = text(input.openGraphDescription, "openGraphDescription", 500);
  if (!Array.isArray(input.mediaReferences) || input.mediaReferences.length > MAX_MEDIA || input.mediaReferences.some((id) => typeof id !== "string" || !id.trim())) {
    throw new ContentError("INVALID_CONTENT", "mediaReferences is invalid.");
  }
  const mediaReferences = [...new Set(input.mediaReferences.map((id) => id.trim()))];
  const linkedReferences = validateReferences(input.linkedReferences);
  const publicationStartAt = parseDate(input.publicationStartAt, "publicationStartAt");
  const publicationEndAt = parseDate(input.publicationEndAt, "publicationEndAt");
  if (publicationStartAt && publicationEndAt && publicationEndAt <= publicationStartAt) throw new ContentError("INVALID_CONTENT", "publicationEndAt must be after publicationStartAt.");
  if (input.type === "COLLECTION_PAGE" && !linkedReferences.some((r) => r.type === "COLLECTION")) throw new ContentError("INVALID_CONTENT", "Collection pages require a collection reference.");
  if (input.type === "CATEGORY_EDITORIAL" && !linkedReferences.some((r) => r.type === "CATEGORY")) throw new ContentError("INVALID_CONTENT", "Category editorial content requires a category reference.");
  if (input.type === "PRODUCT_EDITORIAL" && !linkedReferences.some((r) => r.type === "PRODUCT")) throw new ContentError("INVALID_CONTENT", "Product editorial content requires a product reference.");
  const snapshot: ContentSnapshot = {
    type: input.type, internalName, slug, locale, title, summary, body, seoTitle, seoDescription,
    canonicalUrl, robots, openGraphTitle, openGraphDescription, mediaReferences, linkedReferences,
    publicationStartAt: publicationStartAt?.toISOString() ?? null,
    publicationEndAt: publicationEndAt?.toISOString() ?? null,
    translationStatus: input.translationStatus, sourceContentId: input.sourceContentId, sourceVersion: input.sourceVersion,
  };
  if (Buffer.byteLength(JSON.stringify(snapshot), "utf8") > MAX_BODY_BYTES) throw new ContentError("INVALID_CONTENT", "Content payload is too large.");
  return snapshot;
}

function transitionAllowed(from: ContentStatus, to: ContentStatus): boolean {
  if (from === to) return true;
  const transitions: Record<ContentStatus, ContentStatus[]> = {
    DRAFT: ["IN_REVIEW", "ARCHIVED"],
    IN_REVIEW: ["DRAFT", "APPROVED"],
    APPROVED: ["DRAFT", "SCHEDULED", "PUBLISHED"],
    SCHEDULED: ["APPROVED", "PUBLISHED", "DRAFT"],
    PUBLISHED: ["UNPUBLISHED", "ARCHIVED", "DRAFT"],
    UNPUBLISHED: ["DRAFT", "IN_REVIEW", "ARCHIVED"],
    ARCHIVED: ["DRAFT"],
  };
  return transitions[from].includes(to);
}

function snapshotFromRecord(record: {
  type: ContentType; internalName: string; slug: string | null; locale: string; title: string; summary: string | null;
  body: Prisma.JsonValue; seoTitle: string | null; seoDescription: string | null; canonicalUrl: string | null; robots: string | null;
  openGraphTitle: string | null; openGraphDescription: string | null; mediaReferences: string[]; linkedReferences: Prisma.JsonValue;
  publicationStartAt: Date | null; publicationEndAt: Date | null; translationStatus: "ORIGINAL"|"IN_PROGRESS"|"CURRENT"|"STALE";
  sourceContentId: string | null; sourceVersion: number | null;
}): ContentSnapshot {
  return {
    type: record.type, internalName: record.internalName, slug: record.slug, locale: normalizeLocale(record.locale),
    title: record.title, summary: record.summary, body: record.body as ContentBlock[],
    seoTitle: record.seoTitle, seoDescription: record.seoDescription, canonicalUrl: record.canonicalUrl, robots: record.robots,
    openGraphTitle: record.openGraphTitle, openGraphDescription: record.openGraphDescription,
    mediaReferences: record.mediaReferences, linkedReferences: record.linkedReferences as ContentReference[],
    publicationStartAt: record.publicationStartAt?.toISOString() ?? null,
    publicationEndAt: record.publicationEndAt?.toISOString() ?? null, translationStatus: record.translationStatus,
    sourceContentId: record.sourceContentId, sourceVersion: record.sourceVersion,
  };
}

async function validateExternalReferences(snapshot: ContentSnapshot) {
  const ids = new Set(snapshot.mediaReferences);
  if (ids.size) {
    const media = await db.productImage.findMany({ where: { id: { in: [...ids] } }, select: { id: true, mediaType: true, altText: true } });
    if (media.length !== ids.size || media.some((m) => m.mediaType !== "IMAGE")) throw new ContentError("NOT_READY", "One or more media references are unavailable.");
  }
  for (const ref of snapshot.linkedReferences) {
    if (ref.type === "PRODUCT") {
      const item = await db.product.findUnique({ where: { id: ref.id }, select: { id: true, status: true } });
      if (!item || item.status !== "ACTIVE") throw new ContentError("NOT_READY", "A referenced product is not currently published.");
    }
    if (ref.type === "CATEGORY") {
      const item = await db.category.findUnique({ where: { id: ref.id }, select: { id: true, status: true } });
      if (!item || item.status !== "ACTIVE") throw new ContentError("NOT_READY", "A referenced category is not currently published.");
    }
    if (ref.type === "COLLECTION") {
      const item = await db.collection.findUnique({ where: { id: ref.id }, select: { id: true, status: true } });
      if (!item || item.status !== "ACTIVE") throw new ContentError("NOT_READY", "A referenced collection is not currently published.");
    }
  }
  for (const block of snapshot.body) {
    if (block.type === "image" && !ids.has(block.mediaId)) throw new ContentError("NOT_READY", "Every editorial image block must reference a declared media asset.");
  }
}

function assertPublishWindow(snapshot: ContentSnapshot, now = new Date()) {
  const start = snapshot.publicationStartAt ? new Date(snapshot.publicationStartAt) : null;
  const end = snapshot.publicationEndAt ? new Date(snapshot.publicationEndAt) : null;
  if (start && start > now) throw new ContentError("INVALID_TRANSITION", "Content is scheduled for a future publication time.");
  if (end && end <= now) throw new ContentError("INVALID_TRANSITION", "Content publication window has expired.");
}

function publicPath(snapshot: ContentSnapshot): string | null {
  return snapshot.slug ? "/content/" + encodeURIComponent(snapshot.slug) : null;
}

async function invalidateContentCaches(snapshot: ContentSnapshot) {
  const path = publicPath(snapshot);
  if (path) revalidatePath(path);
  if (snapshot.type === "HOMEPAGE_SECTION") revalidatePath("/");
  revalidatePath("/sitemap.xml");
}

async function recordLifecycleAudit(context: AdminAuthorizationContext | null, action: string, contentId: string, success: boolean, metadata?: unknown, client: Prisma.TransactionClient | typeof db = db) {
  if (!context) return;
  await auditAdminAction(context, { action, resourceType: "ContentItem", resourceId: contentId, success, metadata }, client);
}

export async function createContent(context: AdminAuthorizationContext, input: ContentInput) {
  const snapshot = validateContentInput(input);
  try {
    const result = await db.$transaction(async (tx) => {
      const content = await tx.contentItem.create({
        data: {
          id: randomUUID(), ...snapshot, body: snapshot.body, linkedReferences: snapshot.linkedReferences,
          locale: snapshot.locale, version: 1, createdByAdminId: context.adminUser.id, updatedByAdminId: context.adminUser.id,
        },
      });
      await tx.contentRevision.create({ data: { id: randomUUID(), contentId: content.id, version: 1, snapshot, createdByAdminId: context.adminUser.id } });
      await recordLifecycleAudit(context, "CONTENT_CREATED", content.id, true, { version: 1 }, tx);
      return content;
    });
    incrementMetric("content_operations_total" as never, { operation: "create" });
    return result;
  } catch (error) {
    if (error instanceof ContentError) throw error;
    throw new ContentError("DATABASE_ERROR", "Content could not be created.", error);
  }
}

export async function getContent(id: string) {
  return db.contentItem.findUnique({ where: { id }, include: { revisions: { orderBy: { version: "desc" }, take: 20 } } });
}

export async function listContent(filters: { status?: ContentStatus; type?: ContentType; locale?: string; slug?: string; search?: string; limit?: number; offset?: number } = {}) {
  const limit = Math.min(100, Math.max(1, Math.trunc(filters.limit ?? 25)));
  const offset = Math.max(0, Math.trunc(filters.offset ?? 0));
  const where: Prisma.ContentItemWhereInput = {
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.type ? { type: filters.type } : {}),
    ...(filters.locale ? { locale: normalizeLocale(filters.locale) } : {}),
    ...(filters.slug ? { slug: filters.slug } : {}),
    ...(filters.search ? { OR: [{ title: { contains: filters.search, mode: "insensitive" } }, { internalName: { contains: filters.search, mode: "insensitive" } }, { slug: { contains: filters.search, mode: "insensitive" } }] } : {}),
  };
  const [items, total] = await Promise.all([
    db.contentItem.findMany({ where, orderBy: [{ updatedAt: "desc" }, { id: "asc" }], skip: offset, take: limit }),
    db.contentItem.count({ where }),
  ]);
  return { items, total, limit, offset, hasNextPage: offset + items.length < total };
}

export async function updateContent(context: AdminAuthorizationContext, id: string, expectedVersion: number, input: ContentInput, changeSummary?: string | null) {
  const snapshot = validateContentInput(input);
  if (!Number.isInteger(expectedVersion) || expectedVersion < 1) throw new ContentError("CONFLICT", "A valid expectedVersion is required.");
  try {
    const result = await db.$transaction(async (tx) => {
      const current = await tx.contentItem.findUnique({ where: { id } });
      if (!current) throw new ContentError("NOT_FOUND", "Content was not found.");
      if (current.version !== expectedVersion) throw new ContentError("CONFLICT", "Content changed concurrently. Refresh before saving.");
      const nextVersion = current.version + 1;
      const content = await tx.contentItem.updateMany({
        where: { id, version: expectedVersion },
        data: {
          ...snapshot, body: snapshot.body, linkedReferences: snapshot.linkedReferences,
          version: nextVersion, updatedByAdminId: context.adminUser.id,
          status: current.status === "PUBLISHED" ? "DRAFT" : current.status,
          publishedVersion: current.publishedVersion,
        },
      });
      if (content.count !== 1) throw new ContentError("CONFLICT", "Content changed concurrently. Refresh before saving.");
      await tx.contentRevision.create({ data: { id: randomUUID(), contentId: id, version: nextVersion, snapshot, changeSummary: changeSummary?.trim().slice(0,1000) || null, createdByAdminId: context.adminUser.id } });
      await recordLifecycleAudit(context, "CONTENT_UPDATED", id, true, { fromVersion: expectedVersion, toVersion: nextVersion, changeSummary }, tx);
      return tx.contentItem.findUniqueOrThrow({ where: { id } });
    });
    await invalidateContentCaches(snapshot);
    return result;
  } catch (error) {
    if (error instanceof ContentError) throw error;
    throw new ContentError("DATABASE_ERROR", "Content could not be updated.", error);
  }
}

async function transition(context: AdminAuthorizationContext, id: string, target: ContentStatus, expectedVersion: number, reason?: string | null) {
  const result = await db.$transaction(async (tx) => {
    const current = await tx.contentItem.findUnique({ where: { id } });
    if (!current) throw new ContentError("NOT_FOUND", "Content was not found.");
    if (current.version !== expectedVersion) throw new ContentError("CONFLICT", "Content changed concurrently. Refresh before changing lifecycle.");
    if (!transitionAllowed(current.status, target)) throw new ContentError("INVALID_TRANSITION", "Content cannot transition from " + current.status + " to " + target + ".");
    const snapshot = snapshotFromRecord(current);
    if (target === "PUBLISHED") {
      await validateExternalReferences(snapshot);
      assertPublishWindow(snapshot);
    }
    if (target === "SCHEDULED") {
      if (!snapshot.publicationStartAt) throw new ContentError("INVALID_TRANSITION", "Scheduled content requires a publicationStartAt.");
      if (new Date(snapshot.publicationStartAt) <= new Date()) throw new ContentError("INVALID_TRANSITION", "Scheduled publication must be in the future.");
      await validateExternalReferences(snapshot);
    }
    const data: Prisma.ContentItemUpdateInput = { status: target, updatedByAdmin: { connect: { id: context.adminUser.id } } };
    if (target === "PUBLISHED") {
      data.publishedAt = new Date();
      data.publishedVersion = current.version;
      data.publishedBy = { connect: { id: context.adminUser.id } };
    }
    if (target === "UNPUBLISHED") data.publishedAt = null;
    if (target === "SCHEDULED") data.publishedAt = null;
    if (target === "DRAFT" && current.status === "PUBLISHED") data.publishedAt = null;
    const updated = await tx.contentItem.update({ where: { id }, data });
    await recordLifecycleAudit(context, "CONTENT_" + target, id, true, { from: current.status, to: target, version: current.version, reason }, tx);
    return { updated, snapshot };
  });
  await invalidateContentCaches(result.snapshot);
  incrementMetric("content_operations_total" as never, { operation: target.toLowerCase() });
  return result.updated;
}

export const submitContentForReview = (context: AdminAuthorizationContext, id: string, expectedVersion: number, reason?: string | null) => transition(context, id, "IN_REVIEW", expectedVersion, reason);
export const approveContent = (context: AdminAuthorizationContext, id: string, expectedVersion: number, reason?: string | null) => transition(context, id, "APPROVED", expectedVersion, reason);
export const rejectContent = (context: AdminAuthorizationContext, id: string, expectedVersion: number, reason?: string | null) => transition(context, id, "DRAFT", expectedVersion, reason);
export const publishContent = (context: AdminAuthorizationContext, id: string, expectedVersion: number, reason?: string | null) => transition(context, id, "PUBLISHED", expectedVersion, reason);
export const scheduleContent = (context: AdminAuthorizationContext, id: string, expectedVersion: number, reason?: string | null) => transition(context, id, "SCHEDULED", expectedVersion, reason);
export const unpublishContent = (context: AdminAuthorizationContext, id: string, expectedVersion: number, reason?: string | null) => transition(context, id, "UNPUBLISHED", expectedVersion, reason);
export const archiveContent = (context: AdminAuthorizationContext, id: string, expectedVersion: number, reason?: string | null) => transition(context, id, "ARCHIVED", expectedVersion, reason);

export async function rollbackContent(context: AdminAuthorizationContext, id: string, expectedVersion: number, targetRevisionVersion: number, reason?: string | null) {
  if (!Number.isInteger(targetRevisionVersion) || targetRevisionVersion < 1) throw new ContentError("INVALID_CONTENT", "A valid target revision is required.");
  const result = await db.$transaction(async (tx) => {
    const current = await tx.contentItem.findUnique({ where: { id } });
    if (!current) throw new ContentError("NOT_FOUND", "Content was not found.");
    if (current.version !== expectedVersion) throw new ContentError("CONFLICT", "Content changed concurrently. Refresh before rollback.");
    const revision = await tx.contentRevision.findUnique({ where: { contentId_version: { contentId: id, version: targetRevisionVersion } } });
    if (!revision) throw new ContentError("NOT_FOUND", "Target revision was not found.");
    const snapshot = validateContentInput(revision.snapshot as ContentInput);
    const nextVersion = current.version + 1;
    await validateExternalReferences(snapshot);
    await tx.contentItem.update({ where: { id }, data: { ...snapshot, body: snapshot.body, linkedReferences: snapshot.linkedReferences, version: nextVersion, status: "DRAFT", updatedByAdminId: context.adminUser.id } });
    await tx.contentRevision.create({ data: { id: randomUUID(), contentId: id, version: nextVersion, snapshot, changeSummary: "Rollback to revision " + targetRevisionVersion, createdByAdminId: context.adminUser.id } });
    await recordLifecycleAudit(context, "CONTENT_ROLLBACK", id, true, { fromVersion: expectedVersion, targetRevisionVersion, createdVersion: nextVersion, reason }, tx);
    return { snapshot, version: nextVersion };
  });
  await invalidateContentCaches(result.snapshot);
  return result.version;
}

export async function getPublishedContent(type: ContentType, slug: string, locale: SupportedLocale) {
  const item = await db.contentItem.findFirst({ where: { type, slug, locale, status: "PUBLISHED", OR: [{ publicationStartAt: null }, { publicationStartAt: { lte: new Date() } }], AND: [{ OR: [{ publicationEndAt: null }, { publicationEndAt: { gt: new Date() } }] }] }, orderBy: { version: "desc" } });
  if (!item || item.publishedVersion === null) return null;
  const revision = await db.contentRevision.findUnique({ where: { contentId_version: { contentId: item.id, version: item.publishedVersion } } });
  if (!revision) return null;
  return { item, snapshot: validateContentInput(revision.snapshot as ContentInput), version: revision.version };
}

export async function getPublicLandingPage(slug: string, locale: SupportedLocale) {
  return getPublishedContent("LANDING_PAGE", slug, locale);
}

export async function getContentPreview(id: string) {
  const item = await db.contentItem.findUnique({ where: { id } });
  if (!item) throw new ContentError("NOT_FOUND", "Content was not found.");
  return { item, snapshot: snapshotFromRecord(item) };
}

export async function processScheduledContent(limit = 50) {
  const bounded = Math.min(100, Math.max(1, Math.trunc(limit)));
  const now = new Date();
  const due = await db.contentItem.findMany({
    where: { OR: [
      { status: "SCHEDULED", publicationStartAt: { lte: now } },
      { status: "PUBLISHED", publicationEndAt: { lte: now } },
    ]},
    orderBy: [{ publicationStartAt: "asc" }, { id: "asc" }],
    take: bounded,
  });
  const results: Array<{ id: string; action: "PUBLISHED" | "UNPUBLISHED" | "SKIPPED" }> = [];
  for (const item of due) {
    const action = item.status === "SCHEDULED" ? "PUBLISHED" : "UNPUBLISHED";
    try {
      const snapshot = snapshotFromRecord(item);
      if (action === "PUBLISHED") {
        await validateExternalReferences(snapshot);
        assertPublishWindow(snapshot, now);
      }
      const updated = await db.contentItem.updateMany({
        where: { id: item.id, version: item.version, status: item.status },
        data: action === "PUBLISHED"
          ? { status: "PUBLISHED", publishedAt: now, publishedVersion: item.version, updatedByAdminId: item.updatedByAdminId }
          : { status: "UNPUBLISHED", publishedAt: null },
      });
      if (updated.count === 1) {
        await invalidateContentCaches(snapshot);
        results.push({ id: item.id, action });
      } else results.push({ id: item.id, action: "SKIPPED" });
    } catch {
      incrementMetric("content_operations_total" as never, { operation: action === "PUBLISHED" ? "scheduled_publish_failure" : "scheduled_unpublish_failure" });
      results.push({ id: item.id, action: "SKIPPED" });
    }
  }
  return results;
}

export function publicContentSnapshot(snapshot: ContentSnapshot) {
  return {
    type: snapshot.type, slug: snapshot.slug, locale: snapshot.locale, title: snapshot.title, summary: snapshot.summary,
    body: snapshot.body, seo: {
      title: snapshot.seoTitle ?? snapshot.title, description: snapshot.seoDescription ?? snapshot.summary ?? snapshot.title,
      canonicalUrl: snapshot.canonicalUrl, robots: snapshot.robots ?? "index,follow",
      openGraphTitle: snapshot.openGraphTitle ?? snapshot.seoTitle ?? snapshot.title,
      openGraphDescription: snapshot.openGraphDescription ?? snapshot.seoDescription ?? snapshot.summary ?? snapshot.title,
    },
  };
}
