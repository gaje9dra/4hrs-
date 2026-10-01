import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import test from "node:test";

const read = (path: string) => readFileSync(path, "utf8");

test("account routes are private and server-protected", () => {
  for (const route of ["app/(storefront)/account/page.tsx", "app/(storefront)/account/profile/page.tsx"]) {
    const source = read(route);
    assert.match(source, /dynamic = "force-dynamic"/);
    assert.match(source, /robots: \{ index: false, follow: false, noarchive: true \}/);
    assert.match(source, /requireCurrentCustomer/);
  }
});

test("account and profile boundaries never accept browser customer IDs", () => {
  assert.doesNotMatch(read("app/(storefront)/account/page.tsx"), /searchParams|customerId|customer_id/i);
  assert.doesNotMatch(read("app/api/customer/profile/route.ts"), /customerId.*body|body.*customerId/i);
});

test("profile API is authenticated and allowlisted", () => {
  const source = read("app/api/customer/profile/route.ts");
  assert.match(source, /requireCurrentCustomer/);
  assert.match(source, /displayName/);
  assert.doesNotMatch(source, /passwordHash|sessionToken|role|permissions/i);
});

test("customer DTO excludes credentials and session secrets", () => {
  const source = read("lib/customer/contracts.ts");
  assert.doesNotMatch(source, /passwordHash|sessionTokenHash|sessionToken|credential|sessions/);
  assert.match(source, /displayName/);
});

test("profile editor sends only displayName", () => {
  const source = read("components/storefront/customer-profile-form.tsx");
  assert.match(source, /JSON\.stringify\(\{ displayName:/);
  assert.doesNotMatch(source, /password|status|role|permissions|customerId/i);
});

test("email changes remain unavailable without verification infrastructure", () => {
  const source = read("app/api/customer/profile/route.ts");
  assert.match(source, /displayName/);
  assert.doesNotMatch(source, /body\.email|updateProfile\([^\n]*email/i);
});

test("account navigation contains only implemented destinations", () => {
  const source = read("app/(storefront)/account/page.tsx");
  assert.match(source, /\/account/);
  assert.match(source, /\/account\/profile/);
  assert.match(source, /\/cart/);
  assert.doesNotMatch(source, /\/orders|\/wishlist|\/checkout/i);
});

test("authenticated header links to account and keeps logout server-backed", () => {
  const source = read("components/storefront/customer-auth-status.tsx");
  assert.match(source, /href="\/account"/);
  assert.match(source, /\/api\/auth\/logout/);
  assert.match(source, /router\.replace\("\/"\)/);
});

test("profile API uses the private auth response boundary", () => {
  const source = read("app/api/customer/profile/route.ts");
  assert.match(source, /authJson/);
  assert.doesNotMatch(source, /public,\s*max-age|s-maxage/i);
});

test("orders and wishlist remain deferred while Checkout is now implemented", () => {
  for (const route of ["app/(storefront)/orders/page.tsx", "app/(storefront)/wishlist/page.tsx"]) {
    assert.equal(existsSync(route), false, route + " must remain deferred");
  }
});
