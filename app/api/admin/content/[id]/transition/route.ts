import { assertSameOrigin, authErrorResponse } from "@/lib/auth/http";
import { adminErrorResponse } from "@/lib/admin/http";
import { AdminError } from "@/lib/admin/errors";
import { requireAdmin, requireHighRiskReason } from "@/lib/admin/authorization";
import {
  ContentError, approveContent, archiveContent, publishContent, rejectContent, rollbackContent,
  scheduleContent, submitContentForReview, unpublishContent,
} from "@/lib/content/service";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function json(data: unknown, status = 200) { return Response.json(data, { status, headers: { "Cache-Control": "no-store" } }); }

const permissions: Record<string, "content.review"|"content.approve"|"content.publish"|"content.schedule"|"content.rollback"|"content.archive"> = {
  submit_review: "content.review", reject: "content.review", approve: "content.approve",
  publish: "content.publish", unpublish: "content.publish", schedule: "content.schedule",
  rollback: "content.rollback", archive: "content.archive",
};

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const body = await request.json() as { action?: unknown; expectedVersion?: unknown; targetRevisionVersion?: unknown; reason?: unknown };
    const action = typeof body.action === "string" ? body.action : "";
    const permission = permissions[action];
    if (!permission) return json({ error: { code: "INVALID_REQUEST", message: "Unsupported content transition." } }, 400);
    const context = await requireAdmin(request, permission);
    if (!Number.isInteger(body.expectedVersion)) return json({ error: { code: "INVALID_REQUEST", message: "expectedVersion is required." } }, 400);
    const id = (await params).id;
    const reason = ["publish","unpublish","schedule","rollback","archive"].includes(action) ? requireHighRiskReason(body.reason) : (typeof body.reason === "string" ? body.reason : null);
    let content;
    if (action === "submit_review") content = await submitContentForReview(context, id, body.expectedVersion, reason);
    else if (action === "approve") content = await approveContent(context, id, body.expectedVersion, reason);
    else if (action === "reject") content = await rejectContent(context, id, body.expectedVersion, reason);
    else if (action === "publish") content = await publishContent(context, id, body.expectedVersion, reason);
    else if (action === "unpublish") content = await unpublishContent(context, id, body.expectedVersion, reason);
    else if (action === "schedule") content = await scheduleContent(context, id, body.expectedVersion, reason);
    else if (action === "archive") content = await archiveContent(context, id, body.expectedVersion, reason);
    else {
      if (!Number.isInteger(body.targetRevisionVersion)) return json({ error: { code: "INVALID_REQUEST", message: "targetRevisionVersion is required for rollback." } }, 400);
      content = await rollbackContent(context, id, body.expectedVersion, body.targetRevisionVersion, reason);
    }
    return json({ content });
  } catch (error) {
    if (error instanceof AdminError) return adminErrorResponse(error);
    if (error instanceof ContentError) return json({ error: { code: error.code, message: error.message, details: error.details } }, error.code === "CONFLICT" ? 409 : 400);
    return authErrorResponse(error);
  }
}