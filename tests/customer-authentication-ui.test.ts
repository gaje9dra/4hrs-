import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path: string) => readFileSync(path, "utf8");

test("login and registration forms use semantic fields and accessible validation wiring", () => {
  const source = read("components/storefront/customer-auth-form.tsx");
  assert.match(source, /<form onSubmit=/);
  assert.match(source, /label="Email address"/);
  assert.match(source, /label="Password"/);
  assert.match(source, /type="email"/);
  assert.match(source, /type="password"/);
  assert.match(source, /autoComplete="email"/);
  assert.match(source, /autoComplete=\{isRegister \? "new-password" : "current-password"\}/);
  assert.match(source, /aria-busy=/);
  assert.match(source, /<Alert/);
  assert.match(source, /preventDefault/);
});

test("authentication UI never verifies or persists credentials client-side", () => {
  const source = read("components/storefront/customer-auth-form.tsx");
  assert.doesNotMatch(source, /PrismaClient|hashPassword|verifyPassword|localStorage|sessionStorage/i);
  assert.doesNotMatch(source, /document\.cookie/i);
  assert.match(source, /credentials: "same-origin"/);
});

test("authentication redirects are constrained to same-origin relative paths", () => {
  const source = read("lib/auth/redirect.ts");
  assert.match(source, /candidate\.startsWith\("\/"\)/);
  assert.match(source, /candidate\.startsWith\("\/\/"\)/);
  assert.match(source, /parsed\.origin !== "https:\/\/4hrs\.invalid"/);
  assert.match(source, /DEFAULT_REDIRECT = "\/"/);
});

test("customer header state uses the server session API and exposes no admin state", () => {
  const source = read("components/storefront/customer-auth-status.tsx");
  assert.match(source, /\/api\/auth\/session/);
  assert.match(source, /\/api\/auth\/logout/);
  assert.match(source, /credentials: "same-origin"/);
  assert.doesNotMatch(source, /admin|passwordHash|sessionToken/i);
});

test("Bauhaus auth surfaces use existing primitives and token classes", () => {
  const form = read("components/storefront/customer-auth-form.tsx");
  assert.match(form, /Card/);
  assert.match(form, /Button/);
  assert.match(form, /Input/);
  assert.match(form, /Alert/);
  assert.match(form, /FormField/);
  assert.doesNotMatch(form, /linear-gradient|backdrop-filter|glassmorphism|rounded-full/i);
});


test("header no longer exposes a visible sign-out control", () => {
  const source = read("components/storefront/customer-auth-status.tsx");
  assert.doesNotMatch(source, /Sign out|LogOut|customer\.email/);
  assert.match(source, /href="\/cart"/);
  assert.match(source, /UserRound/);
  assert.match(source, /ShoppingCart/);
});


test("Product Detail preserves the approved authenticated Cart boundary", () => {
  const source = read("components/storefront/product-options.tsx");
  assert.match(source, /CART_UNAUTHORIZED/);
  assert.match(source, /\/login\?next=%2Fcart/);
  assert.doesNotMatch(source, /customerId.*body|body.*customerId/i);
});
