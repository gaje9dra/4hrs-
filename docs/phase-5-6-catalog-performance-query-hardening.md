# Phase 5.6 — Production Catalog Discovery Performance & Query Hardening

## Query-path audit

The production listing path is:

/shop, /category/[slug], /collection/[slug] → storefront catalog layer → catalog query service → catalog repository → Prisma/PostgreSQL.

Verified findings:

- Filtering, sorting, and pagination execute in the repository/database layer.
- Result counting uses the same filtered predicate as the page query.
- Category and collection membership constraints remain database relation filters.
- Listing queries were hydrating active variants, option values, inventory, categories, collections, and tags although the storefront card only needs product identity, one image, effective price, and availability.
- Tag existence validation previously performed one database lookup per selected tag.
- Category/collection/tag validation was sequential.
- Category pages reused active-category metadata for breadcrumbs and filter controls; request-scoped memoization now shares that read.

## Changes made

### Listing payload

The listing-only repository selection now contains only product id/title/slug/pricing/currency/status, one product image, and active-variant pricing plus the inventory fields needed to derive the public availability state.

Listing DTOs no longer expose variant SKU/option data, category/collection/tag relations, or inventory quantities. Product-detail DTOs remain unchanged.

Prisma select projections are used to restrict returned fields while filtering can still use unselected database fields.

### Validation and query round trips

- Category, collection, and tag validation now starts concurrently.
- Tag validation is batched into one IN query rather than one query per tag.
- Tag input is bounded to 20 unique tags at URL and service layers.
- Page size remains bounded at 100 and page number at 10,000.
- Database filtering/sorting/pagination remain server-side.

### Index review

The catalog already had indexes for product status, created time, base price, category/collection merchandising relationships, variant product/status, and tag/category/collection relationship keys.

Phase 5.6 adds four composite Product indexes for the actual public listing predicate and supported direct Product sorts:

| Index | Query supported | Benefit | Tradeoff |
|---|---|---|---|
| status, createdAt | newest/oldest | active-row filtering plus creation ordering | extra write/storage cost |
| status, updatedAt | updated | active-row filtering plus updated ordering | extra write/storage cost |
| status, price | price asc/desc | active-row filtering plus price ordering | extra write/storage cost |
| status, title | title asc/desc | active-row filtering plus title ordering | extra write/storage cost |

The product-id secondary ordering remains in place for deterministic results. No unrelated indexes were added.

## Caching / revalidation

No persistent catalog-result cache was introduced because publication state and inventory availability are mutable and the current architecture has no invalidation contract for safely caching listing results.

Request-scoped React cache memoization now deduplicates repeated category/collection resolution and active category/collection/tag metadata reads during a server render. It does not persist stale catalog state across requests.

## Error handling

- Invalid query parameters fail before repository execution.
- Missing category/collection/tag state retains the existing service error taxonomy.
- Existing route error and not-found boundaries remain responsible for user-facing failures.
- Database errors are not exposed directly by the storefront layer.
- Errors are not swallowed into false empty results.

## Determinism

- Ordinary sorts retain the requested field plus product id as the secondary key.
- Merchandising retains featured, priority, position, creation time, title, and product id ordering.
- Pagination still applies after database filtering and ordering.
- No business sorting behavior was changed.

## Tests

Added/updated coverage for batched tag validation, deterministic tag input ordering, excessive tag rejection, listing DTO availability shape, canonical URL tag bounds, and the existing price/sort/pagination/category/collection/visibility/error cases.

The repository integration does not expose runnable CI results and this environment has no runnable checkout/database/browser. Lint, typecheck, full tests, production build, and browser smoke therefore remain unverified.

## Known limitations

- Offset pagination remains because the storefront supports arbitrary page numbers and merchandising sorting is relation-based.
- Effective variant-price and inventory filters remain relation predicates; replacing them with scalar-only indexes would change query semantics.
- No SQL EXPLAIN/query-plan measurement was possible in this environment.