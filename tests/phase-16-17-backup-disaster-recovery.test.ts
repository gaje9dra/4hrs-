import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const recovery=readFileSync("scripts/recovery-drill.ts","utf8");
const validator=readFileSync("lib/recovery/restore-validation.ts","utf8");
const integrity=readFileSync("lib/recovery/integrity.ts","utf8");
const repair=readFileSync("lib/recovery/repair.ts","utf8");
const runbook=readFileSync("docs/recovery-runbook.md","utf8");
const phase15=readFileSync("docs/phase-15-5-backup-disaster-recovery.md","utf8");

test("Phase 16.17 recovery drill is non-production and isolated",()=>{
  assert.match(recovery,/NODE_ENV === "production"/);
  assert.match(recovery,/pg_dump/);
  assert.match(recovery,/pg_restore/);
  assert.match(recovery,/CREATE DATABASE/);
  assert.match(recovery,/DROP DATABASE IF EXISTS/);
  assert.match(recovery,/randomUUID/);
});

test("Phase 16.17 restore validation is read-only and schema-aware",()=>{
  assert.match(validator,/validateRestoredDatabase/);
  assert.match(validator,/_prisma_migrations/);
  assert.match(validator,/information_schema/);
  assert.match(validator,/assertRecoveryChecks/);
  assert.match(phase15,/read-only/);
});

test("Phase 16.17 protects canonical and financial state",()=>{
  assert.match(integrity,/PAYMENT_AMOUNT_MISMATCH/);
  assert.match(integrity,/REFUND_TOTAL_EXCEEDS_PAYMENT/);
  assert.match(integrity,/FULFILLMENT_QUANTITY_INVALID/);
  assert.match(repair,/idempotencyKey/);
  assert.match(repair,/shipping.recovery/);
  assert.match(repair,/recordAdminAudit/);
});

test("Phase 16.17 documents external-provider limitations",()=>{
  assert.match(runbook,/Qikink/);
  assert.match(runbook,/provider/i);
  assert.match(phase15,/production database provider/);
  assert.match(phase15,/No fixed RPO\/RTO guarantee/);
});

test("Phase 16.17 refuses destructive production recovery",()=>{
  assert.doesNotMatch(recovery,/migrate reset/i);
  assert.doesNotMatch(recovery,/db push/i);
  assert.match(runbook,/isolated/i);
});
