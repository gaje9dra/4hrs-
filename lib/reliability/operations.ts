import { db } from "@/lib/db/client";
import { sanitizeIncidentMetadata } from "./incidents";

export async function listReliabilityIncidents(options: { status?: "OPEN" | "ACKNOWLEDGED" | "RESOLVED"; limit?: number } = {}) {
  return db.reliabilityIncident.findMany({
    where: options.status ? { status: options.status } : undefined,
    orderBy: [{ severity: "asc" }, { lastSeenAt: "desc" }],
    take: Math.min(Math.max(options.limit ?? 50, 1), 100),
    select: {
      id: true, fingerprint: true, severity: true, category: true, capability: true,
      title: true, summary: true, dependency: true, status: true,
      firstSeenAt: true, lastSeenAt: true, lastAlertedAt: true, resolvedAt: true,
      occurrenceCount: true, correlationId: true, deploymentId: true, metadata: true,
    },
  });
}

export async function transitionReliabilityIncident(input: {
  incidentId: string;
  action: "ACKNOWLEDGE" | "RESOLVE" | "REOPEN";
  actorAdminId: string;
  reason: string;
  correlationId?: string | null;
}) {
  const status = input.action === "ACKNOWLEDGE" ? "ACKNOWLEDGED" : input.action === "RESOLVE" ? "RESOLVED" : "OPEN";
  const incident = await db.reliabilityIncident.update({
    where: { id: input.incidentId },
    data: { status, resolvedAt: status === "RESOLVED" ? new Date() : null },
  });
  await db.reliabilityIncidentEvent.create({
    data: {
      incidentId: incident.id,
      type: input.action === "ACKNOWLEDGE" ? "ACKNOWLEDGED" : input.action === "RESOLVE" ? "RESOLVED" : "DETECTED",
      actorAdminId: input.actorAdminId,
      reason: input.reason,
      correlationId: input.correlationId ?? null,
      metadata: sanitizeIncidentMetadata({ manual: true }),
    },
  });
  return incident;
}
