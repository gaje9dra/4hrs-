export type ReliabilityCapability =
  | "STOREFRONT" | "CATALOG" | "SEARCH" | "AUTHENTICATION" | "CART"
  | "CHECKOUT" | "PAYMENT" | "ORDER" | "FULFILLMENT" | "SHIPPING"
  | "TRACKING" | "RETURNS" | "CUSTOMER_ACCOUNT" | "ADMIN" | "NOTIFICATIONS"
  | "ANALYTICS" | "CONTENT" | "PRIVACY";

export type ReliabilityDependency =
  | "DATABASE" | "PAYMENT_PROVIDER" | "QIKINK" | "SHIPPING_PROVIDER"
  | "NOTIFICATION_PROVIDER" | "ANALYTICS_PIPELINE" | "SEARCH"
  | "CDN_CACHE" | "APPLICATION";

export type SloCandidate = Readonly<{
  key: string;
  capability: ReliabilityCapability;
  measurement: string;
  population: string;
  exclusions: string[];
  aggregationWindow: string;
  target: number | null;
  provisional: boolean;
  alertThreshold: string;
  owner: string;
}>;

export const SLO_CANDIDATES: readonly SloCandidate[] = [
  { key: "storefront-availability", capability: "STOREFRONT", measurement: "successful storefront HTTP responses", population: "storefront requests", exclusions: ["intentional 4xx"], aggregationWindow: "rolling 30 days", target: null, provisional: true, alertThreshold: "sustained availability degradation", owner: "operations" },
  { key: "checkout-success", capability: "CHECKOUT", measurement: "completed checkout attempts without application failure", population: "checkout attempts", exclusions: ["customer validation failures"], aggregationWindow: "rolling 30 days", target: null, provisional: true, alertThreshold: "material increase versus baseline", owner: "commerce operations" },
  { key: "payment-callback-processing", capability: "PAYMENT", measurement: "payment events processed within operational threshold", population: "received payment callbacks", exclusions: [], aggregationWindow: "rolling 30 days", target: null, provisional: true, alertThreshold: "unprocessed callback dwell-time anomaly", owner: "payments operations" },
  { key: "order-creation", capability: "ORDER", measurement: "successful order creation after eligible payment", population: "successful payment states", exclusions: [], aggregationWindow: "rolling 30 days", target: null, provisional: true, alertThreshold: "successful payment without order beyond threshold", owner: "commerce operations" },
  { key: "fulfillment-handoff", capability: "FULFILLMENT", measurement: "fulfillment requests reaching a terminal or explicitly reconciled state", population: "created fulfillment records", exclusions: [], aggregationWindow: "rolling 30 days", target: null, provisional: true, alertThreshold: "stuck fulfillment dwell-time anomaly", owner: "fulfillment operations" },
  { key: "shipment-creation", capability: "SHIPPING", measurement: "shipments created without unresolved reconciliation", population: "shipment creation attempts", exclusions: [], aggregationWindow: "rolling 30 days", target: null, provisional: true, alertThreshold: "creation dwell-time or reconciliation anomaly", owner: "shipping operations" },
  { key: "notification-processing", capability: "NOTIFICATIONS", measurement: "deliveries processed without terminal failure", population: "notification deliveries", exclusions: ["suppressed by customer preference"], aggregationWindow: "rolling 30 days", target: null, provisional: true, alertThreshold: "retry backlog/dwell-time anomaly", owner: "communications operations" },
];

export const ERROR_BUDGET_POLICY = {
  consumesBudget: ["customer-visible failed requests", "confirmed payment/order/fulfillment/shipping failures", "privacy/data-integrity incidents", "material provider-caused degradation"],
  doesNotConsumeBudget: ["intentional validation failures", "customer preference suppression", "known informational events", "isolated non-customer-visible diagnostics"],
  treatment: "Use reliability budget as an operational signal. Recurring or severe incidents increase release scrutiny; releases are not mechanically blocked without evidence.",
} as const;

export const DEPENDENCY_POLICIES = {
  DATABASE: { timeoutMs: 1500, retry: "No blind retry for mutations; fail closed for readiness." },
  PAYMENT_PROVIDER: { timeoutMs: 5000, retry: "No automatic retry of payment mutation unless provider operation is explicitly idempotent." },
  QIKINK: { timeoutMs: 10000, retry: "Preserve fulfillment state; never duplicate ambiguous provider submission." },
  SHIPPING_PROVIDER: { timeoutMs: 10000, retry: "Provider-neutral retry policy; shipment creation ambiguity requires reconciliation." },
  NOTIFICATION_PROVIDER: { timeoutMs: 10000, retry: "Bounded exponential backoff with jitter; optional communication failure does not roll back domain state." },
  ANALYTICS_PIPELINE: { timeoutMs: 3000, retry: "Best effort; analytics must not block commerce." },
  SEARCH: { timeoutMs: 3000, retry: "Use safe fallback where supported; never mutate catalog because search is unavailable." },
  CDN_CACHE: { timeoutMs: 2000, retry: "Serve origin/last known safe content where platform behavior permits." },
  APPLICATION: { timeoutMs: 10000, retry: "No generic retry; classify the application failure first." },
} as const;
