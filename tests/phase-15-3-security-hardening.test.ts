import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (file: string) => fs.readFileSync(path.join(root, file), "utf8");

test("Phase 15.3 patches the Next.js security release in the locked release line", () => {
  const pkg = JSON.parse(read("package.json")) as { dependencies: Record<string, string>; devDependencies: Record<string, string> };
  assert.equal(pkg.dependencies.next, "16.3.8");
  assert.equal(pkg.devDependencies["eslint-config-next"], "16.3.8");
});

test("Security headers use a strict nonce CSP without unsafe-inline or unsafe-eval", () => {
  const proxy = read("proxy.ts");
  assert.match(proxy, /Content-Security-Policy/);
  assert.match(proxy, /nonce-/);
  assert.match(proxy, /strict-dynamic/);
  assert.doesNotMatch(proxy, /unsafe-inline/);
  assert.doesNotMatch(proxy, /unsafe-eval/);
  assert.match(proxy, /object-src 'none'/);
  assert.match(proxy, /frame-ancestors 'none'/);
  assert.match(proxy, /form-action 'self'/);
});

test("JSON-LD is explicitly nonce-bound to the request CSP", () => {
  const layout = read("app/layout.tsx");
  assert.match(layout, /x-nonce/);
  assert.match(layout, /nonce=/);
});

test("State-changing requests have an origin and fetch-metadata trust boundary", () => {
  const security = read("lib/security/request.ts");
  assert.match(security, /sec-fetch-site/);
  assert.match(security, /same-origin/);
  assert.match(security, /same-site/);
  assert.match(security, /NEXT_PUBLIC_SITE_URL/);
});

test("Authentication and admin origin checks use the shared security boundary", () => {
  assert.match(read("lib/auth/http.ts"), /isTrustedStateChangingRequest/);
  assert.match(read("lib/admin/http.ts"), /isTrustedStateChangingRequest/);
});

test("Customer state-changing API routes enforce the same-origin boundary", () => {
  assert.match(read("app/api/customer/profile/route.ts"), /assertSameOrigin/);
  assert.match(read("app/api/cart/route.ts"), /assertSameOrigin/);
  assert.match(read("app/api/cart/items/[cartItemId]/route.ts"), /assertSameOrigin/);
  assert.match(read("app/api/cases/route.ts"), /assertSameOrigin/);
  assert.match(read("app/api/order/[orderId]/cancel/route.ts"), /assertSameOrigin/);
  assert.match(read("app/api/order/[orderId]/return/route.ts"), /assertSameOrigin/);
  assert.match(read("app/api/payment/route.ts"), /assertSameOrigin/);
});

test("Private provider credentials and provider endpoints remain server-controlled", () => {
  const env = read(".env.example");
  const auth = read("lib/fulfillment/providers/qikink-auth.ts");
  const provider = read("lib/fulfillment/providers/qikink.ts");
  assert.doesNotMatch(env, /NEXT_PUBLIC_QIKINK/i);
  assert.doesNotMatch(auth, /QIKINK_API_BASE_URL/);
  assert.match(provider, /https:\/\/qikink\.com\/erp2\/index\.php\/api\/createOrder/);
  assert.match(auth, /https:\/\/api\.qikink\.com/);
  assert.match(auth, /https:\/\/sandbox\.qikink\.com/);
});

test("Provider rejection messages do not expose arbitrary upstream response bodies", () => {
  const provider = read("lib/fulfillment/providers/qikink.ts");
  assert.doesNotMatch(provider, /response\.msg/);
  assert.doesNotMatch(provider, /response\.message/);
  assert.doesNotMatch(provider, /response\.error/);
});

test("No production secret is present in repository configuration examples", () => {
  const env = read(".env.example");
  for (const key of ["QIKINK_CLIENT_SECRET", "QIKINK_SANDBOX_SECRET", "QIKINK_AUTH_TOKEN", "ADMIN_PROVISION_PASSWORD"]) {
    assert.match(env, new RegExp("^" + key + "=$", "m"));
  }
});
