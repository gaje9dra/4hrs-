import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";

const read=(p:string)=>fs.readFileSync(p,"utf8");

test("Phase 16.8 certification artifacts exist",()=>{
  assert.ok(fs.existsSync("scripts/phase-16-8-database-migration-certification.ts"));
  assert.ok(fs.existsSync("docs/phase-16-8-database-migration-certification.md"));
  assert.match(read("package.json"),/production-certification:phase-16-8/);
});

test("canonical database architecture remains singular",()=>{
  const schema=read("prisma/schema.prisma");
  for(const model of ["Customer","Product","ProductVariant","Payment","PaymentRefund","Order","OrderItem","Fulfillment","Shipment","ReturnRequest","AdminUser","AdminAuditLog"]) {
    assert.match(schema,new RegExp(`model\\s+${model}\\s+\\{`));
  }
  assert.doesNotMatch(schema,/SECONDARY_DATABASE|DuplicateDatabase|ShadowStore/i);
});

test("migration policy forbids destructive shortcuts",()=>{
  const workflow=read(".github/workflows/ci.yml");
  assert.doesNotMatch(workflow,/prisma\\s+db\\s+push/i);
  assert.doesNotMatch(workflow,/prisma\\s+migrate\\s+reset/i);
  assert.match(read("prisma/migrations/migration_lock.toml"),/provider = "postgresql"/);
});

test("critical persistence models expose database idempotency constraints",()=>{
  const schema=read("prisma/schema.prisma");
  for(const model of ["PaymentIdempotency","FulfillmentOperationIdempotency"]) {
    const start=schema.indexOf(`model ${model} {`);
    const next=schema.indexOf("\nmodel ",start+7);
    const block=schema.slice(start,next<0?schema.length:next);
    assert.match(block,/@unique|@@unique/);
  }
});

test("Phase 16.8 audit uses safe Prisma SQL APIs",()=>{
  const script=read("scripts/phase-16-8-database-migration-certification.ts");
  assert.equal(script.includes("$queryRawUnsafe("),false);
  assert.equal(script.includes("$executeRawUnsafe("),false);
  assert.match(script,/prisma\.\$queryRaw/);
  assert.match(script,/prisma\.\$transaction|transaction/i);
});

test("critical application SQL paths do not use unsafe Prisma raw APIs",()=>{
  for(const file of ["lib/admin/customer-query.ts","lib/operations/service.ts","lib/reconciliation/service.ts"]) {
    const source=read(file);
    assert.equal(source.includes("$queryRawUnsafe("),false);
    assert.equal(source.includes("$executeRawUnsafe("),false);
  }
});
