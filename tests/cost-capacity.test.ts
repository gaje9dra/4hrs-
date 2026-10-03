import assert from "node:assert/strict";
import test from "node:test";
import { classifyCostStatus, detectAnomaly, evaluateCapacity, sanitizeMetricMetadata } from "@/lib/cost-capacity/model";

test("cost status semantics never upgrades unknown billing data to actual",()=>{
  assert.equal(classifyCostStatus({providerBillingAvailable:false,measured:true}),"ESTIMATED");
  assert.equal(classifyCostStatus({providerBillingAvailable:false,measured:false}),"UNKNOWN");
  assert.equal(classifyCostStatus({providerBillingAvailable:true,measured:true}),"ACTUAL");
  assert.equal(classifyCostStatus({providerBillingAvailable:false,measured:false,projectionBasis:true}),"PROJECTED");
});

test("capacity evaluation triggers only at or above configured threshold",()=>{
  assert.equal(evaluateCapacity(9,10,"HIGH","scale","operations").triggered,false);
  assert.equal(evaluateCapacity(10,10,"CRITICAL","protect","on-call").triggered,true);
});

test("anomaly detection is deterministic and does not require monetary assumptions",()=>{
  assert.deepEqual(detectAnomaly(120,100,15),{anomalous:true,deviation:20});
  assert.deepEqual(detectAnomaly(110,100,15),{anomalous:false,deviation:10});
});

test("metric metadata strips secrets and customer PII",()=>{
  const value=sanitizeMetricMetadata({service:"search",token:"secret",email:"customer@example.com",phone:"123",nested:{apiKey:"x",count:2}});
  assert.deepEqual(value,{service:"search",nested:{count:2}});
});
