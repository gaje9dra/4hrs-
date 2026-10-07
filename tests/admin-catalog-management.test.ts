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


test("catalog products can be created and updated with category assignments", async () => {
  const f=await fixture("ADMIN"); let productId:string|undefined; let categoryId:string|undefined;
  try {
    const context=await requireAdmin(f.request(),"catalog.create");
    const catalog=createCatalogService({}, { source:"MANUAL", actorType:"USER", actorId:context.adminUser.id, correlationId:undefined });
    const category=await catalog.createCategory({name:"Category Assignment Test",slug:`category-assignment-${crypto.randomUUID()}`,status:"ACTIVE"});
    categoryId=category.id;
    const product=await catalog.createProduct({
      title:"Category Assignment Product",
      slug:`category-assignment-product-${crypto.randomUUID()}`,
      description:"Product category assignment test",
      status:"DRAFT",
      price:"100.00",
      currency:"INR",
      categoryIds:[category.id],
    });
    productId=product.id;
    const details=await catalog.getProductDetails(product.id);
    assert.ok(details);
    assert.equal(details?.categories.some((item) => item.categoryId===category.id),true);

    await catalog.updateProduct({
      id:product.id,
      categoryIds:[],
      expectedUpdatedAt:details!.updatedAt.toISOString(),
    });
    const updated=await catalog.getProductDetails(product.id);
    assert.equal(updated?.categories.some((item) => item.categoryId===category.id),false);
  } finally {
    await cleanup(f,productId);
    if (categoryId) await db.category.delete({where:{id:categoryId}}).catch(()=>undefined);
  }
});


test("catalog size management creates orderable variants for customer size selection", async () => {
  const f=await fixture("ADMIN"); let productId:string|undefined;
  try {
    const context=await requireAdmin(f.request(),"catalog.create");
    const catalog=createCatalogService({}, { source:"MANUAL", actorType:"USER", actorId:context.adminUser.id, correlationId:undefined });
    const product=await catalog.createProduct({
      title:"Size Selection Product",
      slug:`size-selection-${crypto.randomUUID()}`,
      description:"Size selection fixture",
      status:"DRAFT",
      price:"349.00",
      currency:"INR",
    });
    productId=product.id;

    const variant=await catalog.createVariant({
      product: { connect: { id: product.id } },
      sku: `4HRS-${product.id.slice(0,8)}-M`,
      displayName: "Size M",
      size: "M",
      color: null,
      price: null,
      status: "ACTIVE",
    });
    const optionType=await catalog.createOptionType({name:"Size",sortOrder:0});
    const optionValue=await catalog.createOptionValue({
      optionTypeId: optionType.id,
      displayName:"M",
      normalizedValue:"m",
      sortOrder:0,
    });
    await catalog.assignProductOptionType(product.id, optionType.id, 0);
    await catalog.replaceVariantOptionValues(variant.id, [optionValue.id]);

    const details=await catalog.getProductDetails(product.id);
    assert.equal(details?.optionTypes.length,1);
    assert.equal(details?.optionTypes[0]?.optionType.normalizedName,"size");
    assert.equal(details?.variants[0]?.size,"M");
    assert.equal(details?.variants[0]?.optionValues[0]?.optionValue.displayName,"M");
  } finally {
    await cleanup(f,productId);
  }
});


test("catalog publish and unpublish actions do not require a reason", async () => {
  const source=await read("app/admin/catalog/[id]/page.tsx");
  assert.match(source,/label="Publish" expectedUpdatedAt=/);
  assert.match(source,/label="Unpublish" expectedUpdatedAt=/);
  assert.doesNotMatch(source,/label="Publish" reasonRequired/);
  assert.doesNotMatch(source,/label="Unpublish" reasonRequired/);
});


test("publish and unpublish do not require an audit reason", async () => {
  const source=await read("lib/admin/catalog.ts");
  assert.match(source,/action === "archive" \|\| action === "restore"/);
  assert.match(source,/action === "publish".*reason|reason.*action === "publish"/s);
  assert.match(source,/export const publishCatalogProduct/);
  assert.match(source,/export const unpublishCatalogProduct/);
});


