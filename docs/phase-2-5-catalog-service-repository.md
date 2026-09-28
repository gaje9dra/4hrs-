# Phase 2.5 — Catalog Service & Repository Layer

## Scope

Phase 2.5 establishes the canonical application boundary for catalog persistence and business orchestration.

Dependency direction:

```text
UI / API / Admin / Provider Import
            |
            v
     Catalog Services
            |
            v
    Catalog Repositories
            |
            v
       Prisma / DB
```

Validation remains the Phase 2.4 canonical validation layer and runs before persistence.

## Repository responsibility

Repositories are database-focused. They own Prisma queries for:

- Product reads and writes
- Variant reads and writes
- Image reads, writes, ordering, and primary-image state
- Category, collection, and tag persistence
- Product/category, product/collection, and product/tag junctions
- Listing filters, pagination, and safe sorting
- Transaction participation

Repositories do not contain React, HTTP response handling, provider API calls, payment, checkout, order, or shipping logic.

Primary file:

`lib/catalog/repository.ts`

## Service responsibility

The catalog service owns:

- Phase 2.4 validation invocation
- canonical input normalization
- product creation/update/archive/publication
- variant ownership and duplicate checks
- image ownership and primary-image orchestration
- category hierarchy checks
- collection and tag workflows
- relationship orchestration
- structured catalog errors
- transaction boundaries

Primary file:

`lib/catalog/service.ts`

Consumers should use the service boundary rather than importing Prisma directly.

## Error model

`lib/catalog/errors.ts` defines `CatalogServiceError` with stable domain codes such as:

- PRODUCT_NOT_FOUND
- PRODUCT_ALREADY_EXISTS
- INVALID_PRODUCT
- INVALID_VARIANT
- DUPLICATE_SKU
- DUPLICATE_SLUG
- VARIANT_NOT_FOUND
- INVALID_CATEGORY
- CATEGORY_NOT_FOUND
- INVALID_COLLECTION
- COLLECTION_NOT_FOUND
- INVALID_TAG
- TAG_NOT_FOUND
- PRODUCT_NOT_PUBLISHABLE
- INVALID_IMAGE_RELATIONSHIP
- IMAGE_NOT_FOUND
- INVALID_STATUS

Prisma uniqueness, foreign-key, and not-found failures are mapped at the service boundary instead of being exposed as raw ORM errors.

## Product operations

Supported:

- `createProduct()`
- `getProductById()`
- `getProductBySlug()`
- `getProductWithVariants()`
- `getProductDetails()`
- `updateProduct()`
- `archiveProduct()`
- `publishProduct()`
- `isPublishable()`

Product creation is atomic across the Product, variants, images, and requested catalog relationships. A child failure aborts the transaction.

Product updates are field-specific. Updating a title does not recreate variants or images. Relationship arrays are optional and are only replaced when explicitly supplied.

An empty relationship array therefore means "replace this relationship set with empty"; an omitted relationship field means "leave this relationship set unchanged."

## Variant operations

Supported:

- `createVariant()`
- `updateVariant()`
- `deactivateVariant()`
- `getVariantsForProduct()`

The service verifies parent Product ownership, SKU uniqueness, normalized size/color uniqueness, and Phase 2.4 pricing rules.

Inventory deduction, reservation, and release remain outside this service.

## Image operations

Supported:

- `addImage()`
- `updateImage()`
- `reorderImages()`
- `removeImage()`
- `assignPrimaryImage()`

A variant-specific image must reference a variant belonging to the same Product.

Primary product-level image assignment is transactional: existing primary state is cleared before the requested image becomes primary. The Phase 2.4 database partial unique index remains the final integrity guard.

No image-storage provider is implemented.

## Category operations

Supported:

- `createCategory()`
- `updateCategory()`
- `archiveCategory()`
- `getCategory()`
- `getCategoryHierarchy()`

The service validates non-empty names, canonical slugs, self-parenting, parent existence, and hierarchy cycles.

## Collection operations

Supported:

- `createCollection()`
- `updateCollection()`
- `archiveCollection()`
- `getCollection()`
- `attachCollection()`
- `detachCollection()`

Collections remain distinct from Categories.

## Tag operations

Supported:

- `createTag()`
- `updateTag()`
- `deleteTag()`
- `getTag()`
- `attachTag()`
- `detachTag()`

Tag names and slugs are normalized according to Phase 2.4. Tags are deleteable because the current model has no archive state; ProductTag foreign-key behavior remains authoritative.

## Relationship management

Supported product relationships:

