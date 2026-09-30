import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";

test("authentication API and customer UI routes are separated", () => {
  for (const route of [
    "app/api/auth/register/route.ts",
    "app/api/auth/login/route.ts",
    "app/api/auth/session/route.ts",
    "app/api/auth/logout/route.ts",
  ]) {
    assert.equal(existsSync(route), true, route + " missing");
  }

  for (const uiRoute of [
    "app/(storefront)/login/page.tsx",
    "app/(storefront)/register/page.tsx",
  ]) {
    assert.equal(existsSync(uiRoute), true, uiRoute + " missing");
  }

  for (const deferredRoute of [
    "app/(storefront)/forgot-password",
    "app/(storefront)/reset-password",
    "app/(storefront)/verify-email",
  ]) {
    assert.equal(existsSync(deferredRoute), false, deferredRoute + " must remain deferred");
  }

  assert.equal(existsSync("app/(storefront)/account"), true, "account surface is implemented in Phase 9.5");
});

test("authentication route source never accepts a customer ID as an authentication credential", () => {
  for (const route of [
    "app/api/auth/register/route.ts",
    "app/api/auth/login/route.ts",
    "app/api/auth/session/route.ts",
    "app/api/auth/logout/route.ts",
  ]) {
    const source = readFileSync(route, "utf8");
    assert.doesNotMatch(source, /customerId.*body|body.*customerId/i);
    assert.doesNotMatch(source, /passwordHash|sessionTokenHash.*json|sessionToken.*response/i);
  }
});

test("authentication UI delegates credentials to server API boundaries", () => {
  const form = readFileSync("components/storefront/customer-auth-form.tsx", "utf8");
  assert.match(form, /\/api\/auth\/login/);
  assert.match(form, /\/api\/auth\/register/);
  assert.doesNotMatch(form, /PrismaClient|passwordHash|sessionToken/i);
  assert.match(form, /credentials: "same-origin"/);
});

test("authentication pages use noindex metadata and server-side authenticated redirects", () => {
  for (const route of ["app/(storefront)/login/page.tsx", "app/(storefront)/register/page.tsx"]) {
    const source = readFileSync(route, "utf8");
    assert.match(source, /robots: \{ index: false, follow: false, noarchive: true \}/);
    assert.match(source, /resolveCurrentCustomer/);
    assert.match(source, /redirect\(next\)/);
    assert.match(source, /getSafeAuthRedirect/);
  }
});
