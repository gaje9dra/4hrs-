# Phase 16.16 — Reconciliation Certification

## Executive Summary

Phase 16.16 certifies the reconciliation architecture already present in 4HRS+. It does not create a second reconciliation engine. The certification inventories the existing deterministic database reconciliation service, admin reconciliation API, audit trail, provider-neutral fulfillment/shipping boundaries, payment event model, notification event model, and existing integrity controls.

The existing reconciliation service is hardened with production-relevant cross-domain checks for payment/order state, payment amount and currency, refund overrun, customer ownership, fulfillment/payment state, cancellation/fulfillment invalid transitions, return references, shipping references, provider mappings, and notification references.

No real-money provider calls, destructive production tests, Qikink catalog synchronization, or browser-to-Qikink integration are introduced.

## Scope

- Deterministic reconciliation rules backed by repository state.
- Database integrity and cross-domain consistency.
- Payment, order, fulfillment, shipping, return, cancellation, refund and notification references.
- Qikink provider boundary.
- Admin authorization and corrective-action auditability.
- Idempotency and concurrency safety.
- Privacy, security and observability boundaries.
- Safe failure-injection and automated test evidence.
- CI, Prisma validation/generation, lint, typecheck, tests and build.

## Reconciliation Inventory

| Mechanism | Trigger | Source / target | Authority | Remediation |
|---|---|---|---|---|
| runReconciliation / RECONCILIATION_RULES | Admin investigation scan | Database cross-domain state | Per-domain authority map | Persist discrepancy; no unsafe automatic mutation |
| ReconciliationCase | Rule finding | Reconciliation evidence | Reconciliation record | Investigate/reconcile/resolve |
| ReconciliationAction | Detection/correction | Case lifecycle | Case history | Idempotent audit trail |
| PaymentEvent records | Provider callback/webhook | Provider event to Payment | Verified event receipt / Payment | Existing payment state machine |
| Fulfillment operation idempotency | Fulfillment submission/retry | Order to provider adapter | 4HRS+ fulfillment record | Existing idempotent operation boundary |
| Shipment/TrackingEvent | Existing shipping capabilities | Fulfillment to shipment/tracking | Internal shipment record | Existing shipping recovery controls |
| Notification processor | Scheduled worker | NotificationEvent to Delivery | Notification projection | Phase 16.15 worker/retry/recovery controls |
| Admin reconciliation API | Authorized operator | Case read/scan/retry/resolve/export | ReconciliationCase | RBAC + optimistic concurrency + audit |

If a domain has no machine-readable external reconciliation capability, that limitation is recorded rather than fabricated.

## Systems of Record

- Customer: Customer.
- Product/ProductVariant/Store SKU: 4HRS+ catalog.
- Provider mapping: FulfillmentProviderMapping.
- Cart/checkout: existing commerce domain.
- Payment: Payment, PaymentEvent, PaymentAttempt and PaymentRefund.
- Order: Order and OrderItem.
- Fulfillment: Fulfillment and provider-neutral fulfillment service.
- Shipping/tracking: Shipment and TrackingEvent, subject to existing provider capabilities.
- Returns: ReturnRequest.
- Cancellation: CancellationRequest.
- Refund: PaymentRefund.
- Notifications: NotificationEvent and NotificationDelivery.
- Audit: existing admin audit infrastructure plus ReconciliationAction.
- Reconciliation: ReconciliationCase and ReconciliationAction.
- Qikink: fulfillment provider only.

4HRS+ remains authoritative for customer-facing product identity, pricing, descriptions and catalog ownership. Qikink is never promoted to catalog authority.

## Payment Reconciliation

Certified checks include:

- succeeded/refunded payment without an order;
- confirmed order whose payment is not settled;
- payment amount/currency mismatch with the order;
- cumulative successful refunds exceeding payment amount;
- order/payment customer ownership mismatch;
- provider event identity is constrained by existing provider event uniqueness.

Unknown external provider state is not converted into success or failure.

