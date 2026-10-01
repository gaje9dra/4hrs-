import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path: string) => readFileSync(path, "utf8");

test("customer address persistence is customer-owned and has a single-default invariant", () => {
  const schema = read("prisma/schema.prisma");
  const migration = read("prisma/migrations/20260930203100_customer_address_persistence_foundation/migration.sql");

  assert.match(schema, /addresses\s+CustomerAddress\[\]/);
  assert.match(schema, /model CustomerAddress/);
  assert.match(schema, /customerId\s+String\s+@db\.Uuid/);
  assert.match(schema, /recipientName\s+String\s+@db\.VarChar\(120\)/);
  assert.match(schema, /addressLine1\s+String\s+@db\.VarChar\(200\)/);
  assert.match(schema, /countryCode\s+String\s+@db\.Char\(2\)/);
  assert.match(schema, /isDefault\s+Boolean\s+@default\(false\)/);
  assert.match(schema, /customer\s+Customer\s+@relation\(fields: \[customerId\], references: \[id\], onDelete: Cascade\)/);

  assert.match(migration, /CREATE TABLE "CustomerAddress"/);
  assert.match(migration, /FOREIGN KEY \("customerId"\) REFERENCES "Customer"\("id"\)/);
  assert.match(migration, /ON DELETE CASCADE/);
  assert.match(migration, /CREATE UNIQUE INDEX "CustomerAddress_one_default_per_customer"/);
  assert.match(migration, /WHERE "isDefault" = true/);
});

test("checkout remains a server-authoritative boundary and does not trust Cart client pricing", () => {
  const cartApi = read("lib/cart/api.ts");
  const cartService = read("lib/cart/service.ts");
  const cartPage = read("app/(storefront)/cart/page.tsx");

  assert.match(cartApi, /resolveCurrentCustomer/);
  assert.match(cartApi, /CART_API_MAX_QUANTITY/);
  assert.match(cartService, /resolveSelection/);
  assert.match(cartService, /availableQuantity/);
  assert.match(cartService, /unitPrice/);
  assert.doesNotMatch(cartPage, /localStorage|sessionStorage/);
});

test("customer identity remains server-derived for account and Cart access", () => {
  const auth = read("lib/auth/context.ts");
  const profile = read("app/api/customer/profile/route.ts");
  const cartApi = read("lib/cart/api.ts");
  const ownership = read("lib/cart/auth-ownership.ts");

  assert.match(auth, /CUSTOMER_SESSION_COOKIE/);
  assert.match(profile, /requireCurrentCustomer/);
  assert.match(cartApi, /resolveCurrentCustomer/);
  assert.match(ownership, /cart\.customerId !== customerId/);
  assert.doesNotMatch(profile, /customerId.*body|body.*customerId/i);
});

test("private customer surfaces remain non-indexable and cache-safe", () => {
  for (const path of [
    "app/(storefront)/account/page.tsx",
    "app/(storefront)/account/profile/page.tsx",
    "app/(storefront)/cart/page.tsx",
  ]) {
    const source = read(path);
    assert.match(source, /force-dynamic/);
    assert.match(source, /index: false, follow: false, noarchive: true/);
  }
  const authHttp = read("lib/auth/http.ts");
  const cartHttp = read("lib/cart/http.ts");
  assert.match(authHttp, /private, no-store/);
  assert.match(cartHttp, /private, no-store/);
});

test("downstream payment/order/shipping integrations remain deferred", () => {
  for (const path of [
    "app/api/payment/route.ts",
    "app/api/orders/route.ts",
  ]) {
    try {
      readFileSync(path, "utf8");
      assert.fail(path + " must remain deferred");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }
});
