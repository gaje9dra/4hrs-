import { db } from "@/lib/db/client";
import type { ContentStatus, ContentType } from "@prisma/client";

export type ContentQualitySeverity = "INFO" | "WARNING" | "ERROR";
export type ContentQualityFinding = {
  contentId: string;
  title: string;
  type: ContentType;
  locale: string;
  status: ContentStatus;
  code: string;
  severity: ContentQualitySeverity;
  message: string;
};

export async function getContentQualityDiagnostics(options: { limit?: number } = {}): Promise<ContentQualityFinding[]> {
  const limit = Math.min(200, Math.max(1, Math.trunc(options.limit ?? 100)));
  const items = await db.contentItem.findMany({
    orderBy: { updatedAt: "asc" },
    take: limit,
    select: {
      id: true, title: true, type: true, locale: true, status: true, version: true,
      seoTitle: true, seoDescription: true, publicationEndAt: true, updatedAt: true,
      translationStatus: true, sourceVersion: true, publishedVersion: true,
      mediaReferences: true, linkedReferences: true,
    },
  });
  const findings: ContentQualityFinding[] = [];
  const now = Date.now();
  for (const item of items) {
    const add = (code: string, severity: ContentQualitySeverity, message: string) => findings.push({ contentId: item.id, title: item.title, type: item.type, locale: item.locale, status: item.status, code, severity, message });
    if (item.status === "PUBLISHED" && !item.seoTitle) add("MISSING_SEO_TITLE", "WARNING", "Published content has no explicit SEO title and relies on its editorial title.");
    if (item.status === "PUBLISHED" && !item.seoDescription) add("MISSING_SEO_DESCRIPTION", "WARNING", "Published content has no explicit SEO description and relies on summary/title fallback.");
    if (item.translationStatus === "STALE") add("STALE_TRANSLATION", "WARNING", "Translation is behind its source content version.");
    if (item.status === "PUBLISHED" && item.publicationEndAt && item.publicationEndAt.getTime() <= now) add("EXPIRED_PUBLICATION_WINDOW", "ERROR", "Publication window has expired and requires unpublication processing.");
    if (item.status === "SCHEDULED" && item.publicationEndAt && item.publicationEndAt <= new Date()) add("INVALID_SCHEDULE_WINDOW", "ERROR", "Scheduled content has an expiration before its activation window.");
    if (now - item.updatedAt.getTime() > 180 * 24 * 60 * 60 * 1000) add("STALE_CONTENT", "INFO", "Content has not been updated for more than 180 days.");
    if (item.mediaReferences.length > 0) {
      const mediaCount = await db.productImage.count({ where: { id: { in: item.mediaReferences } } });
      if (mediaCount !== item.mediaReferences.length) add("BROKEN_MEDIA_REFERENCE", "ERROR", "One or more canonical media references no longer exist.");
    }
    if (Array.isArray(item.linkedReferences)) {
      const references = item.linkedReferences.filter((value): value is { type: string; id: string } => Boolean(value) && typeof value === "object" && !Array.isArray(value) && typeof (value as { type?: unknown }).type === "string" && typeof (value as { id?: unknown }).id === "string");
      for (const reference of references) {
        if (reference.type === "PRODUCT") {
          const exists = await db.product.findUnique({ where: { id: reference.id }, select: { status: true } });
          if (!exists || exists.status !== "ACTIVE") add("BROKEN_PRODUCT_REFERENCE", "ERROR", "A referenced product is missing or not active.");
        }
        if (reference.type === "CATEGORY") {
          const exists = await db.category.findUnique({ where: { id: reference.id }, select: { status: true } });
          if (!exists || exists.status !== "ACTIVE") add("BROKEN_CATEGORY_REFERENCE", "ERROR", "A referenced category is missing or not active.");
        }
        if (reference.type === "COLLECTION") {
          const exists = await db.collection.findUnique({ where: { id: reference.id }, select: { status: true } });
          if (!exists || exists.status !== "ACTIVE") add("BROKEN_COLLECTION_REFERENCE", "ERROR", "A referenced collection is missing or not active.");
        }
      }
    }
  }
  return findings;
}
