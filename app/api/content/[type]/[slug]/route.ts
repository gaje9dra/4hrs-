import { type ContentType } from "@prisma/client";
import { resolveRequestLocale } from "@/lib/i18n/resolution";
import { ContentError, getPublishedContent, publicContentSnapshot, resolvePublishedMedia } from "@/lib/content/service";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function isContentType(value: string): value is ContentType {
  return ["HOMEPAGE_SECTION","LANDING_PAGE","COLLECTION_PAGE","CATEGORY_EDITORIAL","PRODUCT_EDITORIAL","PROMOTIONAL_BANNER","CONTENT_BLOCK"].includes(value);
}

export async function GET(_request: Request, { params }: { params: Promise<{ type: string; slug: string }> }) {
  const { type, slug } = await params;
  if (!isContentType(type)) return Response.json({ error: { code: "NOT_FOUND", message: "Content was not found." } }, { status: 404 });
  const locale = await resolveRequestLocale();
  const result = await getPublishedContent(type, slug, locale);
  if (!result) return Response.json({ error: { code: "NOT_FOUND", message: "Content was not found." } }, { status: 404, headers: { "Cache-Control": "no-store" } });
  const media = await resolvePublishedMedia(result.snapshot);
  return Response.json({ content: publicContentSnapshot(result.snapshot), media: Object.fromEntries(media) }, { headers: { "Cache-Control": "public, max-age=60, stale-while-revalidate=300", "Vary": "Accept-Language, Cookie" } });
}