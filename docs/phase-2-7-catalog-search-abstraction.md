# Phase 2.7 — Catalog Search Abstraction & Search Contract

## Objective
Phase 2.7 establishes a provider-neutral catalog search boundary on top of the canonical Product catalog and the Phase 2.6 query/discovery foundation.

No external search engine, storefront search UI, admin search UI, provider search API, authentication, checkout, payments, orders, shipping, or fulfillment workflow is introduced.

## Existing architecture reused
The existing Phase 2.6 contracts remain the source for category, collection, tag, price, availability, sorting, and pagination semantics:

Storefront/API → Catalog Search Service → Search Provider/Adapter → Catalog Search Repository → Prisma/PostgreSQL → canonical Product data.

The search service reuses CatalogQuery and CatalogAppliedQuery rather than defining a second filter/pagination contract.

## Search contract
CatalogSearchQuery extends the existing CatalogQuery with query and optional mode: PUBLIC | INTERNAL.
The normalized contract contains normalized query text, public/internal mode, and the existing normalized catalog query.
CatalogSearchProvider is the provider-neutral application boundary. The current implementation is DatabaseSearchAdapter.
The result contract is application-level and does not expose Prisma objects.

## Searchable canonical fields
Customer-facing search evaluates Product title, short description, description, slug, tag names, category names, collection names, variant display name, variant size, and variant color.
Internal/admin search additionally evaluates Product SKU and Variant SKU.
Internal SKU fields are never added to the public search predicate or public search result.
No duplicate SEO/search fields were added because the canonical Product already contains the relevant searchable text fields.

## Query normalization
Search normalization is centralized in lib/catalog/search.ts.
- leading/trailing whitespace is removed
- repeated whitespace is collapsed
- casing is normalized to lowercase
- control characters are removed
- empty queries are rejected
- maximum query length is 100 characters
- %, _, and backslash are escaped before Prisma contains matching so user input cannot become an unintended SQL LIKE wildcard
- catalog filters use the existing Phase 2.6 normalization rules
- price validation uses the existing Phase 2.4 money validator
- sort values remain allowlisted
- page/pageSize remain bounded by the Phase 2.6 limits

The normalized query is deterministic and is returned in the application result metadata.

## Relevance foundation
The intended relevance hierarchy is: exact product title; strong/prefix product title match; product title word/partial match; tag/category/collection match; descriptive content match.
The current database adapter deliberately does not invent a numeric relevance score.
The current Prisma/PostgreSQL implementation uses one coherent database predicate across searchable fields and applies the existing allowlisted catalog sort with a deterministic id tie-breaker. This keeps the implementation portable and avoids enabling PostgreSQL full-text-search preview features or introducing raw SQL solely for a scoring function.
Therefore this phase defines the relevance contract and searchable-field priority for future adapters, but does not claim dedicated-search-engine-grade ranking.

## Database-backed implementation
DatabaseSearchAdapter calls searchCatalogProducts() in the catalog repository.
The repository applies public lifecycle visibility for PUBLIC mode, allows INTERNAL search across draft/active/archived products, combines the search predicate with Phase 2.6 category/collection/tag/price/availability/sort/pagination predicates, executes filtering/sorting/count/pagination in the database, uses the existing selective catalog projection, and avoids N+1 inventory queries.
Public search requires an ACTIVE Product with at least one ACTIVE variant, matching the Phase 2.6 published-catalog boundary.
Internal search can resolve products through Product SKU and Variant SKU while returning the parent Product.

## Public vs internal search
PUBLIC search is exposed through searchPublic(). It searches only published catalog records and never searches Product SKU or Variant SKU. Its result does not expose internal SKU metadata.
INTERNAL search is exposed through searchInternal(). It can search draft and archived products and includes Product/Variant SKU matching. Its result may include internalVariants so an internal caller can resolve a matched variant SKU to its parent Product.
Authorization remains outside this phase.

## Search + Phase 2.6 filters
Search and discovery filters are one repository query.
Supported composition includes search + category, collection, tags, availability, price range, sorting, and pagination.
Tag AND/OR semantics, effective variant pricing, availability semantics, and pagination limits are inherited from the existing catalog query foundation.
No second ProductFilter, ProductSort, Pagination, or parallel catalog search filter model was introduced.

