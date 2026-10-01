# Phase 12.1 — Order Management & Order Domain Architecture Audit

## 1. Executive summary

This audit prepares the repository for Phase 12.2 Order implementation without implementing the Order data model, Order CRUD, Order UI, fulfillment, shipping, or inventory reservation.

Repository baseline: `main` at commit `b29da79e127799a5ed1615aa1520aa4df0cf4c38`, which contains the Phase 11.4 payment provider adapter framework.

The current repository has production-oriented Customer, CustomerAddress, Cart, catalog/inventory, Checkout application, and Payment persistence/application boundaries. There is currently no persisted Order, OrderItem, OrderAddressSnapshot, or Order-to-Payment relation in Prisma.

The architectural conclusion is therefore:
- Order must be introduced as a new historical commercial aggregate in Phase 12.2.
- Order creation must consume validated Checkout state plus a verified successful internal Payment.
- Order history must use immutable snapshots rather than depend on mutable catalog/customer/address records.
- Payment remains provider-neutral and separate from Order.
- Inventory, fulfillment, and shipping remain downstream boundaries.
- The Phase 12.2 implementation should establish database-enforced Payment-to-Order uniqueness and customer ownership.
- No speculative provider-specific Order fields are justified.

## 2. Current Order architecture

There is no current Order persistence layer in the audited Prisma schema.

Existing relevant persistence:
- `Customer`: authenticated customer owner.
- `CustomerAddress`: mutable customer-owned address.
- `Cart` and `CartItem`: current purchase intent.
- `Product`, `ProductVariant`, option/value relations and inventory: mutable catalog/availability state.
- `Payment`, `PaymentAttempt`, `PaymentEvent`, `PaymentIdempotency`: payment aggregate and operational records.

The current Payment model stores:
- customer ID;
- checkout reference;
- internal payment reference;
- provider ID/reference;
- status;
- amount/currency;
- timestamps.

The current Payment application validates Checkout-derived customer/reference/amount/currency and uses persistent idempotency and serializable transactions.

There is no Order repository, Order application service, Order domain service, Order API, or Order DTO to preserve as an existing boundary.

## 3. Identified gaps

Phase 12.2 must introduce:
1. Order aggregate and lifecycle.
2. Customer ownership.
3. Checkout-to-Order relationship.
4. Verified Payment-to-Order relationship.
5. Immutable Order item snapshots.
6. Immutable address snapshot.
7. Authoritative pricing snapshot.
8. Customer historical snapshot only where operationally justified.
9. Customer-facing Order Number/reference.
10. Database uniqueness protecting duplicate conversion.
11. Order repository/application/domain boundaries.
12. Customer-safe DTO/API boundaries.
13. Concurrency-safe creation.
14. Safe domain errors and observability.
15. Tests for ownership, idempotency, snapshots, state transitions, and public-data exposure.

No implementation is added by this phase.

## 4. Order domain boundary

The authoritative conceptual flow is:

```
Customer
  -> Cart
  -> Checkout
  -> Payment Creation
  -> Payment Provider
  -> Payment Verification / Webhook
  -> Verified Successful Payment
  -> Order
  -> Inventory Reservation
  -> Fulfillment
  -> Shipping
```

Order is the historical commercial boundary between payment completion and downstream operational processing.

Payment SUCCEEDED is a prerequisite for Order creation, but Payment SUCCEEDED does not imply any Order fulfillment state.

The Order domain must not call provider SDKs, inventory providers, fulfillment providers, or shipping providers.

## 5. Order lifecycle

The repository currently has a mature Payment lifecycle but no Order lifecycle. The Order lifecycle should be intentionally smaller than the complete downstream commerce lifecycle.

Phase 12.2 should evaluate and implement only states justified by the current downstream architecture. The minimum architecture-supported starting state is `PENDING` or `CONFIRMED`, followed by operational states only when their owners exist.

Required design rules:
- initial state must be explicit;
- transitions must be allow-listed;
- invalid transitions must fail safely;
- terminal states must be explicit;
- transition ownership must be documented;
- concurrent transitions must be protected;
- state changes must remain auditable.

Do not equate Payment status with Order status. In particular, Payment `SUCCEEDED` cannot directly mean Order `DELIVERED` or `COMPLETED`.

## 6. Order creation contract

Future Order creation must accept a server-derived contract, not browser-supplied commercial data.

