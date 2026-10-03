import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/authorization";
import { auditAdminAction } from "@/lib/admin/audit";
import { listReliabilityIncidents, transitionReliabilityIncident } from "@/lib/reliability/operations";
import { AdminError } from "@/lib/admin/errors";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: Request) {
  let context;
  try {
    context = await requireAdmin(request, "analytics.operations.read");
    const url = new URL(request.url);
    const rawStatus = url.searchParams.get("status");
    const status = rawStatus && ["OPEN", "ACKNOWLEDGED", "RESOLVED"].includes(rawStatus) ? rawStatus as "OPEN" | "ACKNOWLEDGED" | "RESOLVED" : undefined;
    const incidents = await listReliabilityIncidents({ status, limit: Number(url.searchParams.get("limit") ?? 50) });
    return NextResponse.json({ incidents });
  } catch (error) {
    const code = error instanceof AdminError ? error.code : "DATABASE_ERROR";
    return NextResponse.json({ error: { code, message: error instanceof Error ? error.message : "Reliability incidents could not be loaded." } }, { status: code === "FORBIDDEN" ? 403 : 500 });
  }
}

export async function POST(request: Request) {
  let context;
  try {
    context = await requireAdmin(request, "system.settings.manage");
    const body = await request.json() as { incidentId?: unknown; action?: unknown; reason?: unknown };
    if (typeof body.incidentId !== "string" || !["ACKNOWLEDGE", "RESOLVE", "REOPEN"].includes(String(body.action)) || typeof body.reason !== "string" || body.reason.trim().length < 3) {
      return NextResponse.json({ error: { code: "INVALID_REQUEST", message: "incidentId, action and a reason are required." } }, { status: 400 });
    }
    const incident = await transitionReliabilityIncident({
      incidentId: body.incidentId,
      action: body.action as "ACKNOWLEDGE" | "RESOLVE" | "REOPEN",
      actorAdminId: context.adminUser.id,
      reason: body.reason.trim().slice(0, 1000),
      correlationId: request.headers.get("x-request-id"),
    });
    await auditAdminAction(context, {
      action: "RELIABILITY_INCIDENT_TRANSITION",
      resourceType: "ReliabilityIncident",
      resourceId: incident.id,
      success: true,
      reason: body.reason,
      requestId: request.headers.get("x-request-id"),
      metadata: { action: body.action },
    });
    return NextResponse.json({ incident });
  } catch (error) {
    const code = error instanceof AdminError ? error.code : "DATABASE_ERROR";
    return NextResponse.json({ error: { code, message: error instanceof Error ? error.message : "Reliability incident transition failed." } }, { status: code === "FORBIDDEN" ? 403 : 500 });
  }
}
