import test from "node:test";
import assert from "node:assert/strict";
import { EXPERIMENT_CATEGORIES, EXPERIMENT_MODES, FAULT_KEYS, validateExperimentDefinition } from "@/lib/resilience/experiments";

const base={mode:"SIMULATION",category:"DEPENDENCY_FAILURE",environment:"staging",owner:"ops",timeoutSeconds:30,expiration:new Date(Date.now()+60000),blastRadius:{targetCount:1,maxDurationSeconds:30,maxExecutions:1,maxConcurrentFaults:1,maxAffectedWorkflows:1,maxAffectedCustomers:0},hypothesis:{expectedBehavior:"retry",expectedMetrics:["latency"],unacceptableOutcomes:["customer impact"]},expectedBehavior:{expected:"fallback",recovery:"healthy"},abortCriteria:{conditions:["error-rate"]}};

test("Phase 15.28 catalog is explicit",()=>{assert.ok(EXPERIMENT_CATEGORIES.includes("DATABASE_RESILIENCE"));assert.ok(EXPERIMENT_MODES.includes("CONTROLLED_PRODUCTION"));assert.ok(FAULT_KEYS.includes("TIMEOUT"));});
test("simulation requires zero customer impact",()=>{assert.doesNotThrow(()=>validateExperimentDefinition(base));assert.throws(()=>validateExperimentDefinition({...base,blastRadius:{...base.blastRadius,maxAffectedCustomers:1}}),/customer impact/i);});
test("experiments require an abort condition",()=>{assert.throws(()=>validateExperimentDefinition({...base,abortCriteria:{conditions:[]}}),/abort condition/i);});
test("timeouts are bounded",()=>{assert.throws(()=>validateExperimentDefinition({...base,timeoutSeconds:0}),/timeout/i);assert.throws(()=>validateExperimentDefinition({...base,timeoutSeconds:3601}),/timeout/i);});
