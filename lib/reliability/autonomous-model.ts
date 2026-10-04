export const RELIABILITY_CONFIDENCE=["UNKNOWN","LOW","MEDIUM","HIGH","VERIFIED"] as const;
export type ReliabilityConfidence=typeof RELIABILITY_CONFIDENCE[number];

export const RELIABILITY_STATES=["CREATED","CORRELATING","ASSESSED","AWAITING_VALIDATION","ACTIONABLE","REMEDIATING","VERIFYING","RESOLVED","REGRESSED","ESCALATED","CLOSED"] as const;
export type ReliabilityState=typeof RELIABILITY_STATES[number];

export function confidenceFromEvidence(input:{signalCount:number;contradictions:number;validated:boolean;stableBaseline:boolean}):ReliabilityConfidence{
 if(input.validated&&input.signalCount>=2&&input.contradictions===0&&input.stableBaseline)return "VERIFIED";
 if(input.signalCount>=3&&input.contradictions===0)return "HIGH";
 if(input.signalCount>=1&&input.contradictions===0)return "MEDIUM";
 if(input.signalCount>0)return "LOW";
 return "UNKNOWN";
}

export function autonomousMutationAllowed(confidence:ReliabilityConfidence,risk:string){
 if(risk==="PROHIBITED"||risk==="HIGH_RISK"||risk==="APPROVAL_REQUIRED")return false;
 return confidence==="HIGH"||confidence==="VERIFIED";
}

export function safeConfidenceForMutation(confidence:ReliabilityConfidence){
 return confidence==="HIGH"||confidence==="VERIFIED";
}

export function validReliabilityTransition(from:ReliabilityState,to:ReliabilityState){
 const map:Record<ReliabilityState,readonly ReliabilityState[]>={
  CREATED:["CORRELATING"],CORRELATING:["ASSESSED"],ASSESSED:["AWAITING_VALIDATION","ACTIONABLE","ESCALATED"],
  AWAITING_VALIDATION:["ACTIONABLE","ESCALATED"],ACTIONABLE:["REMEDIATING","ESCALATED","CLOSED"],
  REMEDIATING:["VERIFYING","ESCALATED"],VERIFYING:["RESOLVED","REGRESSED","ESCALATED"],
  RESOLVED:["CLOSED"],REGRESSED:["ESCALATED","CLOSED"],ESCALATED:["CLOSED"],CLOSED:[]
 };
 return map[from].includes(to);
}

export function assertReliabilityTransition(from:ReliabilityState,to:ReliabilityState){
 if(!validReliabilityTransition(from,to))throw new Error(`Invalid reliability assessment transition: ${from} -> ${to}`);
}

export function deterministicAnomaly(input:{value:number;center:number;spread:number;minimumDeviation:number}){
 const deviation=Math.abs(input.value-input.center);
 const threshold=Math.max(input.minimumDeviation,Math.abs(input.spread)*3);
 return {anomalous:deviation>threshold,deviation,threshold,explanation:deviation>threshold?"Observed value exceeds deterministic baseline threshold.":"Observed value is within deterministic baseline threshold."};
}

export const SAFE_STRATEGIES={
 SYNTHETIC_RETRY:{
  stableId:"synthetic-retry",
  risk:"SAFE_AUTOMATION",
  action:"RERUN_SYNTHETIC_CHECK",
  maxSteps:1,maxMutations:1,maxChainDurationSeconds:300,
  requiredConfidence:["HIGH","VERIFIED"] as const,
  preconditions:["policy-active","environment-allowed","circuit-closed","idempotency-clear","no-critical-reconciliation","no-critical-cost-anomaly","no-major-security-incident","no-maintenance-conflict"],
  postconditions:["synthetic-status-not-failing"],
  rollback:"NONE",
 }
} as const;
