# Phase 2.13 — Catalog Auditability, Change History & Data Integrity Events

## Objective

Phase 2.13 adds a provider-neutral, database-backed audit/change-history foundation for the canonical catalog. It does not add an admin UI, public audit API, provider synchronization, or an event bus.

## Audit event model

The canonical model is `CatalogAuditEvent`.

Each event records:

- event ID
- entity type
- entity ID
- controlled operation
- source
- optional actor type
- optional actor ID
- optional correlation ID
- changed fields
- bounded previous state
- bounded resulting state
- bounded structured metadata
- timestamp

The model uses the project's UUID and timestamp conventions.

## Supported entities

The implemented audit enum supports:

- Product
- Variant
- Media
- Category
- Collection
- Tag
- Option type
- Option value
- Product-category relationship
- Product-collection relationship
- Product-tag relationship

Inventory transaction history is intentionally not duplicated.

## Operations

The controlled operation set is:

- CREATE
- UPDATE
- ARCHIVE
- RESTORE
- PUBLISH
- UNPUBLISH
- DELETE
- RELATIONSHIP_ADD
- RELATIONSHIP_REMOVE
- REORDER
- IMPORT
- BULK_UPDATE

Only operations exercised by the current domain are emitted. Future-compatible enum values such as RESTORE and UNPUBLISH do not create unsupported behavior.

## Sources

Supported sources are:

- MANUAL
- IMPORT
- BULK_OPERATION
- SYSTEM
- PROVIDER_SYNC

Provider sync is represented as a future-compatible source only. No provider integration is implemented.

## Actor handling

The current catalog has no user/authentication model available for direct reuse in the canonical schema.

Therefore actor identity is optional.

The service accepts:

- USER
- PROCESS
- IMPORT
- PROVIDER

with an optional actor ID.

Import operations use an IMPORT actor type. Bulk operations use a PROCESS actor type. Manual calls default to MANUAL source without requiring an actor.

No duplicate user table was introduced.

## State semantics

Meaningful CREATE/UPDATE/ARCHIVE/PUBLISH/media mutations record before/after state where available.

UPDATE events also compute deterministic `changedFields`.

Relationship and reorder events use structured metadata or compact state instead of duplicating large Product records.

The implementation does not create full document-version branches or collaborative revision control.

## Sensitive-data policy

Audit serialization is bounded and explicitly redacts keys matching sensitive credential concepts such as:

- password
- secret
- token
- API key
- access key
- authorization
- cookie
- credential
- environment values

Audit code does not serialize raw request objects.

JSON state is bounded by:

- maximum nesting depth
- maximum array items
- maximum object keys
- maximum serialized JSON size

This keeps audit records useful without becoming an uncontrolled payload store.

## Transaction behavior

Critical service mutations write their audit event inside the same existing Prisma transaction as the catalog mutation.

Therefore:

`catalog mutation + audit event`

commit or roll back together.

Examples include:

- Product create/update/archive/publish
- Variant create/update/deactivation
- Media create/update/delete/reorder/primary changes
- Category/Collection/Tag lifecycle mutations
- merchandising relationship changes
- option type/value mutations

The phase does not introduce queues, workers, distributed transactions, or an event bus.

## Catalog Service integration

Auditing is attached at the Catalog Service domain boundary rather than at individual API routes.

The conceptual flow is:

`Caller → Catalog Service → Validation → Repository Mutation → Audit Event`

The audit context is supplied when creating a service:

`createCatalogService(repository?, auditContext?)`

This permits the same canonical service operations to retain source context.

## Import integration

Phase 2.12 import-created and import-updated catalog entities are marked with:

- source = IMPORT
- actorType = IMPORT

Where the namespace is available, the import namespace is used as a stable correlation context.

Audit history is entity-level; raw import payloads are not copied into every event.

The normal catalog export remains unchanged and does not include audit history.

## Bulk integration

Phase 2.12 bulk operations create the Catalog Service with:

- source = BULK_OPERATION
- actorType = PROCESS
- a generated bulk correlation identifier

