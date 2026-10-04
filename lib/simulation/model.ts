export const SIMULATION_EXECUTION_MODES=["SIMULATION","STAGING","SYNTHETIC_PRODUCTION","CONTROLLED_PRODUCTION"] as const;
export const SIMULATION_LIFECYCLE=["DRAFT","REVIEW_REQUIRED","APPROVED","READY","RUNNING","ASSERTING","COMPLETED","CERTIFIED","FAILED","BLOCKED","ABORTED","REJECTED","EXPIRED"] as const;
export const SIMULATION_TYPES=["DEPENDENCY_FAILURE","API_CHANGE","DATABASE_CHANGE","EVENT_CHANGE","JOB_FAILURE","QUEUE_BACKLOG","CACHE_FAILURE","SEARCH_FAILURE","NOTIFICATION_FAILURE","PROVIDER_FAILURE","PAYMENT_SIMULATION","CHECKOUT_SIMULATION","ORDER_SIMULATION","FULFILLMENT_SIMULATION","SHIPPING_SIMULATION","RETURN_SIMULATION","CUSTOMER_JOURNEY","DEPLOYMENT_CHANGE","FEATURE_FLAG_CHANGE","CAPACITY_CHANGE","SECURITY_CONTROL_CHANGE","ARCHITECTURAL_CHANGE"] as const;
export const SIMULATION_RISKS=["MINIMAL","LOW","MEDIUM","HIGH","CRITICAL"] as const;
export const SIMULATION_RESULTS=["PASSED","PASSED_WITH_LIMITATIONS","FAILED","BLOCKED"] as const;
export const SIMULATION_CERTIFICATION_FRESHNESS=["CURRENT","AGING","STALE","INVALIDATED"] as const;
export type SimulationExecutionMode=typeof SIMULATION_EXECUTION_MODES[number];
export type SimulationLifecycle=typeof SIMULATION_LIFECYCLE[number];
export type SimulationType=typeof SIMULATION_TYPES[number];
export type SimulationRisk=typeof SIMULATION_RISKS[number];
export type SimulationResult=typeof SIMULATION_RESULTS[number];
export function closed<T extends readonly string[]>(values:T,v:unknown):v is T[number]{return typeof v==="string"&&(values as readonly string[]).includes(v);}
export const RISK_ORDER:Record<SimulationRisk,number>={MINIMAL:0,LOW:1,MEDIUM:2,HIGH:3,CRITICAL:4};
export const MAX_DURATION_SECONDS=900,MAX_STEPS=500,MAX_GRAPH_DEPTH=5,MAX_RECORDS=1000,MAX_RETRIES=5,MAX_CONCURRENCY=10,MAX_RESOURCE_UNITS=10000;
export function normalizeLimits(input:Partial<Record<"durationSeconds"|"steps"|"graphDepth"|"records"|"retries"|"concurrency"|"resourceUnits",number>>={}){return{durationSeconds:Math.min(Math.max(input.durationSeconds??300,1),MAX_DURATION_SECONDS),steps:Math.min(Math.max(input.steps??100,1),MAX_STEPS),graphDepth:Math.min(Math.max(input.graphDepth??3,0),MAX_GRAPH_DEPTH),records:Math.min(Math.max(input.records??100,1),MAX_RECORDS),retries:Math.min(Math.max(input.retries??2,0),MAX_RETRIES),concurrency:Math.min(Math.max(input.concurrency??2,1),MAX_CONCURRENCY),resourceUnits:Math.min(Math.max(input.resourceUnits??1000,1),MAX_RESOURCE_UNITS)};}
export const certificationFreshness=(certifiedAt:Date,expiresAt:Date,now=new Date())=>now>=expiresAt?"STALE":(now.getTime()-certifiedAt.getTime())/86400000<=1?"CURRENT":(now.getTime()-certifiedAt.getTime())/86400000<=7?"AGING":"STALE";
