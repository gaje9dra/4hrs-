# Phase 5.1 — Catalog Discovery Architecture Audit

## Scope

Audit and harden the existing public catalog discovery system for shop, category, and collection listing. No cart, checkout, payment, order, shipping, authentication, review, or provider-specific logic was added. Locked technology and the Phase 2 canonical catalog architecture remain unchanged.

## Routes

The canonical Phase 3 taxonomy routes are:

- `/shop`
- `/categories/[slug]`
- `/collections/[slug]`

The Phase 5.1 wording `/category/[slug]` is not introduced because Phase 3 established the plural `/categories/[slug]` route contract. Adding a singular alias would create duplicate taxonomy URLs.

All three routes render the shared `CatalogListing` server component.

## Data flow

Verified source architecture:

Browser → Storefront Route → `lib/storefront/catalog.ts` → Catalog Query Service → Catalog Repository → DB.

The route components do not import Prisma, the DB client, or repository functions directly. Presentation components consume public storefront DTOs.

## Catalog integrity

Published product discovery is guarded by the canonical repository publication predicate:

- product status ACTIVE
- non-empty title
- non-empty slug
- non-empty currency
- non-negative product price

Category and collection filters additionally require ACTIVE taxonomy entities.

The public listing select exposes product-card-safe data and customer-facing availability. Provider/internal fields such as SKU, on-hand quantity, reserved quantity, audit information, and provider metadata are not passed to listing presentation.

Price filters use effective product/active-variant pricing rules, and in-stock filtering follows the canonical inventory availability rules.

## Fix applied

A genuine taxonomy publication boundary issue was found.

Previously, `getStorefrontCategory(slug)` and `getStorefrontCollection(slug)` accepted any entity returned by the slug lookup, including ARCHIVED entities. Their product queries filtered inactive taxonomy relationships, but the taxonomy page itself could still resolve and render an archived category/collection shell.

Fixed in `lib/storefront/catalog.ts`:

- archived/missing category → `CatalogServiceError("CATEGORY_NOT_FOUND", ...)`
- archived/missing collection → `CatalogServiceError("COLLECTION_NOT_FOUND", ...)`

The existing route loaders already translate those public errors to the framework not-found boundary.

A source-level regression assertion was added to `tests/storefront-listing.test.ts`.

## Listing system

Verified:

- shared `CatalogListing`
- shared `ProductGrid` and `ProductCard`
- bounded page-size pagination
- canonical sort allowlist
- category, collection, tag, price, and in-stock filters
- normalized URL state
- deterministic secondary ID ordering in repository queries
- contextual merchandising for category/collection listings
- explicit empty state
- shared catalog error/not-found boundaries
- accessible previous/next pagination
- provider-neutral presentation

Malformed URL values are normalized or ignored before entering the catalog query service.

## SEO and accessibility

Verified source contracts:

- `/shop` metadata with canonical URL
- category/collection metadata through canonical Phase 2 SEO helpers
- canonical catalog URL construction
- indexability based on active/valid catalog entities
- one primary H1 per listing page
- semantic breadcrumb navigation
- native labelled form controls
- visible focus treatment
- accessible pagination labels and current-page state
- customer-facing availability text
- accessible empty-state recovery

## Responsive and performance review

Source review covers the established responsive system from 320px through 1920px.

The listing remains server-rendered. No browser-side catalog fetching or client-side pagination was introduced. Product data is bounded by canonical page limits, and filter metadata is fetched in parallel.

No new dependency, breakpoint system, catalog architecture, or client-state layer was introduced.

## Scope / diff audit

Compared with the Phase 4.4 audit commit, only these files changed:

- `lib/storefront/catalog.ts`
- `tests/storefront-listing.test.ts`

The changes are limited to public taxonomy publication handling and its regression test.

## Validation

Source-level audit: completed.

Runtime validation could not be executed through the available GitHub repository integration:

- `npm run lint`
- `npm run typecheck`
- `npm run build`
- browser smoke for `/shop`, category, and collection pages
- measured 320px–1920px browser viewport checks
- runtime keyboard/focus testing
- runtime reduced-motion testing
- runtime image/layout-shift/network inspection

No GitHub Actions workflow was present in the repository to substitute for these checks.

## Remaining issue

Required runtime validation remains outstanding. The implementation and source-level architecture audit are complete, but Phase 5.1 cannot claim runtime readiness without those checks.

## Final readiness

NOT READY FOR PHASE 5.2
