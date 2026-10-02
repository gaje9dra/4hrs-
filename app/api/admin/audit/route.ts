import { requireAdmin } from "@/lib/admin/authorization";
import { listAdminAudit } from "@/lib/admin/application";
import { adminErrorResponse, adminJson, isValidAdminId } from "@/lib/admin/http";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: Request) {
  try {
    await requireAdmin(request, "admin.audit.read");
    const q = new URL(request.url).searchParams;
    const raw = Number(q.get("limit") ?? "50");
    if (!Number.isInteger(raw) || raw < 1 || raw > 100) {
      return adminJson({ error: { code: "INVALID_REQUEST", message: "Limit is invalid." } }, { status: 400 });
    }
    const cursor = q.get("cursor") ?? undefined;
    if (cursor && !isValidAdminId(cursor)) {
      return adminJson({ error: { code: "INVALID_REQUEST", message: "Cursor is invalid." } }, { status: 400 });
    }
    return adminJson(await listAdminAudit(raw, cursor));
  } catch (error) { return adminErrorResponse(error); }
}
