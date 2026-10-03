import { type ContentType } from "@prisma/client";
import { resolveRequestLocale } from "@/lib/i18n/resolution";
import { getPublishedContent, publicContentSnapshot, resolvePublishedMedia, resolvePublishedReferenceLinks } from "@/lib/content/service";
import { apiResponse, API_CLASSIFICATIONS } from "@/lib/api/governance";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function isContentType(value: string): value is ContentType {
  return ["HOMEPAGE_SECTION","LANDING_PAGE","COLLECTION_PAGE","CATEGORY_EDITORIAL","PRODUCT_EDITORIAL","PROMOTIONAL_BANNER","CONTENT_BLOCK"].includes(value);
}

export async function GET(request: Request, { params }: { params: Promise<{ type: string; slug: string }> }) {
  const { type, slug } = await params;
  if (!isContentType(type)) {
    return apiResponse({ error: { code: "NOT_FOUND", message: "Content was not found." } }, request, { status: 404 }, { ...API_CLASSIFICATIONS.PUBLIC_STOREFRONT, cache: "no-store" });
  }
  const locale = await resolveRequestLocale();
  const result = await getPublishedContent(type, slug, locale);
  if (!result) {
    return apiResponse({ error: { code: "NOT_FOUND", message: "Content was not found." } }, request, { status: 404 }, { ...API_CLASSIFICATIONS.PUBLIC_STOREFRONT, cache: "no-store" });
  }
  const [media, links] = await Promise.all([resolvePublishedMedia(result.snapshot), resolvePublishedReferenceLinks(result.snapshot)]);
  return apiResponse(
    { content: publicContentSnapshot(result.snapshot), media: Object.fromEntries(media), links: Object.fromEntries(links) },
    request,
    { headers: { "Cache-Control": "public, max-age=60, stale-while-revalidate=300", "Vary": "Accept-Language, Cookie" } },
    API_CLASSIFICATIONS.PUBLIC_STOREFRONT,
  );
}
