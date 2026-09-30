import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

test("customer auth architecture remains provider-neutral and separate from admin auth", () => {
  const authBoundary = fs.readFileSync(path.join(root, "lib/auth/README.md"), "utf8");
  assert.match(authBoundary, /Customer authentication is isolated under/);
  assert.match(authBoundary, /Customer and administrator identity domains remain separate/);
});

test("Cart ownership is enforced from trusted server-side customer identity", () => {
  const service = fs.readFileSync(path.join(root, "lib/cart/service.ts"), "utf8");
  const ownership = fs.readFileSync(path.join(root, "lib/cart/auth-ownership.ts"), "utf8");
  assert.match(service, /CartOwnershipBoundary/);
  assert.match(ownership, /customerId/);
  assert.doesNotMatch(ownership, /customerId.*from.*request/i);
});

test("Cart now supports nullable authenticated customer ownership without breaking anonymous rows", () => {
  const schema = fs.readFileSync(path.join(root, "prisma/schema.prisma"), "utf8");
  const cartBlock = schema.match(/model Cart \{[\s\S]*?\n\}/)?.[0] ?? "";
  assert.match(cartBlock, /customerId String\?[^\n]*@unique/);
  assert.match(cartBlock, /Customer\?/);
});

test("Phase 9.4 creates only the approved customer auth UI routes", () => {
  const rootApp = path.join(root, "app/(storefront)");
  assert.equal(fs.existsSync(path.join(rootApp, "login/page.tsx")), true);
  assert.equal(fs.existsSync(path.join(rootApp, "register/page.tsx")), true);

  for (const deferred of ["forgot-password", "reset-password", "verify-email", "account"]) {
    assert.equal(fs.existsSync(path.join(rootApp, deferred)), false, "unexpected route: /" + deferred);
  }
});
