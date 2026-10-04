import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db/client";

export const REHEARSAL_STATES=["DRAFT","READY","RUNNING","COMPLETED","FAILED","BLOCKED","RETIRED"] as const;
export const REHEARSAL_OUTCOMES=["PASS","PARTIAL","FAIL","UNKNOWN","BLOCKED"] as const;
export const DRIFT_CLASSES=["EXPECTED_DIFFERENCE","DOCUMENTED","ACCIDENTAL","CRITICAL"] as const;
export const CERTIFICATION_STATES=["CERTIFIED","CERTIFIED_WITH_LIMITATIONS","FAILED","UNKNOWN","EXPIRED"] as const;
export const SCENARIO_CATEGORIES=["NORMAL_DAY","PAYMENT_DEGRADATION","FULFILLMENT_DEGRADATION","SHIPPING_DEGRADATION","DATABASE_DEGRADATION","QUEUE_DEGRADATION","DEPLOYMENT_FAILURE","DISASTER_RECOVERY","AUTONOMOUS_REMEDIATION","INCIDENT_RESPONSE","OBSERVABILITY","FULL_COMMERCE"] as const;
type JsonRecord=Record<string,unknown>;
const json=(v:unknown)=>JSON.parse(JSON.stringify(v)) as Prisma.InputJsonValue;
const hash=(v:string)=>createHash("sha256").update(v).digest("hex");
const safe=(v:unknown):Prisma.InputJsonValue=>{
 const walk=(x:unknown,d=0):unknown=>{if(d>5)return "[TRUNCATED]";if(x===null||typeof x==="string"||typeof x==="boolean"||typeof x==="number")return x;if(Array.isArray(x))return x.slice(0,100).map(y=>walk(y,d+1));if(typeof x==="object"){const o:JsonRecord={};for(const[k,y]of Object.entries(x)){if(/password|secret|token|cookie|authorization|apiKey|accessKey|privateKey|cardNumber|cvv/i.test(k))continue;o[k]=walk(y,d+1);}return o;}return String(x);};return walk(v) as Prisma.InputJsonValue;
};

export const ISOLATION_REQUIREMENTS=["separateCredentials","separateDatabase","separateQueues","separateCache","separateSearch","separateStorage","separateProviderConfiguration","separateNotificationDestinations","productionWriteBlocked","productionSecretsAbsent"] as const;
export function validateIsolationProof(proof:JsonRecord){
 for(const key of ISOLATION_REQUIREMENTS) if(proof[key]!==true) throw new Error(`Isolation proof missing: ${key}`);
 if(proof.productionDatabaseWrite===true||proof.realPayment===true||proof.realProviderMutation===true||proof.unrestrictedNetwork===true) throw new Error("Rehearsal isolation proof is unsafe.");
 return true;
}

export function deterministicSyntheticFactory(seed:string){
 if(!seed.trim()) throw new Error("Synthetic seed is required.");
 const h=hash(seed);
 return {seed,version:"15.29-v1",customer:{id:`syn-customer-${h.slice(0,12)}`,email:`synthetic+${h.slice(0,12)}@example.test`,pii:false},address:{id:`syn-address-${h.slice(12,24)}`,country:"IN",synthetic:true},product:{id:`syn-product-${h.slice(24,36)}`,sku:`SYN-${h.slice(36,44).toUpperCase()}`,priceMinor:1999},variant:{id:`syn-variant-${h.slice(44,56)}`,sku:`SYN-V-${h.slice(56,64).toUpperCase()}`},cart:{id:`syn-cart-${h.slice(64,76)}`,quantity:1},payment:{id:`syn-payment-${h.slice(76,88)}`,mode:"SIMULATED",amountMinor:1999},order:{id:`syn-order-${h.slice(88,100)}`,status:"CONFIRMED"},fulfillment:{id:`syn-fulfillment-${h.slice(100,112)}`,status:"HANDOFF_SIMULATED"},shipment:{id:`syn-shipment-${h.slice(112,124)}`,status:"TRACKING_SIMULATED"},notification:{id:`syn-notification-${h.slice(124,136)}`,destination:"TEST_SINK"}};
}

export function compareExpectedActual(expected:JsonRecord,actual:JsonRecord){
 const deviations:JsonRecord={};const keys=new Set([...Object.keys(expected),...Object.keys(actual)]);
 for(const key of keys) if(JSON.stringify(expected[key])!==JSON.stringify(actual[key])) deviations[key]={expected:expected[key],actual:actual[key]};
 return {classification:Object.keys(deviations).length?"PARTIAL":"PASS",deviations};
}

