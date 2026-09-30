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

test("current Cart ownership remains fail-closed until trusted identity exists", () => {
  const service = fs.readFileSync(path.join(root, "lib/cart/service.ts"), "utf8");
  assert.match(service, /CART_OWNERSHIP_UNAVAILABLE/);
  assert.match(service, /CartOwnershipBoundary/);
  assert.doesNotMatch(service, /customerId.*from.*request/i);
});

test("Cart now supports nullable authenticated customer ownership without breaking anonymous rows", () => {
  const schema = fs.readFileSync(path.join(root, "prisma/schema.prisma"), "utf8");
  const cartBlock = schema.match(/model Cart \{[\s\S]*?\n\}/)?.[0] ?? "";
  assert.match(cartBlock, /customerId String\?[^\n]*@unique/);\n  assert.match(cartBlock, /Customer\?/);
});

test("no customer authentication route has been introduced during the audit phase", () => {
  const appRoot = path.join(root, "app");
  const candidates = [
    "login", "register", "forgot-password", "reset-password",
    "verify-email", "account"
  ];
  for (const name of candidates) {
    assert.equal(fs.existsSync(path.join(appRoot, name)), false, "unexpected auth route: /" + name);
  }
});
