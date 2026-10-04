import test from "node:test";
import assert from "node:assert/strict";
import { db } from "@/lib/db/client";
import { hashPassword } from "@/lib/auth/password";
import { createSessionToken, hashSessionToken, CUSTOMER_SESSION_TTL_SECONDS } from "@/lib/auth/session";
import { requireAdmin, requireHighRiskReason } from "@/lib/admin/authorization";
import { AdminError } from "@/lib/admin/errors";
import { updateAdminUser } from "@/lib/admin/application";
import { recordAdminAudit } from "@/lib/admin/audit";

async function fixture(role: "SUPER_ADMIN"|"ADMIN"|"OPERATIONS"|"VIEWER") {
  const email = `phase14-1-${role.toLowerCase()}-${crypto.randomUUID()}@example.test`;
  const passwordHash = await hashPassword("Phase14-1-Secure-Test-Password!");
  const roleRow = await db.adminRole.findUnique({ where: { name: role } });
  assert.ok(roleRow);
  const customer = await db.customer.create({ data: { email, status: "ACTIVE", credential: { create: { passwordHash } } } });
  const sessionToken = createSessionToken();
  const session = await db.customerSession.create({ data: { customerId: customer.id, sessionTokenHash: hashSessionToken(sessionToken), expiresAt: new Date(Date.now()+CUSTOMER_SESSION_TTL_SECONDS*1000) } });
  const admin = await db.adminUser.create({ data: { customerId: customer.id, roles: { create: { roleId: roleRow.id } } } });
  return { customer, session, admin, request: () => new Request("https://4hrs.test/admin", { headers: { cookie: `customer_session=${sessionToken}` } }) };
}
async function cleanup(f: Awaited<ReturnType<typeof fixture>>) {
  await db.adminAuditLog.deleteMany({ where: { actorAdminId: f.admin.id } });
  await db.adminUser.delete({ where: { id: f.admin.id } });
  await db.customerSession.delete({ where: { id: f.session.id } });
  await db.customerCredential.deleteMany({ where: { customerId: f.customer.id } });
  await db.customer.delete({ where: { id: f.customer.id } });
}

test("admin authentication requires explicit AdminUser authority and resolves role permissions", async () => {
  const f = await fixture("VIEWER");
  try {
    const context = await requireAdmin(f.request(), "catalog.read");
    assert.equal(context.customer.id, f.customer.id);
    assert.ok(context.permissions.has("catalog.read"));
    await assert.rejects(() => requireAdmin(f.request(), "catalog.update"), (error) => error instanceof AdminError && error.code === "FORBIDDEN");
  } finally { await cleanup(f); }
});

test("disabled administrators cannot continue using an old customer session", async () => {
  const f = await fixture("ADMIN");
  try {
    await db.adminUser.update({ where: { id: f.admin.id }, data: { status: "DISABLED" } });
    await assert.rejects(() => requireAdmin(f.request()), (error) => error instanceof AdminError && error.code === "ADMIN_REQUIRED");
  } finally { await cleanup(f); }
});

test("self-escalation is rejected and final active super-admin protection is enforced", async () => {
  const first = await fixture("SUPER_ADMIN");
  const second = await fixture("SUPER_ADMIN");
  try {
    const context = await requireAdmin(first.request());
    await assert.rejects(
      () => updateAdminUser(context, { id: first.admin.id, expectedVersion: first.admin.version, roles: ["SUPER_ADMIN"], reason: "attempted self change" }),
      (error) => error instanceof AdminError && error.code === "FORBIDDEN",
    );
    const secondRow = await db.adminUser.findUnique({ where: { id: second.admin.id } });
    assert.ok(secondRow);
    await updateAdminUser(context, { id: second.admin.id, expectedVersion: secondRow.version, status: "DISABLED", reason: "offboarding administrator" });
    const currentFirst = await db.adminUser.findUnique({ where: { id: first.admin.id } });
    assert.ok(currentFirst);
    await assert.rejects(
      () => updateAdminUser(context, { id: second.admin.id, expectedVersion: 2, status: "DISABLED", reason: "final admin protection" }),
      (error) => error instanceof AdminError && error.code === "CONFLICT",
    );
  } finally { await cleanup(first); await cleanup(second); }
});

test("privileged reasons reject malformed input and audit records exclude secret-shaped metadata", async () => {
  assert.throws(() => requireHighRiskReason("x"), (error) => error instanceof AdminError && error.code === "INVALID_REQUEST");
  const f = await fixture("ADMIN");
  try {
    await recordAdminAudit({ actorAdminId: f.admin.id, action: "TEST_PRIVILEGED_ACTION", success: true, reason: "security test", metadata: { password: "do-not-store", token: "do-not-store", safe: "ok" } });
    const row = await db.adminAuditLog.findFirst({ where: { actorAdminId: f.admin.id, action: "TEST_PRIVILEGED_ACTION" } });
    assert.ok(row);
    assert.deepEqual(row.metadata, { safe: "ok" });
  } finally { await cleanup(f); }
});


test("the permanent super administrator keeps full access and cannot be modified", async () => {
  const actor = await fixture("SUPER_ADMIN");
  const roleRow = await db.adminRole.findUnique({ where: { name: "SUPER_ADMIN" } });
  assert.ok(roleRow);
  const customer = await db.customer.create({
    data: { email: "gaje9dra@gmail.com", status: "ACTIVE", credential: { create: { passwordHash: await hashPassword("Permanent-Super-Admin-Test!") } } },
  });
  const target = await db.adminUser.create({
    data: { customerId: customer.id, status: "DISABLED", roles: { create: { roleId: roleRow.id } } },
  });
  const sessionToken = createSessionToken();
  const session = await db.customerSession.create({
    data: { customerId: customer.id, sessionTokenHash: hashSessionToken(sessionToken), expiresAt: new Date(Date.now()+CUSTOMER_SESSION_TTL_SECONDS*1000) },
  });
  try {
    const context = await requireAdmin(new Request("https://4hrs.test/admin", { headers: { cookie: `customer_session=${sessionToken}` } }), "system.settings.manage");
    assert.deepEqual([...context.roles], ["SUPER_ADMIN"]);
    assert.ok(context.permissions.has("system.settings.manage"));
    await assert.rejects(
      () => updateAdminUser(actorContext(actor), { id: target.id, expectedVersion: target.version, status: "DISABLED", roles: ["ADMIN"], reason: "attempt to modify protected administrator" }),
      (error) => error instanceof AdminError && error.code === "FORBIDDEN",
    );
  } finally {
    await db.adminAuditLog.deleteMany({ where: { actorAdminId: actor.admin.id } });
    await db.customerSession.delete({ where: { id: session.id } });
    await db.adminUser.delete({ where: { id: target.id } });
    await db.customerCredential.deleteMany({ where: { customerId: customer.id } });
    await db.customer.delete({ where: { id: customer.id } });
    await cleanup(actor);
  }
});

function actorContext(f: Awaited<ReturnType<typeof fixture>>) {
  return {
    customer: { id: f.customer.id, email: f.customer.email, status: f.customer.status },
    adminUser: { id: f.admin.id, customerId: f.admin.customerId, status: f.admin.status, version: f.admin.version, roles: ["SUPER_ADMIN"] },
    permissions: new Set(["admin.users.manage"]) as any,
    roles: new Set(["SUPER_ADMIN"]),
  };
}
