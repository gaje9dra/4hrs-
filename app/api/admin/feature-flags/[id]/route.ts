import { requireAdmin, requireHighRiskReason } from "@/lib/admin/authorization";
import { adminErrorResponse, adminJson, assertAdminSameOrigin, readAdminJson, isValidAdminId } from "@/lib/admin/http";
import { auditAdminAction } from "@/lib/admin/audit";
import { getFeatureFlag, updateFeatureFlag } from "@/lib/feature-flags/service";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await requireAdmin(request, "feature_flags.read");
    const { id } = await params;
    if (!isValidAdminId(id)) return adminJson({ error: { code: "INVALID_REQUEST", message: "Feature flag identifier is invalid." } }, { status: 400 });
    const featureFlag = await getFeatureFlag(id);
    if (!featureFlag) return adminJson({ error: { code: "NOT_FOUND", message: "Feature flag was not found." } }, { status: 404 });
    return adminJson({ featureFlag });
  } catch (error) {
    return adminErrorResponse(error);
  }
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  let context;
  try {
    context = await requireAdmin(request, "feature_flags.manage");
    assertAdminSameOrigin(request);
    const { id } = await params;
    if (!isValidAdminId(id)) return adminJson({ error: { code: "INVALID_REQUEST", message: "Feature flag identifier is invalid." } }, { status: 400 });
    const body = await readAdminJson(request);
    if (!Number.isInteger(body.expectedVersion) || body.expectedVersion < 1) {
      return adminJson({ error: { code: "INVALID_REQUEST", message: "A valid expectedVersion is required." } }, { status: 400 });
    }
    const reason = typeof body.reason === "string" ? body.reason : null;
    if (body.environment === "PRODUCTION" && (body.lifecycle === "ACTIVE" || body.rolloutPercentage !== undefined)) requireHighRiskReason(reason);
    const featureFlag = await updateFeatureFlag(id, body.expectedVersion, body);
    await auditAdminAction(context, {
      action: "FEATURE_FLAG_UPDATED",
      resourceType: "FeatureFlag",
      resourceId: featureFlag.id,
      success: true,
      reason,
      requestId: request.headers.get("x-request-id"),
      metadata: { key: featureFlag.key, environment: featureFlag.environment, lifecycle: featureFlag.lifecycle, rolloutPercentage: featureFlag.rolloutPercentage, version: featureFlag.version },
    });
    return adminJson({ featureFlag });
  } catch (error) {
    if (context) {
      await auditAdminAction(context, {
        action: "FEATURE_FLAG_UPDATE_FAILED",
        resourceType: "FeatureFlag",
        success: false,
        reason: error instanceof Error ? error.message : "Feature flag update failed",
        requestId: request.headers.get("x-request-id"),
      }).catch(() => undefined);
    }
    return adminErrorResponse(error);
  }
}
