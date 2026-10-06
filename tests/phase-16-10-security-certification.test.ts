import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
const root = process.cwd();
const read = (file:string) => fs.readFileSync(path.join(root,file),"utf8");

test("Phase 16.10 security certification is wired into CI", () => {
  const pkg = JSON.parse(read("package.json")) as {scripts:Record<string,string>};
  const ci = read(".github/workflows/ci.yml");
  assert.equal(pkg.scripts["security:certify:phase-16-10"],"tsx scripts/phase-16-10-security-certification.ts");
  assert.match(ci,/production-certification:phase-16-10/);
});
test("Strict nonce CSP remains intact", () => {
  const proxy = read("proxy.ts");
  assert.match(proxy,/nonce-/); assert.match(proxy,/strict-dynamic/);
  assert.doesNotMatch(proxy,/unsafe-inline/); assert.match(proxy,/object-src 'none'/);
  assert.match(proxy,/frame-ancestors 'none'/); assert.match(proxy,/form-action 'self'/);
});
test("Server-side session/password controls remain intact", () => {
  const session=read("lib/auth/session.ts"), password=read("lib/auth/password.ts");
  assert.match(session,/randomBytes\(32\)/); assert.match(session,/sha256/);
  assert.match(session,/httpOnly:\s*true/); assert.match(session,/sameSite:\s*"lax"/);
  assert.match(password,/scrypt/); assert.match(password,/timingSafeEqual/);
});
test("Provider secrets and upstream response bodies remain isolated", () => {
  const env=read(".env.example"), provider=read("lib/fulfillment/providers/qikink.ts");
  assert.doesNotMatch(env,/NEXT_PUBLIC_.*(?:SECRET|TOKEN|PASSWORD|PRIVATE|API_KEY)/i);
  assert.doesNotMatch(provider,/response\.(?:msg|message|error)/);
  assert.match(provider,/safeProviderMessage/);
});
