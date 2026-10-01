# Phase 12.10 — Fulfillment Final Readiness

## 1. Phase objective

Finalize the production-readiness audit of the Phase 12 Fulfillment system before Shipping begins. This document records the implemented behavior, operational limitations, security posture, validation, and the explicit Phase 13 boundary.

## 2. Scope

This phase audits and hardens Fulfillment only. It does not introduce Shipping, shipment creation, labels, tracking UI, returns, exchanges, refunds, cancellation workflows, inventory redesign, a second fulfillment provider, a new payment provider, customer Fulfillment UI, or an admin Fulfillment dashboard.

## 3. Fulfillment architecture

The implemented boundary is:

Customer Order -> Order Application -> Fulfillment Application -> Fulfillment Domain/Repository -> Provider Resolver -> Provider Adapter -> External Provider.

Fulfillment remains separate from the historical commercial Order. Fulfillment records operational execution state and provider references; Order remains the authoritative historical commerce record.

Provider-specific behavior is isolated behind the adapter and resolver. Storefront components do not call provider APIs or the ORM directly.

## 4. Provider adapter architecture

FulfillmentProviderAdapter is the provider-neutral contract. Provider selection is server-side and centralized in the resolver. Provider credentials are never accepted from browser input.

The currently registered provider is Qikink. No second provider is implemented.

## 5. Provider currently integrated

Qikink is the only integrated provider adapter:

lib/fulfillment/providers/qikink.ts

The adapter uses the documented create-order API, normalizes provider responses into canonical Fulfillment states, bounds network timeouts, and classifies provider failures.

Qikink status lookup remains disabled because the repository does not have a verified status-retrieval contract to implement safely. No webhook or signature scheme is invented.

## 6. Provider configuration

Server-only configuration:

- FULFILLMENT_PROVIDER_ID
- FULFILLMENT_PROVIDER_ENABLED
- FULFILLMENT_PROVIDER_MODE
- FULFILLMENT_PROVIDER_SECRET_REFERENCE
- FULFILLMENT_PROVIDER_TIMEOUT_MS
- QIKINK_AUTH_TOKEN

.env.example contains placeholders only. NEXT_PUBLIC_* secret references are rejected.

Production enablement remains an explicit operator decision. The real Qikink credential must be supplied through the deployment environment and is never committed.

## 7. Product/variant mapping

Canonical OrderItem SKU and Variant references remain authoritative internally. Provider SKU and variant references are stored on FulfillmentItem and are not added to canonical customer Order DTOs.

Missing historical SKU data prevents Fulfillment eligibility. The Qikink adapter validates SKU, quantity, shipping country, and required email before network submission.

## 8. Fulfillment lifecycle

Canonical persisted states are:

PENDING -> SUBMITTED -> COMPLETED

with:

PENDING -> FAILED
SUBMITTED -> FAILED
FAILED -> SUBMITTED

COMPLETED is terminal. Transitions are centralized and protected by expected-state compare-and-set persistence plus serializable transactions.

Provider status strings are normalized inside the adapter. Qikink terminal failure-oriented statuses such as RTO Initiated, Returned, and Cancelled are normalized to FAILED; Delivered is normalized to COMPLETED; unknown values do not become terminal states.

## 9. Idempotency strategy

Fulfillment orderId and idempotencyKey are database-unique. Concurrent creation uses serializable transactions, bounded serialization-conflict retries, and unique-conflict reconciliation.

Repeated submission after a successfully persisted provider reference does not call the provider again.

Qikink create requests use a deterministic provider order number derived from the immutable Fulfillment ID. The adapter does not blindly retry ambiguous timeout/network failures.

## 10. Concurrency strategy

Lifecycle transitions validate the caller's expected state before the transaction and validate the current state again inside the serializable transaction.

Conditional database updates require the expected current state. Concurrent or stale updates therefore fail instead of applying last-writer-wins state corruption.

Reconciliation also re-reads state inside its transaction and protects terminal COMPLETED Fulfillments.

## 11. Webhook strategy

No Qikink webhook endpoint is implemented because no verified Qikink webhook authentication/event contract is available in the provider documentation used by this repository.

The system therefore does not accept browser-supplied provider events, invent HMAC verification, or persist unverified webhook payloads.

If Qikink later supplies a verified webhook contract, it must be added behind the existing provider boundary with raw-body verification, replay protection, persistent event deduplication, canonical normalization, and the existing state machine.