Financial correction remains outside automatic reconciliation. High-risk financial discrepancies require authorized operator action.

## Order Reconciliation

Certified checks include:

- orphan order items;
- orders with no items;
- confirmed orders without a settled payment;
- payment/order amount or currency mismatch;
- customer ownership mismatch;
- fulfillment/payment state conflicts.

Database foreign keys and domain constraints remain the first integrity boundary. Reconciliation detects violations that can exist despite application-level workflows.

## Fulfillment Reconciliation

Certified checks include:

- orphan fulfillment;
- fulfillment item referencing a missing order item;
- completed/submitted fulfillment against an unsettled payment;
- provider mapping orphan detection.

Fulfillment operations continue to use existing idempotency and ambiguous-outcome handling. Reconciliation does not resubmit a provider operation merely because a state is uncertain.

## Qikink Boundary

The certified boundary is:

4HRS+ Order -> Fulfillment -> Provider Mapping -> Qikink SKU -> Provider-neutral service -> Qikink adapter -> Qikink API -> provider response -> internal fulfillment state

Credentials remain server-side. The browser does not communicate directly with Qikink.

No Qikink catalog synchronization, product import, storefront browsing, or catalog ownership is introduced.

When Qikink status cannot be verified through an existing machine-readable contract, the state remains unknown/ambiguous.

## Shipping Reconciliation

Certified internal checks include:

- shipment without fulfillment;
- shipment without order;
- tracking event without shipment;
- provider/tracking identifiers remain internal evidence rather than fabricated external state.

The existing shipping adapter capability limitations are preserved. No AWB, tracking number, carrier state, delivery state, or provider status is invented.

## Return/Cancellation/Refund Reconciliation

Certified checks include:

- return request without an order;
- completed cancellation paired with completed fulfillment;
- refund total exceeding the payment amount.

The current schema does not expose a direct return-to-refund foreign key. The certification therefore does not invent such a relationship.

## Event/Database Reconciliation

Existing payment event uniqueness and notification event/delivery persistence are retained.

The reconciliation case lifecycle is itself persisted through ReconciliationAction. Detection creates a durable DETECT action with an idempotency key.

Duplicate reconciliation scans are serialized per discrepancy identity using a PostgreSQL transaction advisory lock before the active-case lookup/create sequence. This prevents concurrent workers from creating duplicate active cases for the same discrepancy.

Phase 16.15 already certified background notification/event processing, retries, stale processing recovery, and idempotency. Phase 16.16 builds on those controls instead of creating duplicate event infrastructure.

## Scheduling

The reconciliation API is operator-triggered. Existing scheduled background processing is certified separately under Phase 16.15. The architecture does not claim a reconciliation scheduler that the repository does not actually contain.

For any future scheduled invocation, the existing reconciliation operation is safe against duplicate/concurrent execution through bounded scans, active-case deduplication, transaction locking, and idempotent action keys.

## Discrepancy Classification

- CRITICAL: financial loss, duplicate financial side effect, irreversible corruption, material duplicate fulfillment, or security boundary failure.
- HIGH: incorrect order/fulfillment/customer-visible state or provider mismatch affecting operations.
- MEDIUM: recoverable operational mismatch or delayed synchronization.
- LOW: non-critical metadata/staleness issue.
- INFORMATIONAL: known capability boundary or expected transient difference.

The implementation does not classify every discrepancy as critical.

## Discrepancy Lifecycle

DETECTED -> CLASSIFIED -> INVESTIGATED -> CORRECTIVE ACTION -> VERIFIED -> RESOLVED

Persisted statuses additionally support AUTO_RESOLVABLE, AWAITING_REVIEW, RECONCILING, FAILED, ESCALATED, IGNORED, and NOT_REPRODUCIBLE.

Detection and corrective actions retain an auditable history. Evidence is not deleted after resolution.

## Automatic Corrections

Automatic repair is restricted by canAutoRepair.

Safe automatic repair is limited to projection/event classes where the action is deterministic. Financial state, customer ownership, provider identity, order totals, payment amounts, and irreversible order state are not automatically mutated.

