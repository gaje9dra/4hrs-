import { authErrorResponse } from "@/lib/auth/http";
import { adminErrorResponse } from "@/lib/admin/http";
import { AdminError } from "@/lib/admin/errors";
import { requireAdmin } from "@/lib/admin/authorization";
import { getContentQualityDiagnostics } from "@/lib/content/quality";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: Request) {
  try {
    await requireAdmin(request, "content.read");
    const limit = Number(new URL(request.url).searchParams.get("limit") ?? 100);
    const findings = await getContentQualityDiagnostics({ limit });
    return Response.json({ findings }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof AdminError) return adminErrorResponse(error);
    return authErrorResponse(error);
  }
}
