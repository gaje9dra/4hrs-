# Phase 11.3 — Payment Domain Service, State Machine & Checkout Integration

## Scope
Phase 11.3 establishes the provider-neutral Payment Application Service on top of the Phase 11.2 persistence foundation. No payment provider SDK, external payment call, live payment intent, credential collection, Order, Shipping, Fulfillment, Inventory Reservation, or Refund workflow is introduced.

## Architecture
The enforced application boundary is:
Customer → Checkout → Payment Application Service → Payment Domain → Payment Repository → Database
Future provider execution remains:
Payment Application Service → Provider Adapter Interface → provider implementation
Provider selection is server-controlled. The browser never selects an adapter or receives provider SDK objects.

## Checkout → Payment handoff
The existing Checkout service remains the authority for Cart integrity, product/variant lifecycle, availability, quantity, currency, totals, address ownership, and revision freshness.
Checkout remains transient; there is no persisted Checkout entity. The smallest compatible bridge is a deterministic 64-character server-derived checkoutReference generated from the authenticated customer, Cart, Checkout revision, selected address, and authoritative total/currency.
The Checkout response exposes this reference only as payment readiness metadata. Payment creation accepts that reference plus the Checkout revision/address context and re-runs Checkout validation before persistence.
The Payment service does not duplicate Cart pricing or availability rules.

## Payment creation
createPaymentFromCheckout() performs:
1. Validate the authenticated customer context.
2. Require a server-validated Checkout context.
3. Validate the opaque Checkout reference.
4. Validate amount/currency format and positivity.
5. Look up the durable idempotency record.
6. Detect an existing Payment for the same customer + Checkout reference.
7. Create one Payment and its initial PaymentAttempt in a Serializable transaction.
8. Persist the idempotency record in the same transaction.
9. Return a safe Payment DTO.
The amount and currency are copied from validated Checkout. Client-submitted financial values are not accepted by the Payment API.
Repeated requests with the same idempotency key and fingerprint replay the existing Payment. Reuse of a key with a different fingerprint returns IDEMPOTENCY_CONFLICT.
The database unique constraints remain the final concurrency guard.

## Payment DTO
The public/application DTO contains only:
- internal Payment ID;
- internal Payment reference;
- Checkout reference;
- normalized status;
- authoritative amount;
- currency;
- expiration timestamp;
- safe next-action field (currently null);
- created/updated timestamps.
It excludes provider secrets, SDK objects, raw event payloads, private configuration, and payment credentials.

## State machine
Initial state: CREATED.
Allowed transitions:
- CREATED → REQUIRES_ACTION | PROCESSING | FAILED | CANCELLED | EXPIRED
- REQUIRES_ACTION → PROCESSING | SUCCEEDED | FAILED | CANCELLED | EXPIRED
- PROCESSING → REQUIRES_ACTION | SUCCEEDED | FAILED | CANCELLED | EXPIRED
- FAILED → REQUIRES_ACTION | PROCESSING | CANCELLED | EXPIRED
- SUCCEEDED → PARTIALLY_REFUNDED | REFUNDED
- PARTIALLY_REFUNDED → REFUNDED
No transition is allowed from CANCELLED, EXPIRED, or REFUNDED.
SUCCEEDED is also protected as a financially terminal state for this phase; it cannot be overwritten by a conflicting failure or processing event.
FAILED is retryable. Retry creates another auditable PaymentAttempt while retaining the same logical Payment.
All state changes pass through transitionPaymentState() or the normalized event processor. Repository conditional updates use the expected previous status to reject stale writers.

## Payment attempts
The initial PaymentAttempt is created with the Payment in one transaction.
Retries do not create another logical Payment. A new attempt number is assigned and the Payment transitions from FAILED to PROCESSING.
Attempts retain amount/currency snapshots, provider-neutral references, status, failure classification, metadata, and timestamps.

## Provider adapter contract
PaymentProviderAdapter defines the future provider boundary without implementing a provider.
Provider-neutral operations include:
- create payment intent/session;
- retrieve provider status;
- verify provider response;
- normalize provider webhook events;
- optional cancellation/refund operations where later architecture requires them.
Provider SDK types must not cross into the core domain. Adapter configuration and provider selection remain server-side.
If no resolver/configuration exists, the application service returns PROVIDER_CONFIGURATION_MISSING. If a resolver exists but no adapter is available, it returns PROVIDER_UNAVAILABLE. No external call is attempted in Phase 11.3.

