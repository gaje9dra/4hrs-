import { requireAdmin } from "@/lib/admin/authorization";
import { getAdminUser, updateAdminUser } from "@/lib/admin/application";
import { adminErrorResponse, adminJson, assertAdminSameOrigin, isValidAdminId, readAdminJson } from "@/lib/admin/http";
import { consumeAdminRateLimit } from "@/lib/admin/rate-limit";
import { requireHighRiskReason } from "@/lib/admin/authorization";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: Request, { params }: { params: Promise<{ adminId: string }> }) {
  try {
    await requireAdmin(request, "admin.users.read");
    const id = (await params).adminId.trim();
    if (!isValidAdminId(id)) return adminJson({ error: { code: "INVALID_REQUEST", message: "Administrator ID is invalid." } }, { status: 400 });
    return adminJson({ adminUser: await getAdminUser(id) });
  } catch (error) { return adminErrorResponse(error); }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ adminId: string }> }) {
  try {
    const context = await requireAdmin(request, "admin.users.manage");
    consumeAdminRateLimit(context.adminUser.id);
    assertAdminSameOrigin(request);
    const id = (await params).adminId.trim();
    if (!isValidAdminId(id)) return adminJson({ error: { code: "INVALID_REQUEST", message: "Administrator ID is invalid." } }, { status: 400 });
    const body = await readAdminJson(request);
    requireHighRiskReason(body.reason);
    return adminJson({
      adminUser: await updateAdminUser(context, {
        id,
        expectedVersion: body.expectedVersion,
        status: body.status,
        roles: body.roles,
        reason: body.reason,
      }),
    });
  } catch (error) { return adminErrorResponse(error); }
}
