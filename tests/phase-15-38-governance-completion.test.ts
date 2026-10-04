import test from "node:test";
import assert from "node:assert/strict";
import { deterministicHash, evaluatePromotion } from "@/lib/delivery-intelligence/service";

const base=()=>({pipelineId:"00000000-0000-0000-0000-000000000001",sourceEnvironment:"staging",targetEnvironment:"production",policyVersion:"v2",evidenceVersion:"e1",evaluatedAt:"2026-10-04T10:00:00.000Z",expiresAt:"2026-10-04T11:00:00.000Z"});
test("E2E decision chain: healthy delivery is eligible",()=>{const r=evaluatePromotion({...base(),dependencies:[{class:"DATABASE",reference:"db",status:"HEALTHY"}],signals:{artifact:{status:"PASS",identity:"r1",assessedIdentity:"r1"},lock:{available:true},promotionWindow:{allowed:true}}});assert.equal(r.decision,"ALLOW");assert.equal(r.confidence,"VERIFIED");});
test("failure injection fails closed for security",()=>{const r=evaluatePromotion({...base(),signals:{security:{status:"CRITICAL",criticalFindings:1}}});assert.equal(r.decision,"PROHIBIT");});
test("privacy gate blocks high-risk PII exposure",()=>{const r=evaluatePromotion({...base(),signals:{privacy:{piiExposure:true}}});assert.equal(r.decision,"PROHIBIT");});
test("dependency/provider degradation blocks affected delivery",()=>{const r=evaluatePromotion({...base(),dependencies:[{class:"FULFILLMENT",reference:"qikink",status:"DEGRADED"}],signals:{fulfillmentChange:true}});assert.equal(r.decision,"BLOCK");});
test("shipping degradation blocks affected delivery",()=>{const r=evaluatePromotion({...base(),dependencies:[{class:"SHIPPING",reference:"provider",status:"FAILING"}],signals:{shippingChange:true}});assert.equal(r.decision,"BLOCK");});
test("payment change requires approval and validation",()=>{const r=evaluatePromotion({...base(),signals:{paymentChange:true,approval:{required:true,valid:false}}});assert.equal(r.decision,"ALLOW_WITH_APPROVAL");assert.ok(r.requiredValidations.includes("PAYMENT_RECONCILIATION"));});
test("approval invalidation input is deterministic",()=>{assert.equal(deterministicHash({b:2,a:1}),deterministicHash({a:1,b:2}));});
test("performance guard: 1000 assessments stay bounded",()=>{const start=performance.now();for(let i=0;i<1000;i++)evaluatePromotion({...base(),signals:{capacity:{status:"HEALTHY"}}});assert.ok(performance.now()-start<2000);});
test("unknown critical dependency is held/blocked",()=>{const r=evaluatePromotion({...base(),dependencies:[{class:"PAYMENT",reference:"gateway",status:"UNKNOWN",severity:"CRITICAL"}]});assert.ok(["BLOCK","HOLD","PROHIBIT"].includes(r.decision));});
