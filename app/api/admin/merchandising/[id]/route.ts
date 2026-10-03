import { requireAdmin, requireHighRiskReason } from "@/lib/admin/authorization";
import { adminErrorResponse, adminJson, assertAdminSameOrigin, readAdminJson, isValidAdminId } from "@/lib/admin/http";
import { auditAdminAction } from "@/lib/admin/audit";
import { getMerchandisingRule, updateMerchandisingRule } from "@/lib/discovery/merchandising";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin(request, "merchandising.read");
    const { id } = await params;
    if (!isValidAdminId(id)) return adminJson({ error: { code: "INVALID_REQUEST", message: "Rule identifier is invalid." } }, { status: 400 });
    const rule = await getMerchandisingRule(id);
    if (!rule) return adminJson({ error: { code: "NOT_FOUND", message: "Merchandising rule was not found." } }, { status: 404 });
    return adminJson({ rule });
  } catch (error) {
    return adminErrorResponse(error);
  }
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  let context;
  try {
    context = await requireAdmin(request, "merchandising.manage");
    assertAdminSameOrigin(request);
    const { id } = await params;
    if (!isValidAdminId(id)) return adminJson({ error: { code: "INVALID_REQUEST", message: "Rule identifier is invalid." } }, { status: 400 });
    const body = await readAdminJson(request);
    if (typeof body.expectedVersion !== "number" || !Number.isInteger(body.expectedVersion) || body.expectedVersion < 1) {
      return adminJson({ error: { code: "INVALID_REQUEST", message: "A valid expectedVersion is required." } }, { status: 400 });
    }
    const reason = typeof body.reason === "string" ? body.reason : null;
    if (body.environment === "PRODUCTION" && body.active === true) requireHighRiskReason(reason);
    const rule = await updateMerchandisingRule(id, body.expectedVersion, {
      name: body.name, description: body.description, environment: body.environment, action: body.action, scope: body.scope,
      scopeValue: body.scopeValue, productId: body.productId, locale: body.locale, priority: body.priority, active: body.active,
      startAt: body.startAt, endAt: body.endAt,
    });
    await auditAdminAction(context, {
      action: "MERCHANDISING_RULE_UPDATED",
      resourceType: "MerchandisingRule",
      resourceId: rule.id,
      success: true,
      reason,
      requestId: request.headers.get("x-request-id"),
      metadata: { action: rule.action, scope: rule.scope, priority: rule.priority, environment: rule.environment, active: rule.active, version: rule.version },
    });
    return adminJson({ rule });
  } catch (error) {
    if (context) await auditAdminAction(context, {
      action: "MERCHANDISING_RULE_UPDATE_FAILED",
      resourceType: "MerchandisingRule",
      success: false,
      reason: error instanceof Error ? error.message : "Merchandising rule update failed",
      requestId: request.headers.get("x-request-id"),
    }).catch(() => undefined);
    return adminErrorResponse(error);
  }
}
