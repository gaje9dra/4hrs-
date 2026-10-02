# Phase 13.6 — Shipping Reconciliation, Failure Recovery & Production Hardening

## 1. Scope and qualification gate

Phase 13.5 remains authoritative: no Shipping provider has a complete verified production contract. Qikink remains Fulfillment-only and its Shipping adapter continues to declare shipment creation, tracking lookup, and webhooks unsupported.

Phase 13.6 therefore hardens the provider-neutral internal Shipping boundary without adding provider HTTP calls, polling, webhooks, customer tracking UI, or a new provider.

## 2. Current-state audit

Before this phase, the repository already had:
- server-authoritative Fulfillment → Shipment handoff;
- a unique Shipment creation idempotency key;
- Serializable transaction retries for concurrent handoff;
- normalized Shipment states and terminal-state protection;
- immutable TrackingEvent persistence with database deduplication;
- chronological/out-of-order tracking handling;
- provider adapter/resolver isolation;
- customer ownership-safe Shipment DTOs;
- a reconciliation boundary that refuses unsupported provider capabilities;
- structured Shipping observations.

The remaining hardening gaps were:
- no persistent flag/reason for unresolved reconciliation;
- no authorized, idempotent operational recovery/audit boundary;
- no explicit provider-neutral retry classification;
- tracking input length/shape validation was incomplete;
- one tracking-event ordering fallback could bypass the canonical transition table;
- failure/recovery observations did not consistently carry correlation identifiers.

No current Shipping code performs a real external provider shipment submission, so an external timeout/5xx/ambiguous-create path cannot be safely simulated or claimed as implemented. Such outcomes must remain recoverable rather than guessed.

## 3. Architecture

Canonical flow remains:
4HRS+ Catalog → Cart → Checkout → Payment → Order → Fulfillment → Shipment → Tracking Events → Customer

Provider boundary remains:
4HRS+ Shipping Domain → Shipping Provider Adapter → External Shipping Provider

The canonical domain never calls Qikink directly.

## 4. Shipment lifecycle invariants

The persisted lifecycle remains:
- CREATED
- IN_TRANSIT
- OUT_FOR_DELIVERY
- DELIVERED
- DELIVERY_FAILED
- RETURNED

DELIVERED and RETURNED are terminal.

Tracking events may be stored as historical evidence, but canonical state changes must use the explicit transition table. Tracking events can no longer bypass that table through a numeric status-order fallback.

Duplicate events remain idempotent. Older events remain history-only and cannot regress a newer canonical state.

## 5. Shipment creation idempotency

The existing Shipment.creationIdempotencyKey unique constraint remains authoritative.

Concurrent handoff attempts are protected by application-level idempotency lookup, in-transaction re-check, database uniqueness, Serializable isolation, and bounded P2034 serialization retries.

The current handoff creates only the internal canonical Shipment from trusted Fulfillment state. It does not submit a Shipping shipment to an external provider.

Therefore no provider-side duplicate-creation guarantee is claimed.

If a future qualified adapter performs external submission, ambiguous outcomes must not be blindly retried unless that provider's documented contract guarantees safe idempotency.

## 6. Ambiguous provider outcomes

The current provider qualification does not establish a production Shipping submission contract.

The system therefore distinguishes the architectural categories: confirmed provider failure, confirmed provider success, and ambiguous outcome.

For an ambiguous future provider submission, the safe rule is to preserve the canonical shipment and route it to reconciliation/recovery rather than invent a failure or retry blindly.

lib/shipping/retry.ts explicitly classifies ambiguous outcomes as non-retryable for automatic processing.

## 7. Reconciliation state and operational recovery

Shipment now persists reconciliationRequired, reconciliationReason, and reconciliationRequestedAt.

An operational recovery action is persisted in ShipmentRecoveryAction with Shipment ID, operator identity, reason, idempotency key, and creation timestamp.

requestShipmentReconciliation() is an internal application boundary. It requires an injected authorization function, explicit Shipment selection, reason, and a valid idempotency key. Unauthorized requests are rejected. Repeated requests with the same key do not create a second recovery action.

The operation does not permit arbitrary Shipment status mutation.

reconcileShipment() marks a Shipment as requiring reconciliation when a provider reference is missing. Unsupported provider capabilities are reported without fabricating provider data.

## 8. Tracking-event hardening

Tracking input now validates provider identity, provider event identifier length, provider status presence/length, location and description length, timestamp validity, and normalized Shipment status.

The provider adapter remains the only boundary for raw provider payload normalization.

Tracking events retain provider event identifiers where available. When no identifier exists, the existing deterministic SHA-256 fingerprint remains the deduplication fallback.

Database uniqueness prevents concurrent duplicate insertion.

## 9. Retry policy

lib/shipping/retry.ts defines provider-neutral retry classes:
- VALIDATION
- AUTHENTICATION
- AUTHORIZATION
- RATE_LIMIT
- PROVIDER_4XX
- PROVIDER_5XX
- NETWORK
- TIMEOUT
- AMBIGUOUS

Deterministic validation/auth/business failures are not retryable.

Rate-limit, provider-5xx, network, and timeout classes may be retried for tracking/reconciliation operations, subject to a bounded backoff.