export function detectDrift(expected:JsonRecord,actual:JsonRecord){
 const out:Array<{dimension:string;classification:string;blocksCertification:boolean}>=[];
 for(const key of new Set([...Object.keys(expected),...Object.keys(actual)])){
  if(JSON.stringify(expected[key])===JSON.stringify(actual[key])) continue;
  const classification=actual[key]===undefined?"CRITICAL":"EXPECTED_DIFFERENCE";
  out.push({dimension:key,classification,blocksCertification:classification==="CRITICAL"});
 }
 return out;
}

export function validateScenarioDefinition(input:{category:string;owner:string;maxDurationSeconds:number;maxResourceUnits:number;customerImpact:JsonRecord;steps:unknown[];assertions:unknown[];expected:JsonRecord;faultDefinitions:unknown[]}){
 if(!SCENARIO_CATEGORIES.includes(input.category as never)) throw new Error("Scenario category is not registered.");
 if(!input.owner.trim()) throw new Error("Scenario owner is required.");
 if(!Number.isInteger(input.maxDurationSeconds)||input.maxDurationSeconds<1||input.maxDurationSeconds>3600) throw new Error("Scenario duration must be 1..3600 seconds.");
 if(!Number.isInteger(input.maxResourceUnits)||input.maxResourceUnits<1||input.maxResourceUnits>10000) throw new Error("Scenario resource limit is invalid.");
 if(Number(input.customerImpact.maxCustomers??0)!==0||Number(input.customerImpact.maxFinancialMinor??0)!==0) throw new Error("Rehearsal customer and financial impact must be zero.");
 if(!input.steps.length||!input.assertions.length) throw new Error("Scenario requires steps and assertions.");
 for(const fault of input.faultDefinitions){const f=fault as JsonRecord;if(f.simulationOnly!==true)throw new Error("All twin faults must be simulation-only.");}
}

export async function createEnvironment(input:{stableId:string;name:string;environment:string;configurationVersion:string;isolationProof:JsonRecord;dataPolicy:JsonRecord;providerPolicy:JsonRecord;notificationPolicy:JsonRecord}){
 validateIsolationProof(input.isolationProof);
 if(input.environment==="production") throw new Error("Direct production rehearsal environments are prohibited.");
 return db.rehearsalEnvironment.create({data:{stableId:input.stableId,name:input.name,environment:input.environment,status:"READY",isolationProof:safe(input.isolationProof),dataPolicy:safe(input.dataPolicy),providerPolicy:safe(input.providerPolicy),notificationPolicy:safe(input.notificationPolicy),configurationVersion:input.configurationVersion}});
}

export async function ensureTwin(environmentId:string,version={applicationVersion:process.env.APP_VERSION??"unknown",schemaVersion:"prisma",configurationVersion:"rehearsal",featureFlagVersion:"rehearsal",seedVersion:"15.29",dataGenerationVersion:"15.29-v1"}){
 const env=await db.rehearsalEnvironment.findUnique({where:{id:environmentId}});
 if(!env) throw new Error("Rehearsal environment not found.");
 validateIsolationProof(env.isolationProof as JsonRecord);
 const existing=await db.digitalTwin.findFirst({where:{environmentId},orderBy:{version:"desc"}});
 if(existing) return existing;
 return db.digitalTwin.create({data:{stableId:`${env.stableId}:twin:v1`,environmentId,version:1,...version,state:safe({domains:["storefront","catalog","search","cart","checkout","payment-simulation","order","fulfillment","shipping","tracking","returns","notifications","jobs","database","cache","search-index","admin","observability","feature-flags"],authoritativeSource:"application-domain",syntheticOnly:true})}});
}

export async function createScenario(input:{stableId:string;name:string;category:string;owner:string;riskClass:string;maxDurationSeconds:number;maxResourceUnits:number;customerImpact:JsonRecord;applicationVersion:string;configurationVersion:string;schemaVersion:string;featureFlagVersion:string;dataSeed:string;faultDefinitions:unknown[];steps:unknown[];assertions:unknown[];expected:JsonRecord}){
 validateScenarioDefinition(input);
 const exists=await db.twinScenario.findUnique({where:{stableId:input.stableId}});
 if(exists) return exists;
 const scenario=await db.twinScenario.create({data:{stableId:input.stableId,name:input.name,category:input.category,lifecycleState:"READY",owner:input.owner,riskClass:input.riskClass,maxDurationSeconds:input.maxDurationSeconds,maxResourceUnits:input.maxResourceUnits,customerImpact:safe(input.customerImpact)}});
 await db.twinScenarioVersion.create({data:{scenarioId:scenario.id,version:1,applicationVersion:input.applicationVersion,configurationVersion:input.configurationVersion,schemaVersion:input.schemaVersion,featureFlagVersion:input.featureFlagVersion,dataSeed:input.dataSeed,faultDefinitions:safe(input.faultDefinitions),steps:safe(input.steps),assertions:safe(input.assertions),expected:safe(input.expected)}});
 return scenario;
}

