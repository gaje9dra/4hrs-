import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (file: string) => fs.readFileSync(path.join(root, file), "utf8");

test("Phase 15.18 recovery drill is isolated and timing-aware", () => {
  const source = read("scripts/recovery-drill.ts");
  for (const term of [
    "NODE_ENV === \"production\"",
    "pg_dump",
    "pg_restore",
    "CREATE DATABASE",
    "DROP DATABASE IF EXISTS",
    "measuredRecoverySeconds",
    "dataLossBoundary"
  ]) assert.ok(source.includes(term), term);
  assert.doesNotMatch(source, /DATABASE_URL.*console\.log/);
});

test("Phase 15.18 restore validation remains read-only", () => {
  const source = read("lib/recovery/restore-validation.ts");
  assert.doesNotMatch(source, /create\s+database|drop\s+database|update\s+|delete\s+from|insert\s+into/i);
  for (const term of ["information_schema.tables", "_prisma_migrations", "pg_indexes", "table_constraints"]) {
    assert.ok(source.includes(term), term);
  }
});

test("Phase 15.18 documentation states evidence limits instead of inventing RTO/RPO guarantees", () => {
  const docs = read("docs/phase-15-18-business-continuity-disaster-recovery-validation.md");
  for (const heading of [
    "Executive summary", "Current recovery architecture", "Business continuity model",
    "RTO/RPO", "Data classification", "Backup architecture", "Restore procedure",
    "Restore validation", "Migration recovery", "Application recovery", "Search recovery",
    "Content recovery", "Feature flag recovery", "Customer account recovery",
    "Payment recovery", "Order/fulfillment recovery", "Qikink recovery", "Shipping recovery",
    "Webhook recovery", "Background job recovery", "Notification recovery",
    "Privacy/security controls", "Recovery access control", "Recovery environment",
    "Disaster scenarios", "Recovery exercise results", "Measured RTO/RPO",
    "Known limitations", "Deferred work", "Production readiness decision"
  ]) assert.ok(docs.includes(heading), heading);
  assert.match(docs, /provisional/i);
  assert.match(docs, /NOT READY/);
});