Minimum authoritative inputs:
- authenticated Customer ID;
- validated Checkout identity/reference;
- validated Checkout state;
- internal Payment ID;
- verified Payment state = `SUCCEEDED`;
- verified Payment amount;
- verified Payment currency;
- Checkout-authoritative totals;
- selected customer-owned address data;
- resolved Cart/product/variant data needed to construct snapshots.

The operation must reject:
- client-provided Customer ID as an ownership authority;
- client-provided Payment ownership;
- client-provided Checkout ownership;
- client-provided prices/totals/currency;
- client-provided address ownership;
- unverified provider success information.

The Payment record, not browser/provider callback data, is the payment authority.

## 7. Payment -> Order relationship

Current Payment persistence is provider-neutral and customer-scoped. It already contains an internal Payment ID, checkout reference, authoritative amount/currency, normalized status, provider reference fields, attempts, events, and idempotency records.

Phase 12.2 should establish a strong invariant:

```
Verified Payment (SUCCEEDED)
        |
        | exactly one successful commercial conversion
        v
      Order
```

The database should enforce the critical one-to-one conversion invariant where the repository's relational model permits it. Application-level existence checks alone are insufficient for concurrent requests.

The Order must reference the internal Payment. Provider references remain Payment concerns.

Future partial refunds/refunds must not require Order to become provider-specific. They should relate to the Payment/refund architecture separately.

## 8. Checkout -> Order relationship

The existing Checkout boundary is server-authoritative and validates authenticated customer ownership, address ownership, Cart state, pricing consistency, currency, availability and revision state.

Order creation should consume that validated Checkout state.

The Order should preserve the originating Checkout reference where operationally useful, because it provides traceability between the historical purchase and the validated purchase attempt.

Phase 12.2 should define whether Checkout becomes closed/consumed after successful Order creation. It must prevent silent reuse of the same Checkout for a second Order.

The existing Checkout implementation must not be redesigned in Phase 12.1.

## 9. Order item snapshot strategy

OrderItem is the historical representation of what was purchased.

The snapshot should preserve only fields supported by the current catalog model and required for historical reconstruction:
- Order ID;
- Product ID as a supporting reference, where useful;
- Variant ID as a supporting reference, where useful;
- product title snapshot;
- variant display/name snapshot;
- SKU snapshot;
- quantity;
- unit price snapshot;
- line total snapshot;
- currency;
- selected option values when required by the current variant model;
- fulfillment/support metadata only when justified.

The snapshot is authoritative after creation.

Current Product/ProductVariant data remains supporting relational context only. Catalog mutations must never rewrite an existing OrderItem snapshot.

Do not duplicate the complete Product record.

## 10. Address snapshot strategy

CustomerAddress is mutable and therefore cannot be the sole historical Order address record.

Phase 12.2 should create an Order-owned immutable address snapshot containing only the fields supported by the current address architecture and required to reconstruct the purchase-time destination:
- recipient name;
- phone when supported/required;
- address lines;
- city;
- state/province;
- postal code;
- country code;
- any other existing Checkout-supported contact field required for fulfillment.

The Order must preserve the address used at purchase time.

The snapshot must be created only after server-side validation of:

```
Authenticated Customer
  -> Checkout
  -> customer-owned CustomerAddress
  -> Order snapshot
```

A CustomerAddress ID may remain a supporting reference if useful, but it cannot replace the immutable snapshot.

## 11. Pricing snapshot strategy

Checkout is the current authority for payable totals.

Order creation must copy authoritative commercial values from the validated Checkout/Payment boundary rather than recompute arbitrary prices from the current catalog.

The snapshot should include only pricing concepts that actually exist in the repository:
- merchandise subtotal;
- total;
- currency;
- line quantities/unit prices/line totals.

Discount, tax, and shipping fields must not be invented unless a real repository feature exists that requires them.

Decimal/monetary precision must be preserved consistently with the existing Prisma Decimal representation.

Payment amount must match the authoritative Order/Checkout total before creation.

## 12. Customer ownership

Every Order must belong to exactly one Customer.

Future access must use server-derived authenticated customer identity:

```
Authenticated Customer
  -> owns Order
  -> owns OrderItems / historical data
```

Customer ID in a request body must never override the authenticated owner.

Repository queries for customer-facing Order access should scope the Order by Customer ID.

An Order ID or Order Number from another customer must resolve to not-found/denied behavior without leaking whether another customer's Order exists.

## 13. Idempotency strategy

Order creation is a critical idempotent conversion.