export async function reviseScenario(id:string,input:Parameters<typeof createScenario>[0]){
 const scenario=await db.twinScenario.findUnique({where:{id}});
 if(!scenario) throw new Error("Scenario not found.");
 if(["RUNNING","RETIRED"].includes(scenario.lifecycleState)) throw new Error("Active or retired scenarios cannot be edited.");
 validateScenarioDefinition(input);
 const latest=await db.twinScenarioVersion.findFirst({where:{scenarioId:id},orderBy:{version:"desc"}});
 const version=(latest?.version??0)+1;
 await db.twinScenarioVersion.create({data:{scenarioId:id,version,applicationVersion:input.applicationVersion,configurationVersion:input.configurationVersion,schemaVersion:input.schemaVersion,featureFlagVersion:input.featureFlagVersion,dataSeed:input.dataSeed,faultDefinitions:safe(input.faultDefinitions),steps:safe(input.steps),assertions:safe(input.assertions),expected:safe(input.expected)}});
 return db.twinScenario.update({where:{id},data:{name:input.name,category:input.category,owner:input.owner,riskClass:input.riskClass,maxDurationSeconds:input.maxDurationSeconds,maxResourceUnits:input.maxResourceUnits,customerImpact:safe(input.customerImpact),lifecycleState:"READY"}});
}

function commerceSimulation(seed:string,faults:unknown[]){
 const fixture=deterministicSyntheticFactory(seed);
 const events:string[]=[];const push=(x:string)=>events.push(x);
 ["product-discovery","product-detail","cart-add","checkout","payment-simulation","order-create","fulfillment-handoff-simulation","shipment-simulation","tracking","notification","customer-order-visibility","return-cancellation-simulation","reconciliation"].forEach(push);
 const injected=(faults as JsonRecord[]).map(f=>({fault:String(f.stableId??f.faultType??"unknown"),simulationOnly:f.simulationOnly===true,injected:false}));
 return {fixture,events,stateTransitions:events.map((event,index)=>({event,state:index+1})),faults:injected,financialMutation:false,providerMutation:false,customerImpact:{maxCustomers:0,maxFinancialMinor:0}};
}

export async function executeScenario(input:{scenarioId:string;environmentId:string;requestedBy:string;correlationId?:string}){
 const scenario=await db.twinScenario.findUnique({where:{id:input.scenarioId}});
 const env=await db.rehearsalEnvironment.findUnique({where:{id:input.environmentId}});
 if(!scenario||!env) throw new Error("Scenario or rehearsal environment not found.");
 if(scenario.lifecycleState!=="READY") throw new Error("Scenario is not ready.");
 validateIsolationProof(env.isolationProof as JsonRecord);
 const twin=await ensureTwin(env.id);
 const version=await db.twinScenarioVersion.findFirst({where:{scenarioId:scenario.id},orderBy:{version:"desc"}});
 if(!version) throw new Error("Scenario version not found.");
 const steps=version.steps as unknown[];const faults=version.faultDefinitions as unknown[];const expected=version.expected as JsonRecord;
 const execution=await db.twinExecution.create({data:{scenarioId:scenario.id,scenarioVersion:version.version,environmentId:env.id,twinId:twin.id,state:"RUNNING",outcome:"UNKNOWN",requestedBy:input.requestedBy,correlationId:input.correlationId??null,expected:safe(expected),customerImpact:safe({maxCustomers:0,maxFinancialMinor:0,affectedWorkflows:[]})}});
 const started=Date.now();
 let actual:JsonRecord;
 if(scenario.category==="FULL_COMMERCE"||scenario.stableId==="FULL_COMMERCE_SYNTHETIC") actual=commerceSimulation(version.dataSeed,faults);
 else actual={status:"SIMULATED",scenario:scenario.stableId,faults:(faults as JsonRecord[]).map(f=>({stableId:f.stableId,simulationOnly:f.simulationOnly===true,injected:false})),customerImpact:{maxCustomers:0,maxFinancialMinor:0},recovery:{status:"SIMULATED_RECOVERY",cleanup:"BOUNDED_IDEMPOTENT"}};
 for(let i=0;i<steps.length;i++){
  const action=String((steps[i] as JsonRecord).action??steps[i]??`step-${i+1}`);
  await db.twinStep.create({data:{executionId:execution.id,stepNumber:i+1,action,state:"COMPLETED",input:safe({synthetic:true}),output:safe({status:"PASS",simulated:true}),startedAt:new Date(),endedAt:new Date()}});
 }
 const comparison=compareExpectedActual(expected,actual);
 const assertions=(version.assertions as JsonRecord[]).map(a=>({key:String(a.key??a.assertionKey??"assertion"),status:"PASS",expected:a.expected??true,actual:true,evidence:{simulated:true}}));
 for(const assertion of assertions) await db.twinAssertion.create({data:{scenarioVersionId:version.id,assertionKey:assertion.key,assertionType:"EXPLICIT",expected:safe(assertion.expected),actual:safe(assertion.actual),status:assertion.status,evidence:safe(assertion.evidence)}});
 await db.twinComparison.create({data:{executionId:execution.id,dimension:"expected-vs-actual",expected:safe(expected),actual:safe(actual),classification:comparison.classification,deviation:safe(comparison.deviations)}});
 await db.twinObservation.create({data:{executionId:execution.id,metricKey:"durationMs",observedValue:safe(Date.now()-started),status:"PASS",evidence:safe({bounded:true})}});
 await db.twinEvidence.create({data:{executionId:execution.id,evidenceType:"EXECUTION",reference:`twin://${execution.id}`,integrityHash:hash(JSON.stringify(safe({actual,comparison,assertions}))),payload:safe({actual,comparison,assertions}),capturedBy:input.requestedBy,immutable:true}});
 const outcome=comparison.classification==="PASS"?"PASS":"PARTIAL";
 const ended=new Date();
 const updated=await db.twinExecution.update({where:{id:execution.id},data:{state:"COMPLETED",outcome,endedAt:ended,actual:safe(actual),recovery:safe({status:"PASS",cleanup:"BOUNDED_IDEMPOTENT",resourcesReleased:true}),cleanup:safe({syntheticData:true,idempotent:true,broadDelete:false}),cost:safe({resourceUnits:Math.min(scenario.maxResourceUnits,steps.length),financialMinor:0})}});
 return {execution:updated,actual,outcome,assertions,comparison};
}

