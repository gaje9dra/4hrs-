export const RECONCILIATION_DOMAINS = ["CATALOG","CART","CHECKOUT","PAYMENT","ORDER","FULFILLMENT","SHIPPING","RETURNS","CANCELLATIONS","CUSTOMER","PRIVACY","CONTENT","SEARCH","ANALYTICS","NOTIFICATIONS","FEATURE_FLAGS","GOVERNANCE","BACKGROUND_JOBS","WEBHOOKS","PROVIDERS"] as const;
export const DISCREPANCY_TYPES = ["MISSING_DEPENDENCY","ORPHAN_RECORD","STATE_MISMATCH","DUPLICATE_RECORD","INVALID_REFERENCE","STALE_PROJECTION","DUPLICATE_EVENT","MISSING_EVENT","INVALID_TRANSITION","FINANCIAL_MISMATCH","OWNERSHIP_MISMATCH","PROVIDER_MISMATCH","TIMING_MISMATCH","UNKNOWN"] as const;
export const SEVERITIES = ["CRITICAL","HIGH","MEDIUM","LOW"] as const;
export const RECONCILIATION_STATUSES = ["DETECTED","INVESTIGATING","AUTO_RESOLVABLE","AWAITING_REVIEW","RECONCILING","RESOLVED","FAILED","ESCALATED","IGNORED","NOT_REPRODUCIBLE"] as const;
export const AUTHORITATIVE_DOMAINS: Record<string,string> = {
 CATALOG:"CATALOG", CART:"CART", CHECKOUT:"CHECKOUT", PAYMENT:"PAYMENT", ORDER:"ORDER", FULFILLMENT:"FULFILLMENT",
 SHIPPING:"SHIPPING", RETURNS:"RETURNS", CANCELLATIONS:"CANCELLATIONS", CUSTOMER:"CUSTOMER", PRIVACY:"PRIVACY",
 CONTENT:"CONTENT", SEARCH:"SEARCH_PROJECTION", ANALYTICS:"ANALYTICS_PROJECTION", NOTIFICATIONS:"NOTIFICATION_PROJECTION",
 FEATURE_FLAGS:"FEATURE_FLAGS", GOVERNANCE:"GOVERNANCE", BACKGROUND_JOBS:"JOB_RUNTIME", WEBHOOKS:"VERIFIED_EVENT_RECEIPT", PROVIDERS:"PROVIDER_ADAPTER"
};
export function isHighRisk(type:string,domain:string){ return ["FINANCIAL_MISMATCH","OWNERSHIP_MISMATCH","PROVIDER_MISMATCH"].includes(type) || ["PAYMENT","ORDER","CUSTOMER","FULFILLMENT"].includes(domain); }
export function canAutoRepair(type:string,domain:string){ return !isHighRisk(type,domain) && ["STALE_PROJECTION","MISSING_EVENT","DUPLICATE_EVENT"].includes(type) && ["SEARCH","ANALYTICS","NOTIFICATIONS","CONTENT"].includes(domain); }
export function sanitizeReconciliationEvidence(input:unknown): Record<string,unknown> {
 const blocked=/password|secret|token|authorization|cookie|api[_-]?key|customerEmail|phone|address/i;
 const walk=(value:unknown,depth:number):unknown=>{
  if(depth>3||value==null||typeof value==="number"||typeof value==="boolean") return value;
  if(typeof value==="string") return value.length>500?value.slice(0,500)+"…":value;
  if(Array.isArray(value)) return value.slice(0,20).map(v=>walk(v,depth+1));
  if(typeof value==="object"){const out:Record<string,unknown>={};for(const [k,v] of Object.entries(value as Record<string,unknown>)){if(blocked.test(k)) continue;out[k]=walk(v,depth+1);}return out;}
  return String(value);
 };
 return (walk(input,0) as Record<string,unknown>) ?? {};
}