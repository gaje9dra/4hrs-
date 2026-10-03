export const SYNTHETIC_STATUSES = ["HEALTHY","DEGRADED","FAILING","BLOCKED","UNAVAILABLE","NOT_CONFIGURED","UNKNOWN"] as const;
export type SyntheticStatus = (typeof SYNTHETIC_STATUSES)[number];
export const SYNTHETIC_MODES = ["UNIT_LOCAL","CI","PREVIEW_STAGING","PRODUCTION_SAFE","MANUAL_DIAGNOSTIC"] as const;
export type SyntheticMode = (typeof SYNTHETIC_MODES)[number];
export const CRITICALITIES = ["P0","P1","P2","P3"] as const;
export type Criticality = (typeof CRITICALITIES)[number];

export const FAILURE_CODES = [
  "STOREFRONT_UNAVAILABLE","CATALOG_UNAVAILABLE","SEARCH_FAILURE","PRODUCT_LOAD_FAILURE","CART_FAILURE","CHECKOUT_FAILURE",
  "PAYMENT_FAILURE","ORDER_CREATION_FAILURE","ORDER_IDEMPOTENCY_FAILURE","FULFILLMENT_FAILURE","PROVIDER_MAPPING_FAILURE",
  "PROVIDER_UNAVAILABLE","SHIPPING_FAILURE","TRACKING_FAILURE","RETURN_FAILURE","CUSTOMER_DATA_FAILURE","NOTIFICATION_FAILURE",
  "ANALYTICS_CONTAMINATION","CONTENT_FAILURE","ADMIN_AUTH_FAILURE","ADMIN_RBAC_FAILURE","DATABASE_FAILURE","QUEUE_FAILURE",
  "TIMEOUT","CONFIGURATION_FAILURE","SAFETY_GUARD_BLOCK","UNSUPPORTED_SYNTHETIC_CAPABILITY",
] as const;
export type SyntheticFailureCode = (typeof FAILURE_CODES)[number];

export type WorkflowStep = {
  key: string;
  name: string;
  dependency?: string;
  productionSafe: boolean;
  execute: (context: SyntheticExecutionContext) => Promise<StepResult>;
};

export type WorkflowDefinition = {
  id: string;
  name: string;
  domains: string[];
  entryPoint: string;
  prerequisites: string[];
  expectedOutcome: string;
  criticalInvariants: string[];
  dependencies: string[];
  syntheticEligible: boolean;
  productionSafe: boolean;
  failureSeverity: Criticality;
  timeoutMs: number;
  retryPolicy: "NONE" | "READ_ONLY";
  owner: string;
  escalationTarget: string;
  blockedReason?: string;
  steps: WorkflowStep[];
};

export type SyntheticExecutionContext = {
  mode: SyntheticMode;
  environment: string;
  correlationId: string;
  traceId?: string;
  baseUrl?: string;
  timeoutMs: number;
};

export type StepResult = {
  status: SyntheticStatus;
  failureCode?: SyntheticFailureCode;
  diagnostic?: Record<string, unknown>;
};

export const isTerminalFailure = (status: SyntheticStatus) => ["FAILING","BLOCKED","UNAVAILABLE"].includes(status);
