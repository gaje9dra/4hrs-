# Phase 6.1 — Production Search Architecture & Query Contract Audit

## 1. Current search architecture

**VERIFIED**

The current public search flow is:

Browser → `/search` → storefront search service → canonical catalog search service → catalog repository → Prisma/database.

The `/search` route does not import Prisma or the database client. `searchStorefrontProducts` calls the public search service and maps results into the established storefront product-card DTO.

The search implementation remains the existing Phase 2.7 abstraction in `lib/catalog/search.ts` and Phase 3.5 route in `app/(storefront)/search/page.tsx`. No second search architecture was introduced.

## 2. Phase 2.7 search contract

**VERIFIED**

The canonical search input contains:

- `query`
- catalog filters
- `sort`
- `page`
- `pageSize`
- public/internal mode at the service boundary

The database adapter translates catalog sorting into the existing repository sort fields and calls `searchCatalogProducts`.

Search result metadata contains page, page size, total, total pages, next-page state, out-of-range state, and the normalized applied query.

## 3. Phase 3.5 implementation

**VERIFIED**

The route:

- renders a search landing state for an empty query
- uses the canonical `q` parameter
- invokes `searchStorefrontProducts`
- reuses `CatalogListing`
- reuses the Phase 5 filters/sorting/pagination UI
- uses the established public catalog error state for operational failures
- remains `noindex,follow`
- uses `/search` as its canonical URL

Invalid search input now receives a distinct customer-safe correction state rather than being presented as a database/service outage.

## 4. Searchable fields

**VERIFIED**

Public database matching uses real catalog fields:

- product title
- short description
- description
- product slug
- active tag name
- active category name
- active collection name
- active variant display name
- active variant size
- active variant color
- active variant option-value display name
- active variant option-type name

SKU matching remains internal-only.

No provider metadata, supplier data, cost prices, audit records, secrets, private inventory fields, or unpublished product records are part of public matching.

## 5. Query normalization

**VERIFIED / CHANGED**

Search input is:

- required to be a string
- control characters converted to spaces
- surrounding whitespace removed
- repeated whitespace collapsed
- lowercased
- bounded to 1–100 characters
- escaped for database LIKE wildcard characters before repository matching

The canonical catalog filter/sort/page normalization is now reused from `lib/catalog/query.ts` rather than duplicated inside the search service.

Search URL generation now uses the same canonical bounded `q` normalization, preventing unbounded or differently normalized search URLs.

## 6. Visibility / lifecycle rules

**VERIFIED / CHANGED**

The public search repository path reuses `buildPublicCatalogWhere`, which requires the published/ACTIVE product boundary.

Category and collection filter references are required to resolve to active public resources. Public text matching against category and collection names is also restricted to ACTIVE relations.

Public variant matching is restricted to ACTIVE variants. Internal search retains its broader internal mode.

## 7. Matching behavior

**VERIFIED**

Matching is deterministic database-native case-insensitive substring matching through Prisma `contains` predicates.

It is not:

- semantic search
- vector search
- embeddings
- AI search
- speculative fuzzy matching
- undocumented typo correction

The query is escaped before it reaches the repository so wildcard characters are treated as literal search input.

## 8. Ranking behavior

**VERIFIED**

There is no relevance-scoring engine.

Search results use the selected catalog sort:

- newest
- oldest
- price ascending/descending
- title ascending/descending
- updated
- merchandising when a category or collection context exists

The repository applies a deterministic secondary product-ID ordering for ordinary catalog search and deterministic merchandising fields for merchandising search.

No random, popularity, trending, bestseller, or personalized ranking was introduced.

## 9. Filter / sort / pagination integration

**VERIFIED / CHANGED**

Search composes:

`q + filters + sorting + pagination → canonical catalog state → repository query`

Search now reuses the same catalog normalization contract as Phase 5 for:

- category
- collection
- tags
- tag mode
- price range
- stock state
- sorting
- page
- page size

Search pagination now exposes the same out-of-range distinction established by Phase 5.

## 10. URL contract

**VERIFIED / CHANGED**

Canonical search URLs use:

- `/search`
- `q`
- recognized catalog filter parameters
- recognized sort
- bounded page/pageSize

Equivalent whitespace/casing states are normalized when catalog URLs are generated.

Unknown catalog parameters remain ignored by the catalog parser.

Search filters preserve `q`, while pagination preserves the complete recognized catalog state.

## 11. Public DTO contract

**VERIFIED / CHANGED**

The public `searchPublic` boundary now returns the established public catalog-list DTO shape:

- title
- slug
- primary image URL/alt text
- price
- compare-at price
- currency
- ACTIVE status
- public availability state

It does not return:

- product IDs
- image IDs
- SKU
- variant IDs
- internal variant metadata
- category/collection/tag IDs
- internal inventory quantities

The internal search contract remains separate and is not used by the public storefront route.

## 12. Empty / error behavior

**VERIFIED / CHANGED**

Distinct states now exist for:

