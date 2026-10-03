import { requireAdmin, requireHighRiskReason } from "@/lib/admin/authorization";
import { adminErrorResponse, adminJson, assertAdminSameOrigin, readAdminJson } from "@/lib/admin/http";
import { auditAdminAction } from "@/lib/admin/audit";
import { createMerchandisingRule, listMerchandisingRules } from "@/lib/discovery/merchandising";
import type { FeatureFlagEnvironment } from "@prisma/client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const ENVIRONMENTS = new Set<FeatureFlagEnvironment>(["DEVELOPMENT","TEST","STAGING","PRODUCTION"]);

export async function GET(request: Request) {
  try {
    await requireAdmin(request, "merchandising.read");
    const raw = new URL(request.url).searchParams.get("environment");
    const environment = raw ? raw as FeatureFlagEnvironment : undefined;
    if (environment && !ENVIRONMENTS.has(environment)) return adminJson({ error: { code: "INVALID_REQUEST", message: "Environment is invalid." } }, { status: 400 });
    return adminJson({ rules: await listMerchandisingRules(environment) });
  } catch (error) {
    return adminErrorResponse(error);
  }
}

export async function POST(request: Request) {
  let context;
  try {
    context = await requireAdmin(request, "merchandising.manage");
    assertAdminSameOrigin(request);
    const body = await readAdminJson(request);
    const reason = typeof body.reason === "string" ? body.reason : null;
    if (body.environment === "PRODUCTION" && body.active === true) requireHighRiskReason(reason);
    const rule = await createMerchandisingRule({
      name: body.name, description: body.description, environment: body.environment, action: body.action, scope: body.scope,
      scopeValue: body.scopeValue, productId: body.productId, locale: body.locale, priority: body.priority, active: body.active,
      startAt: body.startAt, endAt: body.endAt,
    });
    await auditAdminAction(context, {
      action: "MERCHANDISING_RULE_CREATED",
      resourceType: "MerchandisingRule",
      resourceId: rule.id,
      success: true,
      reason,
      requestId: request.headers.get("x-request-id"),
      metadata: { action: rule.action, scope: rule.scope, priority: rule.priority, environment: rule.environment, active: rule.active },
    });
    return adminJson({ rule }, { status: 201 });
  } catch (error) {
    if (context) await auditAdminAction(context, {
      action: "MERCHANDISING_RULE_CREATE_FAILED",
      resourceType: "MerchandisingRule",
      success: false,
      reason: error instanceof Error ? error.message : "Merchandising rule creation failed",
      requestId: request.headers.get("x-request-id"),
    }).catch(() => undefined);
    return adminErrorResponse(error);
  }
}
