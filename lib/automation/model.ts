export const AUTOMATION_RISK_CLASSES = ["OBSERVE_ONLY","SAFE_AUTOMATION","CONTROLLED_AUTOMATION","APPROVAL_REQUIRED","HIGH_RISK","PROHIBITED"] as const;
export type AutomationRiskClass = typeof AUTOMATION_RISK_CLASSES[number];

export const AUTOMATION_POLICY_STATUSES = ["DRAFT","PENDING_REVIEW","APPROVED","ACTIVE","PAUSED","DISABLED","EXPIRED","RETIRED"] as const;
export type AutomationPolicyStatus = typeof AUTOMATION_POLICY_STATUSES[number];

export const AUTOMATION_EXECUTION_STATES = ["CREATED","EVALUATING","BLOCKED","PENDING_APPROVAL","APPROVED","RUNNING","SUCCEEDED","FAILED","PARTIALLY_SUCCEEDED","ROLLING_BACK","ROLLED_BACK","ESCALATED","CANCELLED"] as const;
export type AutomationExecutionState = typeof AUTOMATION_EXECUTION_STATES[number];

export const AUTOMATION_CIRCUIT_STATES = ["CLOSED","OPEN","HALF_OPEN"] as const;
export type AutomationCircuitState = typeof AUTOMATION_CIRCUIT_STATES[number];

export const AUTOMATION_FAILURE_CLASSES = ["VALIDATION","AUTHORIZATION","SAFETY","CONCURRENCY","TIMEOUT","TRANSIENT_DEPENDENCY","PERMANENT_DEPENDENCY","ROLLBACK","UNKNOWN","POLICY_VIOLATION"] as const;
export type AutomationFailureClass = typeof AUTOMATION_FAILURE_CLASSES[number];

export const AUTOMATION_ROLLBACK_MODES = ["REVERSIBLE","CONDITIONALLY_REVERSIBLE","IRREVERSIBLE"] as const;
export type AutomationRollbackMode = typeof AUTOMATION_ROLLBACK_MODES[number];

export type StructuredCondition = Readonly<{key:string;operator:"EQ"|"NEQ"|"GT"|"GTE"|"LT"|"LTE"|"IN"|"NOT_IN";value:unknown;negated?:boolean}>;

const TRANSITIONS: Record<AutomationExecutionState, readonly AutomationExecutionState[]> = {
  CREATED:["EVALUATING","CANCELLED"], EVALUATING:["BLOCKED","PENDING_APPROVAL","APPROVED","RUNNING","FAILED","CANCELLED"],
  BLOCKED:["ESCALATED","CANCELLED"], PENDING_APPROVAL:["APPROVED","BLOCKED","CANCELLED"], APPROVED:["RUNNING","CANCELLED"],
  RUNNING:["SUCCEEDED","FAILED","PARTIALLY_SUCCEEDED","ROLLING_BACK","CANCELLED"], SUCCEEDED:[], FAILED:["ROLLING_BACK","ESCALATED"],
  PARTIALLY_SUCCEEDED:["ROLLING_BACK","ESCALATED"], ROLLING_BACK:["ROLLED_BACK","FAILED","ESCALATED"], ROLLED_BACK:["ESCALATED"],
  ESCALATED:[], CANCELLED:[]
};

export function canTransitionExecution(from:AutomationExecutionState,to:AutomationExecutionState){return TRANSITIONS[from].includes(to);}
export function assertExecutionTransition(from:AutomationExecutionState,to:AutomationExecutionState){if(!canTransitionExecution(from,to))throw new Error(`Invalid automation execution transition: ${from} -> ${to}`);}

export function riskRequiresApproval(risk:AutomationRiskClass){return risk==="APPROVAL_REQUIRED"||risk==="HIGH_RISK";}
export function isProhibitedRisk(risk:AutomationRiskClass){return risk==="PROHIBITED";}
export function autonomousAllowed(risk:AutomationRiskClass){return risk==="SAFE_AUTOMATION"||risk==="CONTROLLED_AUTOMATION";}

export function evaluatePredicate(actual:unknown, condition:StructuredCondition):boolean{
  let result:boolean;
  switch(condition.operator){
    case "EQ": result=Object.is(actual,condition.value); break;
    case "NEQ": result=!Object.is(actual,condition.value); break;
    case "GT": result=typeof actual==="number"&&typeof condition.value==="number"&&actual>condition.value; break;
    case "GTE": result=typeof actual==="number"&&typeof condition.value==="number"&&actual>=condition.value; break;
    case "LT": result=typeof actual==="number"&&typeof condition.value==="number"&&actual<condition.value; break;
    case "LTE": result=typeof actual==="number"&&typeof condition.value==="number"&&actual<=condition.value; break;
    case "IN": result=Array.isArray(condition.value)&&condition.value.some(value=>Object.is(value,actual)); break;
    case "NOT_IN": result=Array.isArray(condition.value)&&!condition.value.some(value=>Object.is(value,actual)); break;
  }
  return condition.negated?!result:result;
}

export function evaluateConditions(values:Record<string,unknown>,conditions:readonly StructuredCondition[]){return conditions.every(condition=>evaluatePredicate(values[condition.key],condition));}

export function validatePolicyDefinition(input:{risk:AutomationRiskClass;enabled:boolean;dryRun:boolean;timeoutSeconds:number;retryLimit:number;cooldownSeconds:number;maxExecutionsPerWindow:number;actions:string[]}){
  if(!AUTOMATION_RISK_CLASSES.includes(input.risk))throw new Error("Invalid automation risk class.");
  if(isProhibitedRisk(input.risk))throw new Error("PROHIBITED automation policies cannot be executable.");
  if(input.timeoutSeconds<1||input.timeoutSeconds>3600)throw new Error("Automation timeout must be between 1 and 3600 seconds.");
  if(input.retryLimit<0||input.retryLimit>10)throw new Error("Automation retry limit must be between 0 and 10.");
  if(input.cooldownSeconds<0)throw new Error("Automation cooldown cannot be negative.");
  if(input.maxExecutionsPerWindow<1||input.maxExecutionsPerWindow>1000)throw new Error("Automation execution frequency is out of bounds.");
  if(input.enabled&&input.risk==="OBSERVE_ONLY")throw new Error("OBSERVE_ONLY policies cannot be enabled for mutation.");
  if(input.risk==="SAFE_AUTOMATION"||input.risk==="CONTROLLED_AUTOMATION"){if(!input.dryRun)throw new Error("Mutation-capable policies must retain dry-run capability.");}
  if(input.actions.length===0)throw new Error("At least one registered action is required.");
}

export function boundedScope(scope:unknown){const raw=typeof scope==="object"&&scope!==null?scope as Record<string,unknown>:{};return {environment:typeof raw.environment==="string"?raw.environment:"UNKNOWN",resourceType:typeof raw.resourceType==="string"?raw.resourceType:"UNKNOWN",resourceId:typeof raw.resourceId==="string"?raw.resourceId:"UNKNOWN",maxItems:typeof raw.maxItems==="number"&&Number.isInteger(raw.maxItems)&&raw.maxItems>0?Math.min(raw.maxItems,100):1};}