## Normalized event / webhook contract
The normalized event contract contains:
- provider identity;
- provider event reference;
- provider payment reference when available;
- internal Payment reference when resolvable;
- normalized event type;
- normalized Payment status;
- event timestamp;
- safe metadata.
The flow is:
External Provider → future Webhook Endpoint → Adapter Verification → Normalized Event → Payment Application Service → State Machine → Repository.
There is no real provider webhook endpoint in this phase.

## Event processing and deduplication
Normalized events are persisted using the Phase 11.2 (providerId, providerEventId) uniqueness boundary.
Processing:
1. Validate event identity.
2. Persist/deduplicate the event.
3. Resolve the Payment by internal or provider reference.
4. Validate the state transition.
5. Apply the conditional Payment transition and mark the event processed within the same transaction.
6. On failure, mark the event failed with a bounded safe classification.
A previously processed event is returned as a deterministic duplicate result and does not execute another state transition.

## Concurrency
Protection uses:
- durable idempotency uniqueness;
- customer + Checkout uniqueness;
- Serializable transactions for multi-write repository operations;
- conditional status updates with expected previous state;
- PaymentAttempt uniqueness;
- PaymentEvent provider/event uniqueness.
No distributed lock or speculative cache is introduced.

## Security
The Payment API requires the authenticated customer session.
Controls include:
- customer-scoped Payment reads;
- Checkout ownership through the existing Checkout service;
- server-derived Checkout reference;
- server-authoritative amount/currency;
- strict request-field validation;
- required bounded Idempotency-Key;
- server-controlled provider resolution;
- no browser-controlled Payment status;
- no browser-controlled state transitions;
- no sensitive payment credentials;
- safe application errors instead of raw ORM/provider errors;
- no raw provider payload logging or persistence.
The Payment API never accepts amount, subtotal, total, currency, discount, tax, shipping, price, availability, or Payment status as authoritative request fields.

## Error taxonomy
Structured PaymentError codes cover authentication/authorization, invalid or stale Checkout, non-payable/expired Checkout, amount/currency validation, completed/terminal Payment, invalid state transition, idempotency conflict, Payment not found/ownership violation, provider configuration/unavailability, provider rejection, webhook verification boundary, invalid request, and internal persistence failure.
Customer-facing HTTP responses never expose ORM or provider internals.

## Transaction boundaries
Payment + initial Attempt + idempotency record are created through the repository transaction boundary.
Payment state changes use conditional updates.
Normalized event application and event completion use one transaction so a successful state transition is not reported independently of event processing completion.

## Observability
Safe operational identifiers available for structured logging include Payment reference, Checkout reference, Attempt ID, provider identity, event reference, normalized status transition, and error classification.
No credentials, secrets, raw provider payloads, or unnecessary payment data are part of the domain contracts.

## Performance
Checkout validation remains a single authoritative path. Payment does not independently re-query Cart line items, products, variants, pricing, or availability.
Mutable Payment state is not cached. PaymentAttempt and PaymentEvent records are loaded only for operations that require them.

## Tests
Phase 11.3 adds coverage for valid Payment creation from Checkout context, durable idempotency replay, idempotency conflict, malformed idempotency key, centralized valid/invalid transitions, terminal-state protection, retry behavior without duplicate Payment, provider-not-configured behavior, normalized event processing and duplicate handling, Checkout payment-reference generation/readiness, Checkout regression and client-authority rejection, provider-neutral architecture, and sensitive-field restrictions.
No fake external provider call is used.

## Known limitations
1. Checkout is still transient because Phase 10 did not create a persistent Checkout entity. The deterministic reference is therefore an application boundary, not a database foreign key.
2. No provider is configured or called. Provider execution intentionally stops at the adapter-resolution boundary.
3. Real webhook verification and endpoint delivery belong to provider integration.
4. Refund execution remains outside this phase even though the state model preserves future refund states.
5. No Order relationship is created.

## Phase 11.4 requirements
The next phase may add a real provider adapter only behind the existing interface. It must preserve server-authoritative Checkout amount/currency, durable idempotency, PaymentAttempt auditability, normalized status mapping, event deduplication, centralized transitions, and the existing security/error boundaries.
No provider SDK or credential is part of Phase 11.3.

Validation target: npm test, npm run lint, npm run typecheck, npm run build, and CI-equivalent PostgreSQL migration validation.