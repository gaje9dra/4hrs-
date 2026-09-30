# Phase 6.3 — Production Search Relevance & Deterministic Ranking

## Current behavior before Phase 6.3

Before this phase, search matching was deterministic but result ordering was ordinary catalog ordering. The repository filtered using case-insensitive substring predicates across approved catalog fields, then ordered by the selected catalog sort followed by product ID.

That meant a default search did not distinguish a direct title match from a weaker description/tag match.

## Implemented relevance model

Default public/internal search now uses deterministic database-side relevance ordering when the caller did not explicitly select a catalog sort.

Priority tiers:
1. Exact product title.
2. Exact SKU for INTERNAL search.
3. Exact product slug.
4. Title prefix match.
5. All query terms present in the title.
6. Whole-query title substring match.
7. Active searchable variant attributes: display name, size, color, option value, and option type.
8. Tag/category/collection text matches.
9. Description/short-description matches.
10. Remaining matching candidates.

Within every relevance tier, product ID ascending is the stable final tie-breaker.

The score is an internal CASE expression. It is not persisted, exposed through the public DTO, or influenced by user identity, provider metadata, engagement, popularity, or randomness.

## Matching behavior

The existing matching contract remains database-native case-insensitive substring matching across the approved Phase 6.1 fields. INTERNAL search additionally supports SKU.

No fuzzy matching, semantic search, embeddings, AI search, typo correction, personalization, recommendation scoring, popularity scoring, or trending signals were added.

## Exact and multi-word matching

Exact title and exact slug matches are evaluated before weaker title/attribute/description matches. INTERNAL exact SKU matches receive the highest priority tier.

LIKE wildcard escaping continues to be honored.

Multi-word queries keep the existing normalization. A stronger title tier is assigned when every normalized query term occurs in the product title. No natural-language parser or semantic interpretation is introduced.

## Explicit sorting

Relevance is used only when the search caller did not explicitly select a catalog sort. Explicit catalog sorting remains authoritative, including newest, oldest, price ascending/descending, title ascending/descending, updated, and valid merchandising sorting.

## Pagination stability

Relevance ordering is computed in PostgreSQL before OFFSET/LIMIT pagination. PostgreSQL first determines the ordered product IDs for the requested page, then the application retrieves only those page-sized records using the established projection. The records are restored to the database-computed ID order.

A stable product-ID tie-breaker prevents equal-relevance records from moving between pages.

## Filter interaction

Relevance is applied to the established search candidate set after category, collection, tag, price, and stock filters. No separate ranking implementation exists per filter.

## Visibility and security

PUBLIC relevance candidates are restricted to the existing public catalog boundary before ranking. PUBLIC ranking does not use SKU, private fields, provider metadata, internal inventory, cost price, admin data, or unpublished content.

The public DTO remains unchanged and exposes no relevance score or ranking formula.

## Performance

The implementation avoids loading the entire matching catalog into JavaScript. PostgreSQL performs candidate filtering, relevance ordering, stable tie-breaking, and page selection. The application then fetches only the page-sized records.

No N+1 result queries, external search engine, or speculative relevance index was introduced.

Live PostgreSQL query plans and production workload measurements remain necessary before declaring index-level performance optimal.

## Database/index review

Existing Phase 5 catalog indexes remain relevant for lifecycle and ordinary catalog sorting. No new index was added because the primary relevance predicates are case-insensitive substring expressions across multiple text and relational fields, and speculative indexes are not justified without live query evidence.

## Tests

Updated contract coverage includes default relevance mode, explicit sort authority, exact matching, wildcard-safe matching, multi-word relevance rules, public visibility, internal-only SKU behavior, existing search/filter normalization, pagination metadata, DTO safety, and error sanitization.

Runtime execution remains unavailable, so these are source-level test additions rather than claimed passing executions.

## Known limitations

- No live PostgreSQL query plan was available.
- No production-sized catalog workload was available.
- Browser smoke testing was unavailable.
- The relevance model intentionally remains simple and rule-based.
- Token matching uses normalized whitespace-separated query terms; it is not linguistic stemming or semantic matching.
- Relevance is not exposed as a customer-facing explanation.

## Files changed

- lib/catalog/search.ts — distinguishes default relevance ranking from explicitly selected catalog sorting.
- lib/catalog/repository.ts — adds bounded database-side relevance ordering, stable ID tie-breaking, page-sized projection retrieval, and variant option relevance.
- tests/catalog-search.test.ts — verifies default relevance versus explicit sort behavior.
- docs/phase-6-3-production-search-relevance-ranking.md — this implementation record.

No unrelated catalog, commerce, authentication, payment, checkout, storefront redesign, or technology-version changes were made.

## Validation status

Required commands were not executable in the available environment:
- npm run lint — NOT EXECUTED
- npm run typecheck — NOT EXECUTED
- npm test — NOT EXECUTED
- npm run build — NOT EXECUTED

Required browser validation was also not executable for the representative query, filter, sort, pagination, navigation, refresh, responsive, and accessibility matrix.

Therefore source-level completion does not constitute runtime release validation.