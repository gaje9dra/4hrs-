# Phase 6.7 — Search Performance, Security & Observability Hardening

## Scope
Audited the complete storefront search path from the browser /search route through the storefront search layer, search service, catalog repository, and database.

No search architecture was rebuilt and no external search infrastructure was introduced.

## Performance

### PASS
- Filtering, sorting, relevance ordering, and pagination remain database-side.
- Page size remains bounded by the existing catalog maximum of 100.
- Search ordering remains deterministic with stable product-ID tie breaking.
- PUBLIC relevance search hydrates only the page-sized ID set.
- No N+1 product hydration path was found.
- No client-side catalog filtering or sorting was introduced.

### WARNING
- Relevance search contains multiple relation EXISTS predicates and represents the search WHERE expression in both page-ID and total-count branches.
- Search uses leading-wildcard ILIKE substring matching, which ordinary B-tree indexes do not generally accelerate.
- High page offsets remain a bounded but potentially expensive OFFSET workload.
- Runtime EXPLAIN/ANALYZE data was unavailable, so no speculative SQL rewrite or index was added.

## Database and indexes

### PASS
The Product model already has status, createdAt, price, status+createdAt, status+updatedAt, status+price, and status+title indexes.

Relationship indexes also support ProductCategory categoryId, ProductCollection collectionId, ProductTag tagId, ProductVariant productId/status/productId+size+color, ProductVariantOptionValue optionValueId, and the unique Inventory variantId relation.

### NOT APPLICABLE
No additional index was justified from source inspection alone. The major remaining cost is substring matching and multi-relation relevance evaluation.

## Query complexity protection

### PASS
Existing safeguards include the 100-character normalized search limit, control-character normalization, whitespace normalization, wildcard escaping, bounded tags, allowlisted sorting, validated prices, bounded pagination, reference validation, public visibility predicates, and parameterized Prisma SQL.

No user input is concatenated into SQL structure.

## Autocomplete

### NOT APPLICABLE
No autocomplete/typeahead implementation exists. Phase 6.5 intentionally deferred it, so no second suggestion endpoint was created in Phase 6.7.

## Caching and revalidation

### PASS
No persistent search-result cache exists. This avoids search-state cache collisions and stale unpublished catalog data.

Existing React request-scoped cache is used for shared catalog metadata. No new persistent cache or invalidation system was introduced.

## Concurrency and resilience

### PASS
Search is server-side through the existing route/service architecture. There is no client-side search fetch manager whose stale response can overwrite newer search state.

Malformed state is validated deterministically and database/provider failures are converted to customer-safe CatalogServiceError responses.

### WARNING
Rapid-query, refresh-during-load, back/forward, and network-level stale-response behavior could not be browser-tested.

## Security

### PASS
- Query parameters are validated through the existing catalog/search contracts.
- Prisma structured queries and parameterized Prisma.sql are used.
- Search wildcard characters are escaped.
- Sort values are allowlisted.
- PUBLIC search excludes unpublished products and inactive category/collection references.
- PUBLIC search does not expose SKU, internal product IDs, internal variants, inventory quantities, provider metadata, or administrative fields.
- Raw database/provider errors and stack traces are not returned to customers.
- Phase 6.6 already hardened query-derived SEO metadata.

## Abuse and rate limiting

### NOT APPLICABLE
Repository inspection found no middleware.ts, proxy.ts, or dedicated search API route providing reusable rate-limiting infrastructure.

No third-party rate-limiting service was introduced.

### WARNING
Network-level request-frequency protection remains a deployment/infrastructure concern if abusive automated traffic becomes relevant.

## Public data exposure

### PASS
The PUBLIC search contract exposes only storefront card data: title, slug, primary image, price, compare-at price, currency, and availability state.

Internal identifiers, SKU, internal variants, inventory quantities, provider secrets, administrative fields, audit records, and configuration are not part of the public search DTO.

## Error classification

### FIXED
Previously, unrecognized search exceptions could be logged broadly as database failures.

Phase 6.7 now distinguishes:
- recognized validation/reference failures using the existing classifications
- CATALOG_DATABASE_ERROR as database_failure
- other unexpected CatalogServiceError failures as unexpected_application_failure
- raw repository/provider exceptions as database_failure

