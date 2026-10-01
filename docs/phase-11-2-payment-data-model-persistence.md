# Phase 11.2 — Payment Data Model & Persistence

## Scope

Phase 11.2 implements the durable, provider-neutral persistence foundation defined by Phase 11.1. It does not integrate a payment provider, install an SDK, create live payment intents, process credentials, create Orders, or redesign Checkout.

## Implemented entities

### Payment

Payment is the canonical internal payment aggregate.

It persists:
- internal UUID;
- customer ownership;
- opaque Checkout reference;
- internal payment reference;
- generic provider identity/reference;
- canonical provider-neutral lifecycle status;
- authoritative Decimal amount;
- three-character currency;
- terminal timestamp;
- expiration timestamp;
- timestamps.

The Payment model intentionally has no provider-specific fields such as Razorpay, PayU, or Stripe identifiers and no payment credential fields.

### PaymentAttempt

PaymentAttempt represents an individual provider/application attempt belonging to one Payment.

It supports:
- parent Payment;
- monotonically assigned attempt number;
- generic provider identity/reference;
- provider-neutral status;
- amount/currency snapshot;
- safe failure classification;
- optional non-sensitive metadata;
- timestamps.

(paymentId, attemptNumber) is unique, so retries remain auditable without creating a second logical Payment.

### PaymentEvent

PaymentEvent is the durable webhook/event deduplication record.

It stores only the minimum non-sensitive event metadata:
- provider identity;
- external provider event ID;
- provider event type;
- normalized event type;
- optional Payment association;
- received/occurred/processed timestamps;
- processing state;
- bounded processing error;
- optional safe metadata.

There is no raw webhook payload column.

(providerId, providerEventId) is unique, preventing the same external event from being recorded as a second event.

### PaymentIdempotency

PaymentIdempotency is a dedicated durable idempotency record.

It stores:
- authenticated customer;
- opaque Checkout reference;
- operation;
- idempotency key;
- request fingerprint;
- Payment association;
- optional safe response;
- timestamps/expiry.

(customerId, operation, key) is unique at the database level.

This is deliberately separate from Payment so idempotency semantics do not become a second Payment identity field.

## Checkout relationship

The current Checkout architecture is transient: it resolves the authenticated customer's Cart and address and returns a server-generated revision, but it does not persist a Checkout entity/ID.

Therefore Phase 11.2 does not invent a Checkout table or redesign Checkout.

The smallest compatible persistence foundation is the opaque checkoutReference on Payment, scoped by authenticated customer. Phase 11.3 must create/resolve this reference from the validated Checkout boundary before Payment creation.

Important consequence: the database cannot currently declare a foreign key from Payment to Checkout because no persistent Checkout table exists. Customer ownership is enforced with a database foreign key and repository queries. The Checkout reference is intentionally not treated as an authorization mechanism.

## Amount and currency authority

The persistence layer stores the amount and currency supplied by the future Payment Application Service from validated Checkout state.

The intended flow remains:

Cart
  ↓
Checkout validation
  ↓
Authoritative amount/currency
  ↓
Payment persistence
  ↓
Provider adapter

The repository does not calculate prices and does not accept provider responses as the source of the payable amount.

Money uses the project's existing PostgreSQL/Prisma Decimal(12,2) convention. No floating-point monetary fields were introduced.

## Lifecycle

The persisted lifecycle is exactly the provider-neutral Phase 11.1 state set:
- CREATED
- REQUIRES_ACTION
- PROCESSING
- SUCCEEDED
- FAILED
- CANCELLED
- EXPIRED
- PARTIALLY_REFUNDED
- REFUNDED

Terminal states are CANCELLED, EXPIRED, and REFUNDED.

The repository provides optimistic status updates using WHERE id AND expectedStatus. This prevents a stale writer from overwriting a concurrent state change.

Transition policy itself remains in the Payment domain/service layer; the repository does not become the business-rule authority.

## Ownership and referential integrity

Payment.customerId references Customer.id with ON DELETE RESTRICT.

PaymentAttempt.paymentId, PaymentEvent.paymentId, and PaymentIdempotency.paymentId also use restrictive deletion behavior.

This is intentional: financial/payment history must not disappear through ordinary parent deletion.

Repository reads require customer identity for Payment-by-ID and Payment-by-Checkout lookups. Provider references are lookup aids, not authorization authorities.

Cross-customer access is therefore blocked at the repository query boundary and protected by the database relationship for Payment → Customer.

## Constraints and indexes

### Payment
- unique internal payment reference;
- unique customer + Checkout reference;
- customer + creation-time index;
- Checkout-reference index;
- provider + provider-reference index;
- status + creation-time index.

### PaymentAttempt
- unique Payment + attempt number;
- Payment + creation-time index;
- provider + provider-attempt-reference index;
- status + creation-time index.

### PaymentEvent
- unique provider + external event ID;
- Payment + received-time index;
- provider + received-time index;
- processing-status + received-time index.

### PaymentIdempotency
- unique customer + operation + key;
- Payment index;
- customer + Checkout-reference index;
- expiry index.

No speculative indexes were added.

## Repository foundation

