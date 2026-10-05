import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

test("Phase 16.2 certification audit executes and exposes its evidence matrix", () => {
  const output = execFileSync("npx", ["tsx", "scripts/phase-16-2-commerce-journey-certification.ts"], {
    encoding: "utf8",
    env: { ...process.env, NODE_ENV: "test" },
  });
  const report = JSON.parse(output) as {
    phase: string;
    status: string;
    counts: Record<string, number>;
    evidenceMatrix: Array<{ id: string; present: boolean }>;
  };

  assert.equal(report.phase, "16.2");
  assert.ok(["CERTIFIED_BASELINE", "CERTIFICATION_REVIEW_REQUIRED"].includes(report.status));
  assert.equal(report.counts.CRITICAL, 0);
  assert.equal(report.counts.HIGH, 0);
  assert.equal(report.evidenceMatrix.length, 25);
  assert.ok(report.evidenceMatrix.every((item) => item.present));
});

test("Phase 16.2 certification preserves the provider and financial boundaries", () => {
  const qikink = readFileSync("lib/fulfillment/providers/qikink.ts", "utf8");
  const shipping = readFileSync("lib/shipping/providers/qikink.ts", "utf8");
  const checkout = readFileSync("app/api/checkout/route.ts", "utf8");
  const webhook = readFileSync("app/api/payment/webhook/[providerId]/route.ts", "utf8");

  assert.match(qikink, /FulfillmentProviderAdapter/);
  assert.match(shipping, /createShipment: false/);
  assert.match(shipping, /trackingLookup: false/);
  assert.match(shipping, /webhooks: false/);
  assert.match(checkout, /authoritative|server|Cart/i);
  assert.match(webhook, /signature|verify/i);
});
