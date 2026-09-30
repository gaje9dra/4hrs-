# Phase 5.3 — Production Category Listing System

## Category resolution architecture

The canonical category storefront URL is `/category/[slug]`. The pre-existing `/categories/[slug]` route is retained only as a permanent legacy redirect to the singular canonical URL, preserving query parameters without creating a competing content route.

Category resolution remains server-side through the existing catalog query service. Slugs are normalized and validated by the catalog layer; missing, invalid, and inactive categories resolve to the normal Next.js not-found behavior rather than exposing internal errors.

Published product membership is resolved by the catalog repository/query layer. The category listing never infers membership from browser state.

## Public category DTO

`StorefrontCategory` contains only storefront taxonomy fields: name, slug, description, SEO title/description, active status, published-product presence, and breadcrumb names/slugs. Internal category IDs, parent IDs, and provider metadata are not exposed through the category DTO.

Category media is not present in the established catalog schema, so no synthetic media or placeholder metadata was invented.

## Listing integration

The category page reuses the Phase 5.2 `CatalogListing`, `CatalogFilters`, `CatalogPagination`, `ProductGrid`, `ProductCard`, and canonical query parser. Category context is injected into the canonical query before the product request and is also preserved in pagination URLs.

Sorting, filtering, pagination, public availability, lifecycle predicates, deterministic ordering, and bounded page size remain owned by the canonical catalog query/repository architecture. Category pages do not create a second listing system.

## URL behavior

Canonical category URLs are produced by `categoryPath()` and `categoryCanonicalUrl()`. Filter/sort/page query parameters remain query parameters on the category URL. The category slug is authoritative even if a client supplies an unrelated `category` query parameter.

Legacy plural category URLs permanently redirect to the singular canonical route and preserve query parameters.

## SEO behavior

Category metadata uses canonical category SEO title/description when supplied and falls back to the real category name. No keyword-stuffed copy or fabricated category description is generated. The canonical URL is the singular `/category/[slug]` route, and invalid/inaccessible categories are not rendered as indexable pages.

## Empty and not-found behavior

- Missing, invalid, or inactive categories: not-found behavior.
- Active category with zero published products: explicit empty-category state.
- Active category with published products but zero results after filters: normal filtered-empty listing state.
- Active category with results: normal production listing.

The published-product count used to distinguish an empty category from a filtered-empty result is resolved in the catalog repository without loading the category's entire product set.

## Accessibility and responsive behavior

The existing listing supplies semantic headings, breadcrumb navigation, labeled filter controls, keyboard-accessible controls, visible focus states, accessible pagination, live result counts, meaningful product-image alt text, and non-color-only availability states. Existing responsive grid and Bauhaus primitives are retained rather than replaced.

Browser viewport coverage required by the phase remains a smoke-test responsibility. The GitHub file-edit environment does not provide a browser runtime, so 320px through 1920px visual execution could not be independently run here.

## Performance and security

Category lookup and published-product membership remain server-side. Product listings are paginated at the catalog service/repository boundary, only public catalog fields are selected, and the primary product image is the listing media boundary. No ORM access exists in UI components.

Category slug validation, public lifecycle enforcement, allowlisted sorting, bounded pagination, and safe error handling are enforced before or within the catalog service boundary.

## Testing

Added category-focused tests for canonical slug resolution, invalid/missing/archived categories, empty-category detection, category-scoped merchandising pagination, and rejection of merchandising order without category/collection context.

Updated shared listing tests and catalog query mocks to remain compatible with the hardened public taxonomy contract.

Automated lint, typecheck, tests, production build, and browser smoke execution could not be run through the available GitHub file-edit interface. No CI workflow result was available for the final commit during this phase, so runtime/build validation remains a non-blocking environment limitation rather than a claimed pass.

## Scope audit

Phase 5.3 changes are limited to category route resolution, canonical category routing/SEO, public taxonomy DTO hardening required by the shared listing boundary, category-specific empty-state handling, category tests, and phase documentation. No cart, wishlist, checkout, payment, order, shipping, authentication, review, provider integration, or Phase 6+ functionality was introduced.