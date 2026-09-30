import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";

test("authentication API boundary exposes only server routes and no customer UI", () => {
  for (const route of [
    "app/api/auth/register/route.ts",
    "app/api/auth/login/route.ts",
    "app/api/auth/session/route.ts",
    "app/api/auth/logout/route.ts",
  ]) {
    assert.equal(existsSync(route), true, route + " missing");
  }

  for (const uiRoute of [
    "app/login",
    "app/register",
    "app/forgot-password",
    "app/reset-password",
    "app/verify-email",
    "app/account",
  ]) {
    assert.equal(existsSync(uiRoute), false, uiRoute + " must not be implemented in Phase 9.3");
  }
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
