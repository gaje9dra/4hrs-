# Phase 16.15 — Background Job and Event Certification

## Executive Summary

Phase 16.15 certifies the asynchronous architecture that actually exists in 4HRS+. No second queue, worker framework, event bus, scheduler, retry engine, or orchestration platform was introduced.

The repository contains one true scheduled worker: Netlify's process-notifications function, scheduled every five minutes. Payment webhooks, fulfillment operations, shipping/tracking events, and notification events use the existing server-side application/database architecture.

## Scope

Certified:
- scheduled notification processing
- notification event/delivery lifecycle
- notification idempotency and retry behavior
- stale worker recovery
- payment webhook authentication and event deduplication
- fulfillment idempotency and serialization handling
- shipping/tracking deduplication and ambiguous-outcome policy
- Qikink server-side/provider-neutral boundary
- async observability and correlation
- database uniqueness and transactional boundaries
- CI certification enforcement

Not introduced:
- queue infrastructure
- distributed worker infrastructure
- dead-letter queue
- provider catalog synchronization
- Qikink catalog APIs
- Phase 16.16 functionality

## Repository Async Inventory

| Workflow | Mechanism | Trigger | Durable state | Safety model |
|---|---|---|---|---|
| Notification processor | Netlify Scheduled Function | */5 * * * * | NotificationEvent, NotificationDelivery | idempotency key, atomic claim, bounded retry, stale-processing lease |
| Payment callback | Next.js server route | POST /api/payment/webhook/[providerId] | PaymentEvent, Payment | signature verification, unique provider event ID, serializable transaction |
| Fulfillment | server application service | order/admin workflow | Fulfillment, operation idempotency | idempotency key, state validation, serialization conflict handling |
| Shipping/tracking | server application/repository | shipment workflow/provider event | Shipment, TrackingEvent | idempotency key, unique deduplication key, serializable shipment creation |

## Jobs

The only persisted asynchronous job-like delivery records are notification deliveries. They contain status, attempt count, maximum attempts, retry timestamp, last attempt timestamp, provider references, failure classification, correlation ID, and a unique idempotency key.

## Workers

The Netlify scheduled function invokes processNotificationBatch(). The worker is bounded by the configured batch size and does not introduce a separate queue.

A stale PROCESSING delivery is recoverable after the bounded processing lease. The claim remains conditional, preventing two workers from claiming the same record concurrently.

## Queues

No queue service is implemented or required by the current architecture. Notification delivery is database-backed rather than broker-backed.

## Schedulers / Cron

The notification processor is configured as a Netlify scheduled function at five-minute intervals. Repository CI verifies the schedule declaration but cannot prove external scheduler execution history.

## Event Producers / Consumers

Notification producers call the notification service with an application idempotency key. Payment providers produce authenticated webhooks. Shipping providers may produce normalized tracking events. Consumers validate and persist durable state before completing the relevant transition.

## Event Schemas

Payment and tracking events use normalized provider identities, event types/statuses, timestamps, and provider identifiers. Notification events use typed event types, customer/order references, correlation IDs, payload, and idempotency keys.

No exactly-once delivery guarantee is claimed. The architecture is treated as at-least-once where external delivery is involved.

## Job Lifecycle

Notification delivery states include PENDING, PROCESSING, SENT, DELIVERED, RETRY_SCHEDULED, FAILED, SUPPRESSED, and AMBIGUOUS.

A worker crash can leave PROCESSING; Phase 16.15 remediates this with a bounded stale-processing lease.

## Idempotency

- Notification event identity: unique NotificationEvent.idempotencyKey.
- Notification delivery identity: unique delivery idempotency key.
- Payment callback identity: unique (providerId, providerEventId).
- Fulfillment operations: persisted idempotency keys and state checks.
- Shipment creation: persisted creation idempotency key.
- Tracking events: provider identity/deduplication key with a database uniqueness constraint.

## Retry and Backoff

Notification retries are bounded to five attempts with exponential backoff and jitter. Permanent failures are terminal. Shipping shipment creation does not automatically retry ambiguous outcomes because the currently qualified provider boundary does not establish safe duplicate-creation semantics.

## Dead-Letter / Failure Handling

There is no separate dead-letter queue. Failed notification deliveries remain durably visible as FAILED or AMBIGUOUS, with failure classification and correlation metadata. Payment, fulfillment, and shipping failures remain in their respective domain records/reconciliation paths.

## Event Ordering

Payment and shipment transitions validate current state before mutation. Tracking events are deduplicated and normalized. No global event ordering guarantee is claimed.

## Concurrency

Notification claims use conditional database updates. Payment processing uses unique provider event identity and serializable transactions. Fulfillment and shipment workflows use idempotency plus concurrency/state checks.

## Transaction Boundaries

Database mutations that establish durable event/job identity and domain state are performed through the existing Prisma repository/application boundaries. External provider calls are not falsely represented as atomic with the database.

## Payment Async Processing

The payment webhook verifies provider signatures/capabilities, applies payload bounds and rate limiting, persists provider event identity, rejects financial mismatches, and processes state transitions transactionally. Duplicate processed callbacks are treated as duplicates.

## Fulfillment Async Processing

Fulfillment remains provider-neutral. Existing provider mapping resolves Store SKU to the configured provider SKU, and Qikink remains behind the provider adapter.

## Qikink Boundary

