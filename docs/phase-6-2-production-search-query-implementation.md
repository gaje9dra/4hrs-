# Phase 6.2 — Production Search Query Implementation & Discovery Integration

## 1. Scope and architecture

The production search path remains:

Browser → `/search` → storefront search query layer → canonical catalog search service → catalog repository → Prisma/database.

Phase 6.2 does not introduce a second search implementation, external search infrastructure, ranking engine, or storefront redesign.

The implementation continues to reuse:
- Phase 2.7 `lib/catalog/search.ts`
- Phase 3.5 `/search`
- Phase 5 canonical catalog filters, sorting, pagination, URL state, DTO boundaries, security, and observability.

## 2. Canonical search contract

The canonical search service accepts:
- normalized `query`
- catalog filters
- sorting
- pagination
- PUBLIC/INTERNAL mode at the server-side service boundary

The database adapter maps catalog sorting to the existing repository sort fields and calls `searchCatalogProducts`.

The result includes:
- product items
- total result count
- page/pageSize
- totalPages
- hasNextPage
- isOutOfRange
- normalized applied query

No parallel search repository method was introduced.

## 3. Query normalization

There is one service-level normalization path:
- require a string
- replace C0/control characters with spaces
- trim leading/trailing whitespace
- collapse repeated whitespace
- lowercase for deterministic matching
- reject empty input
- enforce a 100-character maximum
- escape LIKE wildcard characters before repository matching

URL query parameters are already decoded by the Next.js request boundary. The server does not perform unsafe or repeated URL decoding, which avoids changing legitimate percent characters in searches such as percentage-bearing product terms.

The normalized query is passed unchanged through the search service into the repository.

## 4. Searchable fields and matching

PUBLIC search uses canonical catalog fields:
- title
- short description
- description
- slug
- active tag name
- active category name
- active collection name
- active variant display name
- active variant size
- active variant color
- active variant option-value display name
- active variant option-type name

SKU matching is restricted to INTERNAL mode.

Matching is deterministic, database-native, case-insensitive substring matching using Prisma `contains` predicates.

No fuzzy, semantic, vector, AI, popularity, trending, random, or recommendation ranking was added.

## 5. Public visibility

PUBLIC search reuses the canonical `buildPublicCatalogWhere` visibility boundary.

It excludes products that are not eligible for public catalog discovery, including non-ACTIVE products and records failing the established publication data constraints.

Category and collection filters require active public resources. Public category/collection text matching also requires ACTIVE relations. Public variant matching is limited to ACTIVE variants.

The public route never uses INTERNAL search mode.

## 6. Filter integration

Search composes the search term with the Phase 5 canonical catalog query:
- category
- collection
- tags
- tag mode
- minimum price
- maximum price
- in-stock state

Reference validation is bounded to requested category, collection, and tag values. Category, collection, and tag validation runs concurrently.

No duplicate filter implementation was introduced.

## 7. Sorting integration

Search reuses the canonical catalog sort contract:
- newest
- oldest
- price ascending
- price descending
- title ascending
- title descending
- updated
- merchandising where category/collection context permits it

Invalid sort values are rejected by the existing query normalization.

Ordinary search uses deterministic secondary product-ID ordering. Merchandising search retains the established contextual merchandising ordering.

No relevance score or synthetic ranking was added.

## 8. Pagination integration

Search reuses the Phase 5 pagination contract:
- page 1–10,000
- pageSize 1–100
- database-side offset/limit
- total count
- deterministic ordering
- out-of-range detection
- stable URL state

The search result count is calculated from the same search visibility/filter predicate used for item retrieval.

## 9. Public DTO

The public storefront boundary returns the existing product-card DTO:
- title
- slug
- primary image URL/alt text
- price
- compare-at price
- currency
- ACTIVE status
- public availability state

The browser does not receive product IDs, image IDs, SKU, internal variant metadata, relation IDs, or internal inventory quantities.

The repository uses the lightweight public listing projection for PUBLIC search and the fuller projection only for INTERNAL server-side search.

## 10. Query efficiency

The repository performs:
- database-side matching
- database-side filtering
- database-side sorting
- database-side pagination
- concurrent item/count queries
- bounded public result projection

No N+1 search result queries or application-side result filtering were introduced.

The current substring predicates span multiple product and relation fields. Live query plans and production workload measurements remain necessary before adding search-specific indexes or other optimization infrastructure. No speculative index or external search engine was introduced.

