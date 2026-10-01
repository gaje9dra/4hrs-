# Phase 12.5 — Customer Order Experience

## Scope

Phase 12.5 adds the authenticated customer-facing Order History and Order Detail experience on top of the Phase 12.4 Order application/API contract. The Order domain, persistence model, and API contract were reused without redesign.

## Customer routes

- `/account/orders` — authenticated Order History.
- `/account/orders/[orderNumber]` — authenticated Order Detail using the public Order Number.
- Both routes are force-dynamic, private, and marked `noindex`.

The detail URL intentionally uses the public Order Number rather than exposing the internal UUID.

## Account integration

The existing Account navigation now includes **Orders** alongside Account, Profile, and Cart. No second Account navigation system was introduced.

## Architecture

The customer UI uses:

Browser
→ Account Order Route
→ `createOrderApplication()`
→ existing customer-scoped Order application service
→ Order repository
→ database

The UI receives only `PublicOrderDto` / `PublicOrderListDto`. It does not import Prisma, query the database, or resolve current catalog products to render historical items.

## Order History

The list displays only authoritative DTO data:

- Order Number
- Order date
- Order status
- Item count derived from the returned Order item snapshots
- Total
- Currency

The Phase 12.4 bounded pagination contract is reused with a maximum page size of 50. URL state is preserved with `page` and `pageSize`.

Customers with no Orders receive an empty state with a real `/shop` Continue Shopping CTA.

## Order Detail

The detail page displays:

- Order Number
- Order date
- Actual lifecycle status
- Historical product/variant title snapshots
- Historical selected options
- Historical SKU when present
- Historical quantity
- Historical unit and line prices
- Authoritative historical subtotal and total
- Historical shipping address snapshot when present

Totals are never recalculated from catalog data in the browser.

## Status presentation

Phase 12 currently implements only:

- `PENDING`
- `CONFIRMED`

The UI does not imply packed, shipped, delivered, returned, refunded, or cancelled states.

## Ownership and privacy

Ownership is enforced by the existing Phase 12 application/repository customer predicates. The UI never accepts a customer ID and does not use UI hiding as an authorization mechanism.

Order pages use private/no-store server rendering behavior and `noindex` metadata. Error and not-found surfaces do not disclose database errors, provider responses, internal payment identifiers, or infrastructure details.

## Loading and error behavior

Dedicated loading boundaries prevent unstable private content from being displayed during navigation. Error boundaries provide safe retry/back-navigation controls. A non-owned, missing, or malformed Order identifier is presented as the same safe Order-not-found experience.

## Post-purchase confirmation

The existing Checkout flow was audited. In this repository state, Checkout explicitly reports that payment processing is not implemented, so there is no verified payment-success callback or authoritative created Order identifier available for a confirmation link. No fake confirmation or Order creation was added.

When a verified payment-to-Order flow becomes available in a later phase, its authoritative Order creation result can be linked to this existing detail route without duplicating Order creation in the UI.

## Responsive and accessibility behavior

Order surfaces reuse the existing Bauhaus primitives and hard-border/shadow system. Layouts are designed to collapse cleanly from mobile to desktop, with readable item data, touch-sized controls, semantic headings, labeled navigation, keyboard-focusable links, status text in addition to color, and accessible loading/error/empty states.

## Performance

The Order pages use server components and the existing application service. There are no browser-side Order fetch loops, catalog lookups, or N+1 product queries. The list uses the bounded Phase 12.4 pagination contract.

## Testing

Phase 12.5 adds static regression coverage for:

- authentication/privacy metadata
- no direct Prisma/ORM access from Order UI/routes
- historical snapshot rendering
- authoritative totals
- real lifecycle status mapping
- public Order Number routing
- bounded pagination
- loading/error/not-found boundaries
- Account navigation

The repository's existing Order API/security tests remain authoritative for server-side IDOR and ownership enforcement.

## Known limitations / Phase 12.6 readiness

Payment processing and post-purchase verified Order confirmation are not implemented by the current repository architecture, so Phase 12.5 does not simulate them. Fulfillment, shipping, tracking, inventory reservation/deduction, returns, refunds, cancellation, exchanges, and admin Order management remain outside this phase.

Phase 12.6 should build only on capabilities explicitly introduced after this phase and must not assume the customer UI has implemented downstream fulfillment workflows.
