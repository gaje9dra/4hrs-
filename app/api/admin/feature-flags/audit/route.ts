import { requireAdmin } from "@/lib/admin/authorization";
import { adminErrorResponse, adminJson } from "@/lib/admin/http";
import { db } from "@/lib/db/client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: Request) {
  try {
    await requireAdmin(request, "admin.audit.read");
    const url = new URL(request.url);
    const resourceType = url.searchParams.get("resourceType");
    if (resourceType && resourceType !== "FeatureFlag" && resourceType !== "Experiment") {
      return adminJson({ error: { code: "INVALID_REQUEST", message: "Unsupported audit resource type." } }, { status: 400 });
    }
    const limit = Math.min(Math.max(Number(url.searchParams.get("limit") ?? 50), 1), 100);
    const logs = await db.adminAuditLog.findMany({
      where: {
        resourceType: resourceType ?? { in: ["FeatureFlag", "Experiment"] },
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: Number.isFinite(limit) ? limit : 50,
      select: {
        id: true,
        actorAdminId: true,
        action: true,
        resourceType: true,
        resourceId: true,
        success: true,
        reason: true,
        correlationId: true,
        metadata: true,
        createdAt: true,
      },
    });
    return adminJson({ audit: logs });
  } catch (error) {
    return adminErrorResponse(error);
  }
}
