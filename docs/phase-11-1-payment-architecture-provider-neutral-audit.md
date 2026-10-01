# Phase 11.1 — Payment Architecture, Payment Domain & Provider-Neutral Gateway Audit

## 1. Scope and audit result

This phase prepares the payment boundary after the completed Checkout work. It does **not** connect a real payment provider, create external payment intents, collect payment credentials, create Orders, or alter the existing Checkout UI/service boundary.

Repository baseline audited: `phase-10-6-checkout-final-integration` at commit `473d4000764201dc963e9f8b7f070f02a60a408b`.

The repository did not contain a persisted Payment model or payment migration. It did contain a minimal `lib/payments/index.ts` placeholder with provider-specific identifiers and an `unknown`-typed adapter contract. Phase 11.1 replaces that placeholder with provider-neutral contracts and keeps persistence as a documented foundation for the next payment implementation phase.

## 2. Target architecture

The production boundary is:

```
Authenticated Customer
        |
        v
     Checkout
        |
        | validated Checkout result only
        v
Payment Application Service
        |
        v
Payment Domain
        |
        v
Provider Adapter
        |
        v
External Payment Provider
```

Storefront code does not select or invoke a provider SDK. Provider-specific request formats, status values, signature verification, and webhook parsing belong inside a provider adapter.

The current repository remains at the pre-provider boundary. No adapter implementation calls an external service.

## 3. Checkout → Payment contract

The Checkout service remains the authority for the payable amount and currency.

The future Payment Application Service consumes:

- authenticated customer identity derived on the server;
- a validated Checkout/payment reference resolved by the server;
- authoritative amount;
- authoritative currency;
- a server-controlled provider selection;
- an idempotency key for the payment operation.

The browser must not supply or replace:

- customer ID;
- Checkout identity;
- Cart identity;
- amount;
- currency;
- provider identity;
- provider transaction/reference;
- payment status.

The existing Checkout API continues to accept only its existing address intent and opaque revision contract. Payment remains explicitly unavailable in Checkout through `PAYMENT_NOT_IMPLEMENTED`; this phase does not redesign Checkout.

## 4. Payment domain

Implemented domain contracts are in `lib/payments/domain.ts`.

The canonical concepts are:

- Payment Intent/reference;
- Payment amount and currency;
- Payment Attempt;
- provider association;
- provider transaction/reference;
- normalized Payment Result;
- lifecycle status;
- customer ownership;
- Checkout association;
- idempotency information;
- timestamps.

Payment and Order are intentionally separate aggregates. Payment produces a verified payment result; the future Order phase consumes that result.

No Order model or Order creation was introduced by this phase.

## 5. Payment lifecycle

The provider-neutral lifecycle is:

- `CREATED`
- `REQUIRES_ACTION`
- `PROCESSING`
- `SUCCEEDED`
- `FAILED`
- `CANCELLED`
- `EXPIRED`
- `PARTIALLY_REFUNDED`
- `REFUNDED`

### Valid transitions

- CREATED → REQUIRES_ACTION, PROCESSING, FAILED, CANCELLED, EXPIRED
- REQUIRES_ACTION → PROCESSING, SUCCEEDED, FAILED, CANCELLED, EXPIRED
- PROCESSING → REQUIRES_ACTION, SUCCEEDED, FAILED, CANCELLED, EXPIRED
- FAILED → REQUIRES_ACTION, PROCESSING, CANCELLED, EXPIRED
- SUCCEEDED → PARTIALLY_REFUNDED, REFUNDED
- PARTIALLY_REFUNDED → REFUNDED

`CANCELLED`, `EXPIRED`, and `REFUNDED` are terminal aggregate states.

A failed payment can be retried through a new Payment Attempt; the original attempt remains independently auditable. A retry must not create an unrelated duplicate logical Payment merely because the customer repeated the operation.

Invalid transitions are rejected by `assertPaymentTransition`.

Provider-specific statuses never become domain statuses.

## 6. Payment Intent boundary

The future Payment Intent contains:

- stable internal payment ID/reference;
- authenticated customer ID;
- validated Checkout reference;
- authoritative amount/currency;
- server-selected provider;
- normalized lifecycle status;
- idempotency information where required;
- created/updated timestamps.

Before any provider-side creation request, the Payment Application Service must resolve and verify the authoritative Checkout/payment context.

