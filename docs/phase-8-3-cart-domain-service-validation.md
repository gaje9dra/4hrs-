# Phase 8.3 — Cart Domain Service, Validation & Business Logic

## Status
Implemented the Cart domain/service boundary above the Phase 8.2 persistence foundation.

This phase does not implement /cart, Cart UI, Cart API routes, Wishlist, Authentication, Checkout, Payments, Orders, Shipping, Fulfillment, Inventory Reservation, Reviews, or provider-specific commerce logic.

## 1. Service architecture
The canonical boundary is:
Future Storefront/API → Cart Service → Catalog Query/Repository → Cart Repository → Database

The Cart service owns input validation, ownership authorization, Product/ProductVariant purchase validation, quantity rules, availability checks, duplicate logical-item behavior, current catalog price resolution, Cart domain views, server-side subtotals, stale Cart line-state decisions, and mutation orchestration.

The Cart repository remains persistence-oriented. A public Cart UI/API must not call Prisma or the Cart repository directly.

## 2. Ownership boundary
Phase 8.2 intentionally did not add a Cart owner column because the project had no supported Customer/session identity mechanism.

Phase 8.3 therefore does not invent authentication, a fake owner ID, a browser identifier, or a second identity system.

The service exposes an injectable CartOwnershipBoundary with authorizeCartAccess(cartId, owner) and authorizeCartCreation(owner). The default implementation fails closed with CART_OWNERSHIP_UNAVAILABLE.

This means no customer-facing Cart operation can accidentally become an IDOR surface while authentication/session infrastructure is absent.

The owner value is opaque to the Cart domain. The future identity/session layer is responsible for deriving it from trusted server-side context.

Before Phase 8.4, the project must provide a supported ownership mechanism and bind newly created Cart IDs to that owner.

## 3. Add-item contract
The domain input is intentionally limited to productId, optional variantId, and quantity.

The service never accepts price, subtotal, total, title, description, inventory, provider ID, provider SKU, fulfillment information, or client ownership.

The server resolves all authoritative commerce data.

## 4. Product and Variant validation
For each mutation the service resolves the canonical Product through the catalog repository and then resolves its published storefront representation through the existing Catalog Query Service.

The service verifies Product existence, public purchasability, active lifecycle, Variant validity and ownership by Product, current availability, and valid quantity.

A variant ID is never trusted merely because a database row exists.

## 5. Price authority
Cart mutations never accept client price information.

Current effective price is resolved from the canonical catalog: Product price when no Variant override exists, otherwise ProductVariant price.

The Cart persistence model contains no price snapshot. The Cart domain view calculates line subtotal and Cart subtotal from current server-resolved prices. Checkout price revalidation remains outside this phase.

## 6. Availability
The service validates availability before adding, increasing, or updating quantity.

Tracked inventory uses the catalog's current available quantity. Untracked inventory remains available without an arbitrary service-imposed maximum.

No inventory is reserved or decremented.

If current availability is lower than requested quantity, the mutation fails with INSUFFICIENT_AVAILABILITY. A Cart read can also return an existing line as INSUFFICIENT_AVAILABILITY when availability has fallen below its stored quantity.

## 7. Quantity rules
Quantity validation is centralized in lib/cart/validation.ts.

The service requires a number, an integer, and a value greater than zero. No arbitrary maximum was invented because the project does not define one.

When adding to an existing logical CartItem, the service validates cumulative quantity against current availability.

## 8. Duplicate item behavior
Phase 8.2 database constraints remain authoritative for logical identity.

The service treats same Cart + same Product + same nullable Variant identity as one logical item.

Adding an existing logical item increases its quantity instead of creating a second CartItem.

The mutation uses the repository transaction boundary and retries database conflict conditions where practical.

## 9. Update quantity
updateItemQuantity validates ownership, CartItem identity, Cart membership, current Product/Variant state, current availability, and then updates only quantity inside the transaction boundary.

Product ID, Variant ID, price, and provider data cannot be modified through this operation.

## 10. Remove item
removeItem verifies Cart ownership and existence, confirms that the CartItem belongs to that Cart, and deletes only through the repository.

Removing an already-removed item is deterministic and returns removed=false. No catalog, inventory, checkout, or order side effects occur.

## 11. Clear Cart
clearCart requires authorized ownership, verifies Cart existence, deletes only CartItems belonging to that Cart through a transaction, and returns the removed-item count.

## 12. Cart domain view
getCart returns a domain-level DTO rather than Prisma records.

A line can expose CartItem ID, Product ID, Variant ID, quantity, line state, current Product identity/title/slug/media, current Variant identity, current effective price, currency, availability quantity, and server-calculated line subtotal.

It does not expose provider credentials, provider identifiers, internal database metadata, or ownership secrets.

## 13. Totals
Implemented only line-item subtotal and Cart subtotal. Both are calculated server-side with Prisma Decimal arithmetic from current authoritative prices.

Tax, shipping, payment fees, discounts, coupons, and checkout totals remain outside Phase 8.3.

## 14. Stale Cart behavior
CartItems are not silently deleted or rewritten when catalog state changes.

Supported line states are AVAILABLE, PRODUCT_UNAVAILABLE, VARIANT_UNAVAILABLE, and INSUFFICIENT_AVAILABILITY.

An unpublished Product becomes PRODUCT_UNAVAILABLE; an invalidated Variant becomes VARIANT_UNAVAILABLE; a quantity above current availability becomes INSUFFICIENT_AVAILABILITY.

No price snapshot exists, so a catalog price change is represented by the current authoritative price. Final checkout price validation remains a later phase.