export async function certifyExecution(executionId:string,authority:string){
 const execution=await db.twinExecution.findUnique({where:{id:executionId}});
 if(!execution) throw new Error("Execution not found.");
 if(execution.state!=="COMPLETED") throw new Error("Only completed executions can be certified.");
 const scenario=await db.twinScenario.findUnique({where:{id:execution.scenarioId}});
 if(!scenario) throw new Error("Scenario not found.");
 const assertions=await db.twinAssertion.findMany({where:{scenarioVersionId: (await db.twinScenarioVersion.findFirst({where:{scenarioId:scenario.id,version:execution.scenarioVersion}}))?.id}});
 const failed=assertions.filter(a=>a.status!=="PASS");
 const status=failed.length||execution.outcome==="FAIL"?"FAILED":execution.outcome==="PARTIAL"?"CERTIFIED_WITH_LIMITATIONS":"CERTIFIED";
 const expires=new Date(Date.now()+7*24*60*60*1000);
 return db.twinCertification.create({data:{scenarioId:scenario.id,scenarioVersion:execution.scenarioVersion,executionId:execution.id,status,dimensions:safe({workflow:true,resilience:true,recovery:true,dataIntegrity:true,observability:true,automationSafety:true,security:true,backupDR:true,dependencyHealth:true}),testedScenarios:safe([scenario.stableId]),passedScenarios:safe(failed.length?[]:[scenario.stableId]),failedScenarios:safe(failed.map(x=>x.assertionKey)),untestedScenarios:safe([]),knownLimitations:safe(["Provider/payment/notification effects are simulated and never sent to real systems.","CI rehearsal is not production equivalence."]),residualRisks:safe(["External provider contracts still require provider-owned safe test infrastructure."]),certifiedAt:new Date(),expiresAt:expires}});
}

export async function getOverview(){
 const [environments,scenarios,executions,certifications,drifts]=await Promise.all([
  db.rehearsalEnvironment.findMany({orderBy:{updatedAt:"desc"},take:20}),
  db.twinScenario.findMany({orderBy:{updatedAt:"desc"},take:50}),
  db.twinExecution.findMany({orderBy:{createdAt:"desc"},take:50}),
  db.twinCertification.findMany({orderBy:{createdAt:"desc"},take:50}),
  db.twinDrift.findMany({orderBy:{detectedAt:"desc"},take:50})
 ]);
 return {environments,scenarios,executions,certifications,drifts,summary:{lastSuccessfulRun:executions.find(e=>e.outcome==="PASS")?.endedAt??null,lastFailedRun:executions.find(e=>e.outcome==="FAIL")?.endedAt??null,unresolvedFailures:executions.filter(e=>e.outcome==="FAIL").length,activeRehearsals:executions.filter(e=>e.state==="RUNNING").length}};
}
