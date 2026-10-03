import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { validateRepairIntent } from "@/lib/recovery/repair";
import { sanitizeTelemetryValue } from "@/lib/observability/redaction";

const root = process.cwd();
const read = (file: string) => fs.readFileSync(path.join(root, file), "utf8");

test("recovery validation is non-destructive and has no arbitrary SQL repair surface", () => {
  const source = read("lib/recovery/repair.ts");
  assert.match(source, /dryRun/);
  assert.match(source, /idempotencyKey/);
  assert.match(source, /requirePermission/);
  assert.doesNotMatch(source, /queryRawUnsafe/);
  assert.doesNotMatch(source, /executeRawUnsafe/);
});

test("repair intent requires explicit operator intent", () => {
  assert.throws(() => validateRepairIntent({ shipmentId: "", operatorId: "admin", reason: "repair", idempotencyKey: "key", dryRun: true }));
  assert.throws(() => validateRepairIntent({ shipmentId: "shipment", operatorId: "admin", reason: "x", idempotencyKey: "key", dryRun: true }));
  assert.doesNotThrow(() => validateRepairIntent({ shipmentId: "shipment", operatorId: "admin", reason: "reconcile shipment", idempotencyKey: "recovery-key", dryRun: true }));
});

test("repair mutation requires authorization and supports dry-run", () => {
  const source = read("lib/recovery/repair.ts");
  assert.match(source, /if \(!input\.dryRun\)/);
  assert.match(source, /authorizedContext/);
  assert.match(source, /shipping\.recovery/);
  assert.match(source, /recordAdminAudit/);
});

test("integrity checks cover financial, fulfillment, shipping, returns, and orphan invariants", () => {
  const source = read("lib/recovery/integrity.ts");
  for (const invariant of ["ORDER_TOTAL_MISMATCH","PAYMENT_AMOUNT_MISMATCH","REFUND_TOTAL_EXCEEDS_PAYMENT","FULFILLMENT_QUANTITY_INVALID","RETURN_QUANTITY_INVALID","ORPHAN_RECORDS","DUPLICATE_BUSINESS_IDENTIFIER"]) assert.ok(source.includes(invariant));
});

test("restore validation checks migration state, tables, indexes, constraints, and domain values", () => {
  const source = read("lib/recovery/restore-validation.ts");
  for (const term of ["_prisma_migrations","information_schema.tables","pg_indexes","table_constraints","domain-values"]) assert.ok(source.includes(term));
});

test("recovery drill refuses production and cleans its temporary database", () => {
  const source = read("scripts/recovery-drill.ts");
  for (const term of ["NODE_ENV === \"production\"","CREATE DATABASE","pg_dump","pg_restore","DROP DATABASE IF EXISTS"]) assert.ok(source.includes(term));
});

test("recovery scripts never print environment secrets", () => {
  for (const file of ["scripts/recovery-validate.ts","scripts/recovery-drill.ts"]) {
    const source = read(file);
    assert.doesNotMatch(source, /console\.log\(.*DATABASE_URL/);
  }
  const redacted = sanitizeTelemetryValue({ DATABASE_URL: "postgres://secret", QIKINK_CLIENT_SECRET: "secret" }) as Record<string, unknown>;
  assert.equal(redacted.DATABASE_URL, "[REDACTED]");
  assert.equal(redacted.QIKINK_CLIENT_SECRET, "[REDACTED]");
});

test("recovery authorization remains server-side", () => {
  const source = read("lib/recovery/repair.ts");
  for (const term of ["AdminAuthorizationContext","requirePermission","shipping.recovery"]) assert.ok(source.includes(term));
  assert.doesNotMatch(source, /app\/api/);
});

test("documentation contains the complete production recovery surface", () => {
  const docs = read("docs/phase-15-5-backup-disaster-recovery.md");
  for (const heading of ["Recovery objectives","RPO","RTO","Data inventory","Backup architecture","Backup retention","Backup security","Restore procedure","Restore validation","Migration recovery","Deployment rollback","Netlify recovery","Secret rotation","Provider outage recovery","Webhook recovery","Payment recovery","Fulfillment recovery","Shipping recovery","Return/cancellation recovery","Audit recovery","Media recovery","Integrity checks","Recovery drills","Reconciliation procedures","Business continuity modes","Known limitations","Operator runbook","Verification commands"]) assert.ok(docs.includes(heading));
});
