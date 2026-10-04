import assert from "node:assert/strict";
import { test } from "node:test";
import { db } from "../lib/db/client";
import { createEnvironment, createScenario, executeScenario, certifyExecution, deterministicSyntheticFactory } from "../lib/rehearsal/service";

const proof={separateCredentials:true,separateDatabase:true,separateQueues:true,separateCache:true,separateSearch:true,separateStorage:true,separateProviderConfiguration:true,separateNotificationDestinations:true,productionWriteBlocked:true,productionSecretsAbsent:true};
test("Phase 15.29 synthetic full-commerce rehearsal is deterministic and isolated",async()=>{
 const env=await createEnvironment({stableId:"test-rehearsal-15-29",name:"Test rehearsal",environment:"rehearsal",configurationVersion:"test",isolationProof:proof,dataPolicy:{syntheticOnly:true,piiAllowed:false},providerPolicy:{payment:"mocked",qikink:"mocked",shipping:"simulated"},notificationPolicy:{destination:"sink"}});
 const scenario=await createScenario({stableId:"TEST_FULL_COMMERCE_15_29",name:"Synthetic full commerce",category:"FULL_COMMERCE",owner:"ci",riskClass:"LOW",maxDurationSeconds:300,maxResourceUnits:100,customerImpact:{maxCustomers:0,maxFinancialMinor:0},applicationVersion:"ci",configurationVersion:"test",schemaVersion:"prisma",featureFlagVersion:"test",dataSeed:"phase-15-29-ci-seed",faultDefinitions:[{stableId:"PAYMENT_TIMEOUT",faultType:"TIMEOUT",target:"payment-simulation",parameters:{durationMs:50},simulationOnly:true}],steps:["product-discovery","product-detail","cart","checkout","payment","order","fulfillment","shipping","tracking","notification","reconciliation"],assertions:[{key:"state-transitions",expected:"PASS"},{key:"financial-integrity",expected:"ZERO_REAL_MONEY"}],expected:{financialMutation:false,providerMutation:false,customerImpact:{maxCustomers:0,maxFinancialMinor:0}}});
 const run=await executeScenario({scenarioId:scenario.id,environmentId:env.id,requestedBy:"ci",correlationId:"phase-15-29-test"});
 assert.equal(run.outcome,"PASS");
 assert.equal(run.actual.financialMutation,false);
 assert.equal(run.actual.providerMutation,false);
 assert.equal((run.actual.customerImpact as Record<string,unknown>).maxCustomers,0);
 const cert=await certifyExecution(run.execution.id,"ci");
 assert.equal(cert.status,"CERTIFIED");
 assert.equal((cert.knownLimitations as unknown[]).length>0,true);
 const fixture=deterministicSyntheticFactory("phase-15-29-ci-seed");
 assert.equal(fixture.payment.mode,"SIMULATED");
});
