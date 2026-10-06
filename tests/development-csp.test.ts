import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

test("development proxy does not emit CSP that blocks React eval", async () => {
  const source = await readFile("proxy.ts", "utf8");

  assert.match(
    source,
    /process\.env\.NODE_ENV\s*===\s*"production"\s*\?\s*contentSecurityPolicy\(nonce\)\s*:\s*null/,
  );
  assert.match(source, /if \(csp\) requestHeaders\.set\("Content-Security-Policy", csp\)/);
  assert.match(source, /if \(csp\) response\.headers\.set\("Content-Security-Policy", csp\)/);
});

test("production CSP remains nonce-bound and strict", async () => {
  const source = await readFile("proxy.ts", "utf8");

  assert.match(source, /script-src 'self' 'nonce-\$\{nonce\}' 'strict-dynamic'/);
  assert.match(source, /object-src 'none'/);
  assert.match(source, /frame-ancestors 'none'/);
  assert.match(source, /form-action 'self'/);
  assert.match(source, /process\.env\.NODE_ENV === "development"/);
});
