# Phase 6.4 — Production Search Filter, Sort & URL-State Integration

## Scope
Phase 6.4 integrates `/search` with the existing Phase 5 catalog filter, sort, pagination, and URL-state contract while preserving Phase 6.2 search and Phase 6.3 deterministic relevance behavior.

No external search engine, semantic/vector search, recommendation ranking, commerce flow, authentication, provider-specific logic, or technology-version changes were introduced.

## Canonical search state
The server remains authoritative for `q`, category, collection, tags/tag mode, price range, stock availability, sort, page size, and page.

`/search` uses the shared `catalogQueryFromSearchParams` parser and `buildCatalogHref` / `buildCatalogFilterHref` URL builders. Search execution continues through `searchStorefrontProducts` into the existing catalog search service and repository.

## Query parameters and normalization
Existing Phase 5/6 validation remains authoritative: allowlisted sorts; bounded page/page-size; canonical slugs; bounded/deduplicated tags; AND/OR tag mode; money validation; valid price ranges; normalized bounded `q`; and escaped search wildcard characters.

Empty `q` remains the distinct search landing state. Invalid values are rejected before repository execution through the existing service error architecture.

## Filter integration
Search uses the existing category, collection, tags, tag mode, min price, max price, and in-stock filters. Filter changes preserve `q` and reset page state through the existing URL builder. Active-filter removal also preserves the query.

No search-specific filter query path was introduced.

## Sort integration
The search UI now exposes `Relevance` as the visual default when no `sort` URL parameter is present.

- no explicit `sort` → Phase 6.3 deterministic relevance ranking
- explicit supported `sort` → catalog sort is authoritative
- changing sort preserves `q` and active filters
- explicit catalog sort is never silently replaced by relevance

The existing catalog sort options remain shared; `Relevance` is only the search-surface representation of the established Phase 6.3 default ranking mode.

## Pagination integration
Search continues to reuse the Phase 5.7 pagination contract: page 1–10000, page size 1–100, database-side offset/limit, total counts, deterministic ordering, and out-of-range detection.

Pagination URLs preserve the complete canonical search/filter/sort state.

## URL-state behavior
Examples include `/search?q=hoodie`, `/search?q=hoodie&sort=price_asc`, and `/search?q=hoodie&category=shirts&page=2`.

Generated URLs normalize equivalent values and omit established defaults. Changing the query through the results search form preserves valid discovery state such as filters, sort, and page size while resetting the current page. Filter changes preserve `q`; clearing filters preserves `q`.

## Relevance interaction
Phase 6.3 remains the source of truth for default search relevance. Filters narrow the candidate set without changing the ranking model. Pagination operates on the already ordered result set. Explicit catalog sorting remains authoritative.

## Empty and error states
The search surface retains distinct handling for no query, query with no results, filtered no results, invalid state, and backend/catalog failure. Existing clear/filter interactions remain in use; no recommendations were added.

## SEO
The established strategy remains unchanged: `/search` canonical metadata, `noindex,follow`, and no automatic indexability for arbitrary search/filter combinations.

## Security
Combined state continues to rely on server-side validation, public visibility enforcement, parameterized repository queries, bounded pagination, public DTO safety, and sanitized error/observability handling.

## Performance
Filtering, relevance or explicit sorting, pagination, and counting remain database-side. No full-result application-side ranking, N+1 catalog filtering path, or speculative result cache was introduced.

Live PostgreSQL query plans, production workload metrics, and browser performance measurements remain unavailable.

## Accessibility and responsive behavior
Existing semantic search, filter, sort, active-filter, pagination, empty, and error patterns were retained. The search sort control now correctly exposes the `Relevance` state for the default ranking path.

No storefront redesign was introduced. Existing Bauhaus rules remain in force. Required viewport validation at 320px, 375px, 768px, 1024px, 1280px, 1440px, and 1920px remains a runtime gate.

## Tests
Added contract coverage for canonical search URL generation, including normalized `q`, filter preservation, sort preservation, page-size preservation, page inclusion, filter-state URL generation, and default omission.

Existing Phase 6.1–6.3 coverage remains in place for relevance, filters, pagination, visibility, DTO safety, and error handling.

## Validation status
Required runtime commands were not executable in the available repository environment:

- `npm run lint` — NOT EXECUTED
- `npm run typecheck` — NOT EXECUTED
- `npm test` — NOT EXECUTED
- `npm run build` — NOT EXECUTED

Browser smoke/regression validation was also not executable for the specified viewport and navigation matrix.

Therefore source-level implementation is complete, but production runtime validation remains a release blocker.

## Files changed in Phase 6.4
- `components/storefront/search-input.tsx`
- `components/storefront/catalog-filters.tsx`
- `components/storefront/catalog-listing.tsx`
- `app/(storefront)/search/page.tsx`
- `tests/catalog-search.test.ts`
- `docs/phase-6-4-search-filter-sort-url-state-integration.md`

No unrelated catalog, commerce, authentication, payment, or technology-version changes were made.

## Known blockers
1. lint execution
2. TypeScript/type generation execution
3. full test execution
4. production build execution
5. browser smoke/regression validation across required viewports and navigation states
6. live database/query-plan and production workload verification