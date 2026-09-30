# Phase 8.6 — Cart Final Hardening, Integration & Readiness Audit

## Scope

This audit covers the Cart implementation delivered through Phases 8.1–8.5 and the Product Detail → Cart integration. No Wishlist, Checkout, Payments, Orders, Shipping, Fulfillment, Reviews, inventory reservation, provider-specific commerce logic, or storefront redesign was introduced.

## Final architecture

`Product Detail`
→ canonical purchase selection
→ `/api/cart`
→ Cart application boundary
→ Cart domain service
→ catalog query/repository authority
→ Cart repository
→ PostgreSQL

The UI has no direct ORM/database access. API handlers delegate request parsing and execution to the application boundary. Persistence operations remain in the Cart repository. Business rules remain in the Cart service. Product, variant, lifecycle, availability, and current price remain catalog authorities.

## Persistence validation

- `Cart` and `CartItem` use UUID primary/foreign keys.
- Cart deletion cascades to CartItems.
- Product and ProductVariant deletion are restricted while referenced by a CartItem.
- Quantity has both application validation and a database `CHECK (quantity > 0)`.
- Partial unique indexes prevent duplicate product-only and product+variant logical lines within a Cart.
- CartItem indexes cover cart, product, variant, and combined lookup.
- Serializable transaction boundaries are used for Cart mutations.
- No owner column is invented because no supported identity/session mechanism exists in the current repository.

## Ownership and security

All supported Cart application paths require a server-side request context containing Cart identity and owner context. The current resolver fails closed with `CART_OWNERSHIP_UNAVAILABLE`; it never accepts a client-supplied owner or exposes a way to forge ownership.

The domain service also authorizes every read/mutation and checks CartItem-to-Cart association before mutation. Malformed UUIDs, quantities, unexpected request fields, and oversized request bodies are rejected.

This is a deliberate safety boundary, not anonymous Cart access.

## Service validation

The service validates:

- Product existence and published lifecycle.
- ProductVariant existence and relationship to the Product.
- Positive integer quantities.
- Current availability.
- Cumulative quantity when adding an existing logical line.
- Current authoritative catalog price.
- Cart ownership before reads and mutations.
- Cross-Cart CartItem isolation.
- Serializable mutation conflicts with bounded retry.

Stale lines remain represented rather than being silently destroyed.

## Price authority

The browser sends only `productId`, `variantId`, and quantity for Product Detail → Cart. It cannot submit authoritative prices, totals, discounts, taxes, or shipping charges.

Cart line prices and subtotals are derived server-side from canonical catalog data. Cart subtotal is derived from available authoritative lines. A later catalog price change is reflected when the Cart is resolved again.

Checkout pricing is not implemented.

## Availability

New additions and quantity increases are revalidated against current catalog availability. Existing stale lines are represented as:

- `PRODUCT_UNAVAILABLE`
- `VARIANT_UNAVAILABLE`
- `INSUFFICIENT_AVAILABILITY`

Cart does not reserve or decrement inventory and does not contact fulfillment providers.

## API/application boundary

Routes are limited to:

- `GET /api/cart`
- `POST /api/cart`
- `DELETE /api/cart`
- `PATCH /api/cart/items/:cartItemId`
- `DELETE /api/cart/items/:cartItemId`

Request bodies have strict allowlists, UUID validation, quantity bounds, JSON parsing, and a 64 KiB body limit. Responses expose client-safe DTOs only. ORM objects, database internals, ownership/session internals, provider credentials, and stack traces are not returned.

Known domain failures map to stable HTTP statuses; unexpected failures return a generic 500 response.

## Storefront Cart

`/cart` is dynamic and private. It renders server-confirmed product information, variant information, current price, line subtotal, Cart subtotal, availability states, quantity controls, remove, clear, loading/error states, and an empty state.

The client does not calculate authoritative commerce values and does not persist Cart data in localStorage/sessionStorage or URLs.

Mutation response versioning prevents an older network response from overwriting newer UI state. Pending controls prevent repeated interactions for the same active mutation.

