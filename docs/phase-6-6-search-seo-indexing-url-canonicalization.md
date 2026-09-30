# Phase 6.6 — Production Search SEO, Indexing & URL Canonicalization

## Scope
Phase 6.6 hardens SEO, indexing, metadata, canonical URL behavior, and crawl control for the existing product search system.

The implementation reuses the Phase 2.8 catalog SEO/URL foundation, Phase 3.5 /search route, Phase 5 URL-state serializers, and Phase 6.1–6.5 search contracts.

No search architecture, external engine, semantic/vector search, storefront redesign, commerce functionality, or technology-version change was introduced.

## Search URL architecture
The canonical search route remains /search with the existing q, category, collection, tags, tagMode, minPrice, maxPrice, inStock, sort, pageSize, and page parameters.

No new SEO-only query parameters were introduced.

## Canonical URL strategy
Search canonicalization is deterministic and server-derived through the existing catalog URL serializers.

- Empty search canonicalizes to /search, even if unused filter/sort/page parameters are present because the empty-search landing state does not execute catalog discovery.
- Valid query states canonicalize to the normalized logical search URL.
- Query whitespace/control-character normalization is reflected in the canonical URL.
- Query casing is normalized through the existing search contract.
- Tags are deduplicated and sorted through the existing catalog contract.
- Default page 1 and default page size 24 are omitted.
- Empty/default tag mode is omitted.
- Valid filters remain in the canonical URL.
- Valid sort remains in the canonical URL when explicitly selected.
- Pagination remains in the canonical URL for page > 1.
- Invalid recognized parameters do not produce a fabricated canonical state; metadata falls back to /search.

### Search-specific sort rule
For ordinary catalog routes, newest remains the established default and can be omitted.

For /search, an absent sort means Phase 6.3 relevance ranking, while explicit sort=newest means chronological catalog sorting. Those are different logical states.

Therefore Phase 6.6 preserves explicit sort=newest in search canonical URLs:

- /search?q=hoodie → relevance
- /search?q=hoodie&sort=newest → explicit newest sort

This prevents canonicalization from collapsing two behaviorally different search states into one URL.

## Indexing strategy
Search-result pages remain intentionally non-indexable.

Server-generated metadata uses noindex and follow for empty, valid, filtered, sorted, paginated, and no-result search states.

The strategy prevents uncontrolled indexing of arbitrary query/filter/sort/page combinations.

Public catalog destinations such as products, categories, and collections retain their separate catalog SEO architecture and are not changed by this phase.

## Robots behavior
The search route uses Next.js server-side metadata robots directives: index=false and follow=true.

There is currently no repository-level app/robots.ts or public robots.txt implementation. Phase 2.8 explicitly deferred robots generation, so this phase does not introduce a new global robots system.

The search page therefore relies on its server-rendered noindex directive rather than blocking /search at the robots layer. This preserves crawler access to the page while instructing indexing systems not to retain search-result URLs as indexable documents.

## Metadata behavior
/search now uses server-side generateMetadata.

### Empty search
Title: Search | 4HRS
Description: Search the public 4HRS catalog.
Canonical: /search
Robots: noindex,follow

### Valid query
The title is derived from the normalized query as Search results for “<query>” | 4HRS.

The metadata query uses the existing search normalization contract and caps displayed title text at 80 characters.

The description is Search the public 4HRS catalog for “<query>”.

The canonical URL is generated from the complete valid search/filter/sort/page state.

### Invalid or excessive query/filter state
Metadata fails closed to safe metadata: Search | 4HRS, generic search description, canonical /search, and noindex,follow.

No invalid user input is inserted into canonical metadata.

## Query-derived metadata security
Query-derived metadata is treated as untrusted input.

The implementation removes control characters, collapses whitespace, normalizes through the existing search contract, enforces the existing 100-character search limit, limits displayed title query text to 80 characters, uses Next.js Metadata APIs, avoids dangerouslySetInnerHTML, and does not expose database/provider/debug data.

Unicode search terms remain supported through the existing normalization behavior.

## No-result search SEO
No-result search pages use the same search metadata/indexing policy as other valid search states: query-derived metadata, deterministic canonical URL, noindex,follow, and no fake products, recommendations, ratings, reviews, offers, or search-result structured data.

No database lookup is added solely for metadata generation.

## Filtered search SEO
Supported filtered search states remain non-indexable.

Canonical URLs preserve valid filters through the existing serializer. No filter combination is promoted to an indexable landing page.

## Sorted search SEO
Sorting does not make search pages indexable.

Canonical URLs preserve explicit supported sorting because sorting changes result ordering. Explicit sort=newest is preserved for /search because absence of sort means relevance.

## Pagination SEO
Pagination remains non-indexable and canonicalizes to its actual normalized state rather than incorrectly forcing every page to page 1.

Examples: /search?q=hoodie, /search?q=hoodie&page=2, and /search?q=hoodie&sort=price_asc&page=2.

Out-of-range handling remains owned by the existing Phase 5.7 catalog pagination contract.

