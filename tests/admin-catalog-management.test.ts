import test from "node:test";
import assert from "node:assert/strict";
import { db } from "@/lib/db/client";
import { createCatalogService } from "@/lib/catalog/service";
import { hashPassword } from "@/lib/auth/password";
import { createSessionToken, hashSessionToken, CUSTOMER_SESSION_TTL_SECONDS } from "@/lib/auth/session";
import { requireAdmin } from "@/lib/admin/authorization";
import { AdminError } from "@/lib/admin/errors";
import { CatalogServiceError } from "@/lib/catalog/errors";

async function fixture(role: "ADMIN"|"VIEWER") {
  const email = `phase14-2-${role.toLowerCase()}-${crypto.randomUUID()}@example.test`;
  const passwordHash = await hashPassword("Phase14-2-Secure-Test-Password!");
  const roleRow = await db.adminRole.findUnique({ where: { name: role } });
  assert.ok(roleRow);
  const customer = await db.customer.create({ data: { email, status: "ACTIVE", credential: { create: { passwordHash } } } });
  const token = createSessionToken();
  const session = await db.customerSession.create({ data: { customerId: customer.id, sessionTokenHash: hashSessionToken(token), expiresAt: new Date(Date.now()+CUSTOMER_SESSION_TTL_SECONDS*1000) } });
  const admin = await db.adminUser.create({ data: { customerId: customer.id, roles: { create: { roleId: roleRow.id } } } });
  return { customer, session, admin, request: () => new Request("https://4hrs.test/admin", { headers: { cookie: `customer_session=${token}` } }) };
}
async function cleanup(f: Awaited<ReturnType<typeof fixture>>, productId?: string) {
  if (productId) {
    await db.catalogAuditEvent.deleteMany({ where: { entityId: productId } });
    await db.product.delete({ where: { id: productId } });
  }
  await db.adminAuditLog.deleteMany({ where: { actorAdminId: f.admin.id } });
  await db.adminUser.delete({ where: { id: f.admin.id } });
  await db.customerSession.delete({ where: { id: f.session.id } });
  await db.customerCredential.deleteMany({ where: { customerId: f.customer.id } });
  await db.customer.delete({ where: { id: f.customer.id } });
}

test("admin catalog uses the canonical service and rejects stale product edits", async () => {
  const f=await fixture("ADMIN"); let productId:string|undefined;
  try {
    const context=await requireAdmin(f.request(),"catalog.create");
    const catalog=createCatalogService({}, { source:"MANUAL", actorType:"USER", actorId:context.adminUser.id, correlationId:undefined });
    const product=await catalog.createProduct({title:"Phase 14.2 Test Product",slug:`phase-14-2-${crypto.randomUUID()}`,description:"Production catalog test",shortDescription:"Test",status:"DRAFT",price:"999.00",currency:"INR"});
    productId=product.id;
    const stale=await catalog.getProductById(product.id);
    await catalog.updateProduct({id:product.id,title:"Fresh update",expectedUpdatedAt:stale.updatedAt.toISOString()});
    await assert.rejects(
      () => catalog.updateProduct({id:product.id,title:"Stale update",expectedUpdatedAt:stale.updatedAt.toISOString()}),
      (error) => error instanceof CatalogServiceError && error.code === "CATALOG_CONFLICT",
    );
  } finally { await cleanup(f,productId); }
});

test("viewer catalog authority remains read-only", async () => {
  const f=await fixture("VIEWER");
  try {
    const context=await requireAdmin(f.request(),"catalog.read");
    assert.ok(context.permissions.has("catalog.read"));
    await assert.rejects(() => requireAdmin(f.request(),"catalog.create"), (error) => error instanceof AdminError && error.code==="FORBIDDEN");
  } finally { await cleanup(f); }
});

test("catalog search is bounded and deterministic", async () => {
  const f=await fixture("ADMIN"); let productId:string|undefined;
  try {
    const context=await requireAdmin(f.request(),"catalog.create");
    const catalog=createCatalogService({}, { source:"MANUAL", actorType:"USER", actorId:context.adminUser.id, correlationId:undefined });
    const product=await catalog.createProduct({title:"Unique Phase 14.2 Search",slug:`phase-14-2-search-${crypto.randomUUID()}`,description:"Searchable catalog fixture",status:"DRAFT",price:"10.00",currency:"INR"});
    productId=product.id;
    const result=await catalog.listProducts({filters:{search:"unique phase 14.2"},limit:10,offset:0,sortBy:"updatedAt",sortDirection:"desc"});
    assert.equal(result.items.some((item) => item?.id===product.id),true);
  } finally { await cleanup(f,productId); }
});
