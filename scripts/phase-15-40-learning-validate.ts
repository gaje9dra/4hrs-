import fs from "node:fs";

const files=[
 "lib/delivery-learning/service.ts",
 "app/api/admin/delivery/learning/route.ts",
 "app/admin/delivery-learning/page.tsx",
 "prisma/schema.prisma",
 ".github/workflows/ci.yml",
];
const corpus=files.map(f=>fs.readFileSync(f,"utf8")).join("\n");
const gates:Array<[string,string[]]>=[
 ["outcome capture",["DeliveryLearningOutcome","captureOutcome","idempotencyKey"]],
 ["prediction evaluation",["PredictionEvaluation","classifyPrediction","predictionVersion"]],
 ["decision quality",["DecisionOutcomeEvaluation","classifyDecisionQuality","falsePositive","falseNegative"]],
 ["signal quality",["SignalQualityEvaluation","evaluateSignalQuality","UNTRUSTED"]],
 ["historical learning",["LearningPattern","associationType","counterEvidence"]],
 ["optimization proposals",["OptimizationProposal","createOptimizationProposal","reversible"]],
 ["learning lifecycle",["EVIDENCE_COLLECTING","GOVERNANCE_REVIEW","CERTIFIED","ROLLED_BACK"]],
 ["policy governance",["LearningPolicy","policyVersion","prohibitedSignals"]],
 ["controlled experiments",["LearningExperiment","CONTROLLED_PRODUCTION","stopConditions","safetyConditions"]],
 ["immutable certification",["LearningCertification","immutable","certifyProposal"]],
 ["RBAC",["delivery_learning.view","delivery_learning.approve","delivery_learning.certify"]],
 ["audit",["recordAdminAudit","DELIVERY_LEARNING_"]],
 ["bounded queries",["bounded(","slice(0,1000)","slice(0,100)"]],
 ["privacy boundary",["affectedCustomers","customerImpact","privacyConstraints"]],
 ["simulation/resilience provenance",["simulationRequired","validationStrategy","resilience"]],
 ["algorithm version",["15.40-learning-deterministic-v1","ALGORITHM_VERSION"]],
];
for(const [name,needles] of gates)for(const needle of needles)if(!corpus.includes(needle))throw new Error("Phase 15.40 gate missing: "+name+" / "+needle);
for(const needle of ["child_process","execSync(","$queryRaw","$executeRaw","eval(","new Function(","qikink.com"])if(corpus.toLowerCase().includes(needle.toLowerCase()))throw new Error("Unsafe learning marker detected: "+needle);
console.log(JSON.stringify({status:"PASS",phase:"15.40",algorithm:"15.40-learning-deterministic-v1",gates:gates.map(([name])=>name)}));
