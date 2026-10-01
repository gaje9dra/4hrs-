# Phase 10.6 — Checkout Final Integration, Security & Payment Readiness Audit

## Audit scope

This phase audits and hardens the existing Checkout implementation. No payment provider, payment intent, transaction, order, shipping, fulfillment, inventory reservation, or Wishlist functionality is implemented.

## Final architecture

Authenticated customer session
→ authenticated Cart application
→ owned Cart service
→ published Catalog/Pricing resolution
→ current availability resolution
→ Checkout service validation
→ owned Address service
→ server-authoritative Checkout DTO
→ future Payment boundary

The Checkout UI uses API/application boundaries only. It has no Prisma/ORM access. Cart ownership is derived from the authenticated session and the current customer's Cart; arbitrary Cart IDs are not accepted by the Checkout request contract. Address reads are customer-scoped.

## Authentication

The /checkout page is force-dynamic and server-protected. Anonymous users are redirected to /login?next=/checkout using the existing safe redirect helper. API authentication is resolved from the existing opaque session cookie. Invalid or expired sessions are treated as unauthenticated and do not expose customer data.

The Checkout request body cannot override customer identity.

## Cart ownership

Checkout obtains the current Cart through createCartApplication().getCurrentCart(request). That application resolves the customer from the session, obtains that customer's Cart, and invokes the Cart service ownership boundary before returning the DTO.

Checkout accepts no Cart ID. The Cart service also fails closed when no ownership boundary is configured.

Cross-customer Cart access is therefore controlled by the authenticated session/customer context rather than browser input.

## Address ownership

Checkout accepts only an address ID. The server calls the address service with the authenticated customer ID and supplied address ID. The address repository query is customer-scoped.

Another customer's address, a deleted address, or an invalid address cannot become the selected Checkout address.

Default-address resolution is server-side. Address creation is performed through the existing customer address API.

## Product, variant and availability integrity

Checkout consumes the Cart service's resolved line representation rather than Product Detail UI state.

The Cart service resolves product publication/purchasability, variant selection and current availability through the catalog query layer. Checkout then validates positive quantities, purchasable line state, currency consistency and line monetary consistency.

Unavailable product, unavailable variant, insufficient quantity, invalid quantity and inconsistent Cart state become explicit Checkout validation states.

Checkout does not reserve inventory. The future boundary remains:

Checkout → Inventory Reservation → Order.

## Pricing authority and total integrity

The browser never submits unit prices, subtotals, totals, discounts, taxes, shipping charges, or currency as Checkout authority.

The Cart service resolves published pricing and availability. Checkout consumes the Cart service's Decimal-backed subtotal and exposes it as the merchandise subtotal and total because no adjustments or charges are currently implemented.

No floating-point arithmetic is introduced. Checkout performs only a Decimal consistency check for each resolved line and does not create a second catalog pricing algorithm.

Displayed item subtotals and summary totals come directly from the server Checkout DTO.

## Stale state

Checkout returns an opaque SHA-256 revision containing independent Cart structure, pricing and availability digests.

When the browser submits a previous revision, the server reloads the current Cart and compares the revision:

- Cart structure change → CART_CHANGED
- availability change → VARIANT_UNAVAILABLE
- pricing/currency representation change → PRICE_CHANGED

The current server-authoritative Cart and totals are returned with the validation result. Old browser values are never accepted as amounts to charge.

The UI keeps the current revision from the initial Checkout load and sends it with address-validation POST requests. Revision checks are protected against stale asynchronous responses and duplicate validation submission.

## Checkout state machine

The UI explicitly handles:

- loading
- authenticated Checkout
- session expiration
- Cart missing/empty or changed
- address required
- validating
- valid
- validation error
- price changed
- availability changed
- server failure

Selection validation is disabled while a request is pending. A request-version guard prevents stale responses from overwriting newer state. The initial Checkout revision is stored before address selection so the first selection validation can detect changes that occurred after page load.

## API contracts and tampering

POST /api/checkout accepts only:

- selectedAddressId
- opaque expectedRevision

The parser rejects all other fields, including customer ID, Cart ID, product ID, variant ID, quantity, price, subtotal, total, discount, tax, shipping, currency and availability.

