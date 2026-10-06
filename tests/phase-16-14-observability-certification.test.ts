import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { classifyIncidentSeverity, incidentFingerprint, shouldEmitAlert } from "@/lib/reliability/incidents";
import { sanitizeTelemetryValue, sanitizeRequestId } from "@/lib/observability/redaction";
import { boundedMetricLabels } from "@/lib/observability/metrics";
import { resolveRequestId } from "@/lib/observability/request";

test("Phase 16.14 certification and incident drill are wired into package and CI", async () => {
  const pkg = JSON.parse(await readFile("package.json", "utf8")) as { scripts: Record<string, string> };
  const ci = await readFile(".github/workflows/ci.yml", "utf8");
  assert.equal(pkg.scripts["production-certification:phase-16-14"], "tsx scripts/phase-16-14-observability-certification.ts");
  assert.equal(pkg.scripts["observability:incident-drill"], "tsx scripts/phase-16-14-incident-drill.ts");
  assert.match(ci, /production-certification:phase-16-14/);
  assert.match(ci, /observability:incident-drill/);
  assert.match(ci, /phase-16-14-observability-certification-evidence/);
});

test("Phase 16.14 preserves the single structured telemetry architecture", async () => {
  const [logger, redaction, metrics, proxy, instrumentation, operations] = await Promise.all([
    readFile("lib/observability/logger.ts", "utf8"),
    readFile("lib/observability/redaction.ts", "utf8"),
    readFile("lib/observability/metrics.ts", "utf8"),
    readFile("proxy.ts", "utf8"),
    readFile("instrumentation.ts", "utf8"),
    readFile("lib/operations/service.ts", "utf8"),
  ]);
  assert.match(logger, /JSON\\.stringify\\(record\\)/);
  assert.match(logger, /NODE_ENV === "production"/);
  assert.match(redaction, /SENSITIVE_KEY/);
  assert.match(metrics, /ALLOWED_LABELS/);
  assert.match(proxy, /x-request-id/);
  assert.match(instrumentation, /onRequestError/);
  assert.match(operations, /criticalIncidents/);
});

test("Phase 16.14 readiness distinguishes liveness from database readiness", async () => {
  const [health, readiness] = await Promise.all([
    readFile("app/api/health/route.ts", "utf8"),
    readFile("app/api/health/readiness/route.ts", "utf8"),
  ]);
  assert.match(health, /status: "ok"/);
  assert.match(readiness, /status: ready/);
  assert.match(readiness, /\? 200 : 503/);
  assert.match(readiness, /checkDatabaseHealth/);
});

test("Phase 16.14 safe telemetry primitives enforce redaction, bounded labels and correlation", () => {
  const sanitized = sanitizeTelemetryValue({
    password: "secret",
    accessToken: "secret",
    nested: { cardNumber: "4111111111111111", safe: "ok" },
  }) as Record<string, unknown>;
  assert.equal(sanitized.password, "[REDACTED]");
  assert.equal(sanitized.accessToken, "[REDACTED]");
  assert.deepEqual(sanitized.nested, { cardNumber: "[REDACTED]", safe: "ok" });

  assert.equal(sanitizeRequestId("bad value"), null);
  assert.equal(sanitizeRequestId("req-123"), "req-123");
  assert.match(resolveRequestId(null), /^[0-9a-f-]{36}$/);

  const labels = boundedMetricLabels({ route: "/api/orders", customerId: "must-be-dropped", status_class: "5xx" });
  assert.deepEqual(labels, { route: "/api/orders", status_class: "5xx" });
});

test("Phase 16.14 incident classification and alert deduplication are deterministic", () => {
  assert.equal(classifyIncidentSeverity({
    customerImpact: "WIDESPREAD",
    financialImpact: "NONE",
    dataIntegrity: "NONE",
    privacy: "NONE",
    operationalScope: "SYSTEM",
  }), "CRITICAL");

  const fingerprintA = incidentFingerprint("PAYMENT", "FINANCIAL", "timeout", "PAYMENT_PROVIDER");
  const fingerprintB = incidentFingerprint("PAYMENT", "FINANCIAL", "timeout", "PAYMENT_PROVIDER");
  assert.equal(fingerprintA, fingerprintB);
  assert.equal(fingerprintA.length, 32);

  const now = new Date("2026-10-06T00:00:00.000Z");
  assert.equal(shouldEmitAlert(now, null), true);
  assert.equal(shouldEmitAlert(new Date(now.getTime() + 60_000), now), false);
  assert.equal(shouldEmitAlert(new Date(now.getTime() + 15 * 60_000), now), true);
});

test("Phase 16.14 explicitly records unavailable external evidence instead of fabricating it", async () => {
  const script = await readFile("scripts/phase-16-14-observability-certification.ts", "utf8");
  assert.match(script, /No external distributed tracing provider is configured/);
  assert.match(script, /Production historical metrics, alert deliveries, customer impact counts and SLO compliance are not available/);
  assert.match(script, /Provider sandbox failures/);
});
