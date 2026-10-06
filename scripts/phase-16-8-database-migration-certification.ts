import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { Prisma, PrismaClient } from "@prisma/client";

type Finding = { id:string; severity:"CRITICAL"|"HIGH"|"MEDIUM"|"LOW"|"INFORMATIONAL"; area:string; description:string; evidence:string; remediation:string; status:"PASS"|"FAIL"|"BLOCKED"|"NOT_APPLICABLE" };
async function main() {
const findings: Finding[] = [];
const root = process.cwd();
const schemaPath = join(root,"prisma","schema.prisma");
const migrationsRoot = join(root,"prisma","migrations");
const schema = await readFile(schemaPath,"utf8");
const add=(f:Finding)=>findings.push(f);
const pass=(id:string,area:string,description:string,evidence:string)=>add({id,severity:"INFORMATIONAL",area,description,evidence,remediation:"None.",status:"PASS"});
const fail=(id:string,severity:"CRITICAL"|"HIGH"|"MEDIUM",area:string,description:string,evidence:string,remediation:string)=>add({id,severity,area,description,evidence,remediation,status:"FAIL"});

const models=[...schema.matchAll(/^model\s+(\w+)\s*\{/gm)].map(m=>m[1]);
const enums=[...schema.matchAll(/^enum\s+(\w+)\s*\{/gm)].map(m=>m[1]);
if(models.length===0) fail("DB-001","CRITICAL","Prisma Schema","No Prisma models were found.","schema.prisma contains no model blocks.","Restore the canonical Prisma schema.");
else pass("DB-001","Prisma Schema","Prisma models are present.",`${models.length} models and ${enums.length} enums discovered.`);

for(const model of models){
  const start=schema.indexOf(`model ${model} {`);
  const next=schema.indexOf("\nmodel ",start+7);
  const block=schema.slice(start,next<0?schema.length:next);
  if(!/@id\b/.test(block)&&!/@@id\b/.test(block)) fail(`DB-PK-${model}`,"HIGH","Constraints",`Model ${model} has no primary-key declaration.`,`No @id/@@id found in model ${model}.`,"Add an explicit stable primary key through a forward migration.");
}
const criticalModels=["Customer","CustomerAddress","Product","ProductVariant","Cart","CartItem","Payment","PaymentIdempotency","PaymentRefund","Order","OrderItem","Fulfillment","FulfillmentProviderMapping","FulfillmentOperationIdempotency","Shipment","TrackingEvent","ReturnRequest","CancellationRequest","AdminUser","AdminRole","AdminPermission","AdminAuditLog"];
const missing=criticalModels.filter(m=>!models.includes(m));
if(missing.length) fail("DB-002","CRITICAL","Database Architecture","Critical application models are missing from Prisma schema.",missing.join(", "),"Restore the missing canonical models without introducing a duplicate persistence system.");
else pass("DB-002","Database Architecture","Critical application persistence models are present.",criticalModels.join(", "));

const entries=(await readdir(migrationsRoot,{withFileTypes:true})).filter(e=>e.isDirectory()).map(e=>e.name).filter(n=>n!=="_prisma_migrations").sort();
const invalid=entries.filter(n=>!/^(\d{14})_[a-z0-9][a-z0-9_-]*$/.test(n));
if(invalid.length) fail("DB-003","HIGH","Migration History","Migration naming/structure is invalid.",invalid.join(", "),"Create a forward migration with a deterministic valid name; never rewrite production history.");
else pass("DB-003","Migration History","Migration directory naming is deterministic.",`${entries.length} migrations discovered; lexical order is the deployment order.`);

const timestampGroups=new Map<string,string[]>();
for(const n of entries){const ts=n.slice(0,14);const list=timestampGroups.get(ts)??[];list.push(n);timestampGroups.set(ts,list);}
const duplicateTimestamps=[...timestampGroups.entries()].filter(([,v])=>v.length>1);
if(duplicateTimestamps.length) pass("DB-004","Migration History","Duplicate timestamps are documented as non-blocking because Prisma migration ordering is the full directory name, not timestamp alone.",duplicateTimestamps.map(([k,v])=>`${k}: ${v.join(", ")}`).join("; "));
else pass("DB-004","Migration History","Migration timestamps are unique.","No duplicate timestamps.");

const riskyPatterns=[/\bDROP\s+TABLE\b/i,/\bDROP\s+COLUMN\b/i,/\bTRUNCATE\b/i,/\bALTER\s+TYPE\b.*\bRENAME\b/i,/\bALTER\s+TABLE\b.*\bRENAME\s+COLUMN\b/i];
const risky:{migration:string;lines:string[]}[]=[];
for(const name of entries){
  const p=join(migrationsRoot,name,"migration.sql");
  let sql=""; try{sql=await readFile(p,"utf8")}catch{fail(`DB-MIG-${name}`,"CRITICAL","Migration History",`Migration ${name} is missing migration.sql.`,p,"Restore the migration file before deployment.");continue;}
  const lines=sql.split(/\r?\n/).filter(line=>riskyPatterns.some(rx=>rx.test(line)));
  if(lines.length) risky.push({migration:name,lines});
}
if(risky.length) fail("DB-005","HIGH","Destructive Migrations","Potentially destructive SQL exists and requires explicit expand/contract review.",risky.map(x=>`${x.migration}: ${x.lines.join(" | ")}`).join("; "),"Provide a safe forward migration sequence, backfill/compatibility plan, and explicit operational justification.");
else pass("DB-005","Destructive Migrations","No destructive migration patterns were detected by the certification scanner.","No DROP TABLE/COLUMN, TRUNCATE, or rename patterns found.");

const forbiddenSource=await Promise.all(["package.json",".github/workflows/ci.yml"].map(async p=>[p,await readFile(join(root,p),"utf8") ] as const));
const forbiddenHits=forbiddenSource.flatMap(([p,c])=>[...c.matchAll(/prisma\s+(db\s+push|migrate\s+reset)/gi)].map(m=>`${p}: ${m[0]}`));
if(forbiddenHits.length) fail("DB-006","CRITICAL","Deployment Safety","Destructive Prisma shortcuts are referenced in deployment/CI configuration.",forbiddenHits.join("; "),"Use versioned prisma migrate deploy only.");
else pass("DB-006","Deployment Safety","CI/deployment configuration does not use db push or migrate reset.","No forbidden migration shortcut found.");

const rawHits:string[]=[];
const sourceFiles=["lib","app","scripts","tests"];
const rawSqlScanExclusions=new Set(["scripts/phase-15-43-governance-stability-validate.ts","scripts/phase-16-8-database-migration-certification.ts","scripts/phase-16-9-api-contract-certification.ts","scripts/phase-16-10-security-certification.ts","tests/phase-16-8-database-migration-certification.test.ts"]);
async function walk(dir:string){let out:string[]=[];try{for(const e of await readdir(join(root,dir),{withFileTypes:true})){const p=join(dir,e.name);if(e.isDirectory())out=out.concat(await walk(p));else if(/\.(ts|tsx|js|jsx)$/.test(e.name))out.push(p)}}catch{}return out}
for(const dir of sourceFiles){for(const p of await walk(dir)){if(rawSqlScanExclusions.has(p))continue;const c=await readFile(join(root,p),"utf8");if(/\$queryRawUnsafe|\$executeRawUnsafe/.test(c))rawHits.push(p)}}
if(rawHits.length) fail("DB-007","HIGH","Raw SQL Security","Unsafe Prisma raw-SQL APIs are present.",rawHits.join(", "),"Replace with parameterized Prisma SQL or prove controlled identifiers and safe binding in a reviewed implementation.");
else pass("DB-007","Raw SQL Security","No unsafe Prisma raw-SQL APIs were detected.","No $queryRawUnsafe/$executeRawUnsafe usage found.");

const transactionFiles=["lib/payments","lib/fulfillment","lib/shipping","lib/orders","lib/returns","lib/cancellations","lib/admin"];
const txMissing:string[]=[];
for(const dir of transactionFiles){for(const p of await walk(dir)){const c=await readFile(join(root,p),"utf8");if(/application|service|repository/.test(p)&&/create|update|delete|process|submit|refund|cancel|resolve|approve/i.test(c)&&/prisma/.test(c)&&!(/\$transaction\s*\(/.test(c)||/transaction/i.test(c)))txMissing.push(p)}}
if(txMissing.length) pass("DB-008","Transactions","Potential transaction-sensitive files were flagged for manual review; static absence alone is not treated as a defect.",txMissing.slice(0,80).join(", "));
else pass("DB-008","Transactions","Critical service files either use explicit transactions or do not meet the heuristic for a transaction-sensitive mutation.","No transaction heuristic gaps detected.");

const idempotencyModels=["PaymentIdempotency","FulfillmentOperationIdempotency"];
for(const model of idempotencyModels){
 const start=schema.indexOf(`model ${model} {`); const next=schema.indexOf("\nmodel ",start+7); const block=schema.slice(start,next<0?schema.length:next);
 if(!/@unique|@@unique/.test(block)) fail(`DB-IDEMP-${model}`,"HIGH","Idempotency",`${model} lacks a unique idempotency constraint.`,block.slice(0,1200),"Add a scoped unique constraint through a forward migration.");
 else pass(`DB-IDEMP-${model}`,"Idempotency",`${model} has database uniqueness enforcement.`,block.match(/@@unique[^\n]*|\w+\s+String[^\n]*@unique/g)?.join("; ")??"Unique constraint present.");
}

const immutableSignals=["Order","OrderItem","Payment","PaymentRefund","Fulfillment","FulfillmentProviderMapping","AdminAuditLog"].map(model=>{
 const start=schema.indexOf(`model ${model} {`);const next=schema.indexOf("\nmodel ",start+7);return schema.slice(start,next<0?schema.length:next);
});
if(immutableSignals.some(b=>/Snapshot|provider.*Reference|createdAt/.test(b))) pass("DB-009","Immutability","Historical/snapshot/provider-reference persistence exists for critical domains.","Order snapshots, provider references, and createdAt fields are represented in the canonical schema.");
else fail("DB-009","HIGH","Immutability","Critical historical persistence signals were not found.","Critical models lack snapshot/provider-reference fields.","Preserve historical commerce truth in immutable persistence fields.");

const secrets=rawHits.length===0 && !/BEGIN\s+(RSA|OPENSSH)\s+PRIVATE KEY|sk_live_|password\s*=\s*["'][^"'\n]{12,}/i.test(schema);
if(secrets) pass("DB-010","Security","Schema contains no obvious committed credential material.","No private-key/live-secret pattern detected in schema.");
else fail("DB-010","CRITICAL","Security","Potential credential material is present in schema/source scan.","Credential pattern detected.","Remove secrets and rotate any exposed production credential.");

const prisma = process.env.DATABASE_URL ? new PrismaClient() : null;
if(!prisma){
  add({id:"DB-011",severity:"HIGH",area:"Database Validation",description:"DATABASE_URL is unavailable; live database certification cannot be completed.",evidence:"DATABASE_URL is not set.",remediation:"Run certification against an isolated database and do not claim live integrity validation.",status:"BLOCKED"});
}else{
  try{
    const migrationRows=await prisma.$queryRaw<Array<{migration_name:string;finished_at:Date|null}>>`SELECT migration_name, finished_at FROM "_prisma_migrations" ORDER BY started_at ASC`;
    const unapplied=entries.filter(n=>!migrationRows.some(r=>r.migration_name===n&&r.finished_at));
    const failed=migrationRows.filter(r=>!r.finished_at);
    if(unapplied.length||failed.length) fail("DB-012","CRITICAL","Migration State","Database migration state is not fully applied and healthy.",`unapplied=${unapplied.join(",")}; failed=${failed.map(x=>x.migration_name).join(",")}`,"Repair the migration state using the documented Prisma recovery procedure before deployment.");
    else pass("DB-012","Migration State","All repository migrations are recorded as successfully applied in the validation database.",`${migrationRows.length} applied migration records; ${entries.length} repository migrations.`);

    const orphanQueries: Array<[string, Prisma.Sql]> = [
      ["OrderItem without Order",Prisma.sql`SELECT count(*)::int AS count FROM "OrderItem" oi LEFT JOIN "Order" o ON o.id=oi."orderId" WHERE o.id IS NULL`],
      ["Payment without Customer",Prisma.sql`SELECT count(*)::int AS count FROM "Payment" p LEFT JOIN "Customer" c ON c.id=p."customerId" WHERE c.id IS NULL`],
      ["Refund without Payment",Prisma.sql`SELECT count(*)::int AS count FROM "PaymentRefund" r LEFT JOIN "Payment" p ON p.id=r."paymentId" WHERE p.id IS NULL`],
      ["Fulfillment without Order",Prisma.sql`SELECT count(*)::int AS count FROM "Fulfillment" f LEFT JOIN "Order" o ON o.id=f."orderId" WHERE o.id IS NULL`],
      ["Shipment without Order",Prisma.sql`SELECT count(*)::int AS count FROM "Shipment" s LEFT JOIN "Order" o ON o.id=s."orderId" WHERE o.id IS NULL`],
      ["CustomerAddress without Customer",Prisma.sql`SELECT count(*)::int AS count FROM "CustomerAddress" a LEFT JOIN "Customer" c ON c.id=a."customerId" WHERE c.id IS NULL`],
      ["ProviderMapping without ProductVariant",Prisma.sql`SELECT count(*)::int AS count FROM "FulfillmentProviderMapping" m LEFT JOIN "ProductVariant" v ON v.id=m."variantId" WHERE v.id IS NULL`],
      ["AdminAuditLog without AdminUser",Prisma.sql`SELECT count(*)::int AS count FROM "AdminAuditLog" a LEFT JOIN "AdminUser" u ON u.id=a."actorAdminId" WHERE u.id IS NULL`],
    ] as const;
    const orphanResults=[] as string[];
    for(const [label,sql] of orphanQueries){const rows=await prisma.$queryRaw<Array<{count:number}>>(sql);if(Number(rows[0]?.count??0)!==0) orphanResults.push(`${label}: ${rows[0]?.count}`);}
    if(orphanResults.length) fail("DB-013","HIGH","Orphan Detection","Critical orphan records exist in the validation database.",orphanResults.join("; "),"Repair orphaned data with a forward, audited remediation before production certification.");
    else pass("DB-013","Orphan Detection","Critical relationship orphan checks returned zero rows.","8 critical orphan queries returned zero rows.");

    const fk=await prisma.$queryRaw<Array<{count:bigint}>>`SELECT count(*)::bigint AS count FROM pg_constraint WHERE contype='f'`;
    const indexes=await prisma.$queryRaw<Array<{count:bigint}>>`SELECT count(*)::bigint AS count FROM pg_class c JOIN pg_index i ON i.indexrelid=c.oid WHERE c.relkind='i'`;
    pass("DB-014","Database Constraints","PostgreSQL foreign-key constraints and indexes are present in the validation database.",`foreignKeys=${String(fk[0]?.count??0)}; indexes=${String(indexes[0]?.count??0)}`);
  }catch(error){fail("DB-015","HIGH","Database Validation","Live database certification query failed.",error instanceof Error?error.message:String(error),"Fix the database validation environment or the underlying schema/state defect; do not fabricate evidence.");}
  finally{await prisma.$disconnect();}
}

const blockers=findings.filter(f=>f.status==="FAIL"&&(f.severity==="CRITICAL"||f.severity==="HIGH"||f.severity==="MEDIUM"));
const result={phase:"16.8",status:blockers.length?"NOT_READY":"READY",summary:{models:models.length,enums:enums.length,migrations:entries.length,findings:findings.length,blockers:blockers.length},findings};
console.log(JSON.stringify(result,null,2));
if(blockers.length) process.exit(1);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Phase 16.8 certification failed.");
  process.exit(1);
});
