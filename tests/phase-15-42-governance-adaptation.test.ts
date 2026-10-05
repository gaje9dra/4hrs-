import test from "node:test";
import assert from "node:assert/strict";
import { assessAdaptation, buildSafetyEnvelope, detectAdaptationDrift, evaluateSafetyEnvelope, validateAdaptationEvidence } from "../lib/delivery-governance-adaptation/service";

test("15.42 safety envelope blocks protected mutations",()=>{
 const envelope=buildSafetyEnvelope({maxRiskClass:"HIGH",minConfidence:"MEDIUM",requiredControls:["approval"]});
 const result=evaluateSafetyEnvelope({policyId:"p",policyVersion:"1",currentPolicy:{paymentGate:true},proposedPolicy:{paymentGate:false},affectedSystems:["payment"],evidence:[{id:"e"}],confidence:"HIGH",riskClass:"HIGH",blastRadius:1,safetyEnvelope:envelope});
 assert.equal(result.decision,"BLOCK");
 assert.ok(result.violations.some(x=>x.startsWith("FORBIDDEN_MUTATION")));
});
test("15.42 adaptation assessment is deterministic",()=>{
 const input={policyId:"p",policyVersion:"1",currentPolicy:{gate:true},proposedPolicy:{gate:false},affectedSystems:["delivery"],evidence:[{id:"e"}],confidence:"HIGH" as const,riskClass:"LOW" as const,blastRadius:1,safetyEnvelope:buildSafetyEnvelope({requiredControls:["approval"],requireApproval:false})};
 assert.deepEqual(assessAdaptation(input),assessAdaptation(input));
});
test("15.42 high-risk adaptation requires simulation",()=>{
 const input={policyId:"p",policyVersion:"1",currentPolicy:{gate:true},proposedPolicy:{gate:false},affectedSystems:["delivery"],evidence:[{id:"e"}],confidence:"HIGH" as const,riskClass:"HIGH" as const,blastRadius:1,safetyEnvelope:buildSafetyEnvelope({maxRiskClass:"HIGH",requiredControls:["approval"]})};
 assert.equal(assessAdaptation(input).decision,"REQUIRE_SIMULATION");
});
test("15.42 drift is explicit and non-reconciling",()=>{
 const result=detectAdaptationDrift({certifiedPolicy:{a:1},activePolicy:{a:2},observedPolicy:{a:3}});
 assert.equal(result.configuredDrift,true); assert.equal(result.observedDrift,true);
});
test("15.42 validation fails closed",()=>{
 const safety=evaluateSafetyEnvelope({policyId:"p",policyVersion:"1",currentPolicy:{gate:true},proposedPolicy:{gate:false},affectedSystems:["delivery"],evidence:[{id:"e"}],confidence:"HIGH",riskClass:"LOW",blastRadius:1,safetyEnvelope:buildSafetyEnvelope({requireApproval:false})});
 const result=validateAdaptationEvidence({safetyResult:safety,simulationPassed:false,rollbackReady:true,dependenciesValid:true,auditPathAvailable:true});
 assert.equal(result.status,"BLOCKED");
});
