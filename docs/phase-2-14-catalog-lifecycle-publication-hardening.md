# Phase 2.14 — Catalog Lifecycle, Publication Readiness & State Transition Hardening

## Scope

Phase 2.14 hardens the existing canonical catalog lifecycle without adding storefront UI, admin UI, provider integrations, payments, checkout, orders, shipping, analytics, discounts, CMS, or external search.

The project already uses three Product states:

- `DRAFT`
- `ACTIVE`
- `ARCHIVED`

`ACTIVE` is the only public lifecycle state. `DRAFT` is the non-public editable/unpublished state.

## Product lifecycle

The lifecycle is centralized in `lib/catalog/lifecycle.ts`, with the transition matrix defined once in `lib/catalog/lifecycle-rules.ts`.

| Current | Target | Result |
|---|---|---|
| DRAFT | DRAFT | no-op |
| DRAFT | ACTIVE | publish, only when publication-ready |
| DRAFT | ARCHIVED | archive |
| ACTIVE | ACTIVE | no-op |
| ACTIVE | DRAFT | unpublish |
| ACTIVE | ARCHIVED | archive |
| ARCHIVED | ARCHIVED | no-op |
| ARCHIVED | DRAFT | restore |
| ARCHIVED | ACTIVE | blocked; restore to DRAFT, then publish |

There is intentionally no new `UNPUBLISHED` enum value. The existing `DRAFT` state represents a product that is not publicly active.

Meaningful transitions emit the corresponding Phase 2.13 audit operation:

- `PUBLISH`
- `UNPUBLISH`
- `ARCHIVE`
- `RESTORE`

Repeated requests that are already in the requested state are deterministic no-ops and do not create duplicate lifecycle audit events.

## Central transition boundary

Product status changes now go through the lifecycle service:

- `publishProduct(productId)`
- `unpublishProduct(productId)`
- `archiveProduct(productId)`
- `restoreProduct(productId)`
- `validatePublicationReadiness(productId)`

The generic `updateProduct()` service no longer accepts a status change as a way to bypass this lifecycle boundary. It may update catalog fields while retaining the existing state.

Each real transition is performed inside a transaction. The persistence layer uses a conditional `UPDATE ... WHERE id = ? AND status = previousStatus` equivalent through Prisma `updateMany`. If another operation changed the state first, the transition fails deterministically instead of committing from stale state.

## Publication readiness

The canonical readiness validator remains Phase 2.4's `validatePublishingReadiness()`; Phase 2.14 does not create a second independent field-validation system.

The current readiness contract checks:

- non-empty product title
- canonical slug format
- valid three-letter uppercase currency
- non-negative money values with supported precision
- compare-at price relationship
- valid product status
- variant uniqueness
- valid variant SKU
- valid variant status
- valid variant pricing
- at least one active variant for the current sellable catalog model
- at least one product-level image
- valid media ownership and URL
- valid media type
- valid media asset/storage reference
- media sort order
- product-level primary-image constraints
- variant/media relationship consistency

Optional SEO fields remain optional. Categories and collections remain optional because the existing architecture does not define them as universal publication requirements.

Inventory does not automatically block publication. Existing inventory semantics are preserved, including products that can remain visible when out of stock.

## Variant behavior

Products continue to use the existing Phase 2.9 variant architecture. Variants remain the purchasable unit.

Existing service-level variant validation remains authoritative for:

- SKU presence
- duplicate variant combinations
- option-value references
- one value per option type
- variant pricing
- active/inactive variant state

A product cannot be published without at least one active variant under the existing catalog contract.

Products without variants are therefore not treated as publishable by the current catalog model; this preserves the existing Phase 2.4 readiness rule rather than inventing a second product type.

## Media behavior

Phase 2.10 remains authoritative.

Publication requires at least one product-level image. Product-level media may be primary; variant media cannot be primary. Media URLs, ownership, type, alt text, ordering, and storage-reference rules remain the existing canonical validation rules.

No second media validator or provider-specific media model was introduced.

## Pricing behavior

Phase 2.4 pricing validation remains authoritative:

- selling price must be finite and non-negative
- supported money precision is preserved
- compare-at price cannot be below the effective selling price
- variant pricing may override product pricing
- money remains represented through Prisma Decimal at persistence boundaries

No discounts or promotion engine was introduced.

## SEO behavior

Phase 2.8 remains authoritative:

- slug format is canonical
- slug uniqueness remains enforced
- published product slug changes are blocked by the existing redirect-safety rule
- SEO title and description remain optional
- metadata fallback behavior remains unchanged

Sitemaps and robots generation are outside this phase.

## Category and collection behavior

Categories and collections retain their existing semantic distinction and lifecycle.

They are not made mandatory merely because they exist.

Public category and collection queries continue to filter product visibility at read time. Membership data is retained internally when a product becomes non-public.