The provider adapter receives only the internal provider-neutral request required for the provider operation.

## 7. Provider adapter contract

The provider-neutral adapter contract is in `lib/payments/provider.ts`.

It defines:

- create payment intent;
- retrieve payment status;
- verify payment;
- normalize webhook events;
- optional cancellation;
- optional refunds;
- provider capability metadata.

The adapter translates:

```
Internal Payment Contract
        ↕
Provider Adapter
        ↕
Provider Contract
```

The core Payment domain never depends on a provider SDK or provider-specific status.

### Capability boundaries

Adapters declare capabilities for:

- supported currencies;
- payment methods;
- refunds;
- partial refunds;
- webhooks;
- asynchronous confirmation;
- cancellation;
- authorization/capture.

The application layer selects a provider through a server-controlled policy. Customer input cannot provide an arbitrary provider ID that bypasses server policy.

No provider is configured in this phase.

## 8. Persistence audit

The current Prisma schema contains Customer, CustomerAddress, Cart, CartItem, Product, ProductVariant, Inventory, and related catalog/authentication persistence, but no Payment, PaymentAttempt, PaymentEvent/WebhookEvent, or ProviderReference model.

No payment schema migration was created in Phase 11.1 because this phase is an architecture/audit foundation and the repository has not yet established the payment application/persistence implementation that would consume such records.

### Required future persistence foundation

The next implementation phase should establish only the records justified by the payment flow:

### Payment

Required fields conceptually:

- internal ID;
- customer ID;
- validated Checkout reference;
- amount;
- currency;
- normalized status;
- selected provider ID;
- created/updated timestamps.

Required constraints/indexes:

- primary internal identifier;
- customer lookup;
- Checkout/payment reference lookup;
- status/time lookup;
- provider lookup where operationally useful.

### PaymentAttempt

Required fields conceptually:

- internal attempt ID;
- Payment ID;
- monotonically assigned attempt number;
- attempt status;
- provider ID;
- provider reference;
- timestamps.

The logical Payment must not be duplicated for each retry.

### PaymentEvent / WebhookEvent

Required fields conceptually:

- provider ID;
- external event ID;
- normalized event type;
- safe payment reference;
- received timestamp;
- occurred timestamp when available;
- processing status;
- processed timestamp;
- failure/retry state.

A uniqueness constraint on provider + external event ID is required for duplicate protection.

### ProviderReference

A separate table is only justified if the provider-reference lifecycle or cardinality requires it. It must not duplicate PaymentAttempt fields unnecessarily. If provider references remain one-per-attempt, they can stay on PaymentAttempt.

### Retention

Payment audit records should be retained according to the application's accounting, legal, dispute, and reconciliation requirements. Raw webhook payloads should not be retained by default. If future reconciliation requires raw payloads, storage must be explicitly justified, redacted, access-controlled, and governed by a documented retention period.

## 9. Idempotency

The idempotency contract is in `lib/payments/idempotency.ts`.

Required production behavior:

1. A request supplies a caller-generated idempotency key for the payment operation.
2. The server derives the idempotency scope from authenticated customer identity and operation.
3. The persistence layer enforces uniqueness for scope + key.
4. A matching request fingerprint replays the original stored result.
5. The same key with a different request fingerprint produces an idempotency conflict.
6. Idempotency records persist beyond the request process; in-memory-only protection is insufficient.
7. Provider references must be correlated with the internal PaymentAttempt.
8. A timeout after provider creation must be recoverable by retrieving/reconciling the provider state rather than blindly creating another payment.

The idempotency record must never be used to authorize another customer or another Checkout.

## 10. Webhook architecture

The future webhook path is:

```
External Provider
      |
      v
Webhook Endpoint
      |
      v
Provider Adapter Verification
      |
      v
Normalized Payment Event
      |
      v
Payment Domain
      |
      v
Validated State Transition
```

Webhook requirements:

- provider-specific signature verification stays inside the adapter;
- unsigned/unverified events are rejected;
- external event ID is persisted before successful processing;
- duplicate event delivery is idempotent;
- replay protection uses provider-supported timestamps/nonces/signatures where available;
- out-of-order events are rejected or safely ignored when they do not represent a valid state transition;
- provider event types are normalized before entering the Payment domain;
- the Storefront never handles webhook payloads.

The event store contract is in `lib/payments/webhooks.ts`.

