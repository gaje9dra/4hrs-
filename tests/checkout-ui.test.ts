import assert from "node:assert/strict";
import test from "node:test";
import { getSafeAuthRedirect } from "@/lib/auth/redirect";

test("Checkout return target cannot become an external redirect", () => {
  assert.equal(getSafeAuthRedirect("/checkout"), "/checkout");
  assert.equal(getSafeAuthRedirect("https://evil.example/checkout"), "/");
  assert.equal(getSafeAuthRedirect("//evil.example/checkout"), "/");
  assert.equal(getSafeAuthRedirect("/\\evil.example"), "/");
});

test("Checkout route is private and non-indexable", async () => {
  const fs = await import("node:fs/promises");
  const source = await fs.readFile("app/(storefront)/checkout/page.tsx", "utf8");
  assert.match(source, /force-dynamic/);
  assert.match(source, /index:\s*false/);
  assert.match(source, /resolveCurrentCustomer/);
  assert.match(source, /\/login\?next=/);
});

test("Checkout UI submits only address intent to the Checkout boundary", async () => {
  const fs = await import("node:fs/promises");
  const source = await fs.readFile("components/storefront/checkout-page.tsx", "utf8");
  assert.match(source, /fetch\("\/api\/checkout"/);
  assert.match(source, /selectedAddressId/);
  assert.match(source, /cache:\s*"no-store"/);
  assert.doesNotMatch(source, /customerId:\s*customer\.id/);
  assert.doesNotMatch(source, /JSON\.stringify\(\{[^}]*total/);
  assert.doesNotMatch(source, /JSON\.stringify\(\{[^}]*price/);
  assert.match(source, /Payment unavailable/);
});

test("Checkout UI has explicit validation and session states", async () => {
  const fs = await import("node:fs/promises");
  const source = await fs.readFile("components/storefront/checkout-page.tsx", "utf8");
  for (const state of ["loading", "validating", "valid", "address_required", "price_changed", "availability_changed", "cart_changed", "session_expired", "server_error"]) {
    assert.match(source, new RegExp('"' + state + '"'));
  }
});

test("Checkout uses customer-owned address API rather than ORM access", async () => {
  const fs = await import("node:fs/promises");
  const source = await fs.readFile("components/storefront/checkout-page.tsx", "utf8");
  assert.match(source, /\/api\/customer\/addresses/);
  assert.doesNotMatch(source, /@prisma|PrismaClient|from ["']prisma/);
});
