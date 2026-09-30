# Phase 5.4 — Production Collection Listing System

## Collection resolution

The canonical public collection route is `/collection/[slug]`. Resolution is server-side through the existing catalog query/storefront service. Slugs are normalized and validated by the shared catalog query parser. Missing, invalid, and inactive collections use the normal not-found boundary without exposing lifecycle or database details.

The repository collection lookup selects only storefront-required collection fields plus a filtered published-product count. It does not load the complete collection membership set just to determine whether the collection is empty.

The former `/collections/[slug]` route is retained only as a permanent redirect to the singular canonical URL, including query-string state.

## Merchandising integration

Collection product membership remains owned by the Phase 2 product-collection relationship and the existing merchandising query path. The production listing repository applies the active collection predicate, published-product predicate, merchandising priority/featured/position ordering, and deterministic product tie-breakers.

The collection page does not reconstruct membership in the browser and does not create a second sorting or pagination implementation.

## Public DTO

`StorefrontCollection` exposes only name, slug, description, SEO title/description, active public status, and a boolean indicating whether published products exist.

Internal collection IDs, rule-engine state, audit information, administrative fields, and provider metadata are not exposed. The established schema does not currently provide collection media, so no synthetic media was introduced.

## Listing integration

The page reuses the shared Phase 5.2 `CatalogListing`, `CatalogFilters`, `CatalogPagination`, and `ProductGrid` stack. Collection context is injected into the canonical query before loading products and is preserved in pagination/filter URLs.

Sorting, supported filters, bounded pagination, public availability, lifecycle enforcement, and deterministic ordering remain implemented by the shared catalog architecture.

## URL behavior

Canonical collection links use `/collection/[slug]`. Query parameters such as `page=2`, `sort=price_asc`, tags, price bounds, and stock state remain attached to the canonical collection path.

The collection slug is authoritative: the page overwrites any incoming collection query parameter with the resolved canonical slug before requesting products.

Legacy plural collection URLs permanently redirect to the singular route and preserve query parameters.

## SEO behavior

Collection metadata uses the collection's real SEO title/description when supplied and otherwise uses the real collection name. No fabricated or keyword-stuffed collection description is generated.

The canonical URL is produced by the shared `collectionCanonicalUrl` helper. Invalid/inaccessible collections are not rendered as indexable storefront pages.

## Empty and not-found behavior

- Missing, invalid, or inactive collection: not-found behavior.
- Active collection with zero eligible published products: explicit empty-collection state.
- Active collection with eligible published products but zero results after current filters: shared filtered-empty state.
- Active collection with results: normal production listing.

The empty-collection distinction is based on the server-side filtered published-product count rather than loading the entire collection.

## Presentation, accessibility, and responsive behavior

The collection page reuses the established Bauhaus listing presentation: approved typography and palette, strong borders, hard shadows, reusable controls, and the existing responsive product grid.

The shared listing supplies semantic headings, breadcrumb navigation, labeled filter/sort controls, visible keyboard focus, accessible pagination, live result counts, meaningful product image alt text, and non-color-only availability communication.

Required viewport coverage is 320px, 375px, 640px, 768px, 1024px, 1280px, 1440px, and 1920px. The repository tooling available for this implementation does not provide a browser runtime, so those visual smoke checks could not be independently executed here.

## Performance and security

Collection resolution uses a single indexed slug lookup with a filtered relation count. Product listing remains paginated at the catalog repository boundary and uses the existing public product selection.

No ORM/database access exists in the collection UI. Shared query parsing validates slugs, filters, sort values, prices, and bounded page sizes before repository execution. Public collection status and public product predicates are enforced server-side.

## Testing

Added collection-focused coverage for collection context, merchandising sorting, pagination offset preservation, and singular canonical routing. Existing shared listing tests remain the validation boundary for sorting, filtering, pagination, and URL-state behavior.

Automated lint, typecheck, tests, production build, and browser smoke execution still require a runnable repository environment/CI result. This implementation environment could not execute the repository locally, so those commands are not claimed as passed.

## Scope audit

Phase 5.4 changes are limited to collection resolution, canonical collection routing, collection public DTO hardening, collection-specific empty state, shared collection SEO behavior, collection tests, and documentation. No cart, wishlist, checkout, payments, orders, shipping, authentication, reviews, provider storefront logic, or Phase 5.5+ functionality was introduced.
