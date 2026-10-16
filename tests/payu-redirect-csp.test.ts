import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const source = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

test("production CSP permits only the official PayU hosted checkout form targets", () => {
  const proxy = source("proxy.ts");
  assert.match(proxy, /form-action 'self' https:\/\/test\.payu\.in https:\/\/secure\.payu\.in/);
  assert.doesNotMatch(proxy, /form-action\s+[^;]*https:\/\/[^;]*(?:\*|payu\.com)/);
  assert.match(proxy, /isPayURedirect/);
  assert.match(proxy, /process\.env\.NODE_ENV === "production" && !isPayURedirect/);
});

test("PayU redirect response owns a matching nonce and CSP for auto-submit", () => {
  const route = source("app/api/payments/payu/redirect/route.ts");
  assert.match(route, /randomBytes\(18\)\.toString\("base64"\)/);
  assert.match(route, /form\.submit\(\)/);
  assert.match(route, /\`script-src 'nonce-\$\{nonce\}'\`/);
  assert.match(route, /form-action 'self' https:\/\/test\.payu\.in https:\/\/secure\.payu\.in/);
  assert.doesNotMatch(route, /request\.headers\.get\("x-nonce"\)/);
  assert.doesNotMatch(route, /<button\b/i, "PayU handoff must not require a second customer click");
  assert.doesNotMatch(route, /Continue to secure payment/);
  assert.match(route, /<noscript>/);
  assert.match(route, /JavaScript must be enabled/);
  assert.match(route, /Cache-Control.*no-store/);
});

test("checkout accepts only the same-origin PayU handoff route", () => {
  const checkout = source("components/storefront/checkout-page.tsx");
  assert.match(checkout, /target\.origin !== window\.location\.origin/);
  assert.match(checkout, /target\.pathname !== "\/api\/payments\/payu\/redirect"/);
  assert.match(checkout, /paymentReference\.length > 128/);
  assert.match(checkout, /new Set<string>\(\["upi", "cards", "netbanking"\]\)\.has\(method\)/);
});
