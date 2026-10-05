import fs from "node:fs";

const files=[
 "lib/delivery-decision-intelligence/service.ts",
 "app/api/admin/delivery/decision-intelligence/route.ts",
 "app/admin/delivery-decision-intelligence/page.tsx",
 "prisma/schema.prisma",
 ".github/workflows/ci.yml",
];
const corpus=files.map(f=>fs.readFileSync(f,"utf8")).join("\n");
const checks:Array<[string,RegExp]>= [
 ["recommendation vocabulary",/PROCEED_WITH_APPROVAL[\s\S]*REQUIRE_MANUAL_REVIEW/],
 ["explainability",/primaryReasons[\s\S]*supportingSignals[\s\S]*limitations[\s\S]*nextRequiredAction/],
 ["provenance",/sourceVersion[\s\S]*observedAt[\s\S]*quality[\s\s]*confidence[\s\S]*provenance/],
 ["historical analysis",/HistoricalDeliveryOutcome[\s\S]*DeliverySimilarityAssessment/],
 ["risk decomposition",/CHANGE_RISK[\s\S]*CAPACITY_RISK/],
 ["immutable algorithm version",/ALGORITHM_VERSION[\s\S]*algorithmVersion/],
 ["policy lifecycle",/DecisionIntelligencePolicy[\s\S]*SUPERSEDED[\s\S]*RETIRED/],
 ["outcome feedback",/DeliveryRecommendationOutcome[\s\S]*falseNegative/],
 ["lifecycle transitions",/DeliveryDecisionTransition[\s\S]*previousState[\s\S]*newState/],
 ["provider-neutral API",/delivery\/decision-intelligence/],
 ["no unsafe execution",/child_process|execSync\\(|\\$queryRaw|\\$executeRaw|new Function\\(|eval\\(/],
];
for(const [name,pattern] of checks){
 if(name==="no unsafe execution"){if(pattern.test(corpus))throw new Error("Unsafe execution marker detected.");}
 else if(!pattern.test(corpus))throw new Error("Phase 15.39 validation gate missing: "+name);
}
console.log(JSON.stringify({status:"PASS",phase:"15.39",algorithm:"15.39-deterministic-v1",gates:checks.map(x=>x[0])}));
