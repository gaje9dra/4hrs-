import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { classifyIncidentSeverity, incidentFingerprint, shouldEmitAlert } from "@/lib/reliability/incidents";
import { SLO_CANDIDATES, DEPENDENCY_POLICIES, ERROR_BUDGET_POLICY } from "@/lib/reliability/model";

const root = process.cwd();
const read = (file: string) => fs.readFileSync(path.join(root, file), "utf8");

test("severity is derived from customer, financial, integrity and privacy impact", () => {
  assert.equal(classifyIncidentSeverity({ customerImpact: "WIDESPREAD", financialImpact: "NONE", dataIntegrity: "NONE", privacy: "NONE", operationalScope: "SYSTEM" }), "MAJOR");
  assert.equal(classifyIncidentSeverity({ customerImpact: "MAJOR", financialImpact: "CONFIRMED", dataIntegrity: "NONE", privacy: "NONE", operationalScope: "WORKFLOW" }), "CRITICAL");
  assert.equal(classifyIncidentSeverity({ customerImpact: "LOCALIZED", financialImpact: "NONE", dataIntegrity: "NONE", privacy: "NONE", operationalScope: "SINGLE_RESOURCE" }), "LOCALIZED");
});

test("incident fingerprints are stable and dependency-scoped", () => {
  const a = incidentFingerprint("PAYMENT", "FINANCIAL", "callback", "PAYMENT_PROVIDER");
  assert.equal(a, incidentFingerprint("PAYMENT", "FINANCIAL", "callback", "PAYMENT_PROVIDER"));
  assert.notEqual(a, incidentFingerprint("PAYMENT", "FINANCIAL", "callback", "APPLICATION"));
});

test("alert emission is bounded by cooldown", () => {
  const now = new Date("2026-10-03T12:00:00.000Z");
  assert.equal(shouldEmitAlert(now, null), true);
  assert.equal(shouldEmitAlert(now, new Date("2026-10-03T11:50:00.000Z")), false);
  assert.equal(shouldEmitAlert(now, new Date("2026-10-03T11:30:00.000Z")), true);
});

test("SLO targets remain provisional until production evidence exists", () => {
  assert.ok(SLO_CANDIDATES.length >= 5);
  assert.ok(SLO_CANDIDATES.every((candidate) => candidate.target === null && candidate.provisional));
});

test("dependency policy forbids blind financial and ambiguous mutation retries", () => {
  assert.match(DEPENDENCY_POLICIES.PAYMENT_PROVIDER.retry, /No automatic retry/);
  assert.match(DEPENDENCY_POLICIES.QIKINK.retry, /never duplicate/);
  assert.match(DEPENDENCY_POLICIES.SHIPPING_PROVIDER.retry, /ambiguity requires reconciliation/);
});

test("error budget is an operational signal rather than an automatic release blocker", () => {
  assert.match(ERROR_BUDGET_POLICY.treatment, /not mechanically blocked/);
});

test("scheduled reliability monitor is provider-neutral and non-mutating to domain state", () => {
  const source = read("netlify/functions/reliability-monitor.mts");
  assert.match(source, /runReliabilityChecks/);
  assert.match(source, /recordReliabilityFindings/);
  assert.doesNotMatch(source, /payment|order|fulfillment|shipment/i);
});

test("incident API requires operational read access and privileged mutation access", () => {
  const source = read("app/api/admin/reliability/incidents/route.ts");
  assert.match(source, /analytics\.operations\.read/);
  assert.match(source, /system\.settings\.manage/);
  assert.match(source, /auditAdminAction/);
});

test("incident metadata uses the existing telemetry redaction boundary", () => {
  assert.match(read("lib/reliability/service.ts"), /sanitizeIncidentMetadata/);
  assert.match(read("lib/reliability/incidents.ts"), /sanitizeTelemetryValue/);
});

test("required runbook documentation is present", () => {
  const docs = read("docs/phase-15-17-incident-response-sre-service-reliability.md");
  for (const heading of ["Critical service map", "SLO candidates", "Error-budget model", "Severity model", "Detection strategy", "Alerting strategy", "Payment incident handling", "Qikink incident handling", "Runbooks", "Post-incident review", "Production readiness decision"]) {
    assert.match(docs, new RegExp(heading));
  }
});
