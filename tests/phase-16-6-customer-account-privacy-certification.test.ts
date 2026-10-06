import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";

const read=(file:string)=>fs.readFileSync(file,"utf8");

test("Phase 16.6 canonical identity and session boundaries are server-side",()=>{
  const auth=read("lib/auth/service.ts");
  const session=read("lib/auth/session.ts");
  const context=read("lib/auth/context.ts");
  assert.match(auth,/hashSessionToken/);
  assert.match(auth,/session\.revokedAt/);
  assert.match(auth,/session\.expiresAt <= now\(\)/);
  assert.match(session,/randomBytes\(32\)/);
  assert.match(session,/httpOnly:\s*true/);
  assert.match(context,/createAuthenticationService\(\)\.resolveSession|createAuthenticationService\(\)/);
});

test("Phase 16.6 customer object access is scoped by authenticated identity",()=>{
  const orders=read("lib/orders/application.ts");
  const addresses=read("app/api/customer/addresses/[addressId]/route.ts");
  assert.match(orders,/getOrderByCustomer\(identifier, customer\.id\)/);
  assert.match(orders,/getOrderByNumberForCustomer\(identifier, customer\.id\)/);
  assert.match(addresses,/addresses\.getAddress\(current\.customer\.id, addressId\)/);
  assert.match(addresses,/addresses\.updateAddress\(current\.customer\.id, addressId/);
  assert.match(addresses,/addresses\.deleteAddress\(current\.customer\.id, addressId/);
});

test("Phase 16.6 profile and privacy endpoints reject client-owned identity fields",()=>{
  const profile=read("app/api/customer/profile/route.ts");
  const privacy=read("app/api/customer/privacy/route.ts");
  assert.match(profile,/Object\.keys\(body\)/);
  assert.doesNotMatch(profile,/body\.customerId|body\.role|body\.permissions/);
  assert.match(privacy,/exportCustomerData\(current\.customer\.id/);
  assert.doesNotMatch(privacy,/body\.customerId|searchParams.*customerId|params.*customerId/i);
});

test("Phase 16.6 privacy deletion preserves commercial history",()=>{
  const privacy=read("lib/customer/privacy.ts");
  assert.match(privacy,/PRIVACY_DELETE_CONFIRMATION/);
  assert.match(privacy,/anonymizedAt/);
  assert.match(privacy,/status: "DISABLED"/);
  assert.doesNotMatch(privacy,/tx\.order\.delete|tx\.payment\.delete|tx\.fulfillment\.delete|tx\.shipment\.delete/);
  assert.match(privacy,/Serializable/);
});

test("Phase 16.6 admin customer access is permission-gated and audited",()=>{
  const detail=read("app/api/admin/customers/[customerId]/route.ts");
  const profile=read("app/api/admin/customers/[customerId]/profile/route.ts");
  const status=read("app/api/admin/customers/[customerId]/status/route.ts");
  assert.match(detail,/requireAdmin\(request,"customers\.read"/);
  assert.match(detail,/auditAdminAction/);
  assert.match(profile,/requireAdmin\(request,"customers\.update"/);
  assert.match(status,/requireAdmin\(request,"customers\.status\.manage"/);
});

test("Phase 16.6 account security mutation is rate-limited and same-origin protected",()=>{
  const password=read("app/api/customer/security/password/route.ts");
  const sessions=read("app/api/customer/security/sessions/route.ts");
  assert.match(password,/assertSameOrigin/);
  assert.match(password,/rateLimiter\.consume/);
  assert.match(password,/currentPassword/);
  assert.match(sessions,/logoutAllSessions/);
  assert.match(sessions,/rateLimiter\.consume/);
});

test("Phase 16.6 cache and secret boundaries are explicit",()=>{
  const privacy=read("app/api/customer/privacy/route.ts");
  const session=read("lib/auth/session.ts");
  assert.match(privacy,/private, no-store/);
  assert.match(privacy,/x-robots-tag/);
  assert.match(session,/httpOnly:\s*true/);
  const clientFiles=["components/storefront/customer-auth-form.tsx","components/storefront/customer-security-controls.tsx","components/storefront/customer-privacy-controls.tsx"];
  for(const file of clientFiles){
    const source=read(file);
    assert.doesNotMatch(source,/QIKINK_(CLIENT_SECRET|AUTH_TOKEN)|DATABASE_URL|SESSION_SECRET|PAYMENT_SECRET|passwordHash|sessionTokenHash/i);
  }
});
