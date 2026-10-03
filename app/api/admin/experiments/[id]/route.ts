import { requireAdmin, requireHighRiskReason } from "@/lib/admin/authorization";
import { adminErrorResponse, adminJson, assertAdminSameOrigin, readAdminJson, isValidAdminId } from "@/lib/admin/http";
import { auditAdminAction } from "@/lib/admin/audit";
import { getExperiment, updateExperiment } from "@/lib/feature-flags/service";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin(request, "experiments.read");
    const { id } = await params;
    if (!isValidAdminId(id)) return adminJson({ error: { code: "INVALID_REQUEST", message: "Experiment identifier is invalid." } }, { status: 400 });
    const experiment = await getExperiment(id);
    if (!experiment) return adminJson({ error: { code: "NOT_FOUND", message: "Experiment was not found." } }, { status: 404 });
    return adminJson({ experiment });
  } catch (error) {
    return adminErrorResponse(error);
  }
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  let context;
  try {
    context = await requireAdmin(request, "experiments.manage");
    assertAdminSameOrigin(request);
    const { id } = await params;
    if (!isValidAdminId(id)) return adminJson({ error: { code: "INVALID_REQUEST", message: "Experiment identifier is invalid." } }, { status: 400 });
    const body = await readAdminJson(request);
    if (!Number.isInteger(body.expectedVersion) || body.expectedVersion < 1) {
      return adminJson({ error: { code: "INVALID_REQUEST", message: "A valid expectedVersion is required." } }, { status: 400 });
    }
    const reason = typeof body.reason === "string" ? body.reason : null;
    if (body.environment === "PRODUCTION" && (body.status === "ACTIVE" || body.startAt !== undefined)) requireHighRiskReason(reason);
    const experiment = await updateExperiment(id, body.expectedVersion, body);
    await auditAdminAction(context, {
      action: "EXPERIMENT_UPDATED",
      resourceType: "Experiment",
      resourceId: experiment.id,
      success: true,
      reason,
      requestId: request.headers.get("x-request-id"),
      metadata: { key: experiment.key, environment: experiment.environment, status: experiment.status, version: experiment.version },
    });
    return adminJson({ experiment });
  } catch (error) {
    if (context) await auditAdminAction(context, {
      action: "EXPERIMENT_UPDATE_FAILED",
      resourceType: "Experiment",
      success: false,
      reason: error instanceof Error ? error.message : "Experiment update failed",
      requestId: request.headers.get("x-request-id"),
    }).catch(() => undefined);
    return adminErrorResponse(error);
  }
}