No webhook endpoint was created because there is no provider integration in this phase.

## 11. Provider status normalization

Provider statuses are not domain states.

For example, a provider adapter may translate its own success/capture/authorization/failed values into:

- SUCCEEDED;
- PROCESSING;
- REQUIRES_ACTION;
- FAILED;
- CANCELLED;
- EXPIRED.

The core domain receives only `PaymentStatus`.

This prevents provider-specific vocabulary from leaking into Checkout, Storefront, persistence contracts, or future Order logic.

## 12. Security model

Threats addressed by the architecture:

### Amount/currency tampering

The browser cannot set the payable amount or currency. Payment resolves authoritative Checkout state server-side.

### Customer/Checkout tampering

Customer identity is derived from the authenticated session. Checkout ownership is resolved server-side. Payment creation cannot attach an arbitrary customer or Checkout.

### Provider-selection tampering

Provider selection is server-controlled through application policy. A browser cannot choose an arbitrary provider implementation.

### Duplicate payment creation

Persistent idempotency plus PaymentAttempt correlation prevents unsafe duplicate creation during double-clicks, retries, timeouts, and lost responses.

### Webhook spoofing/replay

Provider adapters verify signatures where supported. Events are deduplicated by provider + external event ID and processed through the domain transition rules.

### Secrets

Future provider credentials must remain server-side environment/secret configuration. They must never be committed, logged, stored in client state, or unnecessarily returned to the browser.

### Sensitive payment data

The application must never store raw card numbers, CVV, UPI PINs, bank passwords, or raw banking credentials. Future provider integrations must use provider-hosted/tokenized mechanisms.

## 13. Customer ownership

Every Payment is owned by an authenticated customer.

Future private Payment APIs must:

- derive customer identity from the session;
- query Payment by customer ownership;
- reject cross-customer reads;
- reject cross-customer mutation;
- reject attaching another customer's Checkout;
- never accept customer ID as an authorization authority from the browser.

## 14. Concurrency and retry behavior

The architecture explicitly covers:

- two payment requests for one Checkout;
- repeated browser requests;
- provider timeout after request submission;
- delayed provider response;
- webhook before browser response;
- browser response before webhook;
- duplicate webhook;
- out-of-order webhook.

The authoritative state is the persisted Payment aggregate plus verified provider state. Browser response ordering is never authoritative.

Payment attempts provide an audit boundary for retries. A retry after a failed attempt must be deterministic and correlated to the same logical Payment when the future application policy permits it.

## 15. Reconciliation

An ambiguous state such as:

```
Provider: SUCCEEDED
Local Payment: PROCESSING
```

must be resolved from verified provider state, never from a browser callback.

The future reconciliation responsibility belongs to the Payment service/application layer. A background worker is not introduced in Phase 11.1 because existing repository infrastructure does not require one yet.

## 16. Refund boundary

Refunds are explicitly outside initial Checkout payment creation.

Future boundary:

```
Order / Refund Request
        |
        v
Payment Service
        |
        v
Provider Adapter
        |
        v
Provider Refund
```

The initial Checkout flow does not create refunds.

Partial refunds are supported only when both the application policy and selected provider capability permit them.

## 17. Cache and privacy

Future Payment endpoints must be:

- authenticated;
- customer-authorized;
- non-indexable;
- non-public;
- non-shared-cacheable;
- protected from cross-customer leakage.

Provider references should not be exposed in public storefront responses unless a future UI contract has an explicit need.

## 18. Observability

Safe payment telemetry may include:

- internal Payment ID;
- safe provider ID;
- normalized status;
- attempt ID;
- correlation ID;
- webhook event ID;
- operation latency;
- normalized failure category.

Never log:

- provider secrets;
- card data;
- CVV;
- payment credentials;
- raw authentication tokens;
- unnecessary PII;
- full raw provider payloads unless a future reconciliation requirement explicitly justifies controlled storage.

## 19. Error model

Provider-neutral errors are defined in `lib/payments/errors.ts`:

- INVALID_CHECKOUT
- AUTHORIZATION_FAILED
- PROVIDER_UNAVAILABLE
- PROVIDER_REJECTED
- PAYMENT_REQUIRES_ACTION
- PAYMENT_FAILED
- WEBHOOK_VERIFICATION_FAILED
- DUPLICATE_REQUEST
- IDEMPOTENCY_CONFLICT
- PAYMENT_INTERNAL_ERROR

