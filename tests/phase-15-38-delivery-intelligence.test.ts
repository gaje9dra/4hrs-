import test from "node:test";
import assert from "node:assert/strict";
import { evaluatePromotion, deterministicHash, type PromotionInput } from "@/lib/delivery-intelligence/service";

const base=():PromotionInput=>({
 pipelineId:"pipeline-1",sourceEnvironment:"STAGING",targetEnvironment:"PRODUCTION",revisionId:"revision-1",
 policyVersion:"delivery-policy:v1",evidenceVersion:"evidence:v1",evaluatedAt:"2026-10-04T10:00:00.000Z",expiresAt:"2026-10-04T11:00:00.000Z",
 evidence:[{id:"ci-1",type:"CI",status:"PASS",expiresAt:"2026-10-04T10:30:00.000Z"}],
 dependencies:[{class:"DATABASE",reference:"db-primary",status:"HEALTHY",severity:"NORMAL",expiresAt:"2026-10-04T10:30:00.000Z"}],
 signals:{artifact:{status:"PASS",identity:"artifact-1",assessedIdentity:"artifact-1"},security:{status:"PASS",criticalFindings:0},reconciliation:{status:"PASS",criticalDiscrepancies:0},lock:{available:true},promotionWindow:{allowed:true}}
});

test("healthy delivery is allowed deterministically",()=>{
 const a=evaluatePromotion(base()); const b=evaluatePromotion(base());
 assert.equal(a.decision,"ALLOW"); assert.equal(a.riskLevel,"LOW"); assert.equal(a.confidence,"VERIFIED"); assert.equal(a.deterministicInputHash,b.deterministicInputHash);
});

test("unknown blocking evidence cannot become pass",()=>{
 const x=base(); x.dependencies=[{class:"DATABASE",reference:"db-primary",status:"UNKNOWN",severity:"CRITICAL",expiresAt:"2026-10-04T10:30:00.000Z"}];
 const r=evaluatePromotion(x); assert.equal(r.decision,"BLOCK"); assert.ok(r.blockers.some(v=>v.startsWith("DEPENDENCY_UNKNOWN")));
});

test("expired evidence blocks promotion",()=>{
 const x=base(); x.evidence=[{id:"ci-old",type:"CI",status:"PASS",expiresAt:"2026-10-04T09:59:00.000Z"}];
 const r=evaluatePromotion(x); assert.equal(r.decision,"BLOCK"); assert.ok(r.blockers.includes("STALE_EVIDENCE"));
});

test("critical security finding is prohibited",()=>{
 const x=base(); x.signals={...x.signals,security:{status:"CRITICAL",criticalFindings:1}};
 const r=evaluatePromotion(x); assert.equal(r.decision,"PROHIBIT"); assert.equal(r.riskLevel,"CRITICAL");
});

test("payment changes require approval and post-deployment controls",()=>{
 const x=base(); x.signals={...x.signals,paymentChange:true,approval:{required:true,valid:false}};
 const r=evaluatePromotion(x); assert.equal(r.decision,"ALLOW_WITH_APPROVAL"); assert.ok(r.requiredApprovals.includes("PAYMENT_CHANGE")); assert.ok(r.requiredValidations.includes("PAYMENT_RECONCILIATION"));
});

test("hash is stable for reordered object keys",()=>{
 assert.equal(deterministicHash({b:2,a:{d:4,c:3}}),deterministicHash({a:{c:3,d:4},b:2}));
});
