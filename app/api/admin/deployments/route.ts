import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/authorization";
import type { AdminPermission } from "@/lib/admin/permissions";
import * as svc from "@/lib/deployment-control/service";

export const dynamic = "force-dynamic";

const text = (value: unknown) => typeof value === "string" ? value.trim() : "";
const mutationActions = new Set([
  "CREATE","READINESS","PLAN","ENVIRONMENT","INCIDENT","FREEZE","LOCK","START","EXECUTE",
  "HEALTH","VALIDATE","ROLLBACK","VERIFY_ROLLBACK","FORWARD_RECOVERY","CERTIFY","PAUSE","ABORT",
]);

const permissions: Record<string, AdminPermission> = {
  LIST: "deployment.read",
  DETAIL: "deployment.read",
  CREATE: "deployment.create",
  READINESS: "deployment.readiness",
  PLAN: "deployment.plan",
  ENVIRONMENT: "deployment.environment",
  INCIDENT: "deployment.incident",
  FREEZE: "deployment.freeze",
  LOCK: "deployment.lock",
  START: "deployment.execute",
  EXECUTE: "deployment.execute",
  HEALTH: "deployment.validate",
  VALIDATE: "deployment.validate",
  ROLLBACK: "deployment.rollback",
  VERIFY_ROLLBACK: "deployment.rollback",
  FORWARD_RECOVERY: "deployment.recovery",
  CERTIFY: "deployment.certify",
  PAUSE: "deployment.pause",
  ABORT: "deployment.abort",
};

function idempotency(req: Request) {
  const value = text(req.headers.get("Idempotency-Key"));
  if (!value || value.length > 200) throw new Error("Idempotency-Key is required for deployment mutations");
  return value;
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const action = text(url.searchParams.get("action")) || "LIST";
    const auth = await requireAdmin(req, permissions[action] ?? "deployment.read");
    if (action === "LIST") return NextResponse.json(await svc.listDeployments(Number(url.searchParams.get("limit") || 50)));
    if (action === "DETAIL") return NextResponse.json(await svc.detail(text(url.searchParams.get("id"))));
    if (action === "ENVIRONMENT") {
      const environment = text(url.searchParams.get("environment"));
      const result = await svc.setEnvironment({ name: environment, actorId: auth.adminUser.id });
      return NextResponse.json(result);
    }
    return NextResponse.json({ error: "Unknown deployment query" }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Deployment query failed safely" }, { status: 403 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json() as Record<string, unknown>;
    const action = text(body.action);
    const auth = await requireAdmin(req, permissions[action] ?? "deployment.read");
    const key = mutationActions.has(action) ? idempotency(req) : undefined;

    if (action === "CREATE") return NextResponse.json({ result: await svc.createDeployment({
      stableId: text(body.stableId),
      changeRequestId: text(body.changeRequestId),
      releaseId: text(body.releaseId),
      artifactId: text(body.artifactId),
      environment: text(body.environment),
      target: body.target,
      actorId: auth.adminUser.id,
      policyVersion: text(body.policyVersion),
      recoveryClass: text(body.recoveryClass),
    }) }, { status: 201 });

    if (action === "READINESS") return NextResponse.json({ result: await svc.readiness(text(body.id), auth.adminUser.id, key) });
    if (action === "PLAN") return NextResponse.json({ result: await svc.generatePlan(text(body.id), auth.adminUser.id) });
    if (action === "ENVIRONMENT") return NextResponse.json({ result: await svc.setEnvironment({
      name: text(body.name), actorId: auth.adminUser.id, state: text(body.state) || undefined,
      health: text(body.health) || undefined, frozen: typeof body.frozen === "boolean" ? body.frozen : undefined,
      activeIncidents: body.activeIncidents, pendingMigrations: body.pendingMigrations,
      capacity: body.capacity, dependencyHealth: body.dependencyHealth,
    }) });
    if (action === "INCIDENT") return NextResponse.json({ result: await svc.recordIncident({
      deploymentId: text(body.id), incidentReference: text(body.incidentReference), severity: text(body.severity),
      affectedDomains: body.affectedDomains, affectedDependencies: body.affectedDependencies,
      affectedJourneys: body.affectedJourneys, decision: text(body.decision), actorId: auth.adminUser.id,
    }) });
    if (action === "FREEZE") return NextResponse.json({ result: await svc.freeze({
      scope: text(body.scope), scopeReference: text(body.scopeReference), reason: text(body.reason),
      ownerId: auth.adminUser.id, expiresAt: text(body.expiresAt), emergencyOverride: body.emergencyOverride === true,
      auditEvidence: body.auditEvidence,
    }) });
    if (action === "LOCK") return NextResponse.json({ result: await svc.lock(text(body.id), text(body.scope), auth.adminUser.id, Number(body.ttlSeconds || 900)) });
    if (action === "START") return NextResponse.json({ result: await svc.start(text(body.id), auth.adminUser.id, key) });
    if (action === "EXECUTE") return NextResponse.json({ result: await svc.executeNext(text(body.id), text(body.operation), auth.adminUser.id, key) });
    if (action === "HEALTH") return NextResponse.json({ result: await svc.recordHealth(text(body.id), text(body.stage), body.metrics, auth.adminUser.id) });
    if (action === "VALIDATE") return NextResponse.json({ result: await svc.validate(text(body.id), auth.adminUser.id) });
    if (action === "ROLLBACK") return NextResponse.json({ result: await svc.requestRollback(text(body.id), auth.adminUser.id) });
    if (action === "VERIFY_ROLLBACK") return NextResponse.json({ result: await svc.verifyRollback(text(body.id), auth.adminUser.id, body.evidence) });
    if (action === "FORWARD_RECOVERY") return NextResponse.json({ result: await svc.forwardRecovery(text(body.id), auth.adminUser.id, body.plan, body.approval) });
    if (action === "CERTIFY") return NextResponse.json({ result: await svc.certify(text(body.id), auth.adminUser.id) });
    if (action === "PAUSE") return NextResponse.json({ result: await svc.pause(text(body.id), auth.adminUser.id, text(body.reason) || "MANUAL") });
    if (action === "ABORT") return NextResponse.json({ result: await svc.abort(text(body.id), auth.adminUser.id) });

    return NextResponse.json({ error: "Unknown deployment action" }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Deployment operation failed safely" }, { status: 400 });
  }
}