Revision fields must be exactly three SHA-256 hex strings. The revision is a comparison token only and never an amount or business authority.

Checkout DTOs contain storefront-safe customer/address/cart data and do not expose persistence objects or credentials.

## Privacy, cache and SEO

Checkout page rendering is force-dynamic with revalidate = 0 and private non-indexable metadata.

Checkout API responses use:

Cache-Control: private, no-store, max-age=0

plus Pragma: no-cache and Vary: Cookie, Authorization.

No Checkout data is put into query strings. Address data is not placed in page metadata. No public structured data or sitemap entry is introduced.

## Payment boundary

Current Checkout exposes a payment readiness flag with PAYMENT_NOT_IMPLEMENTED. The current UI does not collect credentials or simulate success.

The future Phase 11 payment layer must consume server-derived Checkout state, including:

- authenticated customer context
- validated Checkout reference/state
- authoritative amount
- authoritative currency
- validated Cart context
- validated address context where required

Payment must not accept browser-provided totals.

No card number, CVV, UPI credential, bank credential, payment-provider secret, or simulated payment token is collected by Checkout.

## Idempotency and side effects

Checkout validation is read-only and safe to retry. It does not create Cart items, modify pricing, reserve inventory, create payment records, or create orders.

Future Payment/Order phases own payment/order idempotency keys and transaction semantics.

## Error and observability safety

Public API errors use stable safe messages. Internal database/ORM errors are not returned to clients.

Existing Checkout observability records operation, classification, duration and safe error codes. Address contents, phone numbers, payment credentials and complete sensitive payloads are not logged by Checkout.

## Performance audit

Checkout uses the existing Cart application rather than adding a parallel pricing path. The Cart service resolves Cart lines in parallel and computes the subtotal with Decimal arithmetic.

No shared caching was added for private Checkout data.

The current line-resolution path can perform catalog/availability work per Cart line; this is existing Cart architecture and was not duplicated or widened by Phase 10.6. Any future batching should be addressed at the Cart/Catalog boundary rather than by duplicating those rules in Checkout.

## Accessibility and responsive requirements

The Checkout UI uses semantic headings, labels, native radio controls, form associations, live/async states, disabled controls during validation, visible focus styling from the existing component system, and non-color validation messaging.

The responsive design uses the existing Checkout grid, card, input and button primitives and avoids unrelated visual systems.

Browser validation is required for the specified Phase 10.6 release gate at 320, 375, 390, 640, 768, 1024, 1280, 1440 and 1920px, including keyboard navigation and realistic Cart → Checkout flow.

## Bauhaus compliance

Checkout continues using the existing design tokens and primitives: approved colors, Outfit typography, hard borders, hard-offset shadows, approved radius rules, geometric composition, Button/Card/Input components and existing focus behavior.

No gradients, glass effects, soft shadows or unrelated styling were introduced.

## Test coverage

Automated coverage includes:

- authenticated identity derivation
- safe login return target
- Cart ownership boundary
- address ownership and IDOR rejection
- deleted/missing addresses
- product/variant availability states
- quantity validation
- authoritative price consistency
- currency consistency
- server totals
- stale pricing/Cart revisions
- request tampering rejection
- malformed revisions
- safe error mapping
- private/no-store API behavior
- Checkout UI boundary and state coverage
- absence of payment implementation

## CI/build validation

Phase 10.5's latest CI run was green for Test, Lint, Typecheck and Build. Phase 10.6 must rerun the same pipeline after its changes and inspect all failures rather than weakening tests or configuration.

## Known limitation / release gate

The available repository automation does not replace real browser validation. Phase 10.6 cannot be declared ready until the required browser smoke, responsive and keyboard checks have actually been completed.

## Deferred

Explicitly deferred:

- Razorpay
- PayU
- Stripe
- payment intents
- payment transactions
- orders
- shipping
- fulfillment
- inventory reservation
- Wishlist

## Phase 11 handoff

The Checkout boundary is intended to hand only validated server state to Payment. Phase 11 must not trust browser totals, currency, customer identity, Cart identity, inventory state or address ownership as payment authority.
