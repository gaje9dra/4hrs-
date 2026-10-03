import { requireAdmin, requireHighRiskReason } from "@/lib/admin/authorization";
import { auditAdminAction } from "@/lib/admin/audit";
import { adminErrorResponse, adminJson } from "@/lib/admin/http";
import { db } from "@/lib/db/client";
import { CommunicationPreferenceError, getCustomerCommunicationPreferences, updateCustomerCommunicationPreference } from "@/lib/communications/preferences";
import { consumeCommunicationRateLimit } from "@/lib/communications/rate-limit";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: Request, { params }: { params: Promise<{ customerId: string }> }) {
  let context;
  try {
    context = await requireAdmin(request, "communication.preference.read");
    const { customerId } = await params;
    const preferences = await getCustomerCommunicationPreferences(customerId);
    const audit = context.permissions.has("communication.preference.audit.read")
      ? await db.customerCommunicationPreferenceAudit.findMany({
          where: { customerId },
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          take: 100,
          select: { category: true, channel: true, previousState: true, newState: true, source: true, actorType: true, correlationId: true, reason: true, createdAt: true },
        })
      : null;
    await auditAdminAction(context, { action: "CUSTOMER_COMMUNICATION_PREFERENCE_READ", resourceType: "Customer", resourceId: customerId, success: true, reason: "Authorized communication preference access" });
    return adminJson({ preferences, audit: audit?.map((item) => ({ ...item, createdAt: item.createdAt.toISOString() })) ?? null });
  } catch (error) {
    if (context) await auditAdminAction(context, { action: "CUSTOMER_COMMUNICATION_PREFERENCE_READ_FAILED", resourceType: "Customer", success: false, reason: "Communication preference access failed", metadata: { error: error instanceof Error ? error.name : "unknown" } }).catch(() => undefined);
    return adminErrorResponse(error);
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ customerId: string }> }) {
  let context;
  try {
    context = await requireAdmin(request, "communication.preference.manage");
    const { customerId } = await params;
    consumeCommunicationRateLimit(customerId, request, 20, 60 * 60 * 1000);
    const { readAuthJson } = await import("@/lib/auth/http");
    const body = await readAuthJson(request);
    const reason = requireHighRiskReason(body.reason);
    if (body.state === "OPTED_IN" && body.basis !== "CUSTOMER_REQUEST") {
      throw new CommunicationPreferenceError("PREFERENCE_DATABASE_ERROR", "Administrative opt-in requires an explicitly recorded customer-request basis.");
    }
    const preference = await updateCustomerCommunicationPreference({
      customerId,
      category: body.category,
      channel: body.channel,
      state: body.state,
      expectedVersion: body.expectedVersion,
      idempotencyKey: body.idempotencyKey,
      source: "ADMIN",
      actorType: "ADMIN",
      correlationId: request.headers.get("x-request-id"),
      reason,
    });
    await auditAdminAction(context, {
      action: "CUSTOMER_COMMUNICATION_PREFERENCE_CHANGED",
      resourceType: "Customer",
      resourceId: customerId,
      success: true,
      reason,
      metadata: { category: body.category, channel: body.channel, state: body.state, basis: body.basis ?? null },
    });
    return adminJson({ preference });
  } catch (error) {
    if (context) await auditAdminAction(context, { action: "CUSTOMER_COMMUNICATION_PREFERENCE_CHANGE_FAILED", resourceType: "Customer", success: false, reason: "Communication preference change failed", metadata: { error: error instanceof Error ? error.name : "unknown" } }).catch(() => undefined);
    return adminErrorResponse(error);
  }
}
