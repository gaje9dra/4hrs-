import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/authorization";
import { AdminError } from "@/lib/admin/errors";
import { auditAdminAction } from "@/lib/admin/audit";
import { createGovernanceEvidence, createGovernanceException, exportGovernancePackage, governanceSummary, listGovernanceControls, transitionGovernanceException, verifyGovernanceControl } from "@/lib/governance/service";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function jsonError(error: unknown) {
  const code = error instanceof AdminError ? error.code : "GOVERNANCE_ERROR";
  return NextResponse.json({ error: { code, message: error instanceof Error ? error.message : "Governance operation failed." } }, { status: code === "FORBIDDEN" ? 403 : code === "ADMIN_REQUIRED" ? 401 : 400 });
}

export async function GET(request: Request) {
  try {
    const context = await requireAdmin(request, "governance.read");
    const url = new URL(request.url);
    if (url.searchParams.get("export") === "1") {
      await requireAdmin(request, "governance.export");
      const payload = await exportGovernancePackage();
      await auditAdminAction(context, { action: "GOVERNANCE_EXPORT", resourceType: "GovernanceAuditPackage", success: true, reason: "Governance audit package exported", requestId: request.headers.get("x-request-id"), metadata: { controlCount: payload.controls.length, evidenceCount: payload.evidence.length, verificationCount: payload.verifications.length } });
      const body = JSON.stringify(payload);
      return new NextResponse(body, { status: 200, headers: { "content-type": "application/json", "content-disposition": "attachment; filename=4hrs-governance-audit-package.json", "cache-control": "no-store" } });
    }
    const controls = await listGovernanceControls({
      status: (url.searchParams.get("status") || undefined) as never,
      criticality: url.searchParams.get("criticality") || undefined,
      domain: url.searchParams.get("domain") || undefined,
      limit: Number(url.searchParams.get("limit") || 100),
    });
    return NextResponse.json({ summary: await governanceSummary(), controls });
  } catch (error) { return jsonError(error); }
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as Record<string, unknown>;
    const action = typeof body.action === "string" ? body.action : "";
    if (action === "verify") {
      const context = await requireAdmin(request, "governance.verify");
      if (typeof body.controlKey !== "string" || body.controlKey.length > 120) return NextResponse.json({ error: { code: "INVALID_REQUEST", message: "controlKey is required." } }, { status: 400 });
      return NextResponse.json({ verification: await verifyGovernanceControl(body.controlKey, context.adminUser.id, request.headers.get("x-request-id") ?? undefined) });
    }
    if (action === "evidence") {
      const context = await requireAdmin(request, "governance.evidence.manage");
      const expiresAt = body.expiresAt == null ? null : new Date(String(body.expiresAt));
      if (expiresAt && Number.isNaN(expiresAt.getTime())) return NextResponse.json({ error: { code: "INVALID_REQUEST", message: "expiresAt is invalid." } }, { status: 400 });
      const evidence = await createGovernanceEvidence(context, {
        controlId: String(body.controlId || ""), evidenceType: String(body.evidenceType || "") as never, source: String(body.source || ""), reference: String(body.reference || ""), metadata: body.metadata, expiresAt,
        idempotencyKey: String(body.idempotencyKey || ""),
      });
      return NextResponse.json({ evidence }, { status: 201 });
    }
    if (action === "exception.create") {
      const context = await requireAdmin(request, "governance.exceptions.manage");
      const expiresAt = new Date(String(body.expiresAt || ""));
      if (Number.isNaN(expiresAt.getTime())) return NextResponse.json({ error: { code: "INVALID_REQUEST", message: "A valid exception expiry is required." } }, { status: 400 });
      return NextResponse.json({ exception: await createGovernanceException(context, { controlId:String(body.controlId||""), reason:String(body.reason||""), scope:String(body.scope||""), riskStatement:String(body.riskStatement||""), ownerRole:String(body.ownerRole||""), expiresAt, remediationReference: body.remediationReference == null ? null : String(body.remediationReference) }) }, { status: 201 });
    }
    if (action === "exception.approve" || action === "exception.revoke") {
      const context = await requireAdmin(request, "governance.exceptions.manage");
      if (typeof body.exceptionId !== "string") return NextResponse.json({ error: { code: "INVALID_REQUEST", message: "exceptionId is required." } }, { status: 400 });
      return NextResponse.json({ exception: await transitionGovernanceException(context, body.exceptionId, action === "exception.approve" ? "APPROVE" : "REVOKE") });
    }
    return NextResponse.json({ error: { code: "INVALID_REQUEST", message: "Unsupported governance action." } }, { status: 400 });
  } catch (error) { return jsonError(error); }
}
