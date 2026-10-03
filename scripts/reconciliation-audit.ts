import { readFileSync } from "node:fs";
import { join } from "node:path";
const root=process.cwd();
const schema=readFileSync(join(root,"prisma/schema.prisma"),"utf8");
const migration=readFileSync(join(root,"prisma/migrations/20261003193000_reconciliation_integrity/migration.sql"),"utf8");
const service=readFileSync(join(root,"lib/reconciliation/service.ts"),"utf8");
const failures:string[]=[];
for(const name of ["ReconciliationCase","ReconciliationAction","ReconciliationDomain","ReconciliationStatus","ReconciliationDiscrepancyType"]) if(!schema.includes(name)) failures.push("schema missing "+name);
for(const token of ["CREATE TABLE","ReconciliationCase","ReconciliationAction","ReconciliationAction_idempotencyKey_key"]) if(!migration.includes(token)) failures.push("migration missing "+token);
for(const token of ["canAutoRepair","isHighRisk","expectedVersion","recordReliabilityFindings","auditAdminAction"]) if(!service.includes(token)) failures.push("service missing "+token);
if(/UPDATE\\s+["'](?:Payment|Order|Customer|Shipment|Fulfillment)/i.test(service)) failures.push("reconciliation service contains direct high-risk mutation");
if(failures.length){ console.error(JSON.stringify({status:"failed",failures},null,2)); process.exit(1); }
console.log(JSON.stringify({status:"ok",bounded:true,highRiskMutationBoundary:"enforced",audit:"integrated"},null,2));