## URL normalization
The existing serializer provides deterministic ordering and normalization for supported state, including whitespace normalization, query casing normalization, URL encoding, deterministic parameter order, repeated-tag deduplication, sorted tags, default omission, invalid recognized-value rejection, bounded pagination, and bounded query length.

No second URL parser was introduced.

## Public catalog visibility
Search SEO does not query private catalog metadata. Search results continue through the existing public search service and visibility predicates.

The SEO layer does not expose unpublished products, internal identifiers, SKU values, inventory internals, provider metadata, or administrative fields.

No product-specific structured data is emitted from /search.

## Structured data
The existing /search implementation contains no Product, ItemList, AggregateRating, Review, or Offer structured-data payload.

No structured data was added in Phase 6.6.

## Sitemap findings
There is currently no repository app/sitemap.ts or public/sitemap.xml implementation.

Phase 2.8 explicitly deferred sitemap generation.

Phase 6.6 therefore does not introduce a sitemap architecture or add search URLs to a sitemap.

If sitemap generation is implemented later, arbitrary /search URLs should remain excluded and product/category/collection sitemap behavior should continue to use canonical public routes.

## Internal linking
No new search link architecture was introduced. Existing search/filter/empty-state links continue to use /search, canonical catalog URL builders, and /shop for the no-result escape route.

No unnecessary search URL variants are introduced.

## Crawl behavior
Search pages remain crawlable enough for noindex discovery because they are not blocked through a new global robots rule.

Arbitrary query/filter/sort/page combinations are instructed not to enter the search index. Legitimate product/category/collection routes are unaffected.

## Performance
Metadata generation performs no product/catalog database query. Canonical generation uses existing in-memory query normalization and serialization.

Search result execution remains owned by the existing search/catalog query path.

No N+1 metadata queries, duplicate search queries, new cache, or additional external request was introduced.

## Cache / revalidation
No new metadata cache or revalidation layer was introduced. Search metadata is derived directly from request URL state.

## Accessibility / UX
SEO changes do not alter the rendered search controls or visual system. Existing headings, query state, result state, no-results state, filters, sorting, pagination, and keyboard behavior remain unchanged.

## Bauhaus consistency
No visual redesign was introduced. Existing colors, Outfit typography, thick black borders, hard shadows, square geometry, spacing, and responsive behavior remain unchanged.

No gradients, glassmorphism, soft shadows, generic rounded UI, or unrelated components were added.

## Tests added/updated
Updated tests/storefront-search.test.ts with coverage for explicit sort=newest preservation on search canonical URLs, distinction between relevance and newest sorting, ordinary catalog newest default omission, server-side generateMetadata, noindex/follow metadata, canonical metadata generation, bounded query-derived metadata, raw HTML injection absence, and absence of search structured-data payload.

## IMPLEMENTED
- Search-specific canonical URL hardening
- Explicit sort=newest preservation for search
- Dynamic server-side search metadata
- Query-derived titles/descriptions
- 80-character display-title bound
- Safe fallback metadata for invalid state
- noindex,follow
- Deterministic canonical state
- No search structured data
- No sitemap search URLs
- No global robots-system redesign

## VERIFIED — source audit
- /search uses the existing search service.
- Search state uses the existing catalog URL parser/serializer.
- Search metadata is server-generated.
- Search metadata does not query private catalog data.
- No app/robots.ts exists.
- No app/sitemap.ts exists.
- No public/sitemap.xml exists.
- No search structured-data payload exists in the search route.
- Explicit search sort=newest is preserved by both canonical URL builders.

Runtime verification remains unavailable.

## OUT OF SCOPE
- Global robots.txt architecture
- New sitemap architecture
- External SEO platforms
- Search Console integration
- Search analytics
- External search engines
- AI/semantic/vector search
- Search recommendations
- Search autocomplete
- Product/category/collection SEO redesign
- Commerce functionality

## FUTURE
- A dedicated sitemap phase can implement canonical product/category/collection sitemap generation while excluding arbitrary search URLs.
- A dedicated global robots phase can define site-wide crawler policy if required.
- Search autocomplete remains governed by Phase 6.5's deferred interaction contract.

## Runtime validation
Required commands were not executable through the available repository environment:
- npm run lint — NOT EXECUTED
- npm run typecheck — NOT EXECUTED
- npm test — NOT EXECUTED
- npm run build — NOT EXECUTED

Browser/HTML validation was also not executable.

Required representative states remain empty search, normal query, multi-word query, no results, search plus filter, search plus sort, search plus pagination, and invalid query parameters.

Required head inspection for title, description, canonical, robots, and social metadata remains a runtime gate.

## Known blockers
1. Runtime lint validation unavailable.
2. Runtime typecheck validation unavailable.
3. Runtime test validation unavailable.
4. Production build validation unavailable.
5. Browser-rendered HTML/head validation unavailable.
6. Runtime regression validation for shop/category/collection/product routes unavailable.

## Change control
Only verified search SEO/canonicalization issues were changed.

No search query architecture, catalog schema, commerce flow, authentication, payment, provider logic, or storefront design was modified.

STOP — Phase 6.6 only.