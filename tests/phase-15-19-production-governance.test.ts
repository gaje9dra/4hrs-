import test from "node:test";
import assert from "node:assert/strict";
import { db } from "@/lib/db/client";
import { hashGovernanceEvidence, sanitizeGovernanceMetadata, verificationToStatus, verifyGovernanceControl } from "@/lib/governance/service";

test("Phase 15.19 governance control inventory is seeded", async () => {
  const count = await db.governanceControl.count();
  assert.ok(count >= 30, `Expected a production governance inventory, found ${count} controls.`);
  const critical = await db.governanceControl.count({ where: { criticality: "CRITICAL" } });
  assert.ok(critical >= 10);
});

test("governance status mapping preserves verification distinctions", () => {
  assert.equal(verificationToStatus("PASS"), "VERIFIED");
  assert.equal(verificationToStatus("FAIL"), "FAILED");
  assert.equal(verificationToStatus("BLOCKED"), "BLOCKED");
  assert.equal(verificationToStatus("UNKNOWN"), "UNKNOWN");
});

test("governance metadata redacts secret-shaped keys", () => {
  const value = sanitizeGovernanceMetadata({ safe: "ok", password: "do-not-store", nested: { apiKey: "hidden", count: 2 } });
  assert.deepEqual(value, { safe: "ok", nested: { count: 2 } });
});

test("governance evidence hash is deterministic", () => {
  const input = { controlId: "control", evidenceType: "CI_RESULT", source: "ci", reference: "run-1", metadata: { commit: "abc" } };
  assert.equal(hashGovernanceEvidence(input), hashGovernanceEvidence(input));
  assert.equal(hashGovernanceEvidence(input).length, 64);
});

test("SEC-AUTHZ-001 verifies the existing RBAC persistence boundary", async () => {
  const result = await verifyGovernanceControl("SEC-AUTHZ-001");
  assert.equal(result.status, "VERIFIED");
  assert.equal(result.result, "PASS");
});
