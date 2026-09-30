# Phase 8.1 — Cart & Wishlist Architecture Audit

## Status

Phase 8.1 architecture audit completed against the current `main` branch of `gaje9dra/4hrs-`.

This phase intentionally does not implement Cart, Wishlist, authentication, checkout, payments, orders, shipping, fulfillment, or inventory reservation.

## 1. Current commerce architecture

The current commerce boundary is:

`Product Detail → Purchase Intent → Future Cart → Future Checkout → Future Order`

The Product Detail route remains server-first and delegates product resolution through the storefront/catalog service and repository layers. Storefront components do not own persistence.

The current purchase-selection contract is exactly:

- `productId`
- `variantId`
- `quantity`

The existing selection builder fixes quantity to 1 and returns no selection unless the product/variant selection is internally valid. No price, total, inventory quantity, SKU, provider identifier, payment, shipping, or reservation field is included.

This is the correct provider-neutral handoff for a future Cart boundary.

### Authority

The client must never become authoritative for:

- price
- availability
- product ownership
- variant ownership
- inventory
- totals

The current PDP uses catalog-derived values for presentation and selection. Future Cart mutations must independently resolve the canonical Product and ProductVariant and revalidate all commerce-critical state.

## 2. Cart boundary

The future Cart architecture should remain:

`Cart UI → Cart Application/Service → Cart Repository → Database`

The Cart service should own:

- request-level validation
- ownership resolution
- product/variant validation
- current catalog/price resolution
- availability validation
- quantity validation
- deterministic line/subtotal calculation
- orchestration of repository mutations

The Cart repository should own:

- Cart persistence
- Cart item persistence
- transactional reads/writes
- database-level uniqueness and referential integrity

Storefront components must not access Prisma directly.

Future integration remains:

`Cart → Checkout → Payment → Order`

Checkout, payment, order, shipping, and fulfillment remain outside Phase 8.1.

No unsupported tax, discount, shipping, or payment rules are invented here.

## 3. Cart item contract

The minimum future Cart item reference is:

- product reference
- variant reference
- quantity

Product and variant descriptive data must be resolved from the canonical catalog rather than copied as authoritative Cart state.

The future implementation must validate:

1. Product exists.
2. Product is currently purchasable/published according to the established catalog lifecycle.
3. Variant exists.
4. Variant belongs to the referenced Product.
5. Variant is currently active.
6. Current price is resolved server-side.
7. Current availability is resolved server-side.
8. Quantity satisfies future quantity constraints.
9. Inventory reservation is not performed merely by Cart insertion.

## 4. Cart ownership readiness

The current repository contains no Customer model, authentication system, account pages, or session/customer ownership model.

Therefore:

- authenticated-customer Cart ownership is not currently implemented;
- anonymous/session Cart ownership is not currently implemented;
- anonymous-to-authenticated Cart migration/merge is not currently implemented;
- no client-provided ownership identifier can currently be trusted.

Ownership resolution should eventually live at the Cart application/service boundary, using server-derived request identity/session/customer context.

The future Cart API must never accept a customer ID or ownership identifier as authoritative merely because it was supplied by the client.

Phase 8.1 does not introduce authentication or session persistence.

## 5. Wishlist boundary

The future Wishlist architecture should be:

`Wishlist UI → Wishlist Application/Service → Wishlist Repository → Database`

Wishlist entries should reference canonical catalog identity.

The future service must handle:

- canonical product identity
- variant identity only if the final product model requires variant-specific wishlist semantics
- duplicate prevention
- ownership resolution
- lifecycle-aware reads
- removal/mutation validation

The Wishlist repository should own persistence and database-level uniqueness.

No Wishlist table, API, route, UI, or business logic is created in this phase.

## 6. Catalog integration

The current Prisma schema establishes:

- `Product` as the canonical catalog entity;
- `ProductVariant` as the canonical purchasable variant;
- Product → ProductVariant as a foreign-key relationship;
- Decimal persistence for product and variant prices;
- inventory associated with ProductVariant.

Future Cart/Wishlist models must reference these canonical entities rather than duplicating:

- title
- description
- media
- price
- inventory
- publication state

The existing catalog service/repository boundary is the required resolution path.

Provider metadata remains outside the public catalog contract. Qikink or any other fulfillment/provider integration must not become a Cart or Wishlist dependency.

## 7. Price and availability authority

The current catalog architecture already provides canonical price and availability information for storefront presentation.

Future Cart operations must revalidate at mutation time:

