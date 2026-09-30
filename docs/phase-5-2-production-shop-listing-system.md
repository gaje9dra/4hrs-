# Phase 5.2 — Production Shop Listing System

## Scope and architecture

The /shop surface remains within the existing storefront/catalog boundary:

Browser -> /shop route -> storefront query/data layer -> public catalog query service -> catalog repository -> database.

The route consumes storefront DTOs. Database entities, audit data, provider metadata, inventory internals, and administrative fields are not exposed to the browser. No downstream commerce capability was introduced.

## Query and URL contract

CatalogQuery remains the canonical catalog contract for category, collection, tags, price boundaries, availability, sorting, pagination, and page size.

lib/storefront/query-params.ts is the canonical URL parsing/serialization boundary. Recognized values are validated, normalized, and serialized deterministically. Default sort, default tag matching, false availability, first page, and default page size are omitted from generated URLs. Tags are deduplicated and serialized as a comma-separated list. Unsupported parameters are excluded from generated navigation URLs, and filter changes reset pagination.

The backend remains authoritative for validation, filtering, lifecycle rules, public visibility, sorting, and pagination.

## Shop route and states

/shop is server-rendered and consumes getStorefrontProducts() plus listing filter metadata. The route declares /shop as its canonical URL and public indexing surface.

A route loading boundary provides a catalog-shaped loading state. A route error boundary provides a safe retry/reset state without exposing SQL, stack traces, provider metadata, or other internal errors.

## Filtering, sorting, pagination

Filtering remains server-side. The browser never loads the entire catalog to filter locally.

Only allowlisted catalog sorting modes are available. No trending, popularity, best-selling, or recommendation ranking was introduced.

Pagination remains bounded by the existing catalog query contract, preserves active filter/sort state, uses deterministic navigation URLs, and never requests an unbounded product set.

## Product presentation

The established ProductCard remains the presentation boundary and consumes StorefrontProductCard. Product URLs use the canonical route helper, prices use the storefront money formatter, and availability is restricted to public states.

The existing product grid and card continue to use the approved Bauhaus visual system and responsive layout primitives.

## SEO, accessibility, performance, security

/shop retains unique metadata and canonical /shop indexing behavior. Filtered URLs are not emitted as separate indexable landing-page metadata.

The listing provides semantic headings, labeled controls, keyboard-accessible inputs/selects/buttons, focus states, accessible pagination, and live result counts.

Product data stays server-rendered; listing media is limited to the primary image; responsive image sizes and lazy loading are used. Query values are allowlisted and normalized before repository use, page size remains bounded, and internal errors are not rendered.

## Testing and QA

Added unit coverage for query normalization, malformed recognized parameters, canonical URL serialization, default removal, unsupported-parameter exclusion, and pagination reset.

Full lint, typecheck, unit/integration tests, production build, and browser smoke tests require the repository's configured local environment/database and browser runtime. Phase 5.3 is not started by this phase.