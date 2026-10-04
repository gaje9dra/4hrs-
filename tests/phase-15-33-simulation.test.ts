import test from"node:test";
import assert from"node:assert/strict";
import {MAX_GRAPH_DEPTH,MAX_DURATION_SECONDS,MAX_RECORDS,normalizeLimits,closed} from"../lib/simulation/model";
test("simulation limits are bounded",()=>{const x=normalizeLimits({graphDepth:999,durationSeconds:99999,records:99999});assert.equal(x.graphDepth,MAX_GRAPH_DEPTH);assert.equal(x.durationSeconds,MAX_DURATION_SECONDS);assert.equal(x.records,MAX_RECORDS);});
test("execution modes are closed",()=>{assert.equal(closed(["SIMULATION","STAGING"] as const,"SIMULATION"),true);assert.equal(closed(["SIMULATION","STAGING"] as const,"PRODUCTION"),false);});
test("simulation state remains declarative",()=>{const safety={realPayments:false,realOrders:false,realFulfillment:false,realShipping:false,customerMutation:false,providerCalls:false};assert.deepEqual(safety,{realPayments:false,realOrders:false,realFulfillment:false,realShipping:false,customerMutation:false,providerCalls:false});});