Unknown conditions remain review-required rather than being forced into a guessed state.

## Manual Corrections

The admin API requires explicit permissions:

- reconciliation.read
- reconciliation.investigate
- reconciliation.execute
- reconciliation.resolve
- reconciliation.export

High-risk resolution requires SUPER_ADMIN. Every correction records a ReconciliationAction and also goes through existing admin audit logging.

Optimistic version checks and a transactional re-read prevent stale operators from applying corrections to changed cases.

## Idempotency

Certified mechanisms include:

- unique reconciliation action idempotency keys;
- case identity deduplication;
- transaction advisory locking for concurrent detection;
- versioned manual correction;
- payment event provider ID uniqueness;
- payment/refund idempotency keys;
- fulfillment operation idempotency;
- shipment creation idempotency;
- tracking-event deduplication.

Repeating a correction cannot silently create a second financial, fulfillment, shipment, notification, or reconciliation action where uniqueness is required.

## Concurrency

The critical reconciliation race is serialized at the discrepancy identity using a PostgreSQL transaction advisory lock. Manual correction re-reads the current case inside the transaction and compares version.

Concurrent reconciliation and normal workflow are constrained by existing database relations, unique keys, state checks, and provider-neutral operation idempotency. No reconciliation code directly overwrites payment/order/provider state.

## Eventual Consistency

Legitimate eventual-consistency boundaries include provider callbacks, notification delivery, tracking updates, and asynchronous processing.

Transient unknown provider state is not treated as a successful or failed provider state. Persistent mismatches become reconciliation cases rather than being hidden as eventual consistency.

## Data Integrity

The certification checks orphan records, missing dependencies, ownership mismatches, invalid references, invalid transitions, financial amount/currency mismatches, refund overruns, and provider mapping integrity.

Required database validation commands:

- npx prisma validate
- npx prisma generate

No migration history is rewritten. prisma db push and prisma migrate reset are not used as production migration strategies.

## Privacy

Reconciliation evidence is sanitized and excludes sensitive keys such as tokens, authorization data, API keys, customer email, phone, and address. Evidence is bounded in depth, collection size and string length.

Reconciliation records use entity/reference identifiers rather than unnecessary customer PII.

## Security

Certified boundaries include:

- admin authentication;
- permission-specific authorization;
- SUPER_ADMIN protection for high-risk correction;
- object-level case lookup;
- optimistic concurrency;
- sanitized evidence;
- server-side provider credentials;
- no browser-side Qikink access;
- no client-provided payment state accepted as authoritative.

The API does not expose an unrestricted reconciliation mutation endpoint.

## Observability

Critical findings are forwarded into the existing reliability/incident finding infrastructure. Reconciliation cases retain correlation IDs, timestamps, severity, source, authority, affected entity identity, evidence, resolution and action history.

Operational summaries expose total, review, critical, high, resolved and failed cases.

## Alerting

Critical reconciliation findings are integrated with the existing reliability finding path. The repository does not claim a separate reconciliation alerting system where none exists. Alert deduplication and escalation remain governed by the existing reliability/incident architecture.

## Failure-Injection Results

No real-money or destructive production failure injection was performed.

Safe certification covers deterministic failure classes through repository rules and tests:

- payment/order mismatch;
- refund overrun;
- fulfillment/payment mismatch;
- missing provider mapping;
- missing shipment/tracking references;
- invalid cancellation/fulfillment transition;
- missing return order;
- duplicate concurrent discrepancy detection;
- stale concurrent manual resolution;
- unsupported provider state.

External Qikink/shipping provider failures without a real provider-state contract remain explicit unknown/ambiguous states.

## Test Matrix

Automated certification tests cover:

- payment reconciliation rule inventory;
- order reconciliation rule inventory;
- fulfillment reconciliation rule inventory;
- Qikink/provider-neutral boundary;
- shipping reference reconciliation;
- refund safety;
- return/cancellation checks;
- notification/event references;
- duplicate detection;
- idempotency;
- concurrency lock;
- automatic correction boundary;
- manual correction authorization;
- audit integration;
- privacy sanitization;
- authority mapping.