The design must protect against:
- double browser submissions;
- repeated payment callbacks;
- duplicate webhook processing;
- provider retries;
- network retries;
- server retries;
- concurrent conversion attempts;
- reconciliation retries.

The strongest invariant is a unique verified Payment-to-Order relationship.

Application logic should:
1. validate ownership and verified payment;
2. check for an existing conversion;
3. create Order + snapshots atomically;
4. rely on a database uniqueness constraint for races;
5. on a uniqueness race, safely return/reload the already-created Order when authorization is valid.

Do not use an in-memory lock as the primary guarantee.

## 14. Concurrency strategy

Two simultaneous requests converting the same successful Payment must result in one Order.

The repository already uses serializable transactions for critical Payment operations. Phase 12.2 should follow the same transaction conventions rather than introducing distributed locks.

The transaction should cover, at minimum:
- verified Payment;
- Checkout validation/consumption state as applicable;
- Customer ownership;
- address snapshot;
- Order;
- OrderItems;
- Order totals;
- Payment-to-Order uniqueness enforcement.

External provider, fulfillment, shipping, or inventory calls must not be performed inside this transaction.

## 15. Database requirements

The current Prisma schema contains no Order-related models.

Phase 12.2 should evaluate a minimal relational foundation consisting of:
- `Order`;
- `OrderItem`;
- `OrderAddressSnapshot` or equivalent;
- Order status;
- Customer relation;
- Checkout reference/relation;
- Payment relation;
- unique customer-facing Order Number;
- unique Payment-to-Order invariant;
- indexes for customer lookup and operational state;
- created/updated timestamps;
- foreign-key deletion behavior;
- historical snapshot fields.

The exact column design must be derived from the existing repository conventions during Phase 12.2.

Do not add speculative provider-specific columns for payment, fulfillment, or shipping providers.

Do not create Inventory Reservation tables or fulfillment/shipping tables in Phase 12.1.

## 16. Inventory boundary

The intended future handoff is:

```
Order
  -> Inventory Reservation
```

Inventory already exists in the repository, but Phase 12.1 must not implement reservation.

Phase 12.2+ should define:
- which Order state permits reservation;
- required OrderItem/variant/quantity data;
- insufficient inventory representation;
- concurrency behavior;
- reservation idempotency.

An Order must not silently imply that inventory has been reserved.

## 17. Fulfillment boundary

The intended future boundary is:

```
Order
  -> Fulfillment
  -> Provider Adapter
  -> Fulfillment Provider
```

The Order domain remains provider-neutral.

Possible future providers may include external print/fulfillment services or manual/owned fulfillment, but none should be coupled to the core Order model now.

Fulfillment should consume an explicit contract derived from the Order's immutable purchase data and operational identifiers.

## 18. Shipping boundary

The intended future boundary is:

```
Order
  -> Shipping
  -> Shipping Provider Adapter
  -> Shipping Provider
```

Shipping-specific tracking, labels, carrier identifiers, and provider logic do not belong in the core Order domain unless later architecture explicitly establishes a shipping aggregate.

The minimum downstream contract should consume:
- Order/customer operational identity;
- immutable shipping destination;
- OrderItem quantities;
- SKU/variant data;
- fulfillment status;
- shipping status once implemented.

No shipping provider integration belongs in this phase.

## 19. Security model

The Order architecture must enforce:
- authentication;
- authorization;
- Customer ownership;
- IDOR resistance;
- non-enumerable customer-facing references where repository conventions require it;
- server-side validation of Order/Checkout/Payment identifiers;
- duplicate-conversion protection;
- replay-safe creation;
- request validation;
- private/no-store behavior for private Order APIs;
- safe error responses;
- no sensitive logging.

Customer-facing endpoints must never trust:
- customer ID from request body;
- Order ownership from client;
- Checkout ownership from client;
- Payment ownership from client;
- price/currency from client;
- address ownership from client.

The internal Order record must never expose provider credentials, webhook payloads, internal stack traces, or unrelated customer data.

## 20. DTO/API boundary

Future architecture:

```
Browser
  -> Customer Order API
  -> Order Application Service
  -> Order Domain Service
  -> Order Repository
  -> Database
```

Storefront components must not access Prisma directly.

Customer DTOs should expose only required historical purchase information.

Internal fields such as operational metadata, internal audit details, provider internals, or unrelated ownership data must remain behind the application boundary.

Admin Order functionality must use a separate authorized internal boundary later.

No Order UI or Admin Order UI is implemented here.

## 21. Error model

