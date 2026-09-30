import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path: string) => readFileSync(path, "utf8");

test("authentication path stays layered", () => {
  const form = read("components/storefront/customer-auth-form.tsx");
  const login = read("app/api/auth/login/route.ts");
  const service = read("lib/auth/service.ts");
  const repository = read("lib/customer/repository.ts");
  assert.match(form, /\/api\/auth\/login/);
  assert.match(login, /createAuthenticationService/);
  assert.doesNotMatch(login, /PrismaClient|prisma\./i);
  assert.match(service, /createCustomerRepository/);
  assert.match(repository, /database\.customer/);
});

test("customer/admin privilege boundary remains separate", () => {
  for (const source of [
    read("lib/customer/contracts.ts"),
    read("components/storefront/customer-auth-status.tsx"),
    read("components/storefront/customer-auth-form.tsx"),
  ]) {
    assert.doesNotMatch(source, /adminRole|adminPermissions|admin_session|passwordHash|sessionTokenHash/i);
  }
  assert.match(read("lib/cart/auth-ownership.ts"), /customerId/);
});

test("registration and login normalize credentials and never expose protected fields", () => {
  const service = read("lib/auth/service.ts");
  assert.match(service, /normalizeCustomerEmail/);
  assert.match(service, /hashPassword/);
  assert.match(service, /verifyPassword/);
  assert.match(service, /P2002/);
  assert.match(service, /INVALID_CREDENTIALS/);
  assert.doesNotMatch(service, /return.*passwordHash|return.*sessionTokenHash/i);
});

test("session cookie is opaque, HttpOnly, SameSite protected and secure in production", () => {
  const source = read("lib/auth/session.ts");
  assert.match(source, /randomBytes\(32\)/);
  assert.match(source, /sha256/);
  assert.match(source, /httpOnly: true/);
  assert.match(source, /secure: process\.env\.NODE_ENV === "production"/);
  assert.match(source, /sameSite: "lax"/);
  assert.match(source, /maxAge: CUSTOMER_SESSION_TTL_SECONDS/);
});

test("redirect validation rejects external and malformed destinations", () => {
  const source = read("lib/auth/redirect.ts");
  assert.match(source, /!candidate\.startsWith\("\/"\)/);
  assert.match(source, /candidate\.startsWith\("\/\/"\)/);
  assert.match(source, /parsed\.origin !== "https:\/\/4hrs\.invalid"/);
  assert.doesNotMatch(source, /javascript:/i);
});

test("account identity is always derived from the server session", () => {
  for (const route of [
    "app/(storefront)/account/page.tsx",
    "app/(storefront)/account/profile/page.tsx",
    "app/api/customer/profile/route.ts",
  ]) {
    const source = read(route);
    assert.match(source, /requireCurrentCustomer/);
    assert.doesNotMatch(source, /searchParams.*customerId|customerId.*body/i);
  }
});

test("profile mutation is allowlisted and customer DTO is secret-free", () => {
  const api = read("app/api/customer/profile/route.ts");
  const validation = read("lib/customer/validation.ts");
  const dto = read("lib/customer/contracts.ts");
  assert.match(api, /displayName/);
  assert.match(validation, /DISPLAY_NAME_MAX_LENGTH|120/);
  assert.doesNotMatch(api, /passwordHash|sessionToken|role|permissions/i);
  assert.doesNotMatch(dto, /passwordHash|sessionTokenHash|sessionToken|credential|sessions/);
});

test("Cart remains bound to authenticated customer identity", () => {
  const api = read("lib/cart/api.ts");
  const ownership = read("lib/cart/auth-ownership.ts");
  assert.match(api, /resolveCurrentCustomer/);
  assert.match(api, /customerId/);
  assert.match(ownership, /cart\.customerId !== customerId/);
  assert.doesNotMatch(api, /guest|anonymous.*cart.*create/i);
});

test("logout is server-backed and does not delete the customer's Cart", () => {
  const logout = read("app/api/auth/logout/route.ts");
  const header = read("components/storefront/customer-auth-status.tsx");
  assert.match(logout, /authentication\.logout/);
  assert.match(logout, /cookies\.set/);
  assert.match(header, /router\.replace\("\/"\)/);
  assert.doesNotMatch(logout, /delete.*cart|clearCart/i);
});

test("private account pages are dynamic and non-indexable", () => {
  for (const route of ["app/(storefront)/account/page.tsx", "app/(storefront)/account/profile/page.tsx"]) {
    const source = read(route);
    assert.match(source, /force-dynamic/);
    assert.match(source, /index: false, follow: false, noarchive: true/);
  }
});

test("no premature downstream commerce surfaces were introduced", () => {
  for (const path of [
    "app/(storefront)/wishlist/page.tsx",
    "app/(storefront)/checkout/page.tsx",
    "app/(storefront)/orders/page.tsx",
  ]) {
    try {
      readFileSync(path, "utf8");
      assert.fail(path + " must remain deferred");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }
});