```text
Product
  +-- Categories
  +-- Collections
  +-- Tags
```

Junction tables already have composite primary keys. The service verifies referenced records before direct attach operations.

Relationship replacement is explicit. For `updateProduct()`:

- omitted `categoryIds`, `collectionIds`, or `tagIds` means no change;
- supplied `[]` means replace that relationship set with no relationships;
- duplicate IDs are de-duplicated before persistence.

Unrelated relationship sets are not touched.

## Catalog listing

`listProducts()` supports only schema-backed filters:

- status
- category
- collection
- tag
- minimum price
- maximum price

Sorting is allowlisted to:

- createdAt
- updatedAt
- title
- price

User input is never used as an arbitrary ORM column name.

The repository uses offset pagination because no existing project-wide cursor convention exists yet.

Defaults:

- page size: 24
- maximum page size: 100
- default sort: createdAt descending
- offset must be a non-negative integer

Price filters are represented as decimal strings and remain compatible with the PostgreSQL `DECIMAL(12,2)` money model.

## Published catalog

`listPublishedProducts()` only considers:

- Product.status = ACTIVE
- at least one ACTIVE ProductVariant

Its returned variants are restricted to ACTIVE variants. Variant-specific images are restricted to images whose variant is ACTIVE; product-level images remain available.

Draft and archived Products are therefore excluded from the published catalog boundary.

Internal detail reads intentionally expose the full catalog state for future administrative/provider workflows.

## Publication

Publication calls the Phase 2.4 readiness validator before changing status.

```text
Product
   |
   v
Publish-readiness validation
   |
   +-- invalid --> unchanged
   |
   +-- valid ---> ACTIVE
```

The service does not repair invalid data or partially publish a product.

ARCHIVED products cannot be published because the Phase 2.4 lifecycle is terminal.

## Archive behavior

Product, Category, and Collection archival uses their status fields. No historical rows are deleted by archive operations.

Product archival does not directly manipulate Inventory or InventoryTransaction records.

ProductVariant deactivation changes only its catalog status and does not modify inventory quantities or history.

## Transaction boundaries

Transactions are used for:

- Product + variants + images + relationships creation
- Product update plus explicitly requested relationship replacement
- Product publication plus final status transition
- Primary-image assignment
- Image insertion/update when primary state changes
- Image reordering

Simple reads and simple single-row writes do not open unnecessary transactions.

Prisma supports interactive transactions for multi-step atomic work; this phase uses that capability for catalog orchestration. citeturn1search0

## Money and Prisma

The schema continues to use PostgreSQL `DECIMAL(12,2)`. The service passes decimal-compatible values through to Prisma rather than converting canonical stored money to floating-point values. Prisma documents Decimal fields as Decimal.js-backed values, preserving decimal semantics. citeturn0search0

## Provider-import compatibility

Future callers follow:

```text
Provider Adapter
      |
      v
Canonical Product Input
      |
      v
Catalog Validation
      |
      v
Catalog Service
      |
      v
Catalog Repository
      |
      v
Database
```

The service has no provider parameter or provider API dependency.

## Inventory boundary

The catalog service may create, deactivate, and read ProductVariants, but it does not implement:

- stock deduction
- reservation
- stock release
- inventory adjustment

Those remain in the Phase 2.3 inventory boundary.

## Tests

Phase-specific service tests are in:

`tests/catalog-service.test.ts`

They cover:

- validation before transaction entry
- not-found error mapping
- duplicate SKU rejection
- normalized duplicate variant rejection
- archived publication rejection
- deterministic publication readiness

Existing Phase 2.4 validation tests remain in:

`tests/catalog-validation.test.ts`

No test framework dependency was added.

## Intentionally deferred

- Admin UI
- Storefront UI
- Qikink / Printrove / Printful / other provider adapters
- Provider synchronization
- Product import UI
- HTTP API endpoints unless a later phase requires them
- Search engine integration
- Recommendations
- Analytics
- Cart
- Wishlist
- Checkout
- Payments
- Orders
- Shipping
- Customer authentication
- Inventory reservation/deduction workflow
- Multi-location inventory
- Promotions, tax, and full pricing engine
- CMS
- Product synchronization

## Files

- `lib/catalog/errors.ts`
- `lib/catalog/repository.ts`
- `lib/catalog/service.ts`
- `lib/catalog/index.ts`
- `tests/catalog-service.test.ts`
- `docs/phase-2-5-catalog-service-repository.md`

No database schema or migration change is required for Phase 2.5.

**STOP — Phase 2.5 scope only.**