## Provider-neutral adapter boundary
The application depends on CatalogSearchProvider. The current implementation is DatabaseSearchAdapter.
Future implementations can be introduced behind the same boundary, for example Algolia, Meilisearch, Elasticsearch, or Typesense adapters. Those adapters are not implemented here.
No provider credentials, environment variables, SDKs, or fake integrations were added.
The canonical Product database remains the source of truth.

## Provider/import neutrality
Search has no provider-specific branching.
A manually created Product and a provider-imported Product are searched through the same canonical Product/ProductVariant/category/collection/tag path.
There is no Qikink-specific search behavior.
Provider mappings therefore do not change customer-facing search semantics.

## SKU behavior
Public search does not expose SKU matching.
Internal search supports partial Product SKU and Variant SKU matching. Variant SKU matches resolve to the parent Product because the search repository returns Product records.

## Lifecycle behavior
Public search follows canonical Product status: DRAFT excluded, ACTIVE eligible when published-catalog rules are satisfied, ARCHIVED excluded.
Product, slug, title, category, tag, collection, variant, and image changes are naturally reflected by database-backed search because canonical Product records are queried directly.
No search-specific lifecycle or duplicated publication state is introduced.

## Search-index readiness
The canonical Product database is the source of truth.
Future indexing candidates include Product title, short description, description, slug, tags, categories, collections, variant display names, size/color attributes, and Product/Variant SKU for internal indexes.
Future index updates should follow publication/status transitions, slug/title changes, category/tag/collection changes, variant changes, and image changes where result projections depend on images.
A future index should support initial full reindex, incremental updates, removal/deactivation of unpublished products, and eventual-consistency monitoring.
A dedicated provider must remain replaceable and must never become the storefront source of truth.

## Performance and indexing
The search query is bounded by the existing page-size maximum and uses database-level findMany plus count.
Existing catalog relationship indexes are reused.
No search-specific index was added blindly. The current implementation uses case-insensitive contains matching across several fields and relationships; this is intentionally documented as a Phase 2 database-backed foundation rather than a claim of large-catalog search performance.
At larger catalog scale, query plans should be measured before adding indexes. PostgreSQL pg_trgm is a candidate for future case-insensitive substring/index support, while a dedicated full-text/search provider may provide richer ranking. Those are future optimization decisions, not Phase 2.7 dependencies.

## Error handling
Search uses the existing CatalogServiceError architecture.
Validation failures use existing catalog error codes such as INVALID_QUERY, INVALID_SORT, INVALID_PAGE, INVALID_PRICE_RANGE, CATEGORY_NOT_FOUND, COLLECTION_NOT_FOUND, and TAG_NOT_FOUND.
Unexpected database/provider failures are mapped to CATALOG_DATABASE_ERROR.
Raw database errors, provider details, and stack traces are not exposed through the search result contract.

## Testing
Added tests/catalog-search.test.ts.
Coverage includes whitespace/casing/control-character normalization, wildcard escaping, empty/overlong query rejection, exact/partial/tag/category/collection/descriptive search contract, public result safety, internal SKU result behavior, search + filter composition, reference validation, provider failure mapping, public lifecycle visibility predicate, internal SKU predicate, deterministic sorting/pagination repository behavior, and provider-neutral custom provider execution.
Existing Phase 2 catalog tests remain part of regression validation.

## Known limitations
- The database adapter does not implement weighted numeric relevance scoring.
- It does not enable PostgreSQL full-text-search preview features.
- It does not add pg_trgm indexes.
- Search uses database substring matching and the existing catalog sort allowlist.
- Search ranking can therefore be less sophisticated than a dedicated search engine.
- Authorization for internal/admin search is outside this phase.
- Search UI is intentionally deferred.
- External search providers are intentionally deferred.

## Files changed
- lib/catalog/repository.ts
- lib/catalog/search.ts
- lib/catalog/index.ts
- tests/catalog-search.test.ts
- docs/phase-2-7-catalog-search-abstraction.md

No Prisma schema or migration change was required for this abstraction.
No external search dependency was added.

STOP — Phase 2.7 only.
