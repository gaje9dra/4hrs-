import { assertSameOrigin, authErrorResponse } from "@/lib/auth/http";
import { adminErrorResponse } from "@/lib/admin/http";
import { AdminError } from "@/lib/admin/errors";
import { requireAdmin } from "@/lib/admin/authorization";
import { ContentError, createContent, listContent, type ContentInput } from "@/lib/content/service";
import { type ContentStatus, type ContentType } from "@prisma/client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function json(data: unknown, status = 200) {
  return Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
}
const CONTENT_TYPES: readonly ContentType[] = ["HOMEPAGE_SECTION","LANDING_PAGE","COLLECTION_PAGE","CATEGORY_EDITORIAL","PRODUCT_EDITORIAL","PROMOTIONAL_BANNER","CONTENT_BLOCK"];
const CONTENT_STATUSES: readonly ContentStatus[] = ["DRAFT","IN_REVIEW","APPROVED","SCHEDULED","PUBLISHED","UNPUBLISHED","ARCHIVED"];
function isType(value: string | null): value is ContentType { return value !== null && CONTENT_TYPES.includes(value as ContentType); }
function isStatus(value: string | null): value is ContentStatus { return value !== null && CONTENT_STATUSES.includes(value as ContentStatus); }

export async function GET(request: Request) {
  try {
    const context = await requireAdmin(request, "content.read");
    const url = new URL(request.url);
    const statusParam = url.searchParams.get("status");
    const typeParam = url.searchParams.get("type");
    const status = isStatus(statusParam) ? statusParam : undefined;
    const type = isType(typeParam) ? typeParam : undefined;
    const result = await listContent({
      status,
      type,
      locale: url.searchParams.get("locale") ?? undefined,
      slug: url.searchParams.get("slug") ?? undefined,
      search: url.searchParams.get("search") ?? undefined,
      limit: Number(url.searchParams.get("limit") ?? 25),
      offset: Number(url.searchParams.get("offset") ?? 0),
    });
    return json({ ...result, permissions: [...context.permissions].filter((p) => p.startsWith("content.")) });
  } catch (error) {
    if (error instanceof AdminError) return adminErrorResponse(error);
    return authErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const context = await requireAdmin(request, "content.create");
    assertSameOrigin(request);
    const body = await request.json() as ContentInput;
    return json({ content: await createContent(context, body) }, 201);
  } catch (error) {
    if (error instanceof AdminError) return adminErrorResponse(error);
    if (error instanceof ContentError) return json({ error: { code: error.code, message: error.message, details: error.details } }, error.code === "CONFLICT" ? 409 : 400);
    return authErrorResponse(error);
  }
}