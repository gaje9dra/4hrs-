# Phase 12.2 — Order Data Model & Persistence Foundation

## Scope

Phase 12.2 establishes the persistent Order foundation only. It does not implement Order business services, Order creation workflow, public Order APIs, customer/admin Order UI, fulfillment, shipping, inventory reservation, returns, refunds, cancellation workflows, provider integrations, or Checkout redesign.

## Repository verification

The verified repository contains Customer and CustomerAddress, Product and ProductVariant, Cart and CartItem, and Payment persistence. It contains Payment.checkoutReference but no persisted Checkout model.

Therefore Order persists the existing server-side checkoutReference as its Checkout traceability key and enforces one Order per checkout reference with a database uniqueness constraint. A Prisma foreign key to Checkout would invent a model that does not exist. Phase 12.3 must validate Checkout ownership through the existing Checkout/payment boundary.

## Order schema

Order contains:
- internal UUID id;
- customerId foreign key;
- unique checkoutReference;
- unique internal paymentId foreign key;
- server-generated customer-facing orderNumber;
- OrderStatus;
- authoritative subtotal;
- authoritative total;
- three-letter uppercase currency;
- createdAt;
- updatedAt.

No speculative discount, tax, shipping, fee, fulfillment, or provider-specific fields are stored.

## Order lifecycle persistence

The persistent lifecycle currently contains only PENDING and CONFIRMED. PENDING is the initial state. CONFIRMED is available for the later service layer.

This intentionally does not encode fulfillment, shipping, delivery, cancellation, return, or refund workflows.

Payment status remains independent from Order status.

## Order Number strategy

Order.orderNumber is generated server-side in the repository foundation, prefixed ORD-, and uses UUID randomness. It has a database uniqueness constraint and is not derived from the sequential database identifier.

The customer cannot authoritatively provide an Order Number to the future creation workflow.

## Customer relationship

Every Order requires exactly one Customer. The foreign key uses ON DELETE RESTRICT and the repository provides customer-scoped lookup methods.

## Checkout relationship

There is no Checkout Prisma model in the verified repository. Order therefore persists the validated Checkout reference as a unique scalar. One checkout reference can create at most one Order.

Phase 12.3 must validate that the reference belongs to the authenticated Customer and matches the Payment.

## Payment relationship

Order references the internal Payment.id. paymentId is unique, creating a one-to-one Payment-to-Order boundary. The foreign key uses ON DELETE RESTRICT.

Provider IDs and provider references remain Payment fields. No provider SDK object or provider credential is copied into Order.

## OrderItem schema

OrderItem contains:
- Order foreign key;
- optional Product ID;
- optional Variant ID;
- product title snapshot;
- variant title snapshot;
- SKU snapshot;
- selected option JSON snapshot;
- quantity;
- unit price;
- line total;
- currency;
- creation timestamp.

OrderItems cascade with their Order. Product and Variant references use ON DELETE SET NULL so catalog deletion cannot destroy historical purchase data.

## Historical product/variant snapshot

Snapshot fields are authoritative after Order creation. Catalog mutations cannot rewrite product title, variant title, SKU, selected options, quantity, unit price, or line total.

If a Product or Variant is deleted, the live foreign key is nulled while the historical snapshot remains.

## Address snapshot

OrderAddressSnapshot is a one-to-one historical record containing fields supported by the existing CustomerAddress model:
- recipient name;
- optional phone;
- address line 1;
- optional address line 2;
- city;
- state/province;
- postal code;
- country code;
- optional label;
- creation timestamp.

No separate billing snapshot was added because the repository does not establish separate billing-address functionality.

## Pricing snapshot

Order stores subtotal, total, and currency. OrderItem stores quantity, unit price, line total, and currency.

Money uses Prisma Decimal with DECIMAL(12,2), matching the existing monetary convention. Database checks reject negative Order and OrderItem monetary values.

No discount, tax, shipping, or fee columns were added because those authoritative concepts are not established in the verified repository.

## Database constraints

Structural invariants are database protected:
- unique Order Number;
- unique Checkout reference;
- unique Payment relation;
- required Customer and Payment;
- required currency and status;
- positive OrderItem quantity;
- non-negative monetary values;
- currency/country format checks;
- valid foreign keys.

Business ownership and verified Payment/Checkout state remain application-layer responsibilities.

## Index strategy

Indexes cover Customer plus creation time, Order status plus creation time, creation time, OrderItem Order ID, Product ID, and Variant ID.

Order Number, Checkout reference, Payment ID, and address-snapshot Order ID use unique indexes.

## Referential integrity

- Customer to Order: RESTRICT.
- Payment to Order: RESTRICT.
- Order to OrderItem: CASCADE.
- Order to OrderAddressSnapshot: CASCADE.
- Product to OrderItem: SET NULL.
- ProductVariant to OrderItem: SET NULL.

Historical Orders therefore survive catalog deletion.

## Transaction boundaries

createOrderWithItems uses the repository's existing serializable transaction mechanism and atomically persists the Order, OrderItems, and optional address snapshot.

No provider network call, inventory reservation, fulfillment operation, or shipping operation is performed inside the transaction.

## Repository foundation

lib/orders/repository.ts exposes persistence operations for:
- creating an Order;
- creating an Order with items and snapshots transactionally;
- creating OrderItems;
- creating an address snapshot;
- lookup by internal ID;
- lookup by Order Number;
- customer-scoped lookup;
- lookup by customer;
- lookup by Checkout reference;
- lookup by Payment ID;
- serializable transaction composition.

This is a persistence repository, not an Order application/domain service.

## Privacy

The model does not store card numbers, CVV/CVC, PINs, bank credentials, provider secrets, or authentication secrets.

## Testing

tests/order-persistence.test.ts covers Order creation, server-generated Order Number, Checkout uniqueness, Payment uniqueness, customer isolation, lookup paths, item/address snapshots, catalog deletion preserving snapshots, quantity validation, and monetary validation.

## Migration

Migration:
prisma/migrations/20261001090000_add_order_persistence_foundation/migration.sql

The migration creates OrderStatus, Order, OrderItem, and OrderAddressSnapshot, plus required constraints, indexes, and foreign keys. It does not rewrite existing records or modify unrelated migrations.

## ORM generation

The established Prisma generation and migration commands remain unchanged. No ORM or dependency versions were changed.

## Phase 12.3 requirements

Phase 12.3 may build the Order application/domain service on this foundation. It must require authenticated Customer ownership, validate Checkout ownership, require a verified successful internal Payment, verify amount/currency, convert a Checkout plus verified Payment into exactly one Order, preserve immutable snapshots, handle concurrent conversion safely, and keep provider calls outside database transactions.

## Explicitly deferred

Deferred:
- complete Order creation workflow;
- Order domain transition service;
- customer Order APIs and UI;
- Admin Order management;
- fulfillment;
- shipping;
- inventory reservation;
- returns;
- refunds;
- cancellation workflow;
- payment-provider changes;
- provider integrations;
- Checkout redesign;
- Cart redesign.

Phase 12.2 implements persistence foundation only and does not begin Phase 12.3.