Customer-facing database errors remain the generic safe message: Catalog search failed.

### NOT APPLICABLE
No explicit database timeout boundary exists in the current architecture, so no artificial timeout classification was invented.

## Observability

### FIXED
The existing structured catalog observation surface now includes slow_search.

Search service execution uses a 1000 ms diagnostic threshold. The measurement covers provider execution and storefront result mapping before a successful result is returned. Searches meeting or exceeding that threshold emit structured diagnostics containing surface, operation, classification, rounded duration, and sanitized catalog state.

The complete user-entered search query is not logged.

### PASS
Existing failure observations remain available for validation, not-found, database, catalog-data-integrity, and unexpected application failures.

No passwords, credentials, payment information, provider secrets, SQL, raw database errors, stack traces, or full search payloads are logged.

No monitoring platform or external telemetry provider was introduced.

## Slow-search diagnostics

### FIXED
Added CATALOG_SEARCH_SLOW_THRESHOLD_MS = 1000 and the slow_search observation classification.

No additional database query is performed for diagnostics.

## Error boundaries and safe fallbacks

### PASS
Existing /search handling remains intact for empty search, invalid query/filter state, no results, and database failures. Invalid state renders the existing correction UI and database failures remain customer-safe.

No autocomplete dependency or client-side search lifecycle was added.

## Tests

### PASS — source-level
Existing tests cover bounded result size, pagination, deterministic ordering, filter combinations, invalid filters/sorts, long and malformed input, public visibility, public DTO safety, database failure handling, relevance ranking, and URL-state contracts.

Phase 6.7 additionally added regression coverage for database-failure classification and the structured slow_search observation surface.

No arbitrary execution-time threshold test was added.

## Browser / network validation

### WARNING — NOT EXECUTED
The available repository integration does not expose an executable browser/network environment.

Therefore real rapid-query behavior, network duplication, payload sizes, stale-response behavior, back/forward behavior, and rendered error states were not runtime-verified.

## Cross-surface regression

### PASS — source architecture
Search continues to use the same public catalog DTO and URL-state boundaries as /shop, /category/[slug], /collection/[slug], and /product/[slug].

### WARNING — runtime
Cross-surface browser regression could not be executed.

## Code quality

### FIXED
- Corrected broad database-failure classification for unexpected CatalogServiceError cases.
- Added explicit slow-search diagnostic classification.
- Added regression tests for both changes.

No unrelated refactoring or UI redesign was performed.

## Documentation

Created:
docs/phase-6-7-search-performance-security-observability.md

## Validation

### Source-level
- Search architecture audit — PASS
- Database/query inspection — PASS
- Public DTO/security inspection — PASS
- Existing index inspection — PASS
- Autocomplete absence confirmed — NOT APPLICABLE
- Rate-limit infrastructure absence confirmed — NOT APPLICABLE
- Slow-search diagnostics — FIXED
- Error classification — FIXED
- Regression tests added — PASS

### Runtime
- npm run lint — NOT EXECUTED
- npm run typecheck — NOT EXECUTED
- npm test — NOT EXECUTED
- npm run build — NOT EXECUTED
- Browser/smoke tests — NOT EXECUTED
- PostgreSQL EXPLAIN/ANALYZE — NOT EXECUTED
- Network inspection — NOT EXECUTED

## Remaining limitations
1. Runtime lint/typecheck/test/build validation is unavailable.
2. Browser/network validation is unavailable.
3. Real PostgreSQL query plans and workload metrics are unavailable.
4. Leading-wildcard ILIKE remains difficult to accelerate with ordinary B-tree indexes.
5. Relevance search retains complex relation predicates and count work until real query-plan evidence justifies a change.
6. Very high, though bounded, OFFSET values remain a known pagination cost.
7. No application-level rate limiter currently exists.
8. No explicit database timeout boundary currently exists.
9. Autocomplete/typeahead remains intentionally out of scope.
10. Production deployment infrastructure may need separate network-level abuse protection.

## Change boundary
Only verified Phase 6.7 performance, security, resilience, error-classification, and observability issues were changed.

No external search engine, AI search, semantic/vector search, recommendation engine, commerce system, authentication system, payment system, or search UI redesign was introduced.

STOP — Phase 6.7 only.