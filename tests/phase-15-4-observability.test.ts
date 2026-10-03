import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { sanitizeRequestId, sanitizeTelemetryValue } from "@/lib/observability/redaction";
import { boundedMetricLabels } from "@/lib/observability/metrics";
import { classifyError } from "@/lib/observability/errors";

const root = process.cwd();
const read = (file: string) => fs.readFileSync(path.join(root, file), "utf8");

test("request correlation accepts bounded trusted IDs and generates invalid IDs", () => {
  assert.equal(sanitizeRequestId("abc-123_foo:bar"), "abc-123_foo:bar");
  assert.equal(sanitizeRequestId("a".repeat(129)), null);
  assert.equal(sanitizeRequestId("bad value"), null);
});

test("telemetry redaction removes sensitive keys and bounds strings", () => {
  const value = sanitizeTelemetryValue({
    password: "secret",
    Authorization: "Bearer secret",
    customerNote: "x".repeat(3000),
    nested: { apiKey: "hidden" },
  }) as Record<string, unknown>;
  assert.equal(value.password, "[REDACTED]");
  assert.equal(value.Authorization, "[REDACTED]");
  assert.equal((value.customerNote as string).length, 2001);
  assert.deepEqual(value.nested, { apiKey: "[REDACTED]" });
});

test("metric dimensions remain bounded and reject high-cardinality fields", () => {
  const labels = boundedMetricLabels({
    route: "/api/payment",
    method: "POST",
    status_class: "5xx",
    customerId: "must-not-be-a-label",
    email: "must-not-be-a-label",
  });
  assert.deepEqual(labels, { route: "/api/payment", method: "POST", status_class: "5xx" });
});

test("error classification preserves operational categories", () => {
  assert.equal(classifyError({ code: "PROVIDER_TIMEOUT" }), "timeout");
  assert.equal(classifyError({ code: "FORBIDDEN" }), "authorization");
  assert.equal(classifyError({ code: "P2002" }), "unexpected");
  assert.equal(classifyError({ code: "WEBHOOK_VERIFICATION_FAILED" }), "webhook_verification");
});

test("proxy propagates request IDs while preserving Phase 15.3 CSP", () => {
  const proxy = read("proxy.ts");
  assert.match(proxy, /REQUEST_ID_HEADER/);
  assert.match(proxy, /requestHeaders\.set\(REQUEST_ID_HEADER/);
  assert.match(proxy, /response\.headers\.set\(REQUEST_ID_HEADER/);
  assert.match(proxy, /resolveRequestId/);
  assert.match(proxy, /Content-Security-Policy/);
  assert.match(proxy, /strict-dynamic/);
  assert.doesNotMatch(proxy, /unsafe-inline/);
  assert.doesNotMatch(proxy, /unsafe-eval/);
});

test("database instrumentation logs only slow queries and failures", () => {
  const db = read("lib/db/client.ts");
  assert.match(db, /db\.query\.slow/);
  assert.match(db, /db\.query\.failed/);
  assert.match(db, /durationMs/);
  assert.doesNotMatch(db, /console\.log/);
});

test("health endpoints expose minimal safe status", () => {
  const live = read("app/api/health/route.ts");
  const ready = read("app/api/ready/route.ts");
  assert.match(live, /status: "ok"/);
  assert.match(ready, /status: "not_ready"/);
  assert.match(ready, /checkDatabaseHealth/);
  for (const source of [live, ready]) {
    assert.doesNotMatch(source, /DATABASE_URL/);
    assert.doesNotMatch(source, /stack/);
  }
});

test("frontend telemetry does not send URLs, tokens, payment data, or customer content", () => {
  const client = read("components/observability/client-errors.tsx");
  const vitals = read("components/observability/web-vitals.tsx");
  assert.doesNotMatch(client, /location\.href|location\.search|localStorage|sessionStorage/);
  assert.doesNotMatch(vitals, /location\.href|location\.search/);
  assert.match(vitals, /LCP|INP|CLS/);
});

test("admin audit integration carries request correlation and security denials", () => {
  assert.match(read("lib/admin/audit.ts"), /requestId/);
  assert.match(read("lib/admin/authorization.ts"), /recordSecurityEvent/);
  assert.match(read("lib/admin/authorization.ts"), /AUTHORIZATION_DENIED/);
});

test("provider and domain observability use bounded server-side telemetry", () => {
  const qikink = read("lib/fulfillment/providers/qikink.ts");
  const fulfillment = read("lib/fulfillment/observability.ts");
  const shipping = read("lib/shipping/observability.ts");
  assert.match(qikink, /provider\.request\.succeeded/);
  assert.match(qikink, /provider\.request\.failed/);
  assert.match(fulfillment, /fulfillment_operations_total/);
  assert.match(shipping, /shipping_operations_total/);
  assert.doesNotMatch(qikink, /Authorization.*console|console\.(log|info|warn).*token/i);
});

test("observability failures cannot be thrown by the structured logger", () => {
  const logger = read("lib/observability/logger.ts");
  assert.match(logger, /try/);
  assert.match(logger, /catch \{\}/);
});

test("required Phase 15.4 documentation exists", () => {
  const docs = read("docs/phase-15-4-observability-monitoring.md");
  for (const heading of [
    "Observability architecture",
    "Logging model",
    "Metrics model",
    "Error reporting",
    "Request correlation",
    "Provider telemetry",
    "Health/readiness model",
    "Alert definitions",
    "Metric cardinality rules",
    "Privacy/redaction",
    "Operator troubleshooting workflow",
  ]) assert.match(docs, new RegExp(heading));
});
