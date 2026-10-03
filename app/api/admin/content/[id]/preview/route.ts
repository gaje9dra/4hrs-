import { authErrorResponse } from "@/lib/auth/http";
import { adminErrorResponse } from "@/lib/admin/http";
import { AdminError } from "@/lib/admin/errors";
import { requireAdmin } from "@/lib/admin/authorization";
import { ContentError, getContentPreview, publicContentSnapshot, resolvePublishedMedia } from "@/lib/content/service";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await requireAdmin(request, "content.preview");
    const { id } = await params;
    const result = await getContentPreview(id);
    const media = await resolvePublishedMedia(result.snapshot);
    return Response.json({ ...publicContentSnapshot(result.snapshot), media: Object.fromEntries(media), preview: true }, { headers: { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow" } });
  } catch (error) {
    if (error instanceof AdminError) return adminErrorResponse(error);
    if (error instanceof ContentError) return Response.json({ error: { code: error.code, message: error.message } }, { status: 404 });
    return authErrorResponse(error);
  }
}