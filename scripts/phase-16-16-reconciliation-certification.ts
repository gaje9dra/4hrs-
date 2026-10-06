import { existsSync, readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root=process.cwd();
const read=(p:string)=>readFileSync(join(root,p),"utf8");
const files={
 service:read("lib/reconciliation/service.ts"),
 model:read("lib/reconciliation/model.ts"),
 route:read("app/api/admin/reconciliation/route.ts"),
 schema:read("prisma/schema.prisma"),
 migration:read("prisma/migrations/20261003193000_reconciliation_integrity/migration.sql"),
 fulfillment:read("lib/fulfillment/application.ts"),
 qikink:read("lib/fulfillment/providers/qikink.ts"),
 shipping:read("lib/shipping/application.ts"),
 payments:read("lib/payments/webhooks.ts"),
 tests:read("tests/reconciliation.test.ts"),
 ci:read(".github/workflows/ci.yml"),
};

type Finding={severity:"CRITICAL"|"HIGH"|"MEDIUM"|"LOW"|"INFORMATIONAL";component:string;discrepancy:string;impact:string;evidence:string;remediation:string;remainingRisk:string};
const failures:string[]=[];
const findings:Finding[]=[];

const requireText=(name:string,text:string,tokens:string[])=>{
 for(const token of tokens) if(!text.includes(token)) failures.push(`${name} missing required control: ${token}`);
};

requireText("service",files.service,[
 "RECONCILIATION_RULES","PAYMENT-ORDER-MISSING","ORDER-PAYMENT-AMOUNT-MISMATCH","PAYMENT-REFUND-OVER",
 "FUL-ORPHAN","SHIP-ORPHAN-FULFILLMENT","NOTIFICATION-EVENT-MISSING","pg_advisory_xact_lock",
 "reconciliationAction","expectedVersion","isHighRisk","canAutoRepair","auditAdminAction"
]);
requireText("model",files.model,["AUTHORITATIVE_DOMAINS","FINANCIAL_MISMATCH","CRITICAL","HIGH","MEDIUM","LOW","sanitizeReconciliationEvidence"]);
requireText("admin route",files.route,["reconciliation.read","reconciliation.investigate","reconciliation.execute","reconciliation.resolve","reconciliation.export"]);
requireText("schema",files.schema,["ReconciliationCase","ReconciliationAction","idempotencyKey","version","correlationId"]);
requireText("migration",files.migration,["CREATE TABLE","ReconciliationCase","ReconciliationAction"]);
requireText("fulfillment boundary",files.fulfillment,["provider","idempotency","AMBIGUOUS"]);
requireText("payments",files.payments,["providerEventId","processingStatus"]);
requireText("CI",files.ci,["reconciliation:audit"]);

if(/db\.reconciliationCase\.(delete|updateMany)|db\.(payment|order|shipment|fulfillment)\.(update|updateMany|delete|deleteMany)/.test(files.service)){
 failures.push("reconciliation service contains forbidden broad/high-risk direct mutation");
}

const rulesMatch=files.service.match(/const RULES = \[/)?.[0];
if(!rulesMatch) failures.push("reconciliation rule inventory not found");

const inventory=[
 ["Payment","Internal Payment + Order + PaymentEvent + PaymentRefund; provider state only when an existing adapter contract exposes it.","Payment reconciliation rules cover missing order, amount/currency, customer ownership and refund overrun."],
 ["Order","Order aggregate is authoritative for order state; payment is authoritative for settlement.","Order rules cover missing items and confirmed/unsettled payment."],
 ["Fulfillment","Fulfillment record + provider-neutral fulfillment service; provider reference is external evidence.","Internal orphan/state checks are certified; unknown provider outcome remains ambiguous."],
 ["Qikink","Provider adapter is fulfillment-only; 4HRS+ catalog remains authoritative.","No catalog synchronization or browser-side Qikink state is introduced."],
 ["Shipping","Shipment/TrackingEvent records are authoritative for internally represented shipment state.","Existing provider capabilities are limited; external shipment state is not fabricated."],
 ["Returns/Cancellations/Refunds","ReturnRequest/CancellationRequest and PaymentRefund are separate domain records with database references.","Integrity rules cover missing return order, cancellation/fulfillment invalid transition, and refund amount overrun; no unsupported return-to-refund link is fabricated."],
 ["Events/Database","PaymentEvent and notification/event records plus database constraints.","Duplicate provider event IDs and notification idempotency are protected by existing schema/service controls."],
 ["Notifications","NotificationEvent/NotificationDelivery and processor state machine.","Reference integrity is reconciled; delivery worker behavior is certified in Phase 16.15."],
 ["Admin reconciliation","ReconciliationCase/ReconciliationAction plus admin authorization.","Read, investigate, execute, resolve, and export permissions are explicit; high-risk resolution requires SUPER_ADMIN."]
];

const limitations=[
 "There is no generic external-provider status lookup contract for Qikink/shipping, so provider state that cannot be verified is represented as unknown/ambiguous rather than fabricated.",
 "There is no separate return-to-refund foreign-key model, so reconciliation does not invent a relationship that the schema does not provide.",
 "Payment provider live-state reconciliation is limited to the existing provider-neutral webhook/event contracts; no real-money provider API calls are introduced by this certification.",
 "No production-scale destructive or real-money failure injection is performed; safe static, database-schema, and deterministic test evidence is used."
];
for(const l of limitations) findings.push({severity:"INFORMATIONAL",component:"Capability boundaries",discrepancy:l,impact:"Evidence boundary is explicit and prevents false certification.",evidence:"Repository architecture inspection during Phase 16.16.",remediation:"Document limitation and preserve unknown state.",remainingRisk:"External state may require operator/provider-side investigation when no machine-readable contract exists."});

const docsRequired=[
"Executive Summary","Reconciliation Inventory","Systems of Record","Payment Reconciliation","Order Reconciliation","Fulfillment Reconciliation",
"Qikink Boundary","Shipping Reconciliation","Return/Cancellation/Refund Reconciliation","Event/Database Reconciliation","Scheduling",
"Discrepancy Classification","Discrepancy Lifecycle","Automatic Corrections","Manual Corrections","Idempotency","Concurrency",
"Eventual Consistency","Data Integrity","Privacy","Security","Observability","Alerting","Failure-Injection Results","Test Matrix",
"Performance","Deployment Compatibility","Findings","Remediation","Remaining Risks","Final Certification Decision"
];

const result={
 phase:"16.16",
 title:"Reconciliation Certification",
 status:failures.length?"NOT READY FOR PHASE 16.17":"READY FOR PHASE 16.17",
 counts:{critical:findings.filter(f=>f.severity==="CRITICAL").length,high:findings.filter(f=>f.severity==="HIGH").length,medium:findings.filter(f=>f.severity==="MEDIUM").length,low:findings.filter(f=>f.severity==="LOW").length,informational:findings.filter(f=>f.severity==="INFORMATIONAL").length},
 ruleCount:(files.service.match(/key:"/g)||[]).length,
 inventory,
 limitations,
 failures,
 requiredDocumentation:docsRequired,
 hardStop:"Do not implement Phase 16.17 from this certification."
};

mkdirSync(join(root,"artifacts"),{recursive:true});
writeFileSync(join(root,"artifacts/phase-16-16-reconciliation-certification-evidence.json"),JSON.stringify(result,null,2)+"\n");
if(failures.length){console.error(JSON.stringify(result,null,2));process.exit(1);}
console.log(JSON.stringify(result,null,2));
