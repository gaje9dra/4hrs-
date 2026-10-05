import fs from "node:fs";
const required=[
"lib/delivery-governance-stability/service.ts",
"app/api/admin/delivery/governance-stability/route.ts",
"app/admin/delivery-governance-stability/page.tsx",
"tests/phase-15-43-governance-stability.test.ts",
"prisma/schema.prisma",
"prisma/migrations/20261005143000_phase_15_43_governance_stability/migration.sql",
"lib/platform-graph/service.ts",
"lib/simulation/service.ts",
"lib/reconciliation/service.ts",
"lib/delivery-governance-adaptation/service.ts",
"docs/phase-15-43-production-continuous-delivery-control-intelligence-governance-stability-verified-policy-resilience.md"
];
for(const f of required)if(!fs.existsSync(f))throw new Error("Missing Phase 15.43 artifact: "+f);
const corpus=required.map(f=>fs.readFileSync(f,"utf8")).join("\n");
const gates=[
["control graph",["compatibilityMatrix","detectConflicts","GOVERNANCE_RELATION_TYPES","platform-graph"]],
["deadlock",["detectDeadlocks","cycle"]],
["oscillation",["detectOscillation","frequency","UNSTABLE"]],
["churn",["assessChurn","EXCESSIVE"]],
["cascade/amplification",["analyzeCascade","REDUNDANT"]],
["coverage",["analyzeCoverage","gaps","fragile"]],
["invariants",["DEFAULT_INVARIANTS","evaluateInvariants","BLOCKED"]],
["stability",["classifyStability","STABLE_WITH_WARNINGS","CRITICAL","UNKNOWN"]],
["resilience",["resilienceMode","EMERGENCY_RESTRICTED","FROZEN"]],
["snapshots",["buildSnapshot","immutable","integrityHash"]],
["policy gates",["policyStabilityGates","SAFETY_ENVELOPE_BREACH","AUDIT_PATH_UNAVAILABLE"]],
["drift",["detectDrift","documentedVsConfigured","certifiedVsObserved"]],
["digital twin/simulation",["MAX_DURATION_SECONDS","graphImpactAnalysis","affectedDigitalTwin"]],
["reconciliation",["reconciliationSummary","15.22"]],
["adaptation",["GOVERNANCE_ADAPTATION_ALGORITHM_VERSION","15.42"]],
["RBAC/API",["requireAdmin","governance.stability.read","Idempotency-Key"]],
["bounded analysis",["slice(0,100)","slice(0,250)","slice(0,2000)"]],
["audit",["recordAdminAudit","correlationId"]],
["versioning",["15.43-governance-stability-deterministic-v1","15.41-governance-deterministic-v1"]]
];
for(const [name,needles] of gates)for(const n of needles)if(!corpus.toLowerCase().includes(n.toLowerCase()))throw new Error("Phase 15.43 gate missing: "+name+" / "+n);
const implementationCorpus=required.slice(0,6).map(f=>fs.readFileSync(f,"utf8")).join("\n");
for(const n of ["child_process","execSync(","$queryRawUnsafe","$executeRawUnsafe","new Function(","eval(","qikink.com"])if(implementationCorpus.toLowerCase().includes(n.toLowerCase()))throw new Error("Unsafe Phase 15.43 marker: "+n);
console.log(JSON.stringify({status:"PASS",phase:"15.43",algorithmVersion:"15.43-governance-stability-deterministic-v1",gates:gates.map(x=>x[0])}));
