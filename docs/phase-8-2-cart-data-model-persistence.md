# Phase 8.2 — Cart Data Model & Persistence

## Status

Implemented the Cart persistence foundation defined by Phase 8.2.

This phase deliberately does not implement Cart UI, `/cart`, Cart APIs, Wishlist, authentication, Checkout, Payments, Orders, Shipping, Fulfillment, Inventory Reservation, or provider-specific commerce logic.

## 1. Cart schema

The canonical `Cart` entity contains only:

- `id`: UUID primary key
- `createdAt`
- `updatedAt`
- `items` relation

No status/lifecycle enum was added because Phase 8.1 did not establish a required Cart lifecycle.

No expiration/session metadata was added because the repository has no supported session mechanism.

### Ownership limitation

The repository currently has only an authentication boundary placeholder and no Customer or session identity implementation. Phase 8.2 therefore does not invent an ownership key, fake customer ID, or second identity system.

This means Cart records are persistence containers only at this phase. The Cart service layer must establish server-derived ownership before exposing Cart records to a customer-facing workflow.

## 2. CartItem schema

The canonical `CartItem` entity contains:

- `id`: UUID primary key
- `cartId`: Cart foreign key
- `productId`: canonical Product foreign key
- `variantId`: nullable canonical ProductVariant foreign key
- `quantity`: positive integer
- `createdAt`
- `updatedAt`

No product title, description, image, category, provider, inventory quantity, price, subtotal, discount, tax, shipping, or payment data is duplicated.

## 3. Product and Variant relationships

CartItem references the existing canonical catalog entities.

### Product

`CartItem.productId → Product.id`

The relationship uses restrictive deletion behavior so an active CartItem cannot silently lose its canonical Product reference.

### Variant

`CartItem.variantId → ProductVariant.id`

The relationship is nullable because the current catalog supports product-level pricing as well as variant-level pricing.

When a variant is present, the future Cart service must validate that the variant belongs to the referenced Product. The database stores both canonical references and does not invent a cross-product variant relationship.

Variant deletion is restricted while referenced by a CartItem.

## 4. Price snapshot decision

No price snapshot is stored.

The current catalog already provides authoritative Product/ProductVariant price data, while Phase 8.1 requires future Cart mutations to resolve current pricing server-side.

Therefore:

- CartItem does not store a client-controlled price.
- CartItem does not store a historical price snapshot.
- Future Cart service logic must resolve current catalog pricing.
- Future Checkout must revalidate current pricing before final transaction creation.

## 5. Duplicate CartItem prevention

PostgreSQL nullable-column uniqueness requires two partial unique indexes.

### Product-only item

`(cartId, productId) WHERE variantId IS NULL`

This prevents duplicate product-only CartItems.

### Variant-specific item

`(cartId, productId, variantId) WHERE variantId IS NOT NULL`

This prevents duplicate variant-specific CartItems.

Application-level duplicate checks are therefore not the sole integrity mechanism.

## 6. Quantity integrity

The database migration adds:

`CHECK (quantity > 0)`

The repository also rejects non-integer or non-positive quantities before persistence.

No arbitrary maximum quantity was added because the existing requirements do not define one.

Database integrity and future service-level business validation remain separate.

## 7. Indexes

Implemented indexes are limited to concrete persistence access patterns:

- CartItem → Cart
- CartItem → Product
- CartItem → Variant
- Cart/Product/Variant lookup supporting duplicate detection

The unique partial indexes additionally enforce logical CartItem identity.

No speculative Cart indexes were added.

## 8. Cascade and referential behavior

### Cart → CartItem

`ON DELETE CASCADE`

Deleting a Cart removes its dependent CartItems because they cannot exist independently.

### Product → CartItem

`ON DELETE RESTRICT`

A referenced Product cannot be destructively deleted through the database while CartItems still reference it.

### ProductVariant → CartItem

`ON DELETE RESTRICT`

A referenced ProductVariant cannot be destructively deleted while CartItems reference it.

This prevents catalog deletion from silently corrupting Cart persistence.

## 9. Migration

Created:

`prisma/migrations/20260930180000_cart_persistence_foundation/migration.sql`

The migration creates:

- Cart table
- CartItem table
- Cart foreign key
- Product foreign key
- ProductVariant foreign key
- quantity check
- required indexes
- product-only unique constraint
- variant-specific unique constraint

Existing migrations were not modified.

The migration follows the existing Prisma PostgreSQL migration structure.

## 10. ORM model

`prisma/schema.prisma` now includes:

- Cart
- CartItem
- Product → CartItem relation
- ProductVariant → CartItem relation

Generated Prisma artifacts were not manually edited.

The normal `prisma generate` process remains the source of generated ORM types.

## 11. Repository foundation

Created:

`lib/cart/repository.ts`

The repository is persistence-oriented and exposes primitives for:

- create Cart
- find Cart by ID
- create CartItem
- find CartItem by ID
- find CartItem by Cart/Product/Variant identity
- update CartItem quantity
- remove CartItem
- clear CartItems

