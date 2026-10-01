# Phase 10.5 — Checkout Pricing, Totals & Final Validation Hardening

## Scope

Phase 10.5 hardens the existing Checkout path before Payment. It does not implement payment processing, payment-provider integration, orders, shipping, fulfillment, inventory reservation, or Wishlist.

## Pricing authority

The canonical runtime path is:

Authenticated customer → Checkout application → owned Cart service → published Catalog/Pricing authority → validated Cart line values → Checkout totals.

Checkout does not accept browser-supplied unit prices, subtotals, totals, currencies, discounts, taxes, or shipping charges. The Cart service resolves current published product/variant pricing and availability from the catalog and inventory contracts. Checkout consumes that server-authoritative Cart representation.

The Checkout service does not recalculate merchandise pricing independently. It validates the Cart representation and uses the Cart service's authoritative subtotal as the Checkout merchandise subtotal and final total because no discounts, taxes, or shipping charges are currently implemented.

## Monetary representation

Existing Prisma Decimal arithmetic remains the Cart service's monetary representation. Checkout transports money as canonical decimal strings. No floating-point arithmetic or ad-hoc rounding was added.

With no supported adjustments or charges, the total is:

Cart authoritative subtotal = Checkout total

The response exposes empty adjustments and charges arrays rather than fabricated pricing components.

## Currency rules

Every available Cart line must use one consistent currency matching the Cart currency. Mixed or missing currency states are rejected as validation failures. The browser cannot select or override currency or exchange rates.

No multi-currency conversion is implemented.

## Discounts, taxes and shipping

There is no active discount engine, tax engine, or provider-neutral shipping-pricing contract in this Checkout path. No fake discounts, taxes, or shipping fees are generated.

Future boundaries remain explicit:

Checkout validation → Inventory Reservation → Order

## Line validation

Before producing a Checkout representation, the server validates Cart identity, non-empty state, positive integer quantities, purchasable product/variant state, availability, currency consistency, and the server-resolved line representation.

The existing Cart service re-resolves each Cart item against the published catalog and inventory availability. Checkout does not duplicate those catalog lookup rules.

## Stale Checkout revisions

Phase 10.5 adds an opaque server-generated revision containing SHA-256 digests for Cart structure, pricing, and availability. The browser may return this revision only as a stale-state detector; it is never an authoritative pricing input.

A POST that carries a previous revision is compared with the newly resolved server Cart:

- Cart structure changed → CART_CHANGED
- availability changed → VARIANT_UNAVAILABLE
- pricing/currency representation changed → PRICE_CHANGED

The server always returns current authoritative values. Stale Checkout cannot silently progress using the old representation.

## Address validation

Checkout accepts only an address ID. The address service looks it up using the authenticated customer ID, so another customer's address cannot be selected by supplying its ID. Missing/deleted addresses become structured Checkout validation states.

Address objects are never accepted from the browser as authoritative Checkout data.

## Cart consistency and empty Cart

The complete owned Cart is reloaded through the existing Cart application for every Checkout validation request. An empty Cart returns CART_EMPTY; missing/unavailable Cart state is mapped to a safe Checkout error or structured validation state. Checkout does not create sessions, orders, reservations, or payment records.

## Determinism

Cart persistence already provides stable item ordering by creation timestamp and ID. Checkout revision and validation operations additionally sort line IDs before hashing/validation and return issues in deterministic order.

Repeated validation is side-effect free. It does not mutate Cart items, inventory, discounts, payment state, or orders.

## Error model and observability

Client-visible responses use structured Checkout states and safe public messages. Internal ORM/database errors are not exposed.

Existing Checkout observations record operation, classification, duration and a safe error classification. Address contents, phone numbers, payment credentials, and full customer payloads are not logged.

## Client security

The Phase 10.4 UI submits only the selected address ID and the opaque stale revision. It does not submit authoritative monetary values.

The Checkout request parser rejects unsupported fields such as customer IDs, Cart IDs, prices, subtotal, total, currency, discount, tax, shipping and payment amount.

The customer identity and Cart are resolved from the authenticated server context.

## Performance

Checkout reuses the existing Cart service instead of introducing another pricing query path. Catalog and inventory resolution remains inside the Cart service. No shared caching of private Checkout state was added.

## Test coverage

Phase 10.5 extends Checkout domain/API coverage for:

- authoritative server totals
- deterministic revisions
- stale pricing detection
- Cart structure changes
- malformed revision rejection
- monetary-field tampering rejection
- currency consistency
- availability and address validation
- empty/missing Cart handling
- safe error mapping
- existing Cart, catalog, address, authentication and UI regression coverage

## Deferred work

The following remain explicitly deferred:

- Payment provider integration
- payment intents/transactions
- Order creation
- Shipping provider integration
- Fulfillment
- Inventory reservation/decrement during Checkout
- Wishlist

Checkout validation confirms current state only; it does not reserve inventory or guarantee future stock.

## Validation gate

Run the project's actual scripts:

- npm test
- npm run lint
- npm run typecheck
- npm run build

Relevant database migrations/schema validation must also remain green. Browser validation must cover normal Checkout, address changes/stale addresses, price changes, unavailable variants, Cart changes, empty Cart, invalid requests, mobile layout and keyboard navigation before Phase 10.5 is declared ready.