## Product Detail → Cart

The existing canonical selection engine remains authoritative for variant selection. The CTA sends only the minimal purchase selection to the Cart API. Server validation repeats product, variant, lifecycle, quantity, availability, ownership, and price checks.

The PDP was not redesigned and no downstream commerce behavior was added.

## Concurrency and stale data

Serializable Cart mutation transactions plus bounded conflict retry protect duplicate logical-line updates and concurrent mutations. The UI uses request-version guards for stale response protection.

Product publication changes, variant availability changes, variant removal, and price changes are re-evaluated through the Cart service when the Cart is resolved. Stale lines are not silently deleted.

## Cache and privacy

Cart API responses use:

- `Cache-Control: private, no-store, max-age=0`
- `Pragma: no-cache`
- `Vary: Cookie, Authorization`

The Cart page is force-dynamic, disables revalidation, and is marked `noindex, nofollow, noarchive`. Cart content is therefore not intended for public indexing or shared caching.

## SEO

The Cart route is excluded from indexing intent. No public Cart structured data or product structured data is generated by the Cart surface.

Sitemap integration was not expanded with Cart content.

## Accessibility and responsive behavior

The Cart reuses the established UI primitives and Bauhaus tokens. It includes semantic headings/sections, accessible labels, keyboard-operable controls, focus-visible styling through existing primitives, dynamic busy states, image alternatives, recoverable errors, and touch-sized controls.

The implementation is mobile-first with responsive item layout and a desktop summary column. No gradients, glassmorphism, soft shadows, generic rounded-card styling, or unrelated visual redesign was introduced.

## Performance

The Cart uses a single initial client GET and mutation responses become the next authoritative client state. There is no polling, local persistence, mini-cart, or duplicate intentional refresh after a successful mutation.

Catalog resolution remains the existing provider-neutral catalog boundary. No speculative caching layer or new infrastructure was introduced.

A full runtime N+1/database profiling pass remains a local/CI validation task because the available repository integration cannot execute the application's PostgreSQL environment.

## Error handling and observability

Validation, ownership, domain, persistence, and unexpected failures have distinct error classification paths. Customer-facing responses avoid stack traces and sensitive internals. Cart diagnostics contain operation, classification, duration, and safe error code only.

No passwords, tokens, payment information, customer-sensitive ownership payloads, or provider credentials are logged.

## Cross-surface regression

The Cart changes are isolated to Cart and the direct Product Detail → Cart handoff. Existing catalog discovery surfaces remain provider-neutral and continue to use canonical catalog routes/services. Existing downstream commerce surfaces remain intentionally absent.

## Tests and validation status

Static regression coverage exists for:

- Cart persistence constraints.
- Cart service ownership and mutation behavior.
- Price authority and server-side subtotals.
- Availability and stale-line behavior.
- Cart API validation and safe error contracts.
- Private/dynamic Cart rendering.
- Client-safe DTO boundaries.
- Product Detail → Cart handoff.
- Navigation and downstream-commerce exclusions.

The GitHub integration reports no CI status checks for the current commit. Local PostgreSQL execution, browser/E2E execution, lint, typecheck, full test execution, and production build were not executable through the available repository integration. They must not be represented as passed.

## Remaining blocker

The repository still has no supported customer/session identity mechanism. The Cart request-context resolver therefore fails closed rather than inventing anonymous or client-controlled ownership.

Because a production Cart cannot safely establish or verify ownership without that identity boundary, the complete Cart system is not production-ready for the next commerce phase.

This blocker is outside the current Cart-only hardening boundary unless an existing supported identity mechanism is introduced. No authentication/session system was invented in Phase 8.6.

## Downstream boundary

The hardened boundary remains:

`Cart`
→ Future Checkout
→ Future Payment
→ Future Order
→ Future Fulfillment/Shipping

Cart does not reserve inventory, create orders, process payments, calculate unsupported checkout taxes, create shipments, or call fulfillment providers.

## Final readiness decision

**NOT READY FOR PHASE 9**