Provider-specific error codes must be mapped to these categories before crossing the Payment domain boundary.

Customer responses must not expose provider internals, credentials, signatures, raw payloads, or infrastructure details.

## 20. Test strategy

Phase 11.1 adds `tests/payment-architecture.test.ts`.

Coverage includes:

- valid lifecycle transitions;
- invalid lifecycle transitions;
- terminal state handling;
- retry behavior;
- idempotency scope;
- idempotency fingerprint conflict;
- webhook verification/replay safety;
- provider adapter contract isolation;
- provider-neutral Payment errors;
- Checkout amount-authority boundary;
- Payment vs Order separation;
- absence of provider SDK coupling in Payment code.

Future provider integration tests must additionally cover:

- provider status normalization;
- signature verification;
- invalid signature;
- duplicate webhook;
- replayed webhook;
- unknown event;
- out-of-order event;
- provider timeout/retry;
- provider rejection;
- capability differences;
- provider reference reconciliation.

## 21. Repository/dependency audit

### Dependencies

No payment SDK was added.

The current `package.json` contains no Razorpay, PayU, Stripe, or other payment gateway SDK dependency.

### Environment

The current `.env.example` contains no payment credentials. Phase 11.1 does not add provider secrets.

Future provider secrets must be introduced only when a provider implementation exists and must follow the repository's existing environment-secret conventions.

### Database

No payment migration was added.

No Order, shipping, fulfillment, or inventory-reservation functionality was introduced.

### CI

The existing CI remains the validation path:

- Test;
- Lint;
- Typecheck;
- Build.

No CI workflow redesign is required for this architecture phase.

## 22. Files changed by Phase 11.1

- `lib/payments/index.ts` — provider-neutral public exports replacing the unsafe placeholder contract.
- `lib/payments/domain.ts` — Payment domain types and lifecycle state machine.
- `lib/payments/application.ts` — Payment Application Service boundary and validated Checkout input contract.
- `lib/payments/provider.ts` — provider-neutral adapter and capability contracts.
- `lib/payments/idempotency.ts` — persistent idempotency contract and conflict semantics.
- `lib/payments/webhooks.ts` — normalized webhook/event persistence and verification boundary.
- `lib/payments/errors.ts` — provider-neutral Payment error taxonomy.
- `tests/payment-architecture.test.ts` — architecture/security boundary tests.
- `docs/phase-11-1-payment-architecture-provider-neutral-audit.md` — this audit.

No existing Checkout, Cart, authentication, catalog, shipping, fulfillment, or inventory code is redesigned.

## 23. Deferred to later phases

Explicitly deferred:

- Razorpay integration;
- PayU integration;
- Stripe integration;
- any external payment SDK;
- live payment intent/session creation;
- payment credential collection;
- payment transaction persistence implementation;
- webhook route implementation;
- provider credentials;
- Orders;
- shipping;
- fulfillment;
- inventory reservation;
- refunds implementation;
- production reconciliation worker.

## 24. Phase 11.1 readiness assessment

Architecture readiness criteria:

| Gate | Result |
|---|---|
| Clear Payment domain boundary | PASS |
| Checkout remains amount/currency authority | PASS |
| Customer ownership defined | PASS |
| Provider-specific logic isolated behind adapters | PASS |
| Lifecycle defined and testable | PASS |
| Idempotency architecture defined | PASS |
| Webhook architecture defined | PASS |
| Webhook verification requirements defined | PASS |
| Normalized statuses defined | PASS |
| Payment security model defined | PASS |
| Sensitive data handling defined | PASS |
| Concurrency/retry behavior defined | PASS |
| Reconciliation boundary defined | PASS |
| Refund boundary defined | PASS |
| Persistence requirements documented | PASS |
| Test strategy implemented/documented | PASS |
| Real provider integrated | NO — intentionally deferred |
| Payment credentials collected/stored | NO |
| Orders created | NO |
| Shipping/fulfillment/reservation implemented | NO |
| Existing Checkout remains intact | PASS |
| Documentation complete | PASS |
| Git diff limited to Phase 11.1 | PASS |

This phase intentionally stops at the provider-neutral architecture boundary. Phase 11.2 must consume the validated contracts without moving provider logic into Checkout or Storefront.
