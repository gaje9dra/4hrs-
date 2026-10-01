# Phase 12.3 — Order Domain Service, Order Creation & Business-Logic Foundation

## Architecture

Order creation is a server-only conversion:

`authenticated Customer -> validated Checkout -> verified Payment -> Order Application Service -> Order Domain rules -> Order Repository -> database`.

The canonical operation is `createOrderFromVerifiedPayment({ paymentId, request })`. The caller supplies no authoritative customer, checkout, address, price, total, currency, product, variant, quantity, or Order status.

There is no persisted Checkout model in the current repository. The existing Checkout boundary derives a stable server-side `checkoutReference` from the authenticated customer, Cart identity, Cart revision, selected address, total, and currency. Phase 12.3 therefore reconstructs the authoritative Checkout from the current server-side Cart/address/catalog state and requires its generated reference to equal the Payment's stored `checkoutReference`. No new Checkout table or Checkout redesign is introduced.

## Payment validation

The application service loads Payment through the existing Payment repository, scoped to the authenticated Customer, and requires:
- Payment exists;
- Payment ownership matches the authenticated Customer;
- Payment status is `SUCCEEDED`;
- `completedAt` is present;
- Payment amount is the authoritative amount;
- Payment currency is the authoritative currency;
- Payment is not already linked to an Order.

The Order service consumes internal Payment state only. Browser redirects, client success flags, provider credentials, and client totals are not accepted as proof of payment.

The repository does not expose a separate Payment verification aggregate. In this codebase, server-authoritative `SUCCEEDED` state is the verified payment boundary established by the existing Payment application/webhook state machine.

## Checkout validation

The resolver reads the authenticated customer's Cart and CustomerAddress records from the same serializable transaction used for Order creation. It resolves Products, Variants, option values, inventory availability, prices, quantities, and currency from server-side records.

The resolver recreates the Checkout reference for each customer-owned address and selects only the address whose reference exactly matches Payment.checkoutReference. This prevents an arbitrary address ID from being supplied during Order creation.

A stale Cart, changed price, changed variant, changed quantity, changed currency, missing address, or unavailable item produces a safe Checkout/Order validation error rather than silently rebuilding the purchase from client data.

## Price and totals authority

The commercial chain remains:

`Catalog -> Cart -> Checkout -> Payment -> Order snapshot`.

The final Order total is the reconstructed authoritative Checkout total. Payment amount and currency must exactly match Checkout total and currency. OrderItem unit price and line total are derived server-side from current validated catalog state and the Cart quantity.

No browser-provided commercial values are accepted.

## Product / Variant validation

Each CartItem is re-resolved from the database. The service verifies:
- Product exists;
- Product is ACTIVE;
- Variant exists when selected;
- Variant belongs to the Product;
- Variant is ACTIVE;
- effective catalog price is valid;
- selected quantity is positive;
- inventory availability has not become insufficient;
- Product currency is a valid three-letter uppercase code.

Variant SKU, title, display name, and option values are copied into the historical OrderItem snapshot. The Product/Variant foreign keys remain supporting references only.

No catalog provider or external inventory reservation is invoked.

## Snapshots

OrderItems preserve:
- Product ID;
- Variant ID;
- product title;
- variant display/title;
- SKU;
- selected options;
- quantity;
- unit price;
- line total;
- currency.

The shipping address is copied into `OrderAddressSnapshot` inside the same transaction. Later CustomerAddress or catalog mutations cannot change these snapshots.

No unnecessary customer PII is copied into the Order model.

## Order lifecycle

Phase 12.2 established `PENDING` as the persistence default and Phase 12.1 explicitly permits `PENDING` or `CONFIRMED` as the initial state. Phase 12.3 initializes new Orders to `PENDING`; Payment `SUCCEEDED` does not imply fulfillment, shipping, delivery, or completion.

No downstream lifecycle is implemented.

## Idempotency and concurrency

The database's unique Payment-to-Order and Checkout-to-Order constraints are the primary duplicate-conversion guarantees. The application first returns an existing authorized Order for an already-converted Payment.

Creation runs inside a PostgreSQL serializable transaction. A serialization conflict is retried. A unique conflict is reloaded and converted into a safe idempotent result when the existing Order belongs to the authenticated Customer and the Payment matches. A Checkout already converted for a different Payment is rejected.

No in-memory lock is used as the primary guarantee.

## Transaction boundary

The transaction atomically covers:
- Payment revalidation;
- Checkout reconstruction;
- Customer/address/catalog validation;
- Order creation;
- OrderItems;
- address snapshot;
- authoritative totals and currency.

No external payment/provider call occurs inside the transaction. Inventory is read for availability only; no reservation is created.

## Error model

Structured `OrderDomainError` codes include Payment, Checkout, amount/currency, address/item, and Order creation failures. Raw Prisma/provider errors are never exposed by the application boundary.

Cross-customer Payment/Order access is denied without returning another customer's historical Order.

## Observability

Order creation emits structured diagnostics containing only operational identifiers, result, failure classification, and duration. It does not log card data, payment secrets, webhook secrets, or full address/customer records. Test runs suppress operational logging.

## Security controls

The application requires an authenticated Customer and scopes Payment and Order lookup to that Customer. No browser value can override ownership or commercial authority. The Checkout reference binds the Cart revision, selected address, total, and currency to the Payment.

Private Order results are application-layer objects; no public catalog caching or customer Order UI is introduced.

## Tests and downstream contract

Phase 12.3 tests cover successful conversion, invalid/failed Payment, ownership isolation, Checkout mismatch, amount/currency mismatch, invalid product/variant/quantity, address mismatch, immutable snapshots, totals/currency/status, duplicate conversion, concurrent conversion, rollback, tamper resistance, and catalog/address mutation after creation.

The internal result contains only:
- Order ID;
- Order Number;
- Customer ID;
- Checkout reference;
- Payment ID;
- status;
- total;
- currency;
- creation timestamp.

Phase 12.4 can consume this result without accessing Prisma structures directly.

## Explicitly deferred

No Order UI, customer order history, admin Order management, fulfillment, shipping, inventory reservation, returns, refunds, cancellation, provider SDK integration, additional payment provider, Checkout redesign, Cart redesign, or unrelated refactor is implemented in Phase 12.3.