The individual service mutations remain auditable at entity level.

This avoids one enormous bulk audit payload while retaining correlation across related changes.

## Relationship history

Important relationship changes are represented separately from ordinary Product field updates:

- Product → Category
- Product → Collection
- Product → Tag
- Product → Option Type
- merchandising reorder

The event metadata identifies the related entity and operation context.

## Publishing history

Existing Product status transitions remain authoritative.

The audit layer records the existing transition rather than introducing a second state machine.

Currently implemented examples include:

- publish
- archive

Future enum values allow unpublish/restore if those domain transitions are implemented later.

## Media history

Phase 2.10 ProductImage mutations are audited as MEDIA events.

This includes:

- create
- update
- delete
- primary-image assignment
- reorder

Physical storage assets remain independent of audit history.

## Audit query service

`lib/catalog/audit.ts` provides a provider-neutral query contract supporting:

- entity history
- operation filtering
- source filtering
- actor filtering
- date ranges
- correlation IDs
- cursor pagination

The query service caps page size at 100 and orders history deterministically by timestamp and ID.

No admin UI or public route is included.

## Access boundary

Audit history is internal catalog data.

It is not included in:

- public product detail
- public product listing
- public search
- public SEO payloads
- normal canonical catalog export

A future internal/admin API can consume the audit service.

## Export/replay boundary

Normal catalog export remains separate from audit history.

Audit records are not valid Catalog Import records and the audit schema is intentionally distinct from the Phase 2.12 product import envelope.

No audit replay engine is implemented.

## Inventory boundary

InventoryTransaction remains the canonical inventory history.

Phase 2.13 does not duplicate inventory ledger records inside CatalogAuditEvent.

A future high-level domain event may reference inventory activity without replacing the inventory ledger.

## Retention

No automatic deletion policy was introduced.

Retention should later be decided from actual operational, privacy, storage, and compliance requirements rather than an invented legal period.

## Performance

Indexes support:

- entity + entity ID + timestamp
- timestamp
- source + operation + timestamp
- actor ID + timestamp
- correlation ID + timestamp

Snapshots are bounded to avoid oversized records.

The audit query service uses cursor pagination.

## Database changes

Migration:

`prisma/migrations/20260929130000_catalog_audit_events/migration.sql`

Adds:

- CatalogAuditEntityType enum
- CatalogAuditOperation enum
- CatalogAuditSource enum
- CatalogAuditActorType enum
- CatalogAuditEvent table
- targeted audit indexes

No unrelated catalog tables were modified.

No provider-specific table was added.

## Tests

Added:

`tests/catalog-audit.test.ts`

Coverage includes:

- sensitive metadata redaction
- bounded audit serialization contract
- deterministic changed-field detection
- source attribution
- actor attribution
- correlation context

The existing catalog regression suite remains relevant for mutation behavior.

## Validation

Repository-level implementation and diff review were performed.

The following runtime checks still require the project's local runtime/database environment:

- lint
- typecheck
- unit tests
- integration tests
- Prisma schema validation
- migration deployment
- production build

They were not claimed as passed because that runtime is not available in this execution environment.

## Security considerations

The audit layer:

- does not store credentials
- does not store tokens
- does not store password hashes
- does not store environment variables
- does not blindly serialize requests
- bounds JSON size
- bounds nesting and collection sizes
- remains internal

## Future consumers

Future phases may consume audit history for:

- internal admin history
- operational investigation
- import diagnostics
- provider synchronization history
- catalog change review
- lightweight restore workflows

Those consumers are not implemented here.

## Phase boundary

Phase 2.13 establishes the auditability/data-integrity foundation only.

It does not implement:

- admin audit UI
- public audit APIs
- provider APIs
- provider synchronization
- payments
- checkout
- orders
- shipping
- customer accounts
- analytics dashboards
- recommendation systems
- event buses
- Kafka
- queues
- collaborative version control
- undo/redo UI

Phase 2.14 is not started automatically.
