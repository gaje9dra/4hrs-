import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const source = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

test("production CSP permits only the official PayU hosted checkout form targets", () => {
  const proxy = source("proxy.ts");
  assert.match(proxy, /form-action 'self' https:\/\/test\.payu\.in https:\/\/secure\.payu\.in/);
  assert.doesNotMatch(proxy, /form-action\s+[^;]*https:\/\/[^;]*(?:\*|payu\.com)/);
});

test("PayU redirect response owns a matching nonce and CSP for auto-submit", () => {
  const route = source("app/api/payments/payu/redirect/route.ts");
  assert.match(route, /randomBytes\(18\)\.toString\("base64"\)/);
  assert.match(route, /<script nonce="\$\{nonce\}">document\.getElementById\("payu"\)\.submit\(\)<\/script>/);
  assert.match(route, /\`script-src 'nonce-\$\{nonce\}'\`/);
  assert.match(route, /form-action 'self' https:\/\/test\.payu\.in https:\/\/secure\.payu\.in/);
  assert.doesNotMatch(route, /request\.headers\.get\("x-nonce"\)/);
  assert.match(route, /Cache-Control.*no-store/);
});
