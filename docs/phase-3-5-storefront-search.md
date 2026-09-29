# Phase 3.5 — Storefront Search & Advanced Product Discovery

## 1. Search architecture
The public search page uses the existing Phase 2.7 provider-neutral search abstraction. The route calls `searchStorefrontProducts()`, which calls `searchPublic()` from `lib/catalog/search.ts`. No ORM, database, provider API, or external search engine is accessed by the route.

```
Browser → /search → Storefront Search Data Layer → Catalog Search Service → Database Search Adapter → Catalog Search Repository → Canonical Product data
```

## 2. Search route
Implemented `/search` with the canonical `q` parameter. A missing or whitespace-only query renders a useful search landing state rather than an error.

## 3. Query normalization
The route removes control characters, trims leading/trailing whitespace, and collapses repeated whitespace. The Phase 2.7 search service remains authoritative for the full search normalization contract, including the 100-character limit and wildcard escaping.

## 4. Search service integration
Search uses `searchStorefrontProducts()` → `createCatalogSearchService().searchPublic()`. Public lifecycle visibility and provider neutrality remain owned by the canonical search/catalog layer.

## 5. Result mapping
Search results reuse the Phase 3.4 `StorefrontProductCard`, `ProductGrid`, and `ProductCard` path. Internal SKU, inventory ledger, provider, and audit fields are not exposed.

## 6. Filters
Search composes with the existing Phase 2.6 filters: category, collection, tags, tag mode, minimum price, maximum price, and availability. The search query is preserved when filters are submitted or cleared.

## 7. Sorting
Only the existing canonical catalog sort values are exposed. No new ranking algorithm is introduced.

## 8. Pagination
Existing Phase 2.6 offset pagination is reused. Pagination links preserve `q`, filters, and sorting through the existing URL-state builder.

## 9. Empty and no-results states
`/search` without a query shows a search landing state with a reusable accessible search form. A valid query with zero products shows a query-specific no-results state and a real `/shop` escape route.

## 10. Error handling
Search failures render the existing customer-safe `CatalogErrorState`. Raw SQL, Prisma, database, provider, and stack-trace details are not exposed.

## 11. SEO/indexability
Search metadata uses canonical `/search` and `noindex,follow`, preventing arbitrary search-query URLs from becoming uncontrolled SEO landing pages.

## 12. Accessibility
The search form uses semantic `role="search"`, an accessible label, native GET submission, shared visible focus styling, and keyboard-operable controls. Existing filter and pagination accessibility from Phase 3.4 is retained.

## 13. Responsive behavior
The search input uses the established responsive grid and minimum touch-target sizing. The existing product grid, filters, pagination, and storefront container are reused.

## 14. Performance
The primary search flow is a normal server GET request. There is no live autocomplete, debounce loop, client-side catalog fetch, full-result pagination, or external search request. Pagination remains bounded by the canonical catalog limits.

## 15. Provider neutrality
No provider-specific branches were added. Manual and imported products are searched through the canonical Product catalog.

## 16. Testing
Added `tests/storefront-search.test.ts` covering route/service boundaries, noindex behavior, canonical `q` handling, normalization, search/filter composition, listing reuse, provider neutrality, and customer-safe error handling.

## 17. Known limitations
Runtime browser validation and npm command execution must be performed in the local executable repository environment. The GitHub connector can inspect and modify source but cannot truthfully claim browser smoke, viewport, keyboard, or reduced-motion execution.

## 18. Deferred functionality
- external search engines
- AI/semantic/vector search
- recommendation/personalization
- full autocomplete engine
- search analytics
- admin search management
- cart, wishlist, checkout, payments, orders, shipping, provider integrations

## 19. Files/components changed
- `app/(storefront)/search/page.tsx`
- `components/storefront/search-input.tsx`
- `components/storefront/catalog-listing.tsx`
- `components/storefront/catalog-filters.tsx`
- `tests/storefront-search.test.ts`
- `docs/phase-3-5-storefront-search.md`

## 20. Final readiness

NOT READY FOR PHASE 3.6

Blocking issue: source implementation is complete and source-reviewed, but the required local runtime validation — lint, typecheck, tests, production build, browser smoke, responsive viewport checks, keyboard checks, and reduced-motion checks — has not been executed through the available GitHub integration. No runtime pass is claimed.

STOP — Phase 3.5 only.
