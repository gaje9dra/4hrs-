# Phase 13.3 — Shipping Domain Service, Fulfillment Handoff & Business Logic

## Scope
Phase 13.3 builds the application/domain layer on the Phase 13.2 Shipment and TrackingEvent persistence foundation.

Canonical boundary:

**Order → Fulfillment → Shipment → TrackingEvent → Customer**

Shipping does not replace Fulfillment. Qikink remains a fulfillment provider.

This phase does not add a customer tracking UI, returns, exchanges, a second provider, catalog synchronization, or unsupported provider behavior.

## Fulfillment → Shipment handoff
Shipment creation is server-authoritative and is exposed through `createShippingApplication().createShipmentFromFulfillment()`.

The service requires:
- an existing Fulfillment;
- the supplied Order must own that Fulfillment;
- Fulfillment status must be `SUBMITTED` or `COMPLETED`;
- a non-empty fulfillment provider;
- a trusted provider fulfillment reference;
- a historical Order shipping address.

A Shipment is not created merely because an Order exists.

The provider, provider reference, Order relationship, Fulfillment relationship, shipment status, and shipment reference are derived from trusted internal records. Client input cannot supply carrier, tracking number, shipment status, or provider reference.

The historical Order address is the destination authority. Mutable customer address records are not read for shipment creation.

## Shipment idempotency and concurrency
Every handoff receives a deterministic creation idempotency key. The default is:

`fulfillment-<fulfillmentId>-shipment`

The database has a unique `Shipment.creationIdempotencyKey` constraint.

The service serializes the handoff transaction and rechecks the Fulfillment and existing Shipment inside the transaction.

A repeated request for the same Fulfillment/provider reference returns the existing Shipment. A key reused for a different Order/Fulfillment is rejected.

The database constraint, transaction, and retry path protect against concurrent handoff attempts; no process-local lock is used.

## Shipment lifecycle
The implemented normalized lifecycle is deliberately limited to the Phase 13.1/13.2 design:
- `CREATED`
- `IN_TRANSIT`
- `OUT_FOR_DELIVERY`
- `DELIVERED`
- `DELIVERY_FAILED`
- `RETURNED`

`DELIVERED` and `RETURNED` are terminal.

Direct Shipment transitions cannot use `CREATED → DELIVERED`. Delivery is evidence-gated through a normalized tracking event.

The domain transition table rejects backward transitions from terminal states and rejects arbitrary repository mutations.

## Tracking-event processing
The normalized application flow is:

Provider event → provider adapter normalization → normalized event → deduplication → Shipment resolution → transition validation → TrackingEvent persistence → Shipment state update.

Generic Shipping code never interprets Qikink-specific payload fields.

`NormalizedTrackingEvent` separates provider event ID, provider status, normalized Shipment status, provider event timestamp, location, and description.

Provider event timestamp is used for chronological decisions. `receivedAt` and database `createdAt` remain separate persistence timestamps.

## Deduplication
Phase 13.2's database uniqueness is retained.

When a provider event ID exists, it is used in the deterministic deduplication key. Without a provider event ID, the repository derives a SHA-256 fingerprint from provider, normalized status, event timestamp, location, and description.

Concurrent duplicates return the existing historical event and do not transition the Shipment twice.

## Out-of-order events
Tracking history is preserved even when events arrive out of order.

A late event with an older event timestamp is stored as history but cannot regress canonical Shipment state.

Example:
1. `DELIVERED` occurs at 12:00.
2. `IN_TRANSIT` from 11:00 arrives later.
3. The `IN_TRANSIT` event is retained.
4. Shipment remains `DELIVERED`.

A terminal Shipment cannot be overwritten by a later processing attempt using an earlier/non-terminal state. Genuine provider corrections require an explicit reconciliation rule rather than blind mutation.

## Provider adapter boundary
`lib/shipping/contracts.ts` defines a provider-neutral `ShippingProviderAdapter`.

`lib/shipping/resolver.ts` resolves adapters by normalized provider identity.

The Shipping application service accepts normalized events for domain processing. Provider payloads may only enter through `processProviderTrackingEvent`, which requires a registered adapter to normalize and verify them.

There is no Qikink conditional logic in the generic Shipping domain service.

## Qikink capabilities actually supported
The existing Qikink integration currently provides fulfillment order creation and a provider fulfillment reference.

The existing Qikink adapter explicitly reports status lookup as unsupported. The repository does not contain a verified Qikink machine-to-machine tracking/status/webhook adapter contract.

Accordingly, Phase 13.3 does not invent Qikink carrier, AWB, tracking URL, tracking event, or webhook behavior.

Qikink-created Fulfillments can be handed off to a Shipment with the trusted Qikink fulfillment reference. The Shipment initially remains `CREATED` until an actual verified shipping/tracking event is supplied through a Shipping provider adapter.

`reconcileShipment()` reports provider support boundaries rather than fabricating provider status.

## Error model
`ShippingDomainError` provides normalized application/domain codes including:
- `FULFILLMENT_NOT_FOUND`
- `FULFILLMENT_NOT_ELIGIBLE_FOR_SHIPMENT`
- `SHIPMENT_ALREADY_EXISTS`
- `SHIPMENT_NOT_FOUND`
- `INVALID_SHIPMENT_TRANSITION`
- `TRACKING_EVENT_DUPLICATE`
- `TRACKING_EVENT_OUT_OF_ORDER`
- `UNSUPPORTED_PROVIDER_STATUS`
- `PROVIDER_SHIPMENT_NOT_FOUND`
- `PROVIDER_UNAVAILABLE`
- `PROVIDER_TIMEOUT`
- `UNAUTHORIZED_SHIPMENT_ACCESS`
- `SHIPMENT_RECONCILIATION_REQUIRED`
- `SHIPMENT_IDEMPOTENCY_CONFLICT`
- `SHIPMENT_CONCURRENCY_CONFLICT`
- `INVALID_TRACKING_EVENT`

Raw provider exceptions are not returned as customer-facing domain errors.

## Security and ownership
Customer shipment reads are resolved through `Shipment → Order → Customer`.

The application produces a safe `CustomerShipmentDto` rather than exposing Prisma entities or provider internals.

The service does not provide a customer Shipment creation endpoint.

Provider credentials, authorization headers, raw provider payloads, payment secrets, and mutable customer address data are excluded from customer DTOs and observability output.

## Observability
Structured Shipping observations cover Fulfillment → Shipment handoff, Shipment creation, tracking-event processing, duplicate events, state transitions, reconciliation-required conditions, and failures.

Identifiers are included where useful. Provider credentials, authorization headers, and raw sensitive payloads are not logged.

## Shipping price boundary
Phase 13.3 does not calculate or modify shipping charges. Payment and Order totals remain authoritative.

## Reconciliation boundary
The reusable reconciliation boundary can identify Shipment without a provider reference, unavailable provider tracking/status capability, future provider state mismatch, missing provider events, and ambiguous handoff/provider outcomes.

A polling engine is deliberately not added because the verified Qikink contract does not establish a tracking/status endpoint.

## Phase 13.4 prerequisites
Phase 13.4 can build on the provider-neutral Shipping application service, Shipment persistence, TrackingEvent persistence, lifecycle and chronological rules, customer ownership lookup, provider adapter/resolver boundary, and reconciliation boundary.

Before a production Qikink tracking implementation is enabled, an official verified provider contract is still required for tracking/status/webhook behavior, including event identifiers, timestamps, status semantics, carrier/AWB fields, authentication, replay behavior, and reconciliation semantics.