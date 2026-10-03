import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { buildAnonymizedCustomerEmail, PRIVACY_DELETE_CONFIRMATION } from "@/lib/customer/privacy";

const read = (file: string) => fs.readFileSync(file, "utf8");

test("privacy export identity is server-derived and never accepts a browser customer ID", () => {
  const source = read("app/api/customer/privacy/route.ts");
  assert.match(source, /requireCurrentCustomer/);
  assert.match(source, /exportCustomerData\(current\.customer\.id/);
  assert.doesNotMatch(source, /body\.customerId|searchParams.*customerId|params.*customerId/i);
});

test("privacy export is explicit, bounded, private, and excludes secrets/internal data", () => {
  const source = read("lib/customer/privacy.ts");
  assert.match(source, /MAX_PRIVACY_EXPORT_RECORDS/);
  assert.match(source, /EXPORT_TOO_LARGE/);
  assert.match(source, /content-disposition/);
  assert.doesNotMatch(source, /passwordHash|sessionTokenHash|sessionToken|apiKey|accessKey|internalReason|CaseNote/);
  assert.doesNotMatch(source, /queryRawUnsafe|executeRawUnsafe/);
});

test("privacy deletion requires explicit confirmation and is idempotent", () => {
  assert.equal(PRIVACY_DELETE_CONFIRMATION, "DELETE MY ACCOUNT");
  assert.match(buildAnonymizedCustomerEmail("12345678-1234-1234-8234-123456789abc"), /^deleted\+12345678-1234-1234-8234-123456789abc@privacy\.invalid$/);
  const source = read("lib/customer/privacy.ts");
  for (const term of ["confirmation", "anonymizedAt", "deleteMany({ where: { customerId } })", "updateMany({", "status: \"DISABLED\""]) assert.ok(source.includes(term), term);
  assert.match(source, /if \(customer\.anonymizedAt\)/);
});

test("privacy deletion preserves historical commercial records", () => {
  const source = read("lib/customer/privacy.ts");
  assert.doesNotMatch(source, /tx\.order\.delete|tx\.payment\.delete|tx\.fulfillment\.delete|tx\.shipment\.delete|tx\.returnRequest\.delete|tx\.cancellationRequest\.delete/);
  assert.match(source, /Order/);
});

test("privacy deletion scrubs mutable customer content but preserves auditability", () => {
  const source = read("lib/customer/privacy.ts");
  assert.match(source, /customerDescription: null/);
  assert.match(source, /title: "Customer support request"/);
  assert.match(source, /payload: Prisma\.DbNull/);
  assert.match(source, /response: Prisma\.DbNull/);
  assert.match(source, /CUSTOMER_PRIVACY_DELETE/);
  assert.match(source, /CUSTOMER_PRIVACY_EXPORT/);
});

test("privacy endpoints use Phase 15.3 same-origin protection and rate limiting", () => {
  const source = read("app/api/customer/privacy/route.ts");
  assert.match(source, /assertSameOrigin/);
  assert.match(source, /consumeCustomerPrivacyRateLimit/);
  assert.match(source, /private, no-store/);
  assert.match(source, /x-robots-tag/);
});

test("privacy UI exposes only the controlled export/delete actions", () => {
  const source = read("components/storefront/customer-privacy-controls.tsx");
  assert.match(source, /\/api\/customer\/privacy/);
  assert.match(source, /DELETE MY ACCOUNT/);
  assert.doesNotMatch(source, /localStorage|sessionStorage|customerId/i);
});

test("privacy schema migration is additive and non-destructive", () => {
  const migration = read("prisma/migrations/20261003070000_customer_privacy_lifecycle/migration.sql");
  assert.match(migration, /ADD COLUMN "anonymizedAt"/);
  assert.match(migration, /CREATE INDEX/);
  assert.doesNotMatch(migration, /DROP TABLE|DROP COLUMN|DELETE FROM/i);
});

test("privacy documentation distinguishes unresolved legal/business decisions", () => {
  const docs = read("docs/phase-15-6-data-privacy-retention.md");
  for (const term of ["Personal-data inventory","Data classification","Data minimization","Export model","Deletion and anonymization model","Retention matrix","Backup interaction","Fulfillment/provider data","Shipping/tracking privacy","Case/support privacy","Audit-log privacy","Logging and telemetry privacy","Business/legal decisions still required","Known limitations"]) {
    assert.ok(docs.includes(term), term);
  }
  assert.match(docs, /Requires business\/legal confirmation/);
  assert.doesNotMatch(docs, /GDPR compliant|CCPA compliant|legally required to retain for \d+ years/i);
});