## 15. Transactions and concurrency
Mutating Cart operations use the repository's interactive transaction boundary with PostgreSQL Serializable isolation.

Phase 8.2 unique indexes remain the database backstop for duplicate logical CartItems. The service retries transient unique/write-conflict conditions for rapid concurrent mutations.

No checkout lock or inventory reservation lock was introduced.

## 16. Idempotency
Repeated add requests intentionally increase quantity; repeated remove requests do not delete unrelated records; clear is naturally repeatable.

A distributed request-id idempotency framework was not introduced because the existing architecture does not require one. A future API layer may add request-level idempotency if its transport semantics require it.

## 17. Error model
Created CartServiceError with stable machine-readable codes including CART_NOT_FOUND, CART_OWNERSHIP_UNAVAILABLE, CART_UNAUTHORIZED, CART_ITEM_NOT_FOUND, PRODUCT_NOT_FOUND, PRODUCT_UNAVAILABLE, VARIANT_NOT_FOUND, INVALID_VARIANT, INVALID_QUANTITY, INSUFFICIENT_AVAILABILITY, INVALID_CART_STATE, CART_ITEM_CONFLICT, INVALID_CART_INPUT, and CART_DATABASE_ERROR.

Raw Prisma persistence errors are not returned as the service contract. Sensitive database details are not placed in user-facing messages.

## 18. Service/repository separation
Cart Service owns domain decisions, authorization, catalog validation, price/availability authority, quantity behavior, stale-line decisions, totals, and safe error mapping.

Cart Repository owns persistence operations and transaction orchestration.

Catalog remains the canonical source of Product/ProductVariant lifecycle, published state, effective price, media, option selection, and availability.

No catalog data is copied into Cart persistence.

## 19. Security
The service guards against IDOR/cross-Cart access, forged Cart IDs, CartItem substitution across Carts, invalid quantities, client price manipulation, Product/Variant mismatch, unauthorized mutation, malformed input, and raw persistence error leakage.

The fail-closed ownership boundary is especially important: without a supported server-side identity mechanism, a client-supplied string is not treated as proof of ownership.

## 20. Performance
The service avoids speculative caching and keeps catalog resolution server-side through the existing canonical catalog query path.

Current Cart reads resolve catalog state per CartItem through canonical services. This is correct for the current phase but remains a future optimization target if large Carts require batch catalog resolution.

No N+1 workaround was added by duplicating catalog business logic into Cart.

## 21. Observability
Added a small Cart observation boundary recording operation, failure classification, duration, and safe domain error code.

It does not log passwords, tokens, payment information, provider credentials, sensitive customer data, or raw full request payloads.

No separate logging framework was introduced.

## 22. Testing
Added tests/cart-domain-service.test.ts covering fail-closed ownership, valid add, duplicate logical-item quantity accumulation, invalid quantity, invalid Variant, insufficient availability, cross-Cart authorization failure, authoritative current price, line subtotal, Cart subtotal, deterministic remove, clear Cart, and stale Product publication state.

Phase 8.2 persistence tests remain in place.

Checkout, Payments, Orders, Shipping, Fulfillment, Inventory Reservation, and Wishlist are not tested because they are explicitly outside Phase 8.3 scope.

## 23. Runtime regression validation
The repository's required validation commands remain npm run lint, npm run typecheck, npm test, and npm run build.

The GitHub connector used for this implementation cannot execute the repository against a checked-out PostgreSQL environment. Therefore runtime lint, typecheck, integration tests, and build are not claimed as passed.

## 24. Known limitations
Ownership is still unavailable. The repository has no supported authentication/session mechanism and the Phase 8.2 Cart schema has no owner relation. The service therefore fails closed unless a trusted ownership boundary is explicitly injected.

Cart creation ownership binding is deferred. The ownership boundary must eventually atomically bind a newly created Cart to the trusted customer/session identity; that mechanism cannot be invented inside Phase 8.3.

Runtime validation is pending in a local environment with the repository, dependencies, generated Prisma client, migrations, and PostgreSQL database.

Batch catalog resolution is deferred. A future performance phase can introduce a canonical batch query without moving catalog business rules into Cart.

## 25. Phase 8.4 prerequisites
1. Implement the project's supported authentication/session identity mechanism.
2. Define trusted anonymous-session semantics if anonymous Carts are supported.
3. Add a durable Cart ownership binding compatible with the supported identity mechanism.
4. Wire the existing ownership boundary into that identity mechanism.
5. Run Prisma generation and apply all migrations locally.
6. Run Cart persistence and domain-service integration tests against PostgreSQL.
7. Run lint, typecheck, full tests, and build.
8. Validate concurrent add/update behavior against PostgreSQL.
9. Keep current catalog price and availability authoritative.
10. Build Cart API/UI only after the service contract and ownership boundary are production-ready.

## 26. Scope confirmation
Implemented: Cart domain service; centralized Cart input validation; structured Cart domain errors; ownership boundary with fail-closed default; add-item; duplicate-item quantity behavior; update quantity; remove; clear; Cart domain view; server-side subtotals; Product/Variant validation; current price authority; availability validation; stale Cart line states; serializable transaction orchestration; conflict retry handling; safe Cart observability; domain-service tests; and this documentation.

Not implemented: /cart; Cart UI; Cart API routes; Wishlist; Authentication; Checkout; Payments; Orders; Shipping; Fulfillment; Inventory Reservation; Reviews; provider-specific commerce logic.

## Final readiness decision
NOT READY FOR PHASE 8.4