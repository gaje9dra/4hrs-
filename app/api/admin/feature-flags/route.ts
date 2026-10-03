import { requireAdmin, requireHighRiskReason } from "@/lib/admin/authorization";
import { adminErrorResponse, adminJson, assertAdminSameOrigin, readAdminJson } from "@/lib/admin/http";
import { auditAdminAction } from "@/lib/admin/audit";
import { createFeatureFlag, listFeatureFlags  } from "@/lib/feature-flags/service";
import type { FeatureFlagEnvironment } from "@prisma/client";
const ENVIRONMENTS = new Set<FeatureFlagEnvironment>(["DEVELOPMENT","TEST","STAGING","PRODUCTION"]);

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: Request) {
  try {
    await requireAdmin(request, "feature_flags.read");
    const url = new URL(request.url);
    const rawEnvironment = url.searchParams.get("environment");
    const environment = rawEnvironment ? rawEnvironment as FeatureFlagEnvironment : undefined;
    if (environment && !ENVIRONMENTS.has(environment)) return adminJson({ error: { code: "INVALID_REQUEST", message: "Feature flag environment is invalid." } }, { status: 400 });
    return adminJson({ featureFlags: await listFeatureFlags(environment as FeatureFlagEnvironment | undefined) });
  } catch (error) {
    return adminErrorResponse(error);
  }
}

export async function POST(request: Request) {
  let context;
  try {
    context = await requireAdmin(request, "feature_flags.manage");
    assertAdminSameOrigin(request);
    const body = await readAdminJson(request);
    const reason = typeof body.reason === "string" ? body.reason : null;
    if (body.environment === "PRODUCTION" && body.lifecycle === "ACTIVE") requireHighRiskReason(reason);
    const featureFlag = await createFeatureFlag({
      key: body.key,
      name: body.name,
      description: body.description,
      type: body.type,
      lifecycle: body.lifecycle,
      environment: body.environment,
      defaultEnabled: body.defaultEnabled,
      defaultVariantKey: body.defaultVariantKey,
      rolloutPercentage: body.rolloutPercentage,
      expiresAt: body.expiresAt,
      variants: body.variants,
    });
    await auditAdminAction(context, {
      action: "FEATURE_FLAG_CREATED",
      resourceType: "FeatureFlag",
      resourceId: featureFlag.id,
      success: true,
      reason,
      requestId: request.headers.get("x-request-id"),
      metadata: {
        key: featureFlag.key,
        environment: featureFlag.environment,
        lifecycle: featureFlag.lifecycle,
        rolloutPercentage: featureFlag.rolloutPercentage,
        version: featureFlag.version,
      },
    });
    return adminJson({ featureFlag }, { status: 201 });
  } catch (error) {
    if (context) {
      await auditAdminAction(context, {
        action: "FEATURE_FLAG_CREATE_FAILED",
        resourceType: "FeatureFlag",
        success: false,
        reason: error instanceof Error ? error.message : "Feature flag creation failed",
        requestId: request.headers.get("x-request-id"),
      }).catch(() => undefined);
    }
    return adminErrorResponse(error);
  }
}