lib/payments/repository.ts provides persistence-only operations:
- create Payment;
- atomically create Payment + initial Attempt;
- get Payment by customer-scoped ID;
- list customer Payments;
- get Payment by customer-scoped Checkout reference;
- get Payment by provider reference;
- optimistic Payment status update;
- create PaymentAttempt;
- list PaymentAttempts;
- lookup PaymentAttempt by provider reference;
- record/deduplicate PaymentEvent;
- find PaymentEvent by provider event ID;
- mark PaymentEvent processed;
- mark PaymentEvent failed;
- lookup durable idempotency record;
- create durable idempotency record.

Repositories contain no provider SDK calls, Storefront logic, HTTP concerns, pricing logic, or Payment business-state transition policy.

All transaction-capable repository operations use the existing Prisma transaction conventions and Serializable isolation where the repository itself owns a multi-write transaction.

## Transaction boundaries

### Payment + initial attempt

createPaymentWithInitialAttempt executes both writes in one Serializable transaction. A failed attempt creation cannot leave a Payment without its initial persistence record.

### Idempotency

The database unique constraint is the first-line concurrency guard. The future Payment Application Service must resolve an existing key, compare its request fingerprint, and replay the existing result or return an idempotency conflict.

### Webhook deduplication

recordPaymentEvent first checks the provider/event key and then relies on the unique constraint to protect the race between concurrent deliveries. A uniqueness collision is re-read and returned as an existing event.

### Status transitions

updatePaymentStatus uses optimistic concurrency: the expected previous status is part of the update predicate. A stale transition fails instead of silently overwriting a concurrent update.

## Payment event processing

The repository distinguishes event receipt from event processing:
- RECEIVED — persisted but not successfully processed;
- PROCESSED — normalized event applied successfully;
- FAILED — processing failed and can be retried by the future application layer.

The repository does not perform webhook signature verification or state transitions. Those remain Payment Application Service/provider-adapter responsibilities.

## Idempotency strategy

Durability is provided by PostgreSQL, not process memory.

The future application service must:
1. derive the authenticated customer from the session;
2. derive/validate the Checkout reference from server state;
3. compute a deterministic request fingerprint;
4. look up (customerId, operation, key);
5. replay the stored response when the fingerprint matches;
6. reject incompatible reuse of the key;
7. create the Payment and idempotency record within an appropriate transaction boundary;
8. recover provider timeouts through reconciliation rather than blindly creating another logical Payment.

The repository does not decide whether two fingerprints are semantically compatible; that belongs to the application/domain layer.

## Provider-neutral design

No canonical Payment field is provider-specific.

Generic fields are used:
- providerId;
- providerReference;
- providerAttemptReference;
- providerEventId.

Adding a future provider therefore does not require changing the Payment aggregate.

No Razorpay, PayU, Stripe, or other SDK dependency was added.

## Sensitive-data restrictions

The persistence model contains no:
- card number;
- CVV/CVC;
- PIN;
- bank password;
- raw UPI credential;
- authentication credential;
- provider secret.

Provider secrets remain outside the database and must remain environment/secret-manager controlled.

PaymentEvent.metadata and PaymentAttempt.metadata are intended only for safe, non-sensitive operational metadata. Raw provider payload persistence is intentionally excluded.

## Observability

Safe operational fields include:
- internal Payment ID/reference;
- Checkout reference where existing logging policy permits;
- customer ID where existing policy permits;
- attempt ID;
- event ID;
- provider identity;
- normalized status;
- failure category.

Secrets, authorization headers, credentials, raw payment payloads, and unnecessary PII must not be logged.

## Migration

Created:
prisma/migrations/20261001040000_payment_persistence_foundation/migration.sql

The migration:
1. creates provider-neutral Payment enums;
2. creates Payment, PaymentAttempt, PaymentEvent, and PaymentIdempotency tables;
3. creates required unique constraints and indexes;
4. adds restrictive foreign keys to preserve payment history.

No prior migration was modified or rewritten.

## Tests

Added:
tests/payment-persistence.test.ts

Coverage includes:
- Payment ownership;
- Checkout-reference ownership scoping;
- Decimal amount/currency persistence;
- multiple PaymentAttempts;
- duplicate attempt rejection;
- provider event deduplication;
- event processing state;
- idempotency uniqueness;
- incompatible duplicate idempotency rejection;
- optimistic status concurrency protection;
- invalid customer foreign-key rejection;
- duplicate internal Payment reference rejection;
- provider-neutral schema;
- sensitive-field exclusion;
- migration structure and restrictive referential integrity.

No fake provider integration was introduced.

## Known limitation

The existing Checkout architecture has no persistent Checkout entity/ID. Phase 11.2 therefore cannot create a database foreign key to Checkout without redesigning Checkout, which this phase explicitly forbids.

The Payment checkoutReference is the smallest compatible persistence boundary. Phase 11.3 must establish its server-side lifecycle from validated Checkout state before creating a real provider payment flow.

## Phase 11.3 readiness

The persistence foundation is structurally ready for Phase 11.3 once validation passes:
- Payment aggregate exists;
- PaymentAttempt retry model exists;
- PaymentEvent deduplication exists;
- durable idempotency exists;
- ownership and restrictive referential integrity exist;
- Decimal monetary storage exists;
- provider-specific fields are excluded from the core model;
- repository/service boundaries are separated;
- no payment provider is integrated.

Phase 11.3 must consume this repository through the Payment Application Service and must not bypass it from UI/API code.
