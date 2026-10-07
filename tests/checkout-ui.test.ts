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
  assert.match(source, /PayU/);
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


test("Checkout UI retains the server revision before the first address validation", async () => {
  const fs = await import("node:fs/promises");
  const source = await fs.readFile("components/storefront/checkout-page.tsx", "utf8");
  assert.match(source, /revisionRef\.current\s*=\s*nextCheckout\.revision/);
  assert.match(source, /checkoutRequest\("POST",\s*addressId,\s*revisionRef\.current\)/);
});

test("Checkout UI guards validation against duplicate submission", async () => {
  const fs = await import("node:fs/promises");
  const source = await fs.readFile("components/storefront/checkout-page.tsx", "utf8");
  assert.match(source, /pendingRef\.current/);
  assert.match(source, /if \(pendingRef\.current\) return/);
});

test("Checkout API response is private and exposes only safe payment readiness metadata", async () => {
  const fs = await import("node:fs/promises");
  const http = await fs.readFile("lib/checkout/http.ts", "utf8");
  const contracts = await fs.readFile("lib/checkout/contracts.ts", "utf8");
  assert.match(http, /private, no-store/);
  assert.match(contracts, /checkoutReference/);
  assert.doesNotMatch(contracts, /paymentIntent|transactionId|orderId|providerSecret|cardNumber|cvv|pin/);
});
