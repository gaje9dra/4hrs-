import { NextResponse } from "next/server";
import { requireAdmin, requireHighRiskReason } from "@/lib/admin/authorization";
import { adminErrorResponse, adminJson, assertAdminSameOrigin, readAdminJson } from "@/lib/admin/http";
import { auditAdminAction } from "@/lib/admin/audit";
import { createFeatureFlag, listFeatureFlags, normalizeEnvironment } from "@/lib/feature-flags/service";
import type { FeatureFlagEnvironment } from "@prisma/client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: Request) {
  try {
    const context = await requireAdmin(request, "feature_flags.read");
    const url = new URL(request.url);
    const rawEnvironment = url.searchParams.get("environment");
    const environment = rawEnvironment ? normalizeEnvironment(rawEnvironment) : undefined;
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
    const featureFlag = await createFeatureFlag(body);
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