test("product size management generates variant SKUs from one base SKU", async () => {
  const manager=await read("components/admin/catalog/catalog-variant-manager.tsx");
  assert.match(manager,/function skuFor\(baseSku:string,size:string\)/);
  assert.match(manager,/\$\{baseSku\.trim\(\)\.replace\(\/-\+\$\/, ""\)\}-\$\{compact\}/);
  assert.match(manager,/Add the product base SKU first/);
  assert.match(manager,/providerSku.*input\.sku/);
});

test("product model exposes a single base SKU for automatic size suffixes", async () => {
  const schema=await read("prisma/schema.prisma");
  assert.match(schema,/baseSku\s+String\?\s+@unique/);
  const form=await read("components/admin/catalog/catalog-product-form.tsx");
  assert.match(form,/name="baseSku"/);
  assert.match(form,/987364-M/);
});


test("admin catalog exposes permanent product deletion", async () => {
  const api=await read("app/api/admin/catalog/[productId]/route.ts");
  assert.match(api,/export async function DELETE/);
  assert.match(api,/requireAdmin\(request, "catalog\.archive"\)/);
  const page=await read("app/admin/catalog/page.tsx");
  assert.match(page,/CatalogDeleteButton/);
  const button=await read("components/admin/catalog/catalog-delete-button.tsx");
  assert.match(button,/cannot be undone/);
  assert.match(button,/method: "DELETE"/);
});

test("catalog service exposes product deletion", async () => {
  const service=await read("lib/catalog/service.ts");
  assert.match(service,/async deleteProduct\(id: string\)/);
  const repository=await read("lib/catalog/repository.ts");
  assert.match(repository,/export async function deleteProduct\(id: string/);
});


test("catalog delete cleans disposable cart and inventory dependencies", async () => {
  const repository=await read("lib/catalog/repository.ts");
  assert.match(repository,/cartItem\.deleteMany\(\{ where: \{ productId: id \} \}\)/);
  assert.match(repository,/inventoryTransaction\.deleteMany/);
  assert.match(repository,/inventory\.deleteMany/);
  assert.match(repository,/db\.\$transaction/);
});

test("catalog delete button handles structured API errors", async () => {
  const button=await read("components/admin/catalog/catalog-delete-button.tsx");
  assert.match(button,/typeof apiError === "string"/);
  assert.match(button,/typeof apiError\.message === "string"/);
});


test("catalog delete validates origin and resolves the admin session from server cookies", async () => {
  const route=await read("app/api/admin/catalog/[productId]/route.ts");
  assert.match(route,/isTrustedStateChangingRequest\(request\)/);
  assert.match(route,/requireAdmin\(undefined, "catalog\.archive"\)/);
});


test("catalog delete does not mask non-auth failures as authentication errors", async () => {
  const route=await read("app/api/admin/catalog/[productId]/route.ts");
  assert.match(route,/error instanceof AuthenticationError/);
  assert.match(route,/console\.error\("\[admin\/catalog\/delete\]"/);
  assert.match(route,/status: 500/);
});


test("catalog deletion explicitly cleans non-cascading dependencies", async () => {
  const repository=await read("lib/catalog/repository.ts");
  assert.match(repository,/fulfillmentProviderMapping\.deleteMany/);
  assert.match(repository,/productVariantOptionValue\.deleteMany/);
  assert.match(repository,/inventory\.findMany/);
  assert.match(repository,/inventoryTransaction\.deleteMany/);
  assert.match(repository,/inventory\.deleteMany/);
  assert.match(repository,/cartItem\.deleteMany/);
});

test("successful product deletion is not reported as failed when audit logging fails", async () => {
  const admin=await read("lib/admin/catalog.ts");
  assert.match(admin,/deleteProduct\(id\)/);
  assert.match(admin,/admin\/catalog\/delete-audit/);
  assert.match(admin,/return result;/);
});


test("catalog delete imports its permission guard", async () => {
  const source=await read("lib/admin/catalog.ts");
  assert.match(source,/requireHighRiskReason, requirePermission/);
  assert.match(source,/requirePermission\(context, "catalog\.archive"\)/);
});


test("catalog database errors identify base SKU conflicts and stale schema", async () => {
  const service=await read("lib/catalog/service.ts");
  assert.match(service,/normalizedTarget\.includes\("basesku"\)/);
  assert.match(service,/error\.code === "P2022"/);
  assert.match(service,/prisma migrate deploy/);
});