## 11. Error handling and observability

Search uses the established catalog error architecture.

Customer-facing responses do not expose:
- SQL
- Prisma/ORM internals
- stack traces
- database schema
- filesystem paths
- environment variables
- provider credentials/configuration

Search failures are attributed to the existing `search` catalog observability surface with classifications such as invalid query, not found, and database failure.

## 12. Security

Server-side protections include:
- bounded query length
- strict query/filter/sort/page validation
- parameterized Prisma predicates
- LIKE wildcard escaping
- public visibility enforcement
- active relation enforcement
- internal-only SKU matching
- public DTO minimization
- safe operational error mapping

No unsafe SQL construction is used.

## 13. URL and server/client boundary

The canonical `/search` URL uses:
- `q`
- recognized catalog filters
- recognized sort
- recognized page/pageSize state

Search filter controls preserve `q`, and generated search URLs use the bounded canonical query normalization.

Search execution remains server-controlled. Client components only submit and display state; they do not access Prisma or privileged catalog data.

## 14. Caching / revalidation

No speculative persistent search-result cache was introduced.

Existing request-scoped React caching for shared catalog metadata remains in place. Search results themselves are not cached in a way that could serve stale unpublished/private catalog data.

## 15. Search UX integration

The existing `/search` UI was not redesigned.

The implementation continues to support:
- empty-query landing state
- valid result state
- valid no-result state
- invalid-query state
- customer-safe error state
- result metadata
- pagination
- filters
- sorting
- clear-search behavior
- preserved URL state

The existing Bauhaus storefront presentation and shared catalog components remain unchanged.

## 16. Accessibility

The existing implementation retains:
- semantic `role="search"`
- associated search label
- keyboard-compatible GET submission
- accessible clear/filter/sort controls
- visible focus states
- accessible no-result/error messaging
- existing catalog result/pagination semantics

Browser-level keyboard, touch, contrast, and responsive smoke validation remains unverified in the available environment.

## 17. Tests

Phase 6.2 test coverage includes the existing search contract tests plus corrections and regressions for:
- valid search
- empty query
- whitespace normalization
- maximum query length
- control-character input
- legitimate Unicode preservation
- literal LIKE wildcard handling
- public visibility
- unpublished exclusion
- inactive category/collection rejection
- internal-only SKU matching
- no-result behavior
- search + filters
- search + sorting
- search + pagination
- deterministic ordering
- result metadata
- public DTO safety
- invalid parameters
- sanitized provider/database failures
- URL-state normalization
- canonical lookup contract for requested tags

The test suite was corrected to use the current `getTagsBySlugs` lookup contract rather than the removed `listTags` search-service dependency.

## 18. Regression surface

The Phase 6.2 changes do not alter:
- `/shop`
- `/category/[slug]`
- `/collection/[slug]`
- `/product/[slug]`

The intended cross-surface contract remains:

Homepage → Shop → Category → Collection → Search → Product Detail

Runtime regression validation remains pending.

## 19. Files changed in Phase 6.2

- `tests/catalog-search.test.ts`
  - aligned reference lookup mocks with the canonical `getTagsBySlugs` contract
  - added Unicode/control-character normalization regressions
- `docs/phase-6-2-production-search-query-implementation.md`
  - documents the final Phase 6.2 implementation and validation state

No search UI redesign, external search provider, commerce feature, authentication, payment, provider dependency, or unrelated storefront change was introduced.

## 20. Validation status

The required repository commands were not executed in the available environment:

- `npm run lint` — NOT EXECUTED
- `npm run typecheck` — NOT EXECUTED
- `npm test` — NOT EXECUTED
- `npm run build` — NOT EXECUTED

Browser smoke validation at 320, 375, 768, 1024, 1280, 1440, and 1920 pixels was also not executed.

Therefore runtime validation cannot be represented as passing. Source-level implementation and regression coverage were completed, but mandatory runtime validation remains a release blocker.

## 21. Known limitations

- No live database query plans or production workload metrics are available.
- No browser runtime is available for responsive/accessibility smoke testing.
- GitHub Actions does not provide a verified successful Phase 6.2 validation run for this implementation state.
- Locked dependency versions were not changed as part of this phase.

## Final Phase 6.2 assessment

Source-level search query implementation and discovery integration are complete and remain within the prescribed architecture. The remaining blocker is mandatory runtime validation.

**NOT READY FOR PHASE 6.3**
