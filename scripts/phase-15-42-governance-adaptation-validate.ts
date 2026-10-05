import fs from "node:fs";
const files=[
 "lib/delivery-governance-adaptation/service.ts",
 "tests/phase-15-42-governance-adaptation.test.ts",
 "lib/delivery-governance-intelligence/service.ts",
 "app/api/admin/delivery/governance-intelligence/route.ts",
 "lib/admin/permissions.ts",
 "prisma/schema.prisma",
 "docs/phase-15-42-production-continuous-delivery-governance-adaptation-policy-safety-verified-control-evolution.md",
 ".github/workflows/ci.yml"
];
const corpus=files.map(f=>fs.readFileSync(f,"utf8")).join("\n");
const gates=[
 ["governance adaptation",["GOVERNANCE_ADAPTATION_ALGORITHM_VERSION","createAdaptation","assessAdaptation"]],
 ["safety envelope",["SafetyEnvelope","evaluateSafetyEnvelope","PROTECTED_INVARIANTS_MISSING","FORBIDDEN_MUTATION"]],
 ["fail safe",["validateAdaptationEvidence","BLOCKED","ROLLBACK_NOT_READY"]],
 ["drift",["detectAdaptationDrift","configuredDrift","observedDrift"]],
 ["version pinning",["15.41-governance-deterministic-v1","15.42-governance-adaptation-deterministic-v1"]],
 ["lifecycle",["SAFETY_ASSESSMENT","CONTROLLED_VALIDATION","CERTIFIED","INVALIDATED"]],
 ["bounded",["slice(0,100)","slice(0,50)"]],
 ["RBAC",["governance.adaptation.read","governance.adaptation.approve","governance.adaptation.certify"]],
 ["reuse",["delivery-governance-intelligence","transitionProposal","createProposal"]],
 ["Qikink safety",["Qikink fulfillment-only","qikink catalog","provider credential isolation"]]
];
for(const [name,needles] of gates)for(const needle of needles)if(!corpus.toLowerCase().includes(needle.toLowerCase()))throw new Error("Phase 15.42 gate missing: "+name+" / "+needle);
for(const needle of ["child_process","execSync(","$queryRaw","$executeRaw","new Function(","eval(","fetch(","axios(","qikink.com"]){
 if(corpus.toLowerCase().includes(needle.toLowerCase()))throw new Error("Unsafe Phase 15.42 marker: "+needle);
}
console.log(JSON.stringify({status:"PASS",phase:"15.42",gates:gates.map(x=>x[0])}));
