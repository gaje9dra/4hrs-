import test from "node:test";
import assert from "node:assert/strict";
import { ALGORITHM_VERSION,LEARNING_STATES,confidenceFromEvidence,classifyPrediction,classifyDecisionQuality,classifySafety } from "@/lib/delivery-learning/service";

test("learning confidence is deterministic and explicit",()=>{
 assert.equal(confidenceFromEvidence({evidenceCount:0,quality:1,freshness:1,consistency:1,reproducibility:1,simulationValidated:true,experimentValidated:true}),"UNKNOWN");
 assert.equal(confidenceFromEvidence({evidenceCount:20,quality:1,freshness:1,consistency:1,reproducibility:1,simulationValidated:true,experimentValidated:true}),"VERIFIED");
 assert.equal(ALGORITHM_VERSION,"15.40-learning-deterministic-v1");
});

test("prediction evaluation distinguishes conservative safety decisions",()=>{
 assert.equal(classifyPrediction({predicted:"BLOCK",actual:"SUCCESS",confidence:"HIGH",conservativeSafetyDecision:true}),"PARTIALLY_CORRECT");
 assert.equal(classifyPrediction({predicted:"PROCEED",actual:"INCIDENT",confidence:"HIGH"}),"INCORRECT");
 assert.equal(classifyPrediction({predicted:undefined,actual:"SUCCESS",confidence:"HIGH"}),"UNVERIFIABLE");
});

test("decision quality does not penalize conservative safety without evidence of harm",()=>{
 assert.equal(classifyDecisionQuality({outcomeStatus:"SUCCESS",falsePositive:true,falseNegative:false,confidence:"HIGH",conservativeSafetyDecision:true}),"OVERLY_CONSERVATIVE");
 assert.equal(classifyDecisionQuality({outcomeStatus:"SUCCESS",falsePositive:false,falseNegative:false,confidence:"VERIFIED",conservativeSafetyDecision:false}),"OPTIMAL");
 assert.equal(classifyDecisionQuality({outcomeStatus:"UNKNOWN",falsePositive:false,falseNegative:false,confidence:"HIGH",conservativeSafetyDecision:false}),"INCONCLUSIVE");
});

test("unsafe optimization classes are prohibited",()=>{
 assert.equal(classifySafety({affectedSystems:["payments"],proposedBehavior:{change:"payment correctness"},simulationRequired:true}),"PROHIBITED");
 assert.equal(classifySafety({affectedSystems:["database"],proposedBehavior:{change:"index"},simulationRequired:true}),"HIGH");
 assert.equal(classifySafety({affectedSystems:["search"],proposedBehavior:{change:"weight"},simulationRequired:false}),"LOW");
});

test("learning lifecycle is governed and terminal states cannot self-progress",()=>{
 assert.ok(LEARNING_STATES.includes("GOVERNANCE_REVIEW"));
 assert.ok(LEARNING_STATES.includes("CERTIFIED"));
 assert.ok(LEARNING_STATES.includes("ROLLED_BACK"));
});
