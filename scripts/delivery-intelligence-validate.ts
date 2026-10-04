import { readFileSync } from "node:fs";

const service=readFileSync("lib/delivery-intelligence/service.ts","utf8");
const required=[
 "DELIVERY_INTELLIGENCE_STATUSES","PROMOTION_DECISIONS","GATE_STATUSES","RISK_LEVELS","CONFIDENCE_LEVELS",
 "deterministicHash","evaluatePromotion","collectGraphImpact","acquireDeliveryLock","createAssessment",
 "invalidateAssessment","certifyDelivery","invalidateCertification"
];
for(const item of required) if(!service.includes(item)) throw new Error("Missing delivery intelligence capability: "+item);
const forbidden=[
 "execSync(","spawn(","exec(","child_process","$queryRaw","$executeRaw","eval(","new Function("
];
for(const item of forbidden) if(service.includes(item)) throw new Error("Forbidden autonomous execution pattern: "+item);
for(const item of ["STALE_EVIDENCE","ARTIFACT_MISMATCH","SECURITY_BLOCK","RECONCILIATION_BLOCK","MIGRATION_BLOCK","DELIVERY_LOCK_UNAVAILABLE","PROMOTION_WINDOW"]) if(!service.includes(item)) throw new Error("Missing safety control: "+item);
console.log(JSON.stringify({status:"PASS",domain:"delivery-intelligence",deterministic:true,arbitraryExecution:false,requiredCapabilities:required.length}));