- empty query: search landing
- valid query with zero results: catalog no-results state
- malformed/invalid query: customer-safe search correction state
- category/collection/tag reference not found: safe catalog error classification
- database/search failure: sanitized catalog error state

Operational failures are never returned with raw SQL, ORM errors, stack traces, environment variables, filesystem paths, or credentials.

## 13. SEO behavior

**VERIFIED**

The search page:

- uses `/search` as canonical
- is `noindex,follow`
- has dedicated search metadata
- does not create indexable metadata variants for every search query

This preserves the existing site's search SEO strategy.

## 14. Performance findings

**VERIFIED**

The current implementation:

- uses database-side filtering
- uses database-side ordering
- uses database-side pagination
- selects the established public catalog list projection for PUBLIC search
- uses the full projection only for INTERNAL search
- avoids application-side result filtering
- executes item retrieval and total count concurrently
- does not introduce N+1 product fetches

**REQUIRES RUNTIME VALIDATION**

The search predicates include multiple case-insensitive substring and relational predicates. Without a live database query plan and production dataset, scan cost and index effectiveness cannot be truthfully characterized. PUBLIC reference validation now uses requested tag slugs instead of loading the entire tag table, and category/collection/tag validation runs concurrently.

No speculative search index or external search engine was introduced.

## 15. Security findings

**VERIFIED / CHANGED**

Verified protections:

- server-side validation
- bounded query length
- parameterized Prisma predicates
- public publication boundary
- active category/collection relation checks
- active variant matching
- internal-only SKU search
- public DTO minimization
- sanitized operational errors
- no provider dependency

The search URL cannot bypass the public catalog visibility predicate.

## 16. Accessibility findings

**VERIFIED**

The existing search UI provides:

- semantic `role="search"`
- an associated accessible label
- GET submission
- native search input
- keyboard-compatible submit button
- visible focus styling
- existing catalog filter/sort controls
- existing catalog loading/no-results/error infrastructure

Reduced-motion behavior is provided by the established global stylesheet.

**REQUIRES BROWSER VALIDATION**

Actual keyboard traversal, touch-target measurements, contrast rendering, and responsive behavior remain unverified without a runnable browser environment.

## 17. Changes made

The Phase 6.1 implementation changes are limited to search-foundation code, tests, and documentation:

- `lib/catalog/query.ts` — exposed the canonical catalog query normalization function
- `lib/catalog/search.ts` — hardened PUBLIC/INTERNAL projection handling, kept the public DTO minimal, and changed reference validation to batched requested-tag lookup plus concurrent category/collection/tag validation
- `lib/catalog/repository.ts` — aligned search SELECT projections with PUBLIC/INTERNAL mode so the PUBLIC mapper consumes only the lightweight listing projection
- `lib/catalog/observability.ts` — added the search catalog surface
- `lib/storefront/query-params.ts` — canonicalized bounded search `q` URL state
- `app/(storefront)/search/page.tsx` — attributed filter diagnostics to search and distinguished invalid query UX
- `tests/catalog-search.test.ts` — strengthened query, visibility, DTO, pagination, and observability coverage
- `tests/storefront-search.test.ts` — added canonical search URL normalization coverage
- `tests/catalog-search.test.ts` — added lightweight-public-projection and batched-reference-validation regressions
- `docs/phase-6-1-production-search-architecture-audit.md` — this audit

No cart, checkout, payments, orders, shipping, authentication, reviews, fulfillment provider, external search engine, or storefront redesign changes were made.

## 18. Remaining Phase 6 work

**FUTURE PHASE**

Phase 6.1 establishes the existing search architecture and contract. Later Phase 6 work may address search-specific production improvements only where justified by actual requirements and runtime evidence.

External search infrastructure, semantic search, AI search, typo correction, recommendation ranking, and other speculative search systems remain explicitly out of scope.

## 19. Validation results

**REQUIRES RUNTIME VALIDATION**

The repository does not expose runnable GitHub Actions status for the current audit branch, and the available environment does not provide the project's local database/browser runtime.

Therefore these required commands were not truthfully marked as passed:

- `npm run lint`
- `npm run typecheck`
- `npm test`
- `npm run build`

The required browser matrix was also not executable:

- 320px
- 375px
- 768px
- 1024px
- 1280px
- 1440px
- 1920px

Source-level regression coverage was added, but runtime execution remains a release blocker.

## Final Phase 6.1 assessment

**VERIFIED:** the canonical search architecture is preserved and strengthened, public visibility/data boundaries are hardened, search normalization now shares the Phase 5 contract, search pagination is aligned with the Phase 5 pagination contract, and observability/error handling is safer.

**REQUIRES CHANGE:** none remaining at the source-contract level within Phase 6.1 scope.

**OUT OF SCOPE:** product-detail commerce functionality, external search infrastructure, provider integrations, and storefront redesign.

**REMAINING BLOCKER:** mandatory lint/typecheck/full-test/build and browser smoke validation cannot be executed or verified in the available environment. The GitHub workflow lookup for the current Phase 6.1 head reports no workflow runs.

**Decision: NOT READY FOR PHASE 6.2**