The repository does not:

- expose HTTP behavior
- authorize ownership
- resolve customer identity
- resolve current price
- validate product publication
- validate Product/Variant ownership
- validate availability
- reserve inventory
- calculate checkout totals
- perform Cart merge
- implement UI

Authorization remains above the repository boundary.

## 12. Cart service boundary

No complete Cart service was implemented.

The future service boundary remains responsible for:

- server-derived ownership
- Product validation
- ProductVariant validation
- Product/Variant relationship validation
- quantity business rules
- duplicate mutation handling
- current price resolution
- availability validation
- transaction orchestration
- future idempotency behavior

The repository remains intentionally unaware of those domain decisions.

## 13. Transaction readiness

The persistence model supports future transactions for:

- add item
- quantity update
- remove item
- clear Cart
- Cart merge

No Cart merge or checkout conversion is implemented.

The Cart repository accepts a Prisma transaction client, allowing later service orchestration to execute repository operations inside a transaction without replacing the persistence architecture.

## 14. Security

The persistence foundation provides:

- UUID identifiers
- foreign-key integrity
- positive quantity enforcement
- duplicate prevention
- restrictive catalog deletion behavior

Ownership authorization is intentionally not implemented because no supported customer/session identity system exists.

The repository therefore must remain an internal persistence primitive and must not be exposed directly to untrusted callers.

Future Cart service/API layers must perform ownership authorization before calling repository operations.

## 15. Public vs internal data

Cart persistence remains an internal commerce concern.

The current phase does not expose:

- Cart database IDs to the storefront
- CartItem database IDs to the storefront
- provider IDs
- internal pricing metadata
- ownership identifiers

No public Cart DTO or API was introduced.

## 16. Observability

No new logging infrastructure was introduced.

Future Cart service diagnostics should distinguish:

- invalid Cart item
- duplicate Cart item
- invalid quantity
- unavailable catalog reference
- ownership failure
- persistence failure

Secrets, payment information, sensitive customer data, and provider credentials must not be logged.

## 17. Testing

Created:

`tests/cart-persistence-foundation.test.ts`

The test suite covers, when a database is configured:

- Cart creation
- CartItem creation
- Cart → CartItem relation
- CartItem → Product relation
- CartItem → Variant relation
- duplicate CartItem rejection
- positive quantity enforcement
- Cart item clearing
- Cart deletion behavior

A structural migration test verifies:

- product-only uniqueness
- variant-specific uniqueness
- quantity check
- CartItem cascade
- catalog restrictive deletion behavior

The database integration test is skipped when `DATABASE_URL` is not configured rather than pretending a persistence test passed.

## 18. Regression validation

The repository's existing validation commands are:

- `npm run lint`
- `npm run typecheck`
- `npm test`
- `npm run build`

The GitHub connector environment used for this implementation does not provide a runnable checked-out repository/database process, so these commands could not be executed here.

Accordingly, no runtime validation is claimed as passed.

Source-level changes were kept limited to:

- Prisma Cart persistence models
- Cart migration
- Cart repository
- Cart persistence tests
- Phase 8.2 documentation

No storefront/catalog behavior was changed.

## 19. Phase 2 catalog integrity

Existing Product and ProductVariant models remain canonical.

The Cart persistence layer does not duplicate catalog data and does not weaken existing catalog foreign-key behavior.

No inventory reservation or provider integration was introduced.

## 20. Known limitations

### Ownership is not yet available

The project does not currently implement Customer authentication or session identity.

Phase 8.2 therefore cannot safely associate a Cart with a customer/session yet.

This is intentionally documented rather than solved by inventing an ownership system.

### Runtime database validation is pending

Migration application, Prisma generation, integration tests, typecheck, lint, and build must be executed in a local environment with the repository and PostgreSQL database available.

## 21. Phase 8.3 prerequisites

Before customer-facing Cart behavior:

1. Establish the supported server-side ownership/session mechanism.
2. Define anonymous Cart semantics, if supported.
3. Define authenticated ownership semantics, if supported later.
4. Define anonymous-to-authenticated Cart merge behavior, if both modes are supported.
5. Run the new migration locally with PostgreSQL.
6. Run Prisma generation.
7. Run Cart persistence integration tests.
8. Run lint, typecheck, full tests, and build.
9. Implement the Cart service boundary above the repository.
10. Keep current catalog price and availability authoritative.
11. Keep Cart UI and API work outside this persistence phase.

## Scope confirmation

Implemented:

- Cart persistence schema
- CartItem persistence schema
- catalog foreign keys
- quantity database constraint
- duplicate-item database constraints
- indexes
- referential behavior
- migration
- repository foundation
- persistence tests
- documentation

Not implemented:

- Cart UI
- `/cart`
- Cart API routes
- Wishlist
- Authentication
- Checkout
- Payments
- Orders
- Shipping
- Fulfillment
- Inventory Reservation
- provider-specific commerce logic

## Final readiness decision

NOT READY FOR PHASE 8.3