Qikink is fulfillment-only. No browser code is permitted to call Qikink, and no catalog synchronization was added. Provider credentials remain server-side.

## Shipping / Post-Order Processing

Shipment creation is idempotent and serializable. Tracking events have durable deduplication. Ambiguous shipment creation is not automatically retried; reconciliation is the safe recovery path.

## Notifications

Notification eligibility is rechecked before delivery, communication preferences are honored, customer anonymization/deletion is respected, and delivery retries are bounded.

The repository does not contain an approved concrete production notification-provider adapter. This is documented as a MEDIUM deployment dependency rather than fabricating a provider implementation.

## Scheduled Tasks

The scheduled notification task is safe against duplicate invocation at the database claim boundary and safe against stale worker recovery after the processing lease.

## Worker Shutdown

Netlify functions are short-lived and do not expose a separate long-running worker shutdown protocol. Provider calls are timeout-bounded. Stale processing recovery protects against abrupt termination.

## Deployment Compatibility

The async architecture is database-backed and compatible with rolling/serverless execution because durable state, uniqueness constraints, and state transitions live in Prisma/PostgreSQL rather than process memory.

## Replay and Recovery

No unrestricted replay endpoint was introduced. Payment duplicates are safely ignored after processing. Fulfillment/shipping use reconciliation and idempotency. Notification failures remain inspectable through admin operations.

## Security

Webhook verification, payload bounds, rate limits, domain validation, server-side provider adapters, and existing RBAC boundaries are preserved.

## Admin / RBAC

No new unrestricted recovery endpoint was added. Existing admin operations remain the authorization boundary for operational actions.

## Observability

Async operations use existing structured logging, metrics, correlation IDs, failure categories, and operational records. Secrets and unnecessary customer payloads are not added to logs by this phase.

## Performance / Capacity

The notification batch is bounded. Retry backoff prevents immediate retry storms. Database indexes support notification status/retry lookup and tracking/event lookup. No destructive production load test was performed.

## Database Integrity

The database provides unique event/idempotency constraints and relational integrity. Prisma validation and generation remain required CI gates.

## Failure-Injection Results

Repository-safe automated coverage verifies:
- duplicate notification enqueue race handling
- stale notification worker recovery
- bounded retry policy
- duplicate payment callback handling
- concurrent payment serialization handling
- duplicate tracking event protection
- ambiguous shipment creation non-retry behavior
- provider-boundary security

External production evidence remains unavailable for:
- Netlify scheduler execution history
- real payment provider delivery
- real Qikink callbacks
- real notification provider delivery
- production crash/restart telemetry

These limitations are not fabricated into successful production observations.

## Test Coverage

tests/phase-16-15-background-event-certification.test.ts validates the architecture and phase gate. The complete repository test suite remains the final correctness gate.

## Discovered Issues

### ASYNC-002 — HIGH — Remediated

Affected component: notification worker.

Failure mode: an interrupted worker could leave a delivery in PROCESSING indefinitely.

Impact: notification work could become permanently stuck.

Evidence: prior claimDelivery only selected PENDING and due RETRY_SCHEDULED records.

Remediation: added a two-minute processing lease and conditional stale-PROCESSING reclamation.

Remaining risk: lease duration is time-based; external provider behavior remains outside the repository.

### ASYNC-003 — HIGH — Remediated

Affected component: notification enqueue.

Failure mode: concurrent identical event creation could race the pre-create lookup and hit a unique constraint.

Impact: at-least-once producers could receive an avoidable failure.

Remediation: unique-conflict recovery now resolves the authoritative existing notification event.

Remaining risk: external provider duplicate semantics remain provider-specific.

### ASYNC-014 — MEDIUM — External Dependency

Affected component: notification provider.

Failure mode: no concrete production provider adapter is currently implemented.

Impact: production notification delivery cannot be enabled until an approved adapter exists.

Remediation: none fabricated; provider-neutral boundary is preserved.

Remaining risk: transactional notification delivery remains deployment-dependent.

## Severity Classification

- CRITICAL: none after remediation.
- HIGH: none after remediation.
- MEDIUM: concrete notification provider remains an external deployment dependency.
- LOW: none identified.
- INFORMATIONAL: external scheduler/provider evidence unavailable to repository CI.

## Remediation Performed

- Added stale notification processing recovery.
- Added concurrent notification-event idempotency race handling.
- Added Phase 16.15 certification script and machine-readable evidence.
- Added automated certification tests.
- Added CI enforcement and artifact upload.
- Added this certification document.
- Preserved the existing architecture and locked technology stack.
- Did not introduce Phase 16.16.

## Remaining Risks

1. External notification provider selection/adapter implementation remains a deployment dependency.
2. External scheduler delivery and provider callback histories cannot be certified solely from repository CI.
3. No exactly-once guarantee is claimed for external distributed events.

## Production Readiness Assessment

The repository's implemented asynchronous state-management architecture is production-ready with respect to the certified controls. The remaining notification-provider dependency is explicitly documented and does not create an unresolved CRITICAL/HIGH repository safety blocker.

## Final Certification Decision

PHASE 16.15 STATUS: READY FOR PHASE 16.16

This decision is valid only after the complete required CI suite, Prisma validation/generation, build, and Phase 16.15 certification command pass.

Phase 16.16 is not implemented, pre-built, or started by this phase.
