import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import test from "node:test";

test("Phase 16.3 certification audit reports the real provider readiness boundary", () => {
  const output = execFileSync("npx", ["tsx", "scripts/phase-16-3-payment-financial-safety-certification.ts"], {
    encoding: "utf8",
    env: { ...process.env, NODE_ENV: "test" },
  });
  const report = JSON.parse(output) as {
    phase: string;
    status: string;
    counts: Record<string, number>;
    findings: Array<{ id:string; status:string; severity?:string }>;
  };
  assert.equal(report.phase, "16.3");
  assert.ok(["NOT_READY", "CERTIFICATION_REVIEW_REQUIRED", "CERTIFIED"].includes(report.status));
  assert.equal(report.counts.CRITICAL, 0);
  assert.ok(report.findings.some((item) => item.id === "16.3.30"));
});

test("Phase 16.3 financial boundaries require provider-event amount/currency and safe replay handling", () => {
  const provider = readFileSync("lib/payments/provider.ts", "utf8");
  const application = readFileSync("lib/payments/application.ts", "utf8");
  const schema = readFileSync("prisma/schema.prisma", "utf8");
  assert.match(provider, /amount:PaymentAmount; currency:string/);
  assert.match(application, /Payment event amount does not match the authoritative payment amount/);
  assert.match(application, /Payment event currency does not match the authoritative payment currency/);
  assert.match(application, /code === "P2034"/);
  assert.match(schema, /@@unique\(\[providerId, providerEventId\]\)/);
  assert.match(schema, /@@unique\(\[customerId, operation, key\]\)/);
});

test("Phase 16.3 registry contains the controlled sandbox certification adapter", () => {
  const registry = readFileSync("lib/payments/registry.ts", "utf8");
  assert.match(registry, /controlledSandboxPaymentProvider/);
  assert.match(registry, /const providerAdapters: readonly PaymentProviderAdapter\[\]/);
  assert.match(registry, /controlledSandboxPaymentProvider/);
  assert.match(registry, /payuPaymentProvider/);
});
