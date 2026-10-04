import test from "node:test";
import assert from "node:assert/strict";
import { DELIVERY_STATUSES, DELIVERY_STAGES, REGISTERED_DELIVERY_OPERATIONS, RECOVERY_CLASSES, READINESS_RESULTS } from "../lib/delivery-orchestration/service";

test("delivery lifecycle is explicit and bounded",()=>{for(const s of ["CREATED","PREFLIGHT","READY","SCHEDULED","EXECUTING","DEPLOYMENT_VALIDATING","ROLLOUT_EXECUTING","ROLLOUT_VALIDATING","POST_RELEASE_VALIDATING","CERTIFYING","COMPLETED","BLOCKED","PAUSED","ABORTED","FAILED","ROLLING_BACK","ROLLBACK_FAILED","FORWARD_RECOVERY","RECOVERY_VALIDATING","INVALIDATED"])assert.ok(DELIVERY_STATUSES.includes(s as never));});
test("stage graph vocabulary is bounded",()=>{assert.equal(DELIVERY_STAGES.length,12);assert.ok(DELIVERY_STAGES.includes("CANARY"));assert.ok(DELIVERY_STAGES.includes("PROGRESSIVE_ROLLOUT"));});
test("registered operations exclude arbitrary execution",()=>{assert.ok(REGISTERED_DELIVERY_OPERATIONS.includes("DEPLOY_REGISTERED_ARTIFACT"));assert.ok(!REGISTERED_DELIVERY_OPERATIONS.some(x=>/SHELL|SQL|ARBITRARY/i.test(x)));});
test("recovery and readiness vocabularies are explicit",()=>{assert.deepEqual([...RECOVERY_CLASSES],["ROLLBACK_SAFE","FORWARD_RECOVERY_REQUIRED","MANUAL_RECOVERY_REQUIRED","UNKNOWN"]);assert.deepEqual([...READINESS_RESULTS],["READY","READY_WITH_APPROVAL","DELAYED","BLOCKED","PROHIBITED"]);});
test("safety boundary is provider-neutral",()=>{assert.ok(REGISTERED_DELIVERY_OPERATIONS.every(x=>x.length<=80));assert.equal(REGISTERED_DELIVERY_OPERATIONS.includes("QIKINK_PRODUCT_CREATE" as never),false);});
