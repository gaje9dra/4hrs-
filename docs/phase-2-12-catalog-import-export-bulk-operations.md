# Phase 2.12 — Catalog Data Import, Export & Bulk Operations Foundation

## Objective

Phase 2.12 establishes a provider-neutral catalog portability layer for JSON import, deterministic export, validation/preview, idempotent upsert, relationship resolution, and reusable bulk operations.

The canonical store database remains the source of truth.

No provider integration, admin UI, storefront import/export UI, payment, checkout, orders, fulfillment, or recommendation system is implemented.

## Architecture reused

The implementation reuses:

- Prisma/PostgreSQL persistence
- Catalog Repository
- Catalog Service
- Phase 2.4 validation
- Phase 2.6 catalog query concepts
- Phase 2.7 search-independent canonical catalog data
- Phase 2.8 SEO fields
- Phase 2.9 option/variant relationships
- Phase 2.10 media foundation
- Phase 2.11 merchandising relationships
- existing transaction utility

The conceptual pipeline is:

`JSON Parser → Normalizer → Validator → Relationship Resolver → Import Planner → Catalog Service → Repository → Database`

Export uses:

`Repository Read → Export Mapper → Deterministic JSON Serializer`

Bulk operations use:

`Bulk Operation Service → Catalog Service → Repository`

Import code never performs provider-specific database writes.

## Canonical import contract

The canonical JSON envelope is versioned:

`version = 1`

Optional `namespace` identifies the stable external-reference namespace. The namespace is generic and can later be supplied by a provider adapter without adding provider-specific schema.

Product support includes:

- canonical ID
- external reference
- title
- slug
- description
- short description
- status
- price
- compare-at price
- currency
- SEO title/description
- category references
- collection references
- tag references
- merchandising metadata

Variant support includes:

- canonical ID
- external reference
- SKU
- option value IDs
- size
- color
- display name
- price override
- compare-at price override
- status

Media support includes:

- external reference
- URL
- storage reference
- media type
- alt text
- sort order
- primary state
- optional variant association

Category support includes:

- ID
- external reference
- name
- slug
- parent reference
- status
- SEO metadata

Collection support includes:

- ID
- external reference
- name
- slug
- description
- status
- SEO metadata
- membership merchandising metadata

Tags support:

- ID
- external reference
- name
- slug

## Normalization

Normalization is deterministic and occurs before planning.

Rules include:

- trim textual values
- product titles use the existing title normalizer
- slugs use the canonical catalog slug normalizer
- SKUs use the canonical SKU normalizer
- tags use existing tag normalization
- currency is normalized to uppercase
- media alt text uses the existing media normalizer
- duplicate option-value IDs are removed
- duplicate relationship IDs are removed through service/repository behavior
- empty optional strings become null/undefined as appropriate

Normalization never executes imported content and does not silently perform fuzzy matching.

## Validation pipeline

The import pipeline is:

1. parse
2. normalize
3. validate input bounds
4. validate canonical Product/Variant/Category rules
5. resolve Category/Collection/Tag references
6. resolve product identity
7. detect conflicts
8. construct an import plan
9. dry-run or persist

Invalid records are rejected before their product persistence operation begins.

The existing catalog validators remain the canonical validation implementation.

## Input bounds

The current JSON implementation applies bounded limits:

- maximum products: 1,000
- maximum variants per product: 100
- maximum media records per product: 200
- namespace length: 80 characters

These limits provide a resource-exhaustion boundary without introducing queues/background workers.

## Matching and upsert

Product matching order:

1. explicit canonical Product ID
2. namespace + external reference
3. canonical slug

If two stable identifiers resolve to different Products, the record is a conflict.

Title matching is never used.

Variant matching order:

1. explicit canonical Variant ID
2. namespace + external reference
3. canonical SKU within the Product

Ambiguous matches are conflicts rather than automatic merges.

## Idempotency

A generic `CatalogImportIdentity` model stores:

- entity type
- namespace
- external reference
- canonical UUID

This is intentionally provider-neutral.

It allows a future provider adapter to use:

`Provider → canonical namespace/reference → Import Contract`

without introducing Qikink/Printful/etc. fields into Product or ProductVariant.

Repeated imports using the same namespace/reference resolve to the same canonical entity.

The migration is additive and does not alter existing catalog records.

## Dry-run / preview

Dry-run performs parsing, normalization, validation, relationship resolution, identity matching, and action planning without writing catalog data.

The structured result reports:

- total records
- valid records
- invalid records
- creates
- updates
- unchanged records
- skipped records
- conflicts
- warnings
- structured errors
- per-record plans

This result is UI-independent and can later be consumed by an admin workflow.

## Import persistence

Import persistence goes through the existing Catalog Service.

Product creation uses the canonical Product service, including its existing validation and transaction boundary.

Variant creation/update uses the existing Variant service.

Media creation/update uses the Phase 2.10 media service.

Category, collection, and tag creation/update uses the existing Catalog Service.

Collection/category merchandising metadata uses the Phase 2.11 relationship services.

No raw provider-specific persistence layer exists.

## Relationships

Relationships are resolved before Product persistence where possible.

Supported relationships:

- Product → Category
- Product → Collection
- Product → Tag
- Product → Variant
- Product → Media
- Product → Option Types
- Variant → Option Values

Category imports support parent references and cycle detection.

Collection imports reuse Phase 2.11 membership semantics.

Tag imports reuse canonical tag normalization.

## Media handling

Import preserves external URLs and optional stable storage references.

The importer does not download remote assets.

No storage provider is introduced.

Media continues to use the Phase 2.10 ProductImage foundation.

Existing URL/storage-reference deduplication remains authoritative.

## Inventory boundary