- Product existence
- Product publication/lifecycle state
- ProductVariant existence
- ProductVariant → Product ownership
- ProductVariant active state
- effective current price
- current availability
- quantity constraints

The future Cart must reject or safely re-resolve:

- client-submitted price
- client-submitted totals
- client-submitted inventory
- client-submitted provider information

No inventory reservation belongs in Phase 8.1.

## 8. Totals boundary

The conceptual calculation pipeline is:

`Line Item Data → Pricing Resolution → Subtotal → Future Discounts → Future Tax → Future Shipping → Final Checkout Total`

Cart responsibility should be limited to authoritative line-item state and the subtotal information supported by the established architecture.

Checkout should own final transaction-specific calculations that depend on:

- discounts
- tax
- shipping
- payment context
- final order total

No discount, tax, shipping, or payment calculation is introduced by this audit.

## 9. Cart merge and concurrency readiness

Future Cart implementation must define behavior for:

- duplicate product/variant additions
- quantity updates
- simultaneous mutations
- stale catalog data
- stale availability
- concurrent requests
- anonymous-to-authenticated migration
- idempotent mutations

Database mutation boundaries should eventually be transactional.

The final implementation should use database uniqueness constraints for duplicate CartItem identity and transaction boundaries for read/validate/write operations where concurrent changes can otherwise produce inconsistent state.

No concurrency mechanism is implemented here.

## 10. Wishlist lifecycle

The current catalog lifecycle includes active, draft/archived product states and active/inactive variants.

Future Wishlist reads/mutations must not assume that a stored reference remains publicly purchasable forever.

The architecture should distinguish:

- unpublished product
- deleted product/reference no longer resolvable
- deleted/inactive variant
- unavailable variant
- changed product slug
- changed price

Wishlist identity should remain based on stable canonical IDs rather than slugs, so a changed slug does not invalidate identity.

Customer-facing treatment of unavailable/deleted items remains a Phase 8 implementation/product requirement and is not invented here.

## 11. Route and UI readiness

Current storefront routing contains the established homepage, shop, category, collection, search, and product surfaces.

There are currently no Cart or Wishlist routes, which is correct for Phase 8.1.

The shared layout already provides reusable:

- header
- desktop navigation
- utility navigation
- mobile navigation
- container/grid/layout primitives

These provide appropriate future integration points without requiring commerce state in the global shell.

No `/cart`, `/wishlist`, badges, placeholders, or commerce UI were added.

## 12. Server/client boundaries

Future client responsibilities:

- interaction
- temporary UI state
- selection state
- safe optimistic presentation where appropriate

Future server responsibilities:

- ownership
- persistence
- authorization
- catalog validation
- price authority
- availability authority
- quantity validation
- business rules
- authoritative totals

Authoritative Cart/Wishlist logic must not be moved into client components.

## 13. Security boundary

Future Cart/Wishlist endpoints must defend against:

- unauthorized Cart access
- unauthorized Wishlist access
- forged Product IDs
- forged Variant IDs
- cross-product Product/Variant combinations
- quantity abuse
- price tampering
- ownership tampering
- enumeration
- malformed requests
- replay/double mutation
- excessive mutation requests

Validation must occur at the server application boundary and again at persistence boundaries where database constraints are appropriate.

No authentication is added in Phase 8.1.

## 14. Future data model readiness

The existing database uses UUID primary keys and foreign-key relationships throughout the catalog.

Conceptual future entities:

- Cart
- CartItem
- Wishlist
- WishlistItem

A future Cart model should contain server-derived ownership/session identity and timestamps, with CartItem referencing canonical Product and ProductVariant identity.

A future Wishlist model should contain server-derived ownership identity and timestamps, with WishlistItem referencing canonical Product identity and enforcing duplicate prevention at the database level.

The existing Product/ProductVariant foreign-key strategy is suitable for future references.

Customer/session ownership is the principal missing dependency.

No tables or migrations are created by Phase 8.1.

## 15. Service and repository boundaries

Future code should conceptually reside behind feature boundaries such as:

- Cart service
- Cart repository
- Wishlist service
- Wishlist repository
- catalog validation/resolution
- pricing resolution
- ownership resolution

The Cart/Wishlist services should orchestrate existing catalog services instead of duplicating catalog queries.

Storefront components must remain unaware of Prisma and database persistence.

No feature service or repository is implemented in Phase 8.1.

## 16. API contract readiness

Future operations identified by this audit are:

