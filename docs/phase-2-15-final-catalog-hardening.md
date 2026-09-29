# Phase 2.15 — Final Catalog Hardening

## Executive summary

Phase 2.15 is the final integrity pass over the Phase 2 catalog foundation. The review covered the database schema, catalog services/repositories, validation, queries/search, SEO, variants/options, media, merchandising, import/export, auditability, lifecycle, and inventory boundaries.

The phase deliberately makes targeted fixes only where a concrete integrity, consistency, security, lifecycle, audit, or architectural problem was identified.

## Integrity checklist

| Area | Status | Finding |
|---|---|---|
| Product identity | PASS | UUID identity and unique product slug remain database-enforced. |
| Product → Variant | PASS | Foreign key with cascade; variants are service-validated against their parent Product. |
| Product → Media | PASS | Foreign key plus service ownership validation; database ownership check added. |
| Variant → Media | PASS | Service prevents cross-product variant media ownership. |
| Product relationships | PASS | Composite primary keys prevent duplicate memberships and FKs prevent missing parents. |
| Variant options | PASS | Option-type/value references and canonical combination validation remain centralized. |
| Inventory quantities | PASS | Service validation retained; database non-negative/reservation checks added. |
| Category hierarchy | PASS | Self-parent database check plus service cycle validation; invalid active-parent states blocked. |
| Collection lifecycle | PASS | Existing ACTIVE/ARCHIVED model preserved. |
| Tags | PASS | Normalization and unique slug/name behavior retained. |
| Pricing | PASS | Decimal persistence and canonical getEffectivePrice() validation retained. |
| Media | PASS | Exactly-one-owner invariant hardened at database boundary. |
| SEO / URLs | PASS | Existing slug uniqueness and published-slug redirect-safety rules retained. |
| Public visibility | PASS | Public queries reuse the canonical ACTIVE/variant/media predicate. |
| Internal visibility | PASS | Internal search remains distinct from public visibility. |
| Merchandising | PASS | Deterministic featured/priority/position ordering retained. |
| Import lifecycle | PASS | Imported status transitions use lifecycle service. |
| Export/import options | PASS | Stable option identities are now exported and resolved during import. |
| Audit | PASS | Category updates and product option relationships now remain transactionally auditable. |
| Lifecycle | PASS | Direct repository archive bypass removed; lifecycle service remains the status boundary. |
| Provider neutrality | PASS | No provider-specific catalog model or integration introduced. |

## Findings and fixes

### HIGH — Media ownership was not database-enforced

ProductImage had nullable productId and variantId columns with application-level validation but no database invariant requiring exactly one owner.

Fix: added ProductImage_exactly_one_owner_check.

The constraint is additive and marked NOT VALID, so it does not silently rewrite or delete existing data. New and updated rows must satisfy the invariant.

### HIGH — Inventory quantity invariants were application-only

Inventory service code already enforced available = onHand - reserved and rejected negative quantities or reserved > onHand, but the database did not independently protect those invariants.

Fixes:

- Inventory_non_negative_quantities_check
- Inventory_reserved_not_above_on_hand_check

No inventory ledger redesign or order reservation was introduced.

### MEDIUM — Category updates bypassed audit transaction handling

Category creation/archive were audited transactionally, but category updates directly called the repository and did not create a corresponding audit event.

Fix: category updates now execute inside the repository transaction and record CATEGORY / UPDATE through the existing Phase 2.13 audit implementation.

### MEDIUM — Active category could reference archived parent

This could make an active child inconsistent with public hierarchical navigation.

Fixes:

- active categories cannot use an archived parent
- a category with active children cannot be archived
- existing cycle detection remains authoritative
- database self-parent protection was added

No arbitrary hierarchy depth limit was introduced.

### MEDIUM — Product creation missed some relationship audit events

Product creation already audited Product, Variant, Media, Category, Collection, and Tag mutations, but option-type assignments and variant option-value assignments did not receive relationship events.

Fix: creation now records those relationship additions using the existing Phase 2.13 audit system.

### MEDIUM — Export/import option identity was UUID-dependent

Export contained option definitions and variant option IDs, while import primarily depended on those IDs. That is fragile when moving catalog data into another safe context where UUIDs differ.

Fixes:

- export now includes stable option-type normalized identity and option-value normalized identity for each variant
- import resolves option types by ID or normalized identity
- option values resolve by ID or option-type/value identity
- imported product option assignments are preserved
- existing products receive missing option assignments without duplicating them

The canonical option architecture from Phase 2.9 remains unchanged.

### LOW — Repository lifecycle bypass

The repository still exposed an archiveProduct helper that directly mutated Product status even though Phase 2.14 centralized lifecycle transitions.

Fix: removed the unused repository-level archive bypass. Product state changes now remain behind the lifecycle service.

## Referential-integrity policy

Current database relationship behavior is intentional:

- Product → Variant: CASCADE
- Product → ProductImage: CASCADE
- Product → ProductCategory: CASCADE
- Product → ProductCollection: CASCADE
- Product → ProductTag: CASCADE
- Category → ProductCategory: RESTRICT
- Collection → ProductCollection: CASCADE
- Tag → ProductTag: CASCADE
- Variant → Inventory: RESTRICT
- Inventory → InventoryTransaction: RESTRICT
- VariantOptionType → ProductOptionType: RESTRICT
- VariantOptionType → VariantOptionValue: RESTRICT
- VariantOptionValue → ProductVariantOptionValue: RESTRICT
- ProductVariant → ProductVariantOptionValue: CASCADE
- Category → parent Category: RESTRICT

