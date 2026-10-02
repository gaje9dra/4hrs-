# Phase 14.2 — Admin Catalog Management

## Scope
Phase 14.2 adds the administrative interface over the existing canonical 4HRS+ Catalog domain. It does not create a second catalog implementation and does not redesign checkout, payment, order, fulfillment, shipping, returns, cases or analytics.

## Canonical boundary
Admin UI → protected Admin API → Phase 14.1 authentication/RBAC → admin catalog application facade → canonical Catalog service → repository/domain rules → PostgreSQL.

The admin facade in `lib/admin/catalog.ts` supplies audit context to the existing Catalog service. It never performs arbitrary Product/Variant Prisma mutations.

## Product lifecycle
Products are created as drafts. Editing a published product cannot silently change lifecycle state. Publication, unpublication, archive and restore are explicit server-side lifecycle operations.

Publication uses the existing Catalog publication-readiness rules. The current repository requires active Qikink provider mappings for active variants before publication; Phase 14.2 does not weaken that pre-existing business rule.

High-risk lifecycle actions require a server-validated reason and are written to both the catalog audit trail and centralized AdminAuditLog.

## Variants and SKU separation
ProductVariant.sku is the canonical 4HRS+ Store SKU.

Provider-specific SKU data remains in `FulfillmentProviderMapping.providerSku`. The admin UI explicitly keeps these concepts separate.

Provider mappings are managed through the canonical Catalog service using the existing provider-mapping repository. No Qikink catalog import, synchronization or provider-side product creation is implemented.

## Categories and collections
Administrators with the Phase 14.2 management permissions can create, update and archive categories and collections. Catalog readers can inspect taxonomy. Product membership remains governed by existing Catalog application services.

## Media
Existing ProductImage infrastructure is used. Media add, primary-image assignment and removal are protected by `catalog.media.manage`. Destructive media removal requires a privileged-action reason.

No storage credentials are exposed to the browser.

## RBAC
Phase 14.1 RBAC remains the only authorization system.

Additional catalog permissions:
- `catalog.category.manage`
- `catalog.collection.manage`
- `catalog.media.manage`
- `catalog.provider_mapping.manage`

Read access remains `catalog.read`; product mutation uses `catalog.create` / `catalog.update`; lifecycle actions use `catalog.publish` / `catalog.archive`.

## Concurrency
Product and Variant administrative updates accept an `expectedUpdatedAt` revision token. Repository updates compare the stored timestamp atomically before committing. A stale administrative edit returns a conflict instead of overwriting a newer change.

Lifecycle transitions also validate the expected revision and perform the status transition through the existing lifecycle service.

## Search, filtering and pagination
Product listings use bounded server-side pagination, whitelisted sorting, status/category/collection/tag filters, price filters and bounded case-insensitive search. Unsupported sort/filter values are rejected.

## API surface
- `GET/POST /api/admin/catalog`
- `PATCH /api/admin/catalog`
- `GET /api/admin/catalog/products/:id`
- `PATCH /api/admin/catalog/products/:id`
- `POST /api/admin/catalog/products/:id/publish`
- `POST /api/admin/catalog/products/:id/unpublish`
- `POST /api/admin/catalog/products/:id/archive`
- `POST /api/admin/catalog/products/:id/restore`
- `POST /api/admin/catalog/products/variants`
- `PATCH/DELETE /api/admin/catalog/variants/:id`
- `POST /api/admin/catalog/media`
- `POST /api/admin/catalog/media/:id/primary`
- `DELETE /api/admin/catalog/media/:id`
- category and collection CRUD/archive endpoints under `/api/admin/catalog`
- provider mapping endpoints under `/api/admin/catalog/variants/:id/provider-mappings`

All protected routes authenticate and authorize server-side. JSON request bodies are bounded and same-origin protected for state-changing requests.

## Audit
Catalog domain audit events carry the administrator actor and request correlation ID. Central AdminAuditLog entries are written for administrative operations, including successful and failed privileged operations. Secret-shaped values are never persisted.

## UI
The admin catalog uses the Phase 14.1 Bauhaus shell with responsive product listings, product editing, lifecycle controls, variant management, media management, taxonomy management and provider-mapping controls.

The navigation remains permission-aware but is never the security boundary.

## Database
Migration `20261003000000_admin_catalog_permissions` adds the granular Phase 14.2 catalog-management permissions and safely assigns them to SUPER_ADMIN and ADMIN. It is additive and ordered after the Phase 14.1 foundation migration.

No catalog tables are duplicated and no provider-specific catalog tables are introduced.

## Testing
Phase 14.2 adds tests for:
- canonical catalog service usage
- explicit admin/read-only authorization
- optimistic concurrency conflicts
- bounded catalog search

The complete repository lint, typecheck, test, build and Prisma gates remain mandatory.

## Operational limitations
- The repository's existing rate limiter is process-local; distributed deployment still requires shared enforcement infrastructure.
- Provider mapping management remains provider-neutral. Qikink remains only a fulfillment provider integration.
- Media management uses the existing ProductImage/storage-reference model; this phase does not introduce a new media storage provider.