Cart:

- add item
- update quantity
- remove item
- clear cart
- fetch cart

Wishlist:

- add item
- remove item
- fetch wishlist

The exact HTTP methods and payload contracts should follow the project's eventual application/API convention rather than being invented in this audit.

Every mutation must perform server-side ownership and catalog validation.

No endpoints are created.

## 17. Observability readiness

Future diagnostic categories should include:

- invalid Cart item
- unavailable variant
- price mismatch
- ownership failure
- Cart mutation failure
- Wishlist mutation failure
- stale catalog reference
- database failure

Logs must not contain:

- authentication secrets
- payment information
- sensitive customer data
- provider credentials

The existing catalog observability pattern can remain the foundation; a separate logging platform is not required by this phase.

No new logging infrastructure is added.

## 18. Performance readiness

Future implementation must avoid:

- N+1 catalog lookups
- repeated price resolution for identical references
- duplicate database queries
- oversized Cart payloads
- unnecessary client hydration
- repeated Wishlist lookups
- missing database uniqueness constraints
- excessive mutation requests

Cart reads should resolve referenced catalog data efficiently and avoid per-item query loops.

Database constraints should enforce duplicate prevention rather than relying exclusively on application checks.

No speculative caching or performance infrastructure is introduced.

## 19. Cross-surface regression

The established discovery flow remains:

`Homepage → Shop → Category → Collection → Search → Product → Purchase Intent`

The Product Detail purchase selection remains provider-neutral and contains only:

`productId + variantId + quantity`

No Cart or Wishlist coupling was added to the existing discovery surfaces.

No storefront redesign was introduced.

## 20. Testing and validation

### Source-level validation

Verified through repository inspection:

- Product Detail remains independent of Cart persistence.
- Purchase selection contains the required three-field handoff.
- Catalog services/repositories remain the server-side catalog boundary.
- ProductVariant belongs to Product through the existing database relation.
- Price uses Decimal persistence.
- Inventory is associated with ProductVariant.
- No Customer/authentication/session ownership model exists.
- No Cart/Wishlist models, routes, APIs, or UI exist.
- Existing shared layout primitives remain reusable.
- Existing tests cover catalog, search, listing, homepage, storefront shell, and Product Detail areas.

### Runtime validation

The following required Phase 8.1 checks could not be executed in the available environment:

- `npm run lint`
- `npm run typecheck`
- `npm test`
- integration/database tests
- `npm run build`
- browser smoke tests
- responsive viewport validation

The local container cannot reach GitHub to obtain a runnable checkout. The repository also currently has no GitHub Actions status checks available for the current head.

Therefore no runtime command is represented as passed without execution.

## 21. Known blockers

### Blocker 1 — Runtime validation unavailable

The Phase 8.1 specification requires lint, typecheck, tests, build, and browser smoke validation.

Those gates cannot be truthfully marked passed from the current environment.

### Blocker 2 — Customer/session ownership does not yet exist

The current architecture has no Customer, authentication, or session ownership model.

This is not a defect introduced by Phase 8.1 and must not be invented here. Phase 8.2+ implementation must establish the ownership contract before persistent Cart/Wishlist behavior can safely depend on it.

## 22. Phase 8.2 recommendations

Before implementing Cart/Wishlist:

1. Establish the project's supported server-side ownership/session contract.
2. Define whether anonymous carts are supported.
3. Define anonymous-to-authenticated merge behavior if both modes are supported.
4. Add Cart/Wishlist persistence only after ownership semantics are explicit.
5. Enforce Product/Variant referential integrity and duplicate constraints at the database layer.
6. Keep price and availability resolution behind existing catalog/service boundaries.
7. Keep Cart totals separate from future Checkout-only calculations.
8. Implement transactional/idempotent mutation boundaries.
9. Add endpoint authorization and malformed-input validation.
10. Add Cart/Wishlist-specific unit/integration coverage before enabling storefront mutations.
11. Execute lint, typecheck, tests, build, and browser smoke validation before production certification.

## 23. Scope confirmation

No Cart implementation was added.

No Wishlist implementation was added.

No Cart/Wishlist database tables were added.

No Cart/Wishlist APIs were added.

No `/cart` or `/wishlist` pages were added.

No authentication was added.

No checkout, payment, order, shipping, fulfillment, review, or inventory reservation implementation was added.

No provider-specific Cart/Wishlist dependency was added.

## Final readiness decision

NOT READY FOR PHASE 8.2
