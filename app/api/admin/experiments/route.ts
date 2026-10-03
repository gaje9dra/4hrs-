import { requireAdmin, requireHighRiskReason } from "@/lib/admin/authorization";
import { adminErrorResponse, adminJson, assertAdminSameOrigin, readAdminJson } from "@/lib/admin/http";
import { auditAdminAction } from "@/lib/admin/audit";
import { createExperiment, listExperiments } from "@/lib/feature-flags/service";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: Request) {
  try {
    await requireAdmin(request, "experiments.read");
    const url = new URL(request.url);
    const rawEnvironment = url.searchParams.get("environment");
    const environment = rawEnvironment
      ? (["DEVELOPMENT","TEST","STAGING","PRODUCTION"] as const).find((value) => value === rawEnvironment)
      : undefined;
    if (rawEnvironment && !environment) return adminJson({ error: { code: "INVALID_REQUEST", message: "Experiment environment is invalid." } }, { status: 400 });
    return adminJson({ experiments: await listExperiments(environment) });
  } catch (error) {
    return adminErrorResponse(error);
  }
}

export async function POST(request: Request) {
  let context;
  try {
    context = await requireAdmin(request, "experiments.manage");
    assertAdminSameOrigin(request);
    const body = await readAdminJson(request);
    const reason = typeof body.reason === "string" ? body.reason : null;
    if (body.environment === "PRODUCTION" && body.status === "ACTIVE") requireHighRiskReason(reason);
    const experiment = await createExperiment({
      key: body.key,
      name: body.name,
      description: body.description,
      environment: body.environment,
      status: body.status,
      startAt: body.startAt,
      endAt: body.endAt,
      primaryMetricEvent: body.primaryMetricEvent,
      variants: body.variants,
    });
    await auditAdminAction(context, {
      action: "EXPERIMENT_CREATED",
      resourceType: "Experiment",
      resourceId: experiment.id,
      success: true,
      reason,
      requestId: request.headers.get("x-request-id"),
      metadata: { key: experiment.key, environment: experiment.environment, status: experiment.status, version: experiment.version },
    });
    return adminJson({ experiment }, { status: 201 });
  } catch (error) {
    if (context) await auditAdminAction(context, {
      action: "EXPERIMENT_CREATE_FAILED",
      resourceType: "Experiment",
      success: false,
      reason: error instanceof Error ? error.message : "Experiment creation failed",
      requestId: request.headers.get("x-request-id"),
    }).catch(() => undefined);
    return adminErrorResponse(error);
  }
}
