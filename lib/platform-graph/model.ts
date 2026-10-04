export const GRAPH_NODE_TYPES = ["DOMAIN","SERVICE","MODULE","API","ROUTE","DATABASE","TABLE","COLUMN","EVENT","QUEUE","JOB","CACHE","SEARCH_INDEX","PROVIDER","EXTERNAL_SYSTEM","FEATURE_FLAG","WORKFLOW","CUSTOMER_JOURNEY","INCIDENT","SLO","ALERT","AUTOMATION","REMEDIATION","RESILIENCE_EXPERIMENT","DIGITAL_TWIN_SCENARIO","GOVERNANCE_CONTROL","RECONCILIATION_RULE","MIGRATION","DEPENDENCY","DEPLOYMENT","OWNER","DOCUMENT","ADR"] as const;
export const GRAPH_RELATION_TYPES = ["OWNS","CONTAINS","DEPENDS_ON","CALLS","READS","WRITES","PUBLISHES","CONSUMES","TRIGGERS","PROTECTS","MONITORS","ALERTS_ON","IMPLEMENTS","FULFILLS","USES","CONTROLS","FLAGS","VALIDATES","RECONCILES","MIGRATES","DEPLOYS","AFFECTS","IMPACTS","DOCUMENTS","GOVERNED_BY","TESTED_BY","RECOVERS_WITH","ROLLS_BACK_WITH"] as const;
export const GRAPH_PROVENANCE = ["CODE","DATABASE_SCHEMA","API_CONTRACT","CONFIGURATION","DEPLOYMENT","DOCUMENTATION","OBSERVABILITY","RUNTIME_TELEMETRY","CI","TEST","GOVERNANCE_RECORD","MANUAL_REVIEW","IMPORTED_METADATA"] as const;
export const GRAPH_CONFIDENCE = ["UNKNOWN","LOW","MEDIUM","HIGH","VERIFIED"] as const;
export const GRAPH_FRESHNESS = ["CURRENT","AGING","STALE","UNKNOWN"] as const;
export const GRAPH_DRIFT_SEVERITIES = ["INFO","LOW","MEDIUM","HIGH","CRITICAL"] as const;
export type GraphNodeType = typeof GRAPH_NODE_TYPES[number];
export type GraphRelationType = typeof GRAPH_RELATION_TYPES[number];
export type GraphProvenance = typeof GRAPH_PROVENANCE[number];
export type GraphConfidence = typeof GRAPH_CONFIDENCE[number];
export function freshnessFrom(lastVerifiedAt:Date|null,lastObservedAt:Date|null,threshold:number,now=new Date()){const last=[lastVerifiedAt,lastObservedAt].filter((x):x is Date=>x instanceof Date).sort((a,b)=>b.getTime()-a.getTime())[0];if(!last)return "UNKNOWN";const age=Math.max(0,(now.getTime()-last.getTime())/1000);return age<=threshold?"CURRENT":age<=threshold*2?"AGING":"STALE";}
export function isClosed<T extends readonly string[]>(values:T,value:unknown):value is T[number]{return typeof value==="string"&&(values as readonly string[]).includes(value);}
