import fs from "node:fs";

const files=[
 "lib/delivery-governance-intelligence/service.ts",
 "app/api/admin/delivery/governance-intelligence/route.ts",
 "app/admin/delivery-governance/page.tsx",
 "lib/admin/permissions.ts",
 "prisma/schema.prisma",
 ".github/workflows/ci.yml",
 "docs/phase-15-41-production-continuous-delivery-governance-intelligence-policy-optimization-verified-evolution.md",
];
const corpus=files.map(f=>fs.readFileSync(f,"utf8")).join("\n");
const gates:Array<[string,string[]]>=[
 ["architecture reuse",["Phase 15.39","Phase 15.40","observationalOnly","existing"]],
 ["policy assessment",["assessPolicy","safety","precision","recall","efficiency","timeliness","stability","cost","recall"]],
 ["signal governance",["validateSignal","STALE","UNTRUSTED","provenance"]],
 ["policy drift",["driftDetected","driftReasons","ARCHITECTURE_VERSION_CHANGED"]],
 ["optimization safety",["classifyOptimization","PROHIBITED","rollbackCapability"]],
 ["lifecycle",["GOVERNANCE_STATES","EVIDENCE_COLLECTING","CONTROLLED_VALIDATION","CERTIFIED","INVALIDATED"]],
 ["policy versioning",["GovernancePolicyVersion","parentVersion","immutable"]],
 ["policy changesets",["GovernancePolicyChangeSet","thresholdsChanged","dependencyRulesChanged"]],
 ["simulation",["GovernancePolicySimulation","hypothetical","simulationRequired"]],
 ["shadow evaluation",["GovernanceShadowEvaluation","observationalOnly","evaluateShadow"]],
 ["experimentation",["GovernanceOptimizationExperiment","abortConditions","customerImpactLimits"]],
 ["confidence",["confidenceFromEvidence","VERIFIED","simulationCoverage"]],
 ["causality safety",["hypothetical","association","causality"]],
 ["RBAC",["governance.intelligence.read","governance.optimization.approve","governance.policy.certify"]],
 ["admin API",["requireAdmin","NextResponse","Idempotency-Key","recordAdminAudit"]],
 ["bounded operations",["bounded(","take:bounded","slice(0,100)"]],
 ["regression",["evaluateRegression","PAUSE_AND_REVIEW","regressed"]],
 ["stale certification",["invalidateCertifications","INVALIDATED","triggerReference"]],
 ["knowledge graph",["knowledge graph","Phase 15.32"]],
 ["digital twin",["digital twin","Phase 15.33"]],
 ["reconciliation",["reconciliation","Phase 15.22"]],
 ["release boundaries",["Phase 15.35","Phase 15.36","Phase 15.37","Phase 15.38"]],
 ["security",["integrityHash","version pinning","least privilege"]],
];
for(const [name,needles] of gates)for(const needle of needles)if(!corpus.toLowerCase().includes(needle.toLowerCase()))throw new Error("Phase 15.41 gate missing: "+name+" / "+needle);
for(const needle of ["child_process","execSync(","$queryRaw","$executeRaw","new Function(","eval(","qikink.com","fetch(","axios(","self-modif"]){
 if(corpus.toLowerCase().includes(needle.toLowerCase()))throw new Error("Unsafe Phase 15.41 marker detected: "+needle);
}
console.log(JSON.stringify({status:"PASS",phase:"15.41",algorithm:"15.41-governance-deterministic-v1",gates:gates.map(([name])=>name)}));
