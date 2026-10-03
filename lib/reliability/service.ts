import { db } from "@/lib/db/client";
import { logger } from "@/lib/observability/logger";
import { incrementMetric } from "@/lib/observability/metrics";
import { sanitizeIncidentMetadata, shouldEmitAlert, type ReliabilityFinding } from "./incidents";

export async function recordReliabilityFindings(findings: readonly ReliabilityFinding[], now = new Date()): Promise<void> {
  const activeFingerprints = new Set(findings.map((finding) => finding.fingerprint));

  for (const finding of findings) {
    const existing = await db.reliabilityIncident.findUnique({ where: { fingerprint: finding.fingerprint } });
    const alert = shouldEmitAlert(now, existing?.lastAlertedAt ?? null);

    const incident = existing
      ? await db.reliabilityIncident.update({
          where: { id: existing.id },
          data: {
            severity: finding.severity,
            category: finding.category,
            capability: finding.capability,
            title: finding.title,
            summary: finding.summary,
            dependency: finding.dependency ?? null,
            status: existing.status === "RESOLVED" ? "OPEN" : existing.status,
            lastSeenAt: now,
            lastAlertedAt: alert ? now : existing.lastAlertedAt,
            resolvedAt: null,
            occurrenceCount: { increment: 1 },
            metadata: sanitizeIncidentMetadata(finding.metadata),
          },
        })
      : await db.reliabilityIncident.create({
          data: {
            fingerprint: finding.fingerprint,
            severity: finding.severity,
            category: finding.category,
            capability: finding.capability,
            title: finding.title,
            summary: finding.summary,
            dependency: finding.dependency ?? null,
            firstSeenAt: now,
            lastSeenAt: now,
            lastAlertedAt: now,
            metadata: sanitizeIncidentMetadata(finding.metadata),
          },
        });

    await db.reliabilityIncidentEvent.create({
      data: {
        incidentId: incident.id,
        type: existing ? "UPDATED" : "DETECTED",
        occurredAt: now,
        metadata: sanitizeIncidentMetadata({ alertEmitted: alert, ...finding.metadata }),
      },
    });

    if (alert) {
      logger.error("reliability.alert", {
        resourceType: "ReliabilityIncident",
        resourceId: incident.id,
        provider: finding.dependency,
        outcome: "failure",
        errorCode: finding.category,
      }, {
        fingerprint: finding.fingerprint,
        severity: finding.severity,
        capability: finding.capability,
        title: finding.title,
        summary: finding.summary,
        occurrenceCount: incident.occurrenceCount,
      });
      incrementMetric("reliability_alerts_total", { operation: "emitted", category: finding.category, reason: finding.severity });
    } else {
      incrementMetric("reliability_alerts_total" as never, { operation: "deduplicated", category: finding.category, reason: finding.severity });
    }
  }

  const stale = await db.reliabilityIncident.findMany({
    where: { status: { in: ["OPEN", "ACKNOWLEDGED"] }, lastSeenAt: { lt: now } },
    select: { id: true, fingerprint: true },
    take: 200,
  });
  for (const incident of stale.filter((item) => !activeFingerprints.has(item.fingerprint))) {
    await db.reliabilityIncident.update({
      where: { id: incident.id },
      data: { status: "RESOLVED", resolvedAt: now },
    });
    await db.reliabilityIncidentEvent.create({
      data: { incidentId: incident.id, type: "RESOLVED", occurredAt: now, metadata: { reason: "Signal no longer observed." } },
    });
  }
}