Future Order operations should use repository conventions for safe domain errors.

Relevant categories to evaluate during implementation include:
- Order not found;
- Order access denied;
- invalid Order state;
- payment not verified;
- invalid Checkout;
- Checkout already converted;
- Order already exists;
- address invalid;
- Order creation failed.

The final names should match the repository's existing error conventions rather than introducing unnecessary parallel taxonomies.

Internal database errors and stack traces must not be exposed to customers.

## 22. Observability

Order creation should produce structured operational diagnostics containing only necessary data:
- internal Order ID;
- Order Number;
- Customer ID;
- Checkout reference/ID;
- Payment ID;
- operation;
- lifecycle transition;
- outcome;
- safe error classification;
- latency;
- correlation ID where the existing observability architecture supports it.

Do not log:
- full addresses;
- unnecessary phone/PII;
- payment credentials;
- provider secrets;
- raw webhook payloads;
- unrelated customer records.

## 23. Testing requirements

Phase 12.2 should provide automated coverage for at least:
1. Payment -> Order ownership.
2. Checkout -> Order ownership.
3. Customer -> Order ownership.
4. Address ownership.
5. Duplicate Order creation.
6. Concurrent Order creation.
7. Duplicate Payment-to-Order conversion.
8. Historical price snapshot.
9. Historical product/variant snapshot.
10. Historical address snapshot.
11. Invalid Payment state.
12. Invalid Checkout state.
13. Unauthorized Order access.
14. IDOR attempt.
15. Invalid Order state transition.
16. Provider-neutral Order data.
17. Public DTO data exposure.

Additional regression tests should verify:
- catalog changes do not mutate historical snapshots;
- customer address changes do not mutate historical snapshots;
- repeated conversion returns the same authorized Order;
- a different customer's Payment/Checkout cannot be converted;
- Payment amount/currency mismatches are rejected;
- browser-submitted commercial values cannot override server authority.

The repository's existing CI commands remain:
- `npm test`;
- `npm run lint`;
- `npm run typecheck`;
- `npm run build`;
- database migration validation.

## 24. Phase 12.2 implementation requirements

Phase 12.2 should implement only the minimum production Order foundation identified by this audit.

Expected sequence:
1. Add minimal Prisma Order/OrderItem/address-snapshot schema.
2. Add migration.
3. Add Order domain lifecycle and transition rules.
4. Add repository with customer/payment/checkout ownership boundaries.
5. Add application service for verified Payment -> Order conversion.
6. Add immutable snapshots from authoritative Checkout/catalog/address state.
7. Add database uniqueness for Payment-to-Order conversion and Order Number.
8. Add concurrency-safe transaction handling.
9. Add customer-safe DTOs/API boundary only as required.
10. Add tests and regression coverage.
11. Run full CI-equivalent suite.

Phase 12.2 must not expand into fulfillment, shipping, inventory reservation, refunds, or provider SDK integration.

## 25. Explicit out-of-scope items

The following remain explicitly out of scope for Phase 12.1:
- complete Order system;
- Order CRUD;
- Order UI;
- customer order history;
- Admin Order management;
- fulfillment;
- shipping;
- inventory reservation;
- returns;
- refund implementation;
- payment provider modification;
- additional payment providers;
- Checkout redesign;
- Cart redesign;
- Wishlist;
- provider-specific Order coupling;
- Qikink/Printrove/Printful/Printify integration;
- Shiprocket/Delhivery/DTDC/Blue Dart integration;
- speculative migrations;
- locked-stack changes;
- unrelated refactors.

## Final review

Audited repository facts:
- Payment persistence and application boundaries exist.
- Payment is provider-neutral at the domain/application contract.
- Customer and CustomerAddress persistence exist.
- Catalog, variant and inventory persistence exist.
- Checkout is an existing server-authoritative application boundary.
- No Order persistence exists.
- No Order CRUD/UI exists.
- No Order-to-Payment database invariant exists yet.
- No Order snapshot structures exist yet.
- No fulfillment/shipping implementation is present as part of this audit.
- `lib/payments/reconciliation.ts` is not present on main and therefore cannot be treated as an existing Phase 11 reconciliation implementation.

No speculative Order schema is introduced by Phase 12.1.

CI configuration is configured to run Test, Lint, Typecheck and Build on pushes/PRs targeting main using Node 24.21.0 and PostgreSQL 16. This phase must not declare readiness while that validation is red or unavailable.

## Phase gate

READY FOR PHASE 12.2