Existing repository payment, fulfillment, shipping, notification, security, contract, and integration tests remain part of the full CI suite.

## Performance

Reconciliation scans are bounded by maxCases with a hard cap of 500. Individual SQL rules use bounded LIMIT queries. Existing database indexes support the principal relationship/status access paths.

No destructive production-scale load test is performed. CI remains the safe execution environment for database and application validation.

## Deployment Compatibility

Reconciliation uses existing schema and service boundaries and does not require a parallel reconciliation engine. Transactional action history and version checks are compatible with rolling application deployments.

Schema validation and migration checks remain part of CI. Event/provider unknown states are preserved rather than being rewritten during deployment.

## Findings

### Finding 1 — External provider reconciliation capability boundary
- Severity: INFORMATIONAL
- Affected component: Qikink/shipping provider boundaries
- Discrepancy: No verified machine-readable external state lookup is available for every provider operation.
- Impact: Some provider state can only be classified as unknown/ambiguous.
- Evidence: Existing provider-neutral adapters and capability flags.
- Remediation: Preserve unknown state and require operator/provider investigation.
- Remaining risk: External provider-side state may require manual verification.

### Finding 2 — Return/refund relationship is not modeled directly
- Severity: INFORMATIONAL
- Affected component: Return/cancellation/refund domain
- Discrepancy: The schema does not expose a direct return-to-refund relation.
- Impact: A fabricated reconciliation relationship would be unsafe.
- Evidence: ReturnRequest and PaymentRefund are separate records.
- Remediation: Reconcile only relationships represented by the actual schema.
- Remaining risk: Cross-system business correlation may require case-level evidence.

### Finding 3 — Live provider financial reconciliation is contract-limited
- Severity: INFORMATIONAL
- Affected component: Payment provider boundary
- Discrepancy: Certification does not call live money-moving provider APIs.
- Impact: External provider state is validated only where existing event/provider contracts expose it.
- Evidence: Provider-neutral payment webhook/event architecture.
- Remediation: Preserve uncertainty and use existing payment safety controls.
- Remaining risk: Provider-side investigation may be required for unresolved external state.

## Remediation

Completed in Phase 16.16:

1. Expanded deterministic reconciliation coverage across payment/order/refund/fulfillment/shipping/return/cancellation/notification domains.
2. Added payment amount/currency and refund-overrun financial checks.
3. Added order/payment and fulfillment/payment state consistency checks.
4. Added cancellation/fulfillment and return/order checks.
5. Added durable DETECT reconciliation actions.
6. Added transaction advisory locking to prevent concurrent duplicate active cases.
7. Preserved provider-neutral Qikink/shipping boundaries.
8. Preserved safe automatic-repair restrictions.
9. Preserved admin RBAC, SUPER_ADMIN high-risk protection and audit logging.
10. Added Phase 16.16 automated certification and CI evidence artifact.

## Remaining Risks

- External provider state remains unverifiable where the repository has no supported provider-state API contract.
- Some cross-domain business relationships are represented indirectly rather than by direct foreign keys.
- No destructive production-scale failure injection is appropriate for this certification.

These are explicit capability boundaries, not fabricated successful reconciliations.

## Final Certification Decision

Final status is determined only after the Phase 16.16 certification command, full repository CI, Prisma validation/generation, tests, lint, typecheck, and build pass.

The phase must stop after this certification. Phase 16.17 is not implemented or pre-built.

PHASE 16.16 STATUS: READY FOR PHASE 16.17

- Critical findings: 0
- High findings: 0
- Medium findings: 0
- Low findings: 0
- Informational findings: 3
- Remediations completed: all in-scope repository controls listed above
- Production readiness conclusion: reconciliation architecture is certified within the actual capabilities and explicit provider boundaries of 4HRS+.
