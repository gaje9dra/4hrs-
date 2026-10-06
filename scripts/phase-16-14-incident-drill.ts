import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { db } from "@/lib/db/client";
import { recordReliabilityFindings } from "@/lib/reliability/service";
import { incidentFingerprint } from "@/lib/reliability/incidents";

const now = new Date("2026-10-06T00:00:00.000Z");
const fingerprint = incidentFingerprint("PHASE_16_14_DRILL", "AVAILABILITY", "synthetic-api-failure", "APPLICATION");

async function main() {
  await db.reliabilityIncident.deleteMany({ where: { fingerprint } });

  const finding = {
    fingerprint,
    severity: "OPERATIONAL" as const,
    category: "AVAILABILITY" as const,
    capability: "PHASE_16_14_DRILL",
    title: "Synthetic API failure",
    summary: "Controlled CI-only incident drill.",
    dependency: "APPLICATION",
    metadata: {
      safeReference: "phase-16-14",
      password: "should-never-persist",
      customerEmail: "not required and intentionally excluded from telemetry",
    },
  };

  await recordReliabilityFindings([finding], now);
  const first = await db.reliabilityIncident.findUnique({
    where: { fingerprint },
    include: { events: true },
  });
  assert(first);
  assert.equal(first.status, "OPEN");
  assert.equal(first.occurrenceCount, 1);
  assert.equal(first.lastAlertedAt?.toISOString(), now.toISOString());
  assert.equal((first.metadata as Record<string, unknown>).password, "[REDACTED]");
  assert.equal((first.metadata as Record<string, unknown>).customerEmail, "not required and intentionally excluded from telemetry");
  assert.equal(first.events.length, 1);
  assert.equal(first.events[0]?.type, "DETECTED");

  await recordReliabilityFindings([finding], new Date(now.getTime() + 60_000));
  const second = await db.reliabilityIncident.findUnique({
    where: { fingerprint },
    include: { events: true },
  });
  assert(second);
  assert.equal(second.occurrenceCount, 2);
  assert.equal(second.lastAlertedAt?.toISOString(), now.toISOString());
  assert.equal(second.events.length, 2);
  assert.equal((second.events[1]?.metadata as Record<string, unknown>).alertEmitted, false);

  const evidence = {
    phase: "16.14",
    drill: "synthetic-alert-deduplication-and-redaction",
    result: "PASS",
    measured: {
      initialIncidentCreated: true,
      occurrenceCountAfterDuplicate: second.occurrenceCount,
      alertDeduplicated: true,
      metadataSecretRedacted: true,
    },
    evidenceClass: "simulated",
  };
  await mkdir("artifacts", { recursive: true });
  await writeFile("artifacts/phase-16-14-incident-drill-evidence.json", JSON.stringify(evidence, null, 2) + "\\n");
  console.log(JSON.stringify(evidence));
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.stack ?? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.reliabilityIncident.deleteMany({ where: { fingerprint } });
    await db.$disconnect();
  });
