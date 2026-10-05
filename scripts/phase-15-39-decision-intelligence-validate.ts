import fs from "node:fs";

const files=[
 "lib/delivery-decision-intelligence/service.ts",
 "app/api/admin/delivery/decision-intelligence/route.ts",
 "app/admin/delivery-decision-intelligence/page.tsx",
 "prisma/schema.prisma",
 ".github/workflows/ci.yml",
];
const corpus=files.map((f)=>fs.readFileSync(f,"utf8")).join("\n");
const checks:Array<[string,string[]]>=[
 ["recommendation vocabulary",["PROCEED_WITH_APPROVAL","REQUIRE_MANUAL_REVIEW"]],
 ["explainability",["primaryReasons","supportingSignals","limitations","nextRequiredAction"]],
 ["provenance",["sourceVersion","observedAt","quality","confidence","provenance"]],
 ["historical analysis",["HistoricalDeliveryOutcome","DeliverySimilarityAssessment"]],
 ["risk decomposition",["CHANGE_RISK","CAPACITY_RISK"]],
 ["immutable algorithm version",["ALGORITHM_VERSION","algorithmVersion"]],
 ["policy lifecycle",["DecisionIntelligencePolicy","SUPERSEDED","RETIRED"]],
 ["outcome feedback",["DeliveryRecommendationOutcome","falseNegative"]],
 ["lifecycle transitions",["DeliveryDecisionTransition","previousState","newState"]],
 ["provider-neutral API",["delivery/decision-intelligence"]],
 ["risk persistence",["DeliveryRiskAssessment","dimensions","algorithmVersion"]],
 ["decision metrics",["DeliveryDecisionMetric","decision.count","decision.latency_ms"]],
];
for(const [name,needles] of checks){
 for(const needle of needles)if(!corpus.includes(needle))throw new Error("Phase 15.39 validation gate missing: "+name+" / "+needle);
}
const forbidden=["child_process","execSync(","$queryRaw","$executeRaw","new Function(","eval("];
for(const needle of forbidden)if(corpus.includes(needle))throw new Error("Unsafe execution marker detected: "+needle);
console.log(JSON.stringify({status:"PASS",phase:"15.39",algorithm:"15.39-deterministic-v1",gates:checks.map(([name])=>name)}));
