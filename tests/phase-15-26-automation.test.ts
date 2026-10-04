import assert from "node:assert/strict";
import test from "node:test";
import { autonomousAllowed, canTransitionExecution, evaluateConditions, isProhibitedRisk, riskRequiresApproval, validatePolicyDefinition } from "../lib/automation/model";
import { getRegisteredAction, listRegisteredActions } from "../lib/automation/actions";

test("phase 15.26 risk model is fail-closed",()=>{
 assert.equal(autonomousAllowed("SAFE_AUTOMATION"),true);
 assert.equal(autonomousAllowed("CONTROLLED_AUTOMATION"),true);
 assert.equal(riskRequiresApproval("APPROVAL_REQUIRED"),true);
 assert.equal(riskRequiresApproval("HIGH_RISK"),true);
 assert.equal(isProhibitedRisk("PROHIBITED"),true);
});

test("structured conditions support deterministic predicates",()=>{
 assert.equal(evaluateConditions({failures:3,environment:"PRODUCTION"},[
  {key:"failures",operator:"GTE",value:3},
  {key:"environment",operator:"EQ",value:"PRODUCTION"}
 ]),true);
 assert.equal(evaluateConditions({failures:2},[{key:"failures",operator:"GTE",value:3}]),false);
});

test("execution transitions reject invalid state changes",()=>{
 assert.equal(canTransitionExecution("CREATED","EVALUATING"),true);
 assert.equal(canTransitionExecution("SUCCEEDED","RUNNING"),false);
 assert.equal(canTransitionExecution("PENDING_APPROVAL","APPROVED"),true);
});

test("mutation policies retain dry-run and bounded retry/timeout controls",()=>{
 assert.doesNotThrow(()=>validatePolicyDefinition({risk:"SAFE_AUTOMATION",enabled:false,dryRun:true,timeoutSeconds:300,retryLimit:2,cooldownSeconds:60,maxExecutionsPerWindow:2,actions:["RERUN_SYNTHETIC_CHECK"]}));
 assert.throws(()=>validatePolicyDefinition({risk:"SAFE_AUTOMATION",enabled:true,dryRun:false,timeoutSeconds:300,retryLimit:0,cooldownSeconds:0,maxExecutionsPerWindow:1,actions:["RERUN_SYNTHETIC_CHECK"]}));
});

test("only explicitly registered actions are executable",()=>{
 const action=getRegisteredAction("RERUN_SYNTHETIC_CHECK");
 assert.ok(action);
 assert.equal(getRegisteredAction("RUN_ARBITRARY_COMMAND"),undefined);
 assert.ok(listRegisteredActions().every(item=>item.key.length>0));
});