No blanket CASCADE policy was introduced.

Audit records remain polymorphic by design and do not use unsafe foreign keys to multiple entity tables.

## Orphan prevention

The schema prevents the principal relational orphan cases through foreign keys.

Application tests and service validation cover:

- variant parent existence
- media owner existence
- variant-media same-product ownership
- option value/type consistency
- product relationship membership
- inventory variant ownership
- category hierarchy validity

No existing production data was deleted or automatically repaired.

## Pricing

The existing canonical effective-price helper remains getEffectivePrice(productPrice, variantPrice).

A variant price overrides the product price; otherwise the product price is inherited.

Money remains Decimal at persistence boundaries. No floating-point persistence was introduced.

## Inventory

The inventory boundary remains in lib/inventory/repository.ts.

Availability continues to use:

available = onHand - reserved

Catalog hardening does not introduce order reservation, fulfillment, or a replacement inventory ledger.

## Public data safety

Public catalog selection remains deliberately shaped and does not expose audit records, provider credentials, internal audit metadata, or customer information.

Public product visibility requires the canonical ACTIVE state plus an active variant and product-level image. Public search reuses the same visibility predicate.

## Import/export

The export format remains version 1.

Round-trip coverage preserves:

- product identity and catalog fields
- pricing/currency
- variants
- option definitions
- variant option identities
- media
- categories
- collections
- tags
- SEO
- merchandising metadata

Audit history is intentionally not catalog export data.

Inventory transactions are intentionally not exported as catalog state.

## Idempotency

Existing idempotent behavior remains:

- same Product lifecycle state → no-op
- existing product/category/collection/tag references resolve before creation
- duplicate relationship membership is rejected or updated through the service
- repeated media references are deduplicated by owner
- option definitions resolve by canonical identity
- existing product option assignments are reused rather than duplicated

## Performance

No speculative caching was introduced.

Existing deterministic ordering and pagination remain in place. The audit model already has indexes for entity/time, source/operation/time, actor/time, and correlation/time.

The main remaining performance consideration is the existing N+1-style validation of variant option combinations during service-level mutation. It is bounded by catalog mutation sizes and was not rewritten because no measured regression was available.

## Security

Reviewed areas include:

- import payload bounds
- audit payload redaction/bounds
- ORM parameterization
- public DTO shaping
- lifecycle mutation boundaries
- media ownership validation
- provider-neutral catalog storage

No credentials, provider secrets, customer information, or audit snapshots are added to public catalog responses.

## Deferred / future work

The following remain intentionally outside Phase 2:

- storefront UI
- admin UI
- authentication
- cart
- checkout
- payments
- orders
- shipping
- fulfillment
- provider integrations
- provider webhooks
- external search engines
- recommendations
- analytics
- discounts/coupons
- CMS
- background workers
- redirect system beyond the existing published-slug safety boundary

Authorization remains an application-layer concern and is not implemented by this catalog foundation.

## Database changes

Added migration:

prisma/migrations/20260929150000_catalog_integrity_constraints/migration.sql

It adds four additive NOT VALID checks:

1. ProductImage has exactly one owner.
2. Inventory quantities are non-negative.
3. Inventory reserved quantity cannot exceed on-hand quantity.
4. Category cannot be its own parent.

No destructive migration or existing migration rewrite was performed.

## Test coverage added/updated

Added:

- tests/catalog-integrity.test.ts
- lifecycle tests from Phase 2.14 remain in place

Updated catalog service/validation/search coverage for lifecycle and visibility behavior.

Runtime execution is still required for the full project test suite.

## Validation status

The following were reviewed statically through the repository:

- database schema and foreign keys
- migration contents
- service/repository boundaries
- lifecycle bypasses
- public visibility predicate
- provider coupling
- import/export structures
- audit integration
- validation composition

The environment used for this implementation cannot reach GitHub from the local container, so the repository could not be cloned for local execution. GitHub Actions status checks are also not present for the current head.

Therefore these runtime gates are NOT VERIFIED:

- lint
- TypeScript typecheck
- unit tests
- integration/database tests
- Prisma generation
- migration execution against a database
- production build

## Final Phase 2 readiness matrix

| Area | Status | Notes |
|---|---|---|
| Database | PASS* | Constraints and relationships reviewed; migration runtime unverified |
| Catalog Models | PASS | Canonical model boundaries preserved |
| Inventory | PASS* | Service + DB invariants added; runtime unverified |
| Validation | PASS | Canonical validators retained |
| Services | PASS | Lifecycle and category audit boundaries hardened |
| Queries | PASS | Public/internal separation retained |
| Search | PASS | Public search reuses public visibility |
| SEO | PASS | Existing canonical URL/indexability rules retained |
| Variants | PASS | Option/SKU/combination rules retained |
| Media | PASS | Ownership and cross-product checks hardened |
| Merchandising | PASS | Deterministic ordering retained |
| Import/Export | PASS | Option identity round-trip hardened |
| Audit | PASS | Missing category/option relationship audit gaps fixed |
| Lifecycle | PASS | Direct repository bypass removed |
| Referential Integrity | PASS* | DB constraints added; migration runtime unverified |
| Security | PASS* | Static review complete; runtime security testing not performed |
| Performance | PASS* | No clear regression found; no benchmark executed |
| Tests | FAIL | Full runtime suite has not been executed |

*Static/repository verification only; runtime validation remains outstanding.

## Final decision

The catalog hardening implementation is complete, but the Phase 2 readiness gate requires runtime validation before the project can truthfully be declared ready for Phase 3.
