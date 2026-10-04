import test from "node:test";
import assert from "node:assert/strict";
import { evaluatePromotion, deterministicHash } from "@/lib/delivery-intelligence/service";

const base=()=>({pipelineId:"00000000-0000-0000-0000-000000000001",sourceEnvironment:"staging",targetEnvironment:"production",policyVersion:"v2",evidenceVersion:"e1",evaluatedAt:"2026-10-04T10:00:00.000Z",expiresAt:"2026-10-04T11:00:00.000Z"});
test("E2E lifecycle decision chain starts safely",()=>{const r=evaluatePromotion({...base(),dependencies:[{class:"DATABASE",reference:"db",status:"HEALTHY"}],signals:{artifact:{status:"PASS",identity:"r1",assessedIdentity:"r1"},lock:{available:true},promotionWindow:{allowed:true}}});assert.equal(r.decision,"ALLOW");assert.ok(r.requiredValidations);});
test("incident freeze fails closed",()=>{const r=evaluatePromotion({...base(),signals:{incident:{active:true,freeze:true}}});assert.ok(["BLOCK","HOLD","PROHIBIT"].includes(r.decision));});
test("artifact substitution is blocked",()=>{const r=evaluatePromotion({...base(),signals:{artifact:{status:"PASS",identity:"expected",assessedIdentity:"different"}}});assert.ok(["BLOCK","PROHIBIT"].includes(r.decision));});
test("stale evidence is blocked",()=>{const r=evaluatePromotion({...base(),evidence:[{id:"expired-evidence",type:"HEALTH",status:"PASS",expiresAt:"2026-10-04T09:00:00.000Z"}]});assert.ok(["BLOCK","PROHIBIT"].includes(r.decision));});
test("lock conflict is blocked",()=>{const r=evaluatePromotion({...base(),signals:{lock:{available:false}}});assert.ok(["BLOCK","HOLD","PROHIBIT"].includes(r.decision));});
test("database risk requires elevated validation",()=>{const r=evaluatePromotion({...base(),signals:{migration:{destructive:true,rollbackFeasible:true}}});assert.ok(r.requiredValidations.includes("MIGRATION_SAFETY"));});
test("rollback path remains governance-bound",()=>{const r=evaluatePromotion({...base(),signals:{migration:{longRunningRisk:true}}});assert.ok(["ALLOW_WITH_ADDITIONAL_VALIDATION","ALLOW_WITH_APPROVAL","BLOCK","HOLD"].includes(r.decision));});
test("Qikink degradation remains fulfillment-only",()=>{const r=evaluatePromotion({...base(),dependencies:[{class:"FULFILLMENT",reference:"qikink",status:"FAILING"}],signals:{fulfillmentChange:false}});assert.equal(r.decision,"BLOCK");});
test("shipping degradation blocks affected delivery",()=>{const r=evaluatePromotion({...base(),dependencies:[{class:"SHIPPING",reference:"shipping",status:"FAILING"}],signals:{shippingChange:true}});assert.equal(r.decision,"BLOCK");});
test("security failure injection fails closed",()=>{const r=evaluatePromotion({...base(),signals:{security:{status:"CRITICAL",criticalFindings:1}}});assert.ok(["BLOCK","PROHIBIT"].includes(r.decision));});
test("unknown critical dependency fails closed",()=>{const r=evaluatePromotion({...base(),dependencies:[{class:"PAYMENT",reference:"gateway",status:"UNKNOWN",severity:"CRITICAL"}]});assert.ok(["BLOCK","HOLD","PROHIBIT"].includes(r.decision));});
test("decision input is deterministic",()=>{assert.equal(deterministicHash({z:1,a:{b:2}}),deterministicHash({a:{b:2},z:1}));});
test("gate evaluation remains bounded",()=>{const started=performance.now();for(let i=0;i<1000;i++)evaluatePromotion({...base(),signals:{capacity:{status:"HEALTHY"}}});assert.ok(performance.now()-started<2000);});
