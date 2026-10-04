import fs from "node:fs";
const files=["lib/delivery-intelligence/service.ts","app/api/admin/delivery/intelligence/route.ts","lib/admin/permissions.ts","prisma/schema.prisma",".github/workflows/ci.yml"];
const corpus=files.map(p=>fs.readFileSync(p,"utf8")).join("\n");
const checks: Array<[string, RegExp]> = [
 ["approval lifecycle",/requestApproval[\s\S]*decideApproval[\s\S]*reEvaluateAssessment/],
 ["emergency review",/requestEmergencyReview/],
 ["material invalidation",/invalidateForMaterialChange/],
 ["maintenance",/runGovernanceMaintenance/],
 ["audit events",/recordGovernanceEvent/],
 ["RBAC emergency",/delivery:emergency:approve/],
 ["transaction safety",/\$transaction/],
 ["bounded admin query",/Math\.min\(Math\.max\(limit/],
 ["Qikink safety",/Qikink|FULFILLMENT/],
 ["unsafe execution blocked",/child_process|execSync\(|\$queryRaw|\$executeRaw|new Function\(|eval\(/]
];
for(const [name,pattern] of checks){if(name==="unsafe execution blocked"){if(pattern.test(corpus))throw new Error("Unsafe execution marker detected.");}else if(!pattern.test(corpus))throw new Error("Readiness gate missing: "+name);}
console.log(JSON.stringify({status:"PASS",gates:checks.map(x=>x[0])}));
