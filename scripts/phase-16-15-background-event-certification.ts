import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type Severity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFORMATIONAL";
type Finding = {
  id: string; severity: Severity; component: string; failureMode: string;
  impact: string; evidence: string; remediation: string; remainingRisk: string;
};

const root = process.cwd();
const findings: Finding[] = [];

async function main(): Promise<void> {
async function read(rel: string) { return readFile(path.join(root, rel), "utf8"); }
function add(id: string, severity: Severity, component: string, failureMode: string, impact: string, evidence: string, remediation: string, remainingRisk: string) {
  findings.push({ id, severity, component, failureMode, impact, evidence, remediation, remainingRisk });
}

const files = {
  notificationService: await read("lib/notifications/service.ts"),
  notificationConfig: await read("lib/notifications/config.ts"),
  notificationRetry: await read("lib/notifications/retry.ts"),
  notificationProvider: await read("lib/notifications/provider.ts"),
  notificationFunction: await read("netlify/functions/process-notifications.mts"),
  paymentWebhook: await read("app/api/payment/webhook/[providerId]/route.ts"),
  paymentApplication: await read("lib/payments/application.ts"),
  paymentRepository: await read("lib/payments/repository.ts"),
  fulfillmentApplication: await read("lib/fulfillment/application.ts"),
  qikink: await read("lib/fulfillment/providers/qikink.ts"),
  shippingApplication: await read("lib/shipping/application.ts"),
  shippingRepository: await read("lib/shipping/repository.ts"),
  shippingRetry: await read("lib/shipping/retry.ts"),
  ci: await read(".github/workflows/ci.yml"),
  schema: await read("prisma/schema.prisma"),
};

const asyncInventory = [
  { name: "Notification scheduled processor", mechanism: "Netlify scheduled function", trigger: "*/5 * * * *", producer: "commerce/payment/fulfillment/shipping flows", consumer: "processNotificationBatch", state: "NotificationEvent + NotificationDelivery" },
  { name: "Payment provider callback", mechanism: "Next.js server route", trigger: "POST /api/payment/webhook/[providerId]", producer: "payment provider", consumer: "processNormalizedPaymentEvent", state: "PaymentEvent + Payment" },
  { name: "Fulfillment provider processing", mechanism: "server-side application service", trigger: "order/admin fulfillment workflow", producer: "4HRS+ order/fulfillment flow", consumer: "FulfillmentApplicationService", state: "Fulfillment + FulfillmentOperationIdempotency" },
  { name: "Shipping/tracking processing", mechanism: "server-side application/repository", trigger: "shipment workflow/provider event", producer: "4HRS+ shipping flow/provider", consumer: "ShippingApplicationService", state: "Shipment + TrackingEvent" },
];

if (!/schedule:\s*"\*\/5 \* \* \* \*"/.test(files.notificationFunction))
  add("ASYNC-001","HIGH","Notification scheduler","Schedule contract missing or changed","Notifications may stop on the intended cadence.","Netlify scheduled function must expose the certified five-minute schedule.","Restore the existing scheduled-function contract.","External scheduler history is outside repository CI.");

if (!/PROCESSING/.test(files.notificationService) || !/processingLeaseCutoff/.test(files.notificationService))
  add("ASYNC-002","HIGH","Notification worker","Abandoned PROCESSING deliveries are not lease-recoverable","A worker crash can strand a notification indefinitely.","claimDelivery must reclaim stale PROCESSING records atomically.","Use the bounded processing lease and conditional claim.","The lease is time-based.");

if (!/P2002/.test(files.notificationService) || !/notificationEvent\.findUnique/.test(files.notificationService))
  add("ASYNC-003","HIGH","Notification enqueue","Concurrent identical events can fail instead of deduplicating","At-least-once producers could lose work or surface avoidable errors.","Unique idempotency enforcement must handle create races.","Resolve unique conflicts to the authoritative existing event.","Provider-side duplicate semantics remain external.");

if (!/deliveryIdempotencyKey/.test(files.notificationService) || !/idempotencyKey: input\.idempotencyKey/.test(files.notificationService))
  add("ASYNC-004","HIGH","Notification delivery","Stable event/delivery identity is not persisted","Retries could create duplicate customer notifications.","NotificationEvent and NotificationDelivery require stable idempotency keys.","Persist and reuse event and delivery keys.","External provider semantics are provider-specific.");

if (!/retryDelaySeconds/.test(files.notificationService) || !/NOTIFICATION_MAX_ATTEMPTS/.test(files.notificationService) || !/isRetryableFailure/.test(files.notificationService))
  add("ASYNC-005","HIGH","Notification retry","Retry limits/classification incomplete","Permanent failures could loop or transient failures could be lost.","Retry policy must be bounded and classify failures.","Keep bounded exponential retry and terminal states.","No separate dead-letter queue exists.");

if (!/processingStatus === "PROCESSED"/.test(files.paymentApplication) || !/recordPaymentEvent/.test(files.paymentApplication) || !/markPaymentEventProcessed/.test(files.paymentApplication))
  add("ASYNC-006","CRITICAL","Payment webhook processing","Payment callbacks lack durable deduplication","Duplicate callbacks could mutate financial state repeatedly.","PaymentEvent identity and processed-state checks are required.","Persist provider event identity and mark it processed inside the payment transaction.","External provider delivery guarantees remain external.");

if (!/verifyWebhook/.test(files.paymentWebhook) || !/webhookVerification/.test(files.paymentWebhook) || !/MAX_WEBHOOK_BYTES/.test(files.paymentWebhook))
  add("ASYNC-007","HIGH","Payment webhook boundary","Webhook verification/input limits incomplete","Forged or oversized callbacks could reach financial processing.","Webhook route must verify the provider before normalized processing.","Keep verification, rate limits, and payload bounds.","Actual provider signatures are not exercised by CI.");

if (!/idempotencyKey/.test(files.fulfillmentApplication) || !/getByIdempotencyKey/.test(files.fulfillmentApplication) || !/P2034/.test(files.fulfillmentApplication))
  add("ASYNC-008","HIGH","Fulfillment submission","Duplicate/concurrent requests lack enforced safety","Retries or races could create duplicate provider submissions.","Fulfillment must use persisted idempotency and serialization-conflict handling.","Preserve existing fulfillment operation idempotency and transactions.","Provider-side duplicate semantics remain adapter-specific.");

if (/["']use client["']/.test(files.qikink))
  add("ASYNC-009","CRITICAL","Qikink boundary","Provider adapter is client-side","Qikink credentials could cross the browser boundary.","The Qikink adapter must remain server-side.","Keep Qikink behind the existing fulfillment provider adapter.","Deployment-time transformations are outside repository evidence.");

if (!/createTrackingEventIfNew/.test(files.shippingRepository) || !/deduplicationKey/.test(files.shippingRepository) || !/@@unique\(\[shipmentId, providerId, deduplicationKey\]\)/.test(files.schema))
  add("ASYNC-010","HIGH","Shipping tracking events","Duplicate provider events are not durably deduplicated","Repeated callbacks could duplicate or regress shipment state.","TrackingEvent uses provider identity/deduplication plus a database uniqueness constraint.","Persist normalized event identity and reject duplicates safely.","Events without IDs use a deterministic fingerprint.");

if (!/AMBIGUOUS/.test(files.shippingRetry) || !/SHIPMENT_CREATE/.test(files.shippingRetry))
  add("ASYNC-011","HIGH","Shipment creation retry","Ambiguous creation could be retried unsafely","A provider timeout could create duplicate shipments.","Shipment creation must treat ambiguous outcomes as non-retryable unless proven safe.","Keep ambiguous creation non-retryable and reconcile instead.","Manual reconciliation remains necessary.");

if (!/providerId_providerEventId/.test(files.paymentRepository) || !/P2002/.test(files.paymentRepository) || !/P2034/.test(files.paymentApplication))
  add("ASYNC-012","HIGH","Payment concurrency","Database uniqueness/serialization evidence incomplete","Concurrent callbacks could race a financial transition.","Provider event identity is unique and payment transactions use serializable isolation.","Preserve unique event identity and conflict recovery.","Real provider concurrency is not exercised against production.");

if (!/correlationId/.test(files.notificationService) || !/logger\.(info|warn|error)/.test(files.notificationService) || !/notification_operations_total/.test(files.notificationService))
  add("ASYNC-013","MEDIUM","Async observability","Background work lacks sufficient correlation/metrics","Diagnosis of retries and failures would be impaired.","Notification processing emits correlation-aware structured logs and metrics.","Retain structured telemetry for async state transitions.","Queue-depth telemetry is unavailable because there is no queue.");

if (/NOTIFICATION_PROVIDER_MODE === "production"/.test(files.notificationConfig) && /Notification provider .* has no implemented server-side adapter/.test(files.notificationProvider))
  add("ASYNC-014","MEDIUM","Notification provider","No concrete production notification provider adapter is implemented","Enabling production notification processing currently fails closed rather than delivering messages.","The repository contains a provider-neutral boundary but no approved concrete provider.","Keep the boundary server-side and document provider selection as a deployment dependency; do not invent a provider.","Production delivery remains unavailable until an approved adapter exists.");

const packageJson = await read("package.json");
if (!/production-certification:phase-16-15/.test(packageJson))
  add("ASYNC-015","HIGH","Phase certification","Phase 16.15 command is not wired","The async gate could not be enforced automatically.","package.json must expose a deterministic certification command.","Add the Phase 16.15 certification script.","None after CI wiring.");

const critical = findings.filter(f => f.severity === "CRITICAL");
const high = findings.filter(f => f.severity === "HIGH");
const medium = findings.filter(f => f.severity === "MEDIUM");
const low = findings.filter(f => f.severity === "LOW");
const readiness = critical.length === 0 && high.length === 0 ? "READY_FOR_PHASE_16_16" : "NOT_READY_FOR_PHASE_16_16";

const report = {
  phase: "16.15",
  status: readiness,
  generatedAt: new Date().toISOString(),
  evidenceClass: "repository_static_certification",
  asyncInventory,
  findings,
  summary: {
    critical: critical.length, high: high.length, medium: medium.length, low: low.length,
    informational: findings.filter(f => f.severity === "INFORMATIONAL").length,
  },
  externalEvidenceUnavailable: [
    "Netlify scheduler delivery history",
    "real payment-provider callback delivery",
    "real Qikink callback delivery",
    "real notification-provider delivery",
    "production worker crash/restart telemetry",
  ],
  hardStop: "Phase 16.16 is not implemented by this phase.",
};

await mkdir(path.join(root, "artifacts"), { recursive: true });
await writeFile(path.join(root, "artifacts/phase-16-15-background-event-certification-evidence.json"), JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify({ phase: report.phase, status: report.status, findings: report.summary, inventoryCount: asyncInventory.length }));
if (readiness !== "READY_FOR_PHASE_16_16") process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