## 12. Reconciliation strategy

The application exposes a provider-neutral reconciliation operation for adapters that have a verified status-lookup capability.

Reconciliation verifies provider identity, provider fulfillment reference, current state, and canonical transition validity. It never blindly overwrites state.

For the current Qikink adapter, reconciliation deliberately stops with a structured reconciliation-required error because status lookup is not verified. This is the actual provider limitation rather than an invented polling endpoint.

## 13. Ambiguous-outcome recovery

A Qikink timeout or network failure is treated as ambiguous because the external request may have succeeded even when the application did not receive the response.

The failed Fulfillment records that the outcome is ambiguous and reconciliation is required. Subsequent submission is blocked until safe reconciliation is possible. The application never blindly sends a second Qikink create request.

Successful provider submission followed by local persistence failure is likewise treated as reconciliation-required.

## 14. Error/retry strategy

Provider errors are normalized before entering the canonical Fulfillment state machine.

Only explicitly retryable transport/rate-limit categories are retryable. Non-retryable provider failures are blocked from repeated submission. Retryable submission attempts are bounded to three attempts.

Ambiguous timeout/network outcomes are never automatically retried because Qikink does not expose a verified reconciliation/idempotency contract in the integration.

## 15. Security findings

- Provider credentials are server-only.
- NEXT_PUBLIC_* credential references are rejected.
- Provider selection is server-controlled.
- Provider URLs are not client-controlled.
- Customer Order DTOs do not expose provider references or reconciliation metadata.
- Customer Order pages do not access Prisma or provider APIs.
- Fulfillment provider references are associated with persisted Fulfillment records.
- Customer Order access remains customer-scoped.
- Raw provider exceptions and sensitive provider payloads are not exposed through customer Order APIs.
- No public customer Fulfillment mutation endpoint exists.

## 16. Observability

Existing structured Fulfillment observations cover creation, provider resolution, lifecycle transitions, and reconciliation. Diagnostics use safe identifiers and provider names rather than credentials or raw sensitive payloads.

No new observability platform was introduced.

## 17. Database/migration verification

The Fulfillment foundation migration creates:

- one Fulfillment per Order through a unique Order foreign key;
- unique Fulfillment idempotency keys;
- unique provider fulfillment references;
- one FulfillmentItem per OrderItem under the current no-split-fulfillment design;
- foreign keys protecting Order/Fulfillment/FulfillmentItem ownership;
- positive FulfillmentItem quantities;
- lookup indexes for provider, status, Order, and Fulfillment relationships.

No Phase 12.10 migration is required because the audit did not identify a database invariant that needs a schema change.

## 18. Test results

Regression coverage includes:

- Fulfillment eligibility and historical snapshots;
- idempotent and concurrent Fulfillment creation;
- stale-state rejection;
- terminal-state protection;
- unsupported reconciliation behavior;
- provider submission persistence;
- repeated submission protection;
- bounded retry behavior;
- non-retryable provider failure protection;
- Qikink request/response normalization;
- Qikink timeout/error classification;
- Qikink terminal status normalization;
- server-only credential configuration.

## 19. CI results

CI must be green on the final Phase 12.10 commit before readiness is declared.

The Phase 12.9 baseline was validated with Typecheck, Lint, Test, and Build all successful on GitHub Actions.

Final Phase 12.10 CI result is recorded after the implementation commit is validated.

## 20. Remaining limitations

1. Qikink status lookup is not enabled because no verified status endpoint is part of the API contract used by the adapter.
2. No verified Qikink webhook contract is implemented.
3. Ambiguous Qikink outcomes therefore require provider-side/manual operational reconciliation rather than automatic status synchronization.
4. Live Qikink credentials remain deployment configuration and must be supplied by the operator; credentials are not stored in source control.
5. Split fulfillment is intentionally unsupported by the current Phase 12 model.

These limitations are explicit and are not represented as customer-facing shipping or delivery claims.

## 21. Phase 13 Shipping boundary

Phase 12 ends at Fulfillment.

The boundary is:

Customer Order
-> Payment
-> Order
-> Fulfillment
-> Shipping
-> Tracking/Delivery

Phase 13 begins with Shipping. No shipping provider, shipment creation, label generation, carrier integration, tracking UI, or delivery estimate is implemented by Phase 12.10.

## 22. Final readiness decision

PENDING FINAL CI VALIDATION.