Generic catalog import does not directly mutate inventory transactions.

Inventory remains a separate domain.

No raw `onHand`, `reserved`, or inventory transaction writes were added to the generic import path.

Future inventory imports must use the existing inventory service/transaction rules.

## Export contract

Export is canonical JSON version 1.

It includes:

- Products
- Product variants
- variant option values
- Product media
- Categories
- Collections
- tags
- Product option types/values
- SEO metadata
- merchandising metadata
- canonical relationships

Secrets are excluded.

The export contains no:

- passwords
- authentication credentials
- provider API secrets
- environment variables
- security tokens
- payment secrets

## Export filtering

The repository export query supports:

- all products
- Product IDs
- category
- collection
- status
- modified-after timestamp

The filter is implemented at the repository/query boundary rather than by loading the entire catalog into application memory first.

## Deterministic export

Products are ordered by canonical Product ID.

Variants are ordered by creation timestamp and ID.

Media are ordered by sort order and ID.

Category relationships are ordered by merchandising position and category ID.

Collection relationships are ordered by featured state, priority, position, and collection ID.

Tags are ordered by stable ID.

Option values are ordered by canonical option sort order and ID.

The serialized export uses a fixed export timestamp so identical catalog state produces reproducible JSON.

## Bulk operations

The bulk service supports:

- Product validation
- Product archive
- Product publish
- category assignment
- collection assignment
- tag assignment

Each operation uses existing Catalog Service boundaries.

By default, processing continues after a failed operation and returns per-operation errors.

Callers can disable continuation so later operations are returned as skipped after the first failure.

No arbitrary destructive bulk mutation API was added.

## Transaction strategy

Existing Catalog Service operations retain their transaction boundaries.

Product creation/update, Variant creation/update, media primary updates, and merchandising membership updates continue to use existing transactional repository operations.

The bulk service intentionally does not introduce a new transaction/queue framework.

Large imports are bounded at the input layer. Future streaming/batching can be added without changing the canonical import contract.

## Error model

Import issues contain:

- record type
- record index
- record reference
- field
- error code
- message
- severity

Important categories include:

- INVALID_PRODUCT
- INVALID_VARIANT
- DUPLICATE_SKU
- INVALID_CATEGORY
- INVALID_COLLECTION
- INVALID_TAG
- INVALID_MEDIA
- MISSING_REFERENCE
- CONFLICT
- UNSUPPORTED_VALUE
- INPUT_TOO_LARGE
- MALFORMED_INPUT
- PERSISTENCE_ERROR

Raw database errors are not the intended import API contract.

## Provider integration boundary

Future provider architecture:

`Provider API → Provider Adapter → Canonical Import Contract → Normalize → Validate → Plan → Catalog Service → Repository → Database`

Provider credentials, provider webhooks, provider-specific canonical models, and provider direct database writes are explicitly outside Phase 2.12.

## Manual product compatibility

Manual products remain ordinary canonical Products.

They:

- use the same Product/Variant/Media models
- use the same validation
- can be exported
- can be imported
- do not require provider metadata

## Security

Import/export handling is bounded and provider-neutral.

Controls include:

- JSON parsing only
- input-size limits
- bounded namespace values
- no execution of imported content
- existing URL/media validation
- no secret fields in export
- deterministic structured errors
- no fuzzy record merging

## Performance

The foundation avoids unnecessary infrastructure.

The export path performs a single structured repository read with nested canonical relationships.

The import path validates before persistence and limits maximum record counts.

The implementation does not introduce queues, workers, external search engines, or spreadsheet dependencies.

## Database changes

Migration:

`prisma/migrations/20260929110000_catalog_import_identity/migration.sql`

Added:

- `CatalogImportEntityType` enum
- `CatalogImportIdentity` model
- unique namespace/entity/reference identity
- entity/canonical ID lookup index
- namespace/reference lookup index

No provider-specific columns were added to Product or ProductVariant.

Existing catalog data remains untouched.

## Tests

Added:

`tests/catalog-import-export-bulk.test.ts`

Coverage includes:

- canonical JSON envelope parsing
- malformed JSON
- bounded input contract
- bulk validation
- bulk mixed success/failure continuation

The import/export architecture also remains subject to the existing catalog regression suite.

Runtime execution of the full suite, Prisma validation, migration deployment, lint, typecheck, and production build remains dependent on a working project runtime/database environment.

## Limitations

- JSON is the only implemented file adapter.
- CSV is intentionally deferred because the project does not currently have a justified CSV utility layer.
- Remote media are not downloaded.
- Generic catalog import does not mutate inventory.
- Import processing is bounded and synchronous; no background job infrastructure was added.
- Automatic collection rules are not implemented.
- No provider adapter is implemented.
- Export currently uses canonical internal IDs where useful.
- Bulk operations are service-level operations rather than an admin UI.

## Future extension points

Future phases can add:

- Qikink adapter
- Printrove adapter
- Printful adapter
- Printify adapter
- CSV adapter using the same canonical contract
- streaming/batched imports
- admin preview/import UI
- audit/history for imports
- provider-specific reference namespaces
- inventory import through the inventory domain
- scheduled imports

None of those are implemented in Phase 2.12.

## Validation results

The GitHub repository was inspected and the Phase 2.12 changes were kept within the catalog portability/bulk boundary.

Runtime validation commands could not be executed in this environment because the repository runtime/database is not available here.

Therefore the following remain unverified in this execution:

- lint
- typecheck
- unit test execution
- integration tests
- Prisma schema validation
- migration deployment
- production build

No dependency versions were changed.

## Phase boundary

Phase 2.12 stops at the canonical catalog data portability and bulk-operation foundation.

Phase 2.13 is not started automatically.
