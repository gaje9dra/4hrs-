# Phase 10.3 — Checkout Domain, Cart Handoff & Server-Side Validation Foundation

## Scope
Phase 10.3 establishes the server-authoritative Checkout application boundary between authenticated Customer, existing Cart, canonical Customer Address, and existing catalog/availability authority. It does not create Checkout persistence.

## Architecture
Customer/Auth → Checkout Application → Cart Service/Application → Catalog & Inventory Authority → Checkout Validation → future Payment → future Order.

The Checkout layer orchestrates existing services. It does not duplicate Cart pricing, product lifecycle, variant lifecycle, or availability rules.

## Cart handoff and ownership
The browser does not submit a customer ID or Cart ID. The existing Cart application resolves the current Cart from the authenticated session and applies its existing ownership boundary. Checkout consumes that result. A missing Cart remains represented in the Checkout service contract for service-level callers and future Cart implementations.

## Address integration
Checkout accepts only a selected stored address ID. The server supplies the authenticated customer ID to CustomerAddressService, which scopes every address query by customer. An inaccessible address is intentionally reported as an ownership-safe failure rather than revealing whether the identifier belongs to another customer.

If no address ID is supplied, Checkout resolves the customer's default stored address. No arbitrary address object from the browser is accepted.

## Address snapshot decision
No Checkout address snapshot is persisted in this phase. CustomerAddress remains the mutable canonical account address. The future Order phase owns creation of an immutable order-address snapshot at order creation.

## Pricing authority
The browser cannot submit price, subtotal, total, currency, discount, tax, or shipping values as authoritative inputs. Checkout calculates merchandise subtotal from the authoritative Cart representation returned by the existing Cart service.

Only supported totals are returned:
- merchandiseSubtotal
- supported adjustments: currently none
- supported charges: currently none
- total = authoritative merchandise subtotal

No fake zero-valued tax/shipping/discount business rules are emitted. Payment readiness remains false.

## Price-change handling
Current Cart persistence stores product/variant references and quantity, while the existing Cart service re-resolves current catalog pricing on Cart reads. Checkout additionally verifies that each authoritative line subtotal equals authoritative unit price × quantity. An inconsistency produces PRICE_CHANGED rather than silently proceeding.

A historical Cart-price snapshot is deliberately not invented. A future explicit price-reconfirmation contract may use PRICE_CHANGED for UI confirmation if Cart persistence gains such a snapshot.

## Availability and quantity
Cart reads already revalidate published product state, variant relationship/lifecycle and inventory availability through the catalog query service. Checkout rejects unavailable product/variant states and non-positive quantities from that authoritative representation. No inventory is reserved or decremented.

Future boundary:
Checkout validation → Inventory Reservation → Order.

## Checkout state
Checkout is stateless. GET and POST validation perform no Cart, address, inventory, payment, or order mutation. No Checkout table, expiration, cleanup process, or payment/order idempotency system is introduced.

## DTO
The Checkout DTO contains only customer-safe identity, Cart display items, selected stored address, authoritative supported totals, validation state/issues, and explicit payment-not-ready information. It excludes ORM records, database fields, secrets, session tokens, provider metadata, payment credentials, and inventory internals.

## API contract
GET /api/checkout validates the current authenticated Checkout using the customer's default address when available.

POST /api/checkout accepts only:
{ selectedAddressId?: UUID | null }

All other request fields are rejected. In particular, customerId, cartId, price, subtotal, total, currency, inventory, and payment amount are never accepted as Checkout authority.

Both responses are private/no-store and vary on Cookie/Authorization.

## Error model
Expected domain validation is represented by stable Checkout validation states. Unexpected failures map to a safe temporary-unavailable error without exposing ORM/SQL details. Authentication failures are returned as 401.

## Concurrency and stale state
Checkout is a point-in-time server validation. Every request obtains the current Cart representation and current stored address. If Cart quantity, product lifecycle, variant availability, pricing, or address state changes after the response, the next validation request re-evaluates authoritative state.

No inventory reservation is performed, so Checkout does not claim availability for a future payment/order.

## Security and privacy
- Authentication comes from the existing session.
- Customer ownership is never taken from request JSON.
- Cart ownership is enforced by the existing Cart application.
- Address ownership is enforced by CustomerAddressService.
- Browser prices/totals/currency cannot override authority.
- Responses are private and uncached.
- Unsupported request fields are rejected.
- Observability records safe classification/error codes only.
- Full addresses, phone numbers, Cart contents, credentials, payment data and session tokens are not logged.

## Performance
Checkout consumes the existing Cart service representation instead of querying Cart tables directly or duplicating catalog queries. Explicit address selection is a single customer-scoped address lookup. Default selection uses the existing address-list service. No private Checkout caching is introduced.

## Tests
tests/checkout-domain.test.ts covers:
- valid Checkout
- missing/empty Cart
- invalid quantity
- unavailable product/variant
- authoritative price inconsistency
- currency inconsistency
- address ownership/deletion handling
- default address resolution
- request tampering with customer/Cart/price/total/currency fields
- safe error mapping
- absence of inventory reservation

Existing Cart, authentication, address, catalog, and storefront tests are not weakened.

## Deferred work
- final Checkout UI
- payment processing, payment intents, transactions, or providers
- Order persistence and order-address snapshot
- shipping providers and shipping charges
- fulfillment
- inventory reservation/decrement
- discounts/taxes until dedicated rules exist
- Checkout persistence/session lifecycle
- Wishlist
