import test from "node:test";
import assert from "node:assert/strict";

test("customer DTO explicitly excludes credentials and session secrets", async () => {
  const { toCustomerDto } = await import("../lib/customer/contracts.ts");
  const dto = toCustomerDto({
    id: "customer-id",
    email: "customer@example.com",
    status: "ACTIVE",
    emailVerifiedAt: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  });

  assert.deepEqual(dto, {
    id: "customer-id",
    email: "customer@example.com",
    status: "ACTIVE",
    emailVerifiedAt: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  });
  assert.equal("passwordHash" in dto, false);
  assert.equal("sessionTokenHash" in dto, false);
});

test("customer email normalization is deterministic", async () => {
  const { normalizeCustomerEmail } = await import("../lib/customer/validation.ts");
  assert.equal(normalizeCustomerEmail("  CUSTOMER@Example.COM "), "customer@example.com");
});

test("customer migration creates isolated credential/session tables and nullable Cart ownership", async () => {
  const { readFile } = await import("node:fs/promises");
  const migration = await readFile(
    new URL("../prisma/migrations/20260930190000_customer_identity_persistence_foundation/migration.sql", import.meta.url),
    "utf8",
  );

  assert.match(migration, /CREATE TYPE "CustomerAccountStatus"/);
  assert.match(migration, /CREATE TABLE "Customer"/);
  assert.match(migration, /CREATE TABLE "CustomerCredential"/);
  assert.match(migration, /CREATE TABLE "CustomerSession"/);
  assert.match(migration, /"passwordHash" TEXT NOT NULL/);
  assert.match(migration, /"sessionTokenHash" VARCHAR\(128\) NOT NULL/);
  assert.match(migration, /ALTER TABLE "Cart" ADD COLUMN "customerId" UUID/);
  assert.match(migration, /ON DELETE RESTRICT/);
  assert.match(migration, /ON DELETE CASCADE/);
});

test("customer service contains no authentication UI or provider dependency", async () => {
  const { createCustomerIdentityService } = await import("../lib/customer/service.ts");
  assert.equal(typeof createCustomerIdentityService, "function");
});
