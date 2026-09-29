# Phase 3.4 — Storefront Shop, Category & Collection Listing System

## 1. Objective

Phase 3.4 extends the Phase 3.1–3.3 storefront architecture into the reusable public catalog listing experience for shop, category, and collection discovery.

The implementation remains provider-neutral and consumes the canonical Phase 2 catalog query, publication, availability, filtering, sorting, pagination, SEO, and merchandising contracts.

## 2. Shop architecture

The shop route is:

- `/shop`

It loads normalized URL state through `lib/storefront/query-params.ts`, retrieves products through `getStorefrontProducts()`, and renders the shared `CatalogListing` server component.

The default shop sort is the canonical `newest` query behavior. No browser-side catalog fetching or browser-side pagination is used.

## 3. Category architecture

The existing Phase 3.1 canonical route convention is preserved:

- `/categories/[slug]`

The public category loader resolves the active category through `getStorefrontCategory()`. Product results use `getStorefrontCategoryProducts()`, which preserves canonical merchandising ordering unless a supported URL sort is supplied.

Unknown or unpublished categories use the framework not-found boundary.

## 4. Collection architecture

The existing Phase 3.1 canonical route convention is preserved:

- `/collections/[slug]`

The public collection loader resolves active collections through `getStorefrontCollection()`. Product results use `getStorefrontCollectionProducts()`, preserving canonical merchandising order by default.

Unknown or unpublished collections use the framework not-found boundary.

## 5. Listing data contract

The reusable listing consumes `StorefrontProductList`:

- product-card-safe items
- pagination
- total result count
- applied canonical query

Filter option data is exposed through the storefront boundary as minimal public DTOs. Complete ORM entities are not passed into presentation components.

## 6. Product grid

`ProductGrid` and the Phase 3.3 `ProductCard` are reused. Product cards expose only public title, canonical product URL, primary image, price, compare-at price, currency, and customer-facing availability.

No provider metadata, SKU, inventory quantities, or internal identifiers are displayed.

## 7. Product card

The Phase 3.3 product card remains the single product-card implementation. Phase 3.4 does not introduce a duplicate card or add-to-cart behavior.

## 8. Sorting

The UI exposes only the canonical Phase 2 sort contract:

- newest
- oldest
- price ascending
- price descending
- title ascending
- title descending
- updated
- merchandising where category/collection context permits it

Sorting is submitted as URL state and executed by the canonical catalog query service. No client-side full-result sorting is performed.

## 9. Filtering

The listing foundation exposes only filters supported by the canonical query contract:

- category
- collection
- tags
- minimum price
- maximum price
- availability / in-stock

Category and collection context is fixed on their respective listing pages so the UI does not duplicate the route's taxonomy context.

## 10. Pagination

The existing offset/page pagination contract is preserved. The listing never fetches the complete catalog for browser pagination.

Pagination retains supported URL filter/sort state and provides:

- previous navigation
- next navigation
- current page
- total pages
- accessible labels and `prev/next` relationships

## 11. URL state

Incoming listing parameters are normalized in `lib/storefront/query-params.ts` before they reach the catalog query service.

Normalization covers:

- canonical category/collection slugs
- allowlisted sort values
- positive page/page-size values
- valid decimal money strings
- repeated/comma-separated tags
- in-stock state

Malformed values fall back to ignored/default values instead of being passed arbitrarily into database queries.

## 12. SEO

Shop metadata provides a descriptive title, description, `/shop` canonical URL, and index/follow behavior.

Category and collection metadata continues to use the Phase 2 public SEO helpers and canonical URL helpers.

No duplicate SEO generation system was introduced.

## 13. Availability

Availability remains owned by the canonical catalog/inventory domain layer. Listing UI consumes the resulting public availability state only.

Exact on-hand quantities, reserved quantities, and inventory ledger information are not exposed.

## 14. Merchandising

Category and collection listing defaults preserve Phase 2 merchandising semantics. No bestseller, popularity, trending, recommendation, or synthetic ranking is introduced.

Shop uses the canonical default/newest discovery behavior.

## 15. Server/client boundaries

Listing pages remain Server Components. URL query state is handled by App Router server `searchParams` and native GET forms.

No client component or `useEffect` catalog-fetching layer was introduced.

The filter controls use semantic HTML form controls, so sorting/filtering works without a client-side state framework.

## 16. Performance

Listing requests remain bounded by the canonical page-size limit.

Filter metadata is fetched in parallel through `getStorefrontListingFilters()`. Product listing data is fetched through one canonical catalog query per page.

The implementation does not load complete product variants, provider records, audit records, or inventory ledgers into the listing UI.

## 17. Accessibility

Implemented/retained:

- one H1 per listing page
- breadcrumb navigation for category/collection context
- semantic filter labels
- keyboard-operable native form controls
- visible focus treatment
- accessible pagination labels
- current-page indication
- non-color-only availability labels from the existing product card
- accessible empty-state action
- meaningful product links

## 18. Responsive behavior

The listing uses the established Bauhaus container and grid breakpoints:

- mobile: compact stacked controls and 1–2 column product presentation
- tablet: responsive multi-column product grid and wrapped controls
- desktop: 3–4 column grid with expanded filter layout

No new breakpoint system was introduced.

## 19. Tests

Added `tests/storefront-listing.test.ts` covering:

- listing routes use the shared server component
- canonical sort values
- URL query normalization
- malformed filter handling
- empty-state and pagination accessibility
- provider/internal-field boundaries

Updated the existing storefront architecture test for the normalized tag query contract.

## 20. Known limitations

Runtime validation still depends on the user's executable repository environment. The connected GitHub repository interface does not execute the project's npm commands or browser automation.

The current phase therefore cannot truthfully claim local lint, typecheck, test, production-build, or browser-smoke success from the repository connector alone.

## 21. Deferred functionality

Not implemented:

- advanced search
- search-engine integration
- product detail redesign
- cart
- wishlist
- authentication
- checkout
- payments
- orders
- shipping
- reviews
- recommendations
- discount/coupon systems
- provider integrations
- admin catalog/merchandising UI

## 22. Files/components changed

- `app/(storefront)/shop/page.tsx`
- `app/(storefront)/categories/[slug]/page.tsx`
- `app/(storefront)/collections/[slug]/page.tsx`
- `app/(storefront)/loading.tsx`
- `components/storefront/catalog-filters.tsx`
- `components/storefront/catalog-listing.tsx`
- `components/storefront/catalog-pagination.tsx`
- `lib/storefront/catalog.ts`
- `lib/storefront/query-params.ts`
- `tests/storefront-architecture.test.ts`
- `tests/storefront-listing.test.ts`
- `docs/phase-3-4-storefront-listing-system.md`

## Final readiness

NOT READY FOR PHASE 3.5

Blocking issue: runtime validation required by the phase specification — lint, typecheck, tests, production build, browser smoke, responsive viewport checks, keyboard checks, and reduced-motion checks — has not been executed through the available GitHub integration. The Phase 3.4 implementation is present on `main` and has been source-reviewed, but no runtime pass is claimed.
