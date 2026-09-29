# Phase 3.1 — Storefront Application Architecture & Catalog Integration

## Architecture

Browser → App Router storefront route → storefront data/view-model layer → canonical Catalog Query/Search Service → Catalog Repository → database.

Storefront routes never import Prisma, the database client, or provider APIs. The public data layer in lib/storefront/catalog.ts maps canonical catalog results into customer-facing contracts.

## Routes

The existing Phase 2 canonical URL helpers use provider-neutral plural paths, so the storefront preserves them:

- / — existing homepage
- /shop — public catalog listing
- /categories/[slug] — public category
- /collections/[slug] — public collection
- /products/[slug] — public product detail
- /search — public search

The exact route helpers in lib/catalog/routes.ts remain authoritative for product/category/collection canonical URLs.

## Public catalog boundary

Public routes use listPublishedProducts(), getPublishedProductBySlug()/the new public product-detail projection, and searchPublic(). Product lifecycle/publication readiness, active variants, product-level media, canonical pricing, availability, category/collection visibility, and canonical pagination/filter semantics remain owned by Phase 2.

No React component recreates publication or inventory rules.

## DTO/view-model strategy

lib/storefront/catalog.ts defines the storefront boundary.

Product cards expose only:
- id, title, slug, customer URL
- primary image URL/alt text
- canonical display price/compare-at price/currency
- customer-facing availability state

Product detail exposes the canonical public projection:
- product content and SEO fields
- ordered product media
- active variants without SKU
- variant media/options/pricing/availability
- assigned option types/values
- active category/collection/tag names and slugs

Internal SKU, inventory quantities, reservations, audit data, provider metadata, and credentials are excluded.

## Page composition

Routes are thin server components. They retrieve data through lib/storefront/catalog.ts and pass view models to presentational components.

Reusable storefront components include ProductCard, ProductGrid, ProductDetail, CatalogPagination, and safe catalog state/error components.

## Server/client strategy

Initial catalog data is fetched server-side in App Router server components. Only the storefront error boundary is a client component because framework error recovery requires client behavior.

No catalog page is converted into a client-rendered application.

## SEO

Product, category, and collection pages call the Phase 2 SEO helpers and expose title, description, canonical URL, and robots metadata. Search is explicitly noindex/follow to avoid accidental arbitrary-query canonicalization. /shop has descriptive metadata without inventing a new catalog canonical URL.

Canonical product/category/collection URLs are generated through lib/catalog/routes.ts rather than IDs or provider slugs.

## Loading/error/not-found

The storefront route group has a compact accessible loading boundary, a safe error boundary, and a not-found boundary. Product/category/collection loaders translate expected public not-found errors to the framework notFound() response. Unexpected failures reach the safe error boundary without exposing ORM/SQL/stack details in the UI.

## Caching/revalidation

No new caching library or Redis dependency was introduced. Public catalog reads use the framework's existing server-rendering behavior. The phase deliberately avoids aggressive static caching because product availability and catalog publication can change.

## Media/pricing/availability

Media uses the canonical Phase 2 product/variant media projection and preserves ordering/alt text. Pricing is received from the canonical effective-price calculation. Availability is reduced to a customer-facing state; on-hand/reserved quantities are not rendered.

## Merchandising

Category and collection product queries default to Phase 2 merchandising ordering. No bestseller, trending, popularity, or synthetic ranking is introduced.

## Responsive/accessibility

Storefront composition reuses Container, Card, Badge, Button patterns, global Bauhaus tokens, CSS breakpoints, focus-visible rules, semantic landmarks, heading hierarchy, accessible image alt text, and non-color-only availability labels. Product grids are mobile-first and use existing breakpoints; no page-specific breakpoint system was introduced.

## Security boundaries

No public route exposes:
- Prisma records
- audit events
- provider metadata/credentials
- inventory quantities/reservations
- internal SKU values
- database errors or stack traces

Route parameters are normalized/validated by canonical catalog query services before public lookup.

## Testing

Added storefront contracts and route foundations. Runtime validation remains dependent on an executable repository environment.

Required validation:
- lint
- typecheck
- unit tests
- integration tests
- production build
- browser smoke tests for all public routes

## Phase 3.1 scope exclusions

No cart, wishlist, customer authentication/accounts, checkout, addresses, payments, orders, fulfillment, shipping/tracking, provider APIs/webhooks, admin catalog UI, product creation/editing UI, external search engine, recommendation engine, coupon/discount system, or analytics dashboard is implemented.