## Public visibility

The canonical public rule is:

1. Product lifecycle state must be `ACTIVE`.
2. The product must have at least one active variant.
3. The product must have at least one product-level image.
4. The public catalog query path must be used.

The repository's public catalog predicate is shared by:

- published product listing
- published product lookup
- public search
- public category/collection merchandising queries

The predicate also rejects obviously malformed public records such as empty title/slug/currency, negative product price, empty active-variant SKU, and missing product-level image.

Internal catalog reads/search remain capable of returning non-public records.

## Search interaction

Public search reuses the same repository visibility predicate as public catalog queries. Search does not implement a second lifecycle system.

Internal search continues to use its broader internal predicate and can return non-public catalog records where the caller is using the internal mode.

## Import behavior

Phase 2.12 import now respects lifecycle transitions.

For a new imported product:

1. create it in `DRAFT`
2. persist the canonical catalog data
3. if the requested state is `ACTIVE`, publish through the lifecycle service
4. if the requested state is `ARCHIVED`, archive through the lifecycle service

For an existing imported product:

1. update catalog fields without directly changing Product.status
2. apply the requested lifecycle state through the lifecycle service
3. publication readiness is therefore enforced before an imported product becomes `ACTIVE`

A failed publication transition is returned as a structured import persistence error and cannot silently bypass the lifecycle boundary.

## Bulk behavior

Bulk publication/archive behavior uses CatalogService lifecycle methods.

Phase 2.14 also exposes explicit bulk operations for:

- publish
- unpublish
- restore
- archive

Bulk operations do not issue raw Product.status updates.

Each operation retains the existing per-operation result/error model and the Phase 2.13 bulk correlation/audit context.

## Audit behavior

Phase 2.13 remains the only audit implementation.

Lifecycle transitions create audit records with:

- Product entity
- lifecycle operation
- source
- actor context
- correlation ID when supplied
- timestamp
- status in changed fields
- before state
- after state

No-op lifecycle requests do not create duplicate transition audit events.

## Error contract

Lifecycle-specific domain errors now include:

- `INVALID_STATUS_TRANSITION`
- `NOT_PUBLICATION_READY`
- `ALREADY_IN_STATE`
- `INVALID_VARIANT_STATE`
- `INVALID_MEDIA_STATE`
- `INVALID_PRICING_STATE`
- `INVALID_SLUG_STATE`
- `ENTITY_NOT_FOUND`

Existing catalog error infrastructure remains in use. The current implementation primarily uses `INVALID_STATUS_TRANSITION`, `NOT_PUBLICATION_READY`, and existing catalog-specific errors; the additional codes reserve structured lifecycle error vocabulary without creating a second serialization system.

## Concurrency

Lifecycle transitions read the current state inside the transaction and then use a conditional status update keyed by both Product ID and the observed previous status.

This prevents two concurrent transitions from both successfully committing from the same prior state.

No distributed lock or external coordination mechanism was introduced.

## Idempotency

Same-state lifecycle requests are no-ops:

- publish an already ACTIVE product → unchanged
- unpublish an already DRAFT product → unchanged
- archive an already ARCHIVED product → unchanged
- restore an already DRAFT product → unchanged

No duplicate transition audit is created for these no-ops.

## Database changes

**None.**

Phase 2.14 does not add a Product status enum value, readiness column, cache, or migration. Existing Product status storage and Phase 2.13 audit storage remain authoritative.

## Files changed

- `lib/catalog/lifecycle.ts`
- `lib/catalog/lifecycle-rules.ts`
- `lib/catalog/errors.ts`
- `lib/catalog/repository.ts`
- `lib/catalog/service.ts`
- `lib/catalog/validation.ts`
- `lib/catalog/import.ts`
- `lib/catalog/bulk.ts`
- `lib/catalog/index.ts`
- `tests/catalog-lifecycle.test.ts`
- `tests/catalog-validation.test.ts`
- `docs/phase-2-14-catalog-lifecycle-publication-hardening.md`

No package or technology-version changes are part of this phase.

## Validation

Implementation review completed for:

- lifecycle state preservation
- centralized transition rules
- conditional transactional transition
- publication-readiness reuse
- import lifecycle routing
- bulk lifecycle routing
- public visibility predicate
- Phase 2.13 audit integration
- no database migration requirement
- phase-boundary compliance

Runtime validation still requires execution of:

- lint
- TypeScript typecheck
- unit tests
- integration tests
- Prisma/client generation and schema validation
- migration validation against a database
- production build

The phase is not considered ready until those checks pass.

## Known limitations

- The current catalog contract requires at least one active variant for publication.
- Inventory does not block visibility when a product is out of stock, matching the existing inventory boundary.
- No persisted readiness flag was added; readiness is derived from the canonical validator at transition time.
- Authorization remains outside this phase.
- Provider synchronization remains outside this phase.