Shipment creation is never automatically retried for ambiguous or transient external outcomes by this layer because provider-safe duplicate semantics are not verified.

Backoff is bounded and supports jitter; exact provider limits are not fabricated.

## 10. Rate limits and scheduling

No provider-specific rate limit or polling interval is invented.

Qikink Shipping/Tracking machine-to-machine polling remains unsupported.

If a future qualified provider exposes tracking lookup, its documented limits and retry-after semantics must be implemented at that adapter boundary before polling is enabled.

No uncontrolled polling loop exists.

## 11. Concurrency model

The hardening continues to use database-backed concurrency control: unique constraints for idempotency/deduplication; Serializable transactions where cross-record decisions require them; compare-and-set Shipment state transitions; bounded serialization retries; and no process-local locks.

The recovery action is written together with the reconciliation-required Shipment update in one transaction.

## 12. Failure-recovery model

| Failure | Current safe behavior |
|---|---|
| Crash before provider submission | Internal Shipment handoff remains idempotent; no external submission occurs here |
| Crash during future provider submission | Must be treated as ambiguous until provider reconciliation proves outcome |
| Crash after provider success before local commit | Must be reconciled; no blind duplicate retry |
| Provider timeout | Ambiguous unless provider contract proves failure |
| Provider outage | No external Shipping operation is attempted by the current Qikink adapter |
| Rate limit | Classified as retryable only for safe lookup/reconciliation operations |
| Duplicate event | Database deduplication returns the existing event |
| Out-of-order event | Event history is retained; canonical state is not regressed |
| Missing tracking event | Reconciliation boundary remains available |
| Provider inconsistency | Requires reconciliation; no fabricated canonical state |
| Local transaction failure | Transaction rolls back atomically |
| Worker/job failure | No persistent worker is introduced; future jobs must use the same idempotent application boundaries |

## 13. Security

The hardening preserves server-side provider adapters, no provider credentials in customer DTOs, no provider credentials in NEXT_PUBLIC_*, no raw provider payload exposure, ownership-safe customer Shipment lookup, provider payload validation, authorized operational recovery, no arbitrary status mutation through recovery, and no provider endpoint selection from clients.

No provider credential or undocumented endpoint was added.

## 14. Observability

Shipping observations now support correlation identifiers and retry classification metadata.

Relevant operations include handoff, shipment creation failure, tracking-event processing, duplicate event handling, history-only event handling, reconciliation, and recovery-required outcomes.

Logs continue to exclude credentials, authorization headers, payment data, and unnecessary customer PII.

## 15. Database changes

Migration: 20261002195000_shipping_reconciliation_recovery

Changes: add reconciliation-required state fields to Shipment; add reconciliation-state index; add ShipmentRecoveryAction; add unique recovery idempotency key; add Shipment recovery-action index; add restrictive Shipment foreign key.

The migration is additive and non-destructive.

## 16. Tests

Added/updated coverage includes canonical tracking transition bypass regression, authorized operational recovery, unauthorized recovery rejection, recovery idempotency, persisted reconciliation state, bounded retry classification, ambiguous shipment-creation non-retry behavior, and bounded jittered backoff.

Existing Shipping tests continue to cover handoff idempotency, concurrent creation, duplicate events, out-of-order events, terminal protection, ownership, persistence, and provider capability boundaries.

## 17. Provider limitations

Qikink remains Fulfillment-only for this architecture.

Its verified Shipping capabilities remain createShipment=false, trackingLookup=false, and webhooks=false.

No Qikink tracking, AWB, carrier, webhook, polling, or provider-idempotency capability is invented.

Phase 13.5 also left unresolved provider qualification gaps for production Shipping integration. Phase 13.6 does not bypass that gate.

## 18. Known unresolved production risks

1. No qualified machine-to-machine Shipping provider is currently enabled.
2. External provider ambiguous-create recovery cannot be exercised end-to-end until a provider with a verified production contract is selected.
3. No webhook endpoint is implemented because no selected provider has a verified webhook contract in the current repository.
4. No tracking polling job is implemented because the current Qikink capability boundary does not support it.
5. Future provider-specific rate limits, idempotency semantics, event IDs, and reconciliation APIs must be verified before activation.

## 19. CI evidence

CI evidence is recorded only after the Phase 13.6 pull request workflow completes. This section must not be treated as green until Test, Typecheck, Lint, and Build have all succeeded.

## 20. Final architecture review

- 4HRS+ remains the canonical commerce-data owner.
- Shipping remains provider-neutral.
- Provider-specific logic remains behind adapters.
- Qikink is not promoted into canonical Shipping.
- No undocumented provider capability is introduced.
- Duplicate internal Shipment creation is prevented.
- Ambiguous external outcomes have a recoverable boundary.
- Tracking events are idempotent and chronologically safe.
- Retry behavior is bounded.
- Recovery is authorized and audited.
- Existing Order/Fulfillment/Payment/Checkout/Catalog boundaries remain unchanged.
- No customer tracking UI, returns, exchanges, refunds, or additional provider was introduced.

## 21. Phase 13.6 status

Implementation is complete on the Phase 13.6 branch only when the repository's CI-equivalent Test, Typecheck, Lint, and Build checks succeed.

The provider qualification gate remains unchanged.