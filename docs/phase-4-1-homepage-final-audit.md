# Phase 4.1 — Homepage Final Architecture & Conversion Audit

## Audit scope

Phase 4.1 audits and hardens the existing `/` homepage without rebuilding it.

The audit was performed against:
- the Phase 1 foundation and final Phase 1 audit
- the Phase 2 catalog foundation and final Phase 2.15 hardening
- the Phase 2.11 merchandising foundation
- Phase 3 storefront architecture and homepage/product experience work
- Phase 3.8 product-detail hardening

The homepage remains server-first and storefront-only. No cart, wishlist, checkout, payments, orders, shipping, customer authentication, reviews/ratings, provider-specific purchasing, or Qikink-specific storefront logic was introduced.

## Prior-phase architecture used

The Phase 1 final audit establishes the application direction as a provider-neutral Next.js App Router foundation with reusable layout/UI/Bauhaus primitives and infrastructure boundaries outside customer-facing presentation.

Phase 2.15 establishes the canonical catalog as the source of product identity, lifecycle, relationships, pricing, media, SEO, variants/options, inventory availability, and deterministic merchandising.

Phase 2.11 establishes:
- Category as product-family classification.
- Collection as curated merchandising grouping.
- Relationship-scoped `isFeatured`, `priority`, and `position`.
- Deterministic merchandising order:
  1. `isFeatured` descending
  2. `priority` descending
  3. `position` ascending
  4. Product `createdAt` descending
  5. Product title ascending
  6. Product ID ascending
- New arrivals from Product `createdAt), with no redundant `isNew` flag.
- No bestseller, trending, recommendation, popularity, or analytics score.

## 1. Homepage architecture

### Verified flow

The current homepage follows:

Browser
→ `app/(storefront)/page.tsx`
→ `getStorefrontHomeCatalogData()`
→ public Catalog Query Service / Storefront Catalog boundary
→ canonical Catalog Repository
→ canonical database

The route is a server component and does not access Prisma directly.

`components/storefront/homepage.tsx` receives `StorefrontHomeData` and remains presentation-only.

### Boundary findings

PASS:
- No direct Prisma import in homepage UI.
- No database client access in homepage UI.
- No provider API calls in homepage UI.
- No Qikink/Printful/Printrove/Printify storefront branch.
- No homepage-specific product model.
- No duplicate product-card implementation.
- Canonical `ProductCard` is reused.
- Canonical route helpers are reused for category/collection links.

## 2. Homepage content

Current source-backed structure:

1. Hero
2. Curated product discovery
3. Shop by category
4. New arrivals
5. Collections
6. Editorial collection block
7. Final CTA
8. Footer remains owned by the existing storefront shell/layout rather than duplicated inside homepage content.

A separate benefits/value block is not forced because the canonical catalog currently provides no data contract for benefits, service promises, customer metrics, or other proof points.

No fake metrics, customer counts, reviews, ratings, bestseller claims, trending claims, or placeholder product records were added.

### Refinement

The previous `Featured` heading was changed to `Curated picks`.

Reason:
- The underlying source is a real active collection with an editorial description.
- Products are ordered through the canonical merchandising query, where relationship-scoped featured state is authoritative.
- There is no global featured-product flag in the Phase 2.11 model.

The new wording therefore describes the actual source rather than implying a global featured-product system.

## 3. Catalog data

Homepage products originate from the public storefront catalog DTO.

Product discovery uses:
- published catalog products only
- canonical product title
- canonical slug
- canonical primary media
- canonical price/currency
- canonical compare-at value when valid
- canonical public availability state

Product links use the canonical product path helper.

No homepage-specific product data model was introduced.

### Published-only enforcement

The homepage product queries pass through the public catalog query/repository boundary.

The repository publication predicate requires:
- `status: ACTIVE`
- non-empty title
- non-empty slug
- non-empty currency
- non-negative product price

Draft and archived products are excluded.

### Product cards

The shared `components/storefront/product-card.tsx` remains the only product-card implementation used by homepage product discovery.

The card uses:
- Next Image
- canonical image URL/alt text
- canonical product path
- canonical money formatter
- canonical public availability
- canonical compare-at value

No client-side price arithmetic is performed.

## 4. Merchandising

### Curated picks

Curated product discovery is sourced from the first deterministic active collection with:
- published-product membership
- an editorial description

The collection is obtained from the canonical collection service and is deterministically ordered by name then ID.

Its products are requested through the existing merchandising sort.

No random ordering, popularity score, AI recommendation, bestseller algorithm, or trending algorithm was introduced.

### New arrivals

New arrivals use:

`getStorefrontProducts({ pageSize: 8, sort: "newest" })`

The catalog `newest` sort is based on canonical Product `createdAt).

No `isNew` field was introduced.

Curated-pick product IDs are removed from the new-arrival presentation set so the two sections do not intentionally duplicate the same products.

### Determinism

All homepage discovery sets are bounded and deterministic:
- curated products: up to 4
- new arrivals: up to 4 after de-duplication
- categories: up to 6
- collections: up to 3

## 5. Category discovery

The homepage now uses a dedicated public catalog discovery boundary:

`listActiveCategoriesWithPublishedProducts()`

This filters category visibility at the repository boundary to:
- ACTIVE category
- at least one related product satisfying the canonical published-product predicate

This prevents an empty active category from being presented as a populated storefront destination.

Category ordering remains deterministic:
- parent ID
- category name
- category ID

Category links use `categoryPath()`.

No category-specific homepage model or query was added.

## 6. Collection discovery

The homepage now uses:

`listActiveCollectionsWithPublishedProducts()`

This filters collection visibility at the repository boundary to:
- ACTIVE collection
- at least one related product satisfying the canonical published-product predicate

This prevents empty active collections from being presented as populated discovery destinations.

Collection ordering remains deterministic:
- collection name
- collection ID

Collection links use `collectionPath()`.

### Collection media

The Phase 2.11 canonical Collection model has no collection-media field. The homepage therefore does not fabricate collection imagery or introduce a parallel collection-media model.

The collection presentation uses only canonical collection identity/description and Bauhaus geometry.

## 7. Hero

The hero retains the established 4HRS Bauhaus identity.

Current behavior:
- concise headline
- concise supporting copy
- one clear primary CTA
- real `/shop` destination
- optional product visual sourced from canonical curated/new-arrival data
- decorative geometric composition
- existing color/design tokens

The hero does not contain a dead CTA or invented campaign statistic.

The visual product uses Next Image with `priority` because it is part of the above-the-fold hero composition.

If no product image exists, the hero falls back to decorative geometry rather than fake product media.

## 8. Product discovery

The product discovery sections reuse the shared ProductCard.

Verified fields:
- image
- title
- price
- compare-at price when present in the public DTO
- availability
- canonical product link

The homepage does not duplicate card markup.

Missing product media uses the existing card fallback rather than generated/fake imagery.

## 9. Category and collection empty-state behavior

The homepage conditionally omits:
- product discovery when the product set is empty
- category discovery when categories are empty
- collection discovery when collections are empty
- editorial collection content when no eligible editorial collection exists

The page never inserts fake catalog records to preserve a visual slot.

The new repository methods also prevent empty categories/collections from entering homepage discovery in the first place.

## 10. Bauhaus design audit

The homepage preserves the Phase 1 design system.

Verified source usage remains based on:
- `#F0F0F0`
- `#121212`
- `#D02020`
- `#1040C0`
- `#F0C020`
- strong black borders
- hard-offset shadows
- square-card geometry
- geometric circles/triangles/blocks
- bold typography
- asymmetric editorial compositions
- solid color blocks

No gradients, glassmorphism, blur effects, soft generic shadows, or generic rounded ecommerce cards were introduced.

Decorative geometry is marked `aria-hidden` through the existing Bauhaus geometry primitives or directly on decorative elements.

## 11. Responsive audit

The source continues to use the existing mobile-first responsive system.

Required viewport matrix:
- 320px
- 375px
- 390px
- 430px
- 640px
- 768px
- 820px
- 1024px
- 1280px
- 1440px
- 1920px

Static review covers:
- wrapping CTA controls
- responsive product grid: one column below 640px, two columns at small/tablet widths, four columns on large desktop
- category grid adaptation
- collection grid adaptation
- bounded geometric layers
- responsive typography inherited from the Phase 1 token system
- `overflow-hidden`/existing global horizontal-overflow protection

Runtime viewport inspection was not executable through the connected GitHub repository integration.

## 12. Accessibility

Source verification confirms:
- one homepage H1
- logical H2/H3 section structure
- semantic section landmarks
- native links/buttons
- canonical visible focus treatment from global CSS
- meaningful product image alt text
- decorative geometry hidden from assistive technology
- touch-sized CTA/link controls
- availability is represented with text, not color alone
- reduced-motion support is inherited from the centralized Phase 1 motion system

The category decorative hover transform was removed during this phase rather than adding a second motion exception.

Real keyboard, screen-reader, contrast tooling, and reduced-motion browser checks remain runtime validation items.

## 13. SEO

Homepage metadata is defined in the server route:

- title: `4HRS — Fashion by Design`
- description: `Explore the live 4HRS fashion catalog through a bold Bauhaus-inspired storefront.`
- canonical: `/`
- robots: index/follow
- Open Graph title/description
- Open Graph type: website

No duplicate metadata system was introduced.

The homepage does not emit product/provider IDs in its canonical URL.

## 14. Performance

Source-level findings:
- homepage route remains server-rendered
- catalog data is loaded server-side
- homepage UI is not marked `use client`
- no new dependency was introduced
- hero image uses Next Image and `priority`
- product-card imagery uses Next Image and responsive `sizes`
- product discovery is bounded
- collection/category discovery is bounded
- category/collection populated checks are executed through repository queries rather than per-category/per-collection product fetch loops
- no homepage catalog-wide client fetch was introduced
- no recommendation engine was introduced
- no animation library was introduced

The populated category/collection filtering is a single canonical relational query per discovery type and avoids an N+1 homepage loop.

Runtime profiling and Core Web Vitals measurement were not available.

## 15. Public data safety

Homepage presentation consumes public storefront DTOs and catalog service outputs.

The homepage does not render:
- SKU
- supplier cost
- internal inventory quantities
- reservation quantities
- audit records
- audit metadata
- provider credentials
- provider synchronization metadata
- admin-only fields

Availability is reduced to the public state vocabulary.

The repository methods used for category/collection discovery only return public category/collection fields and use the published-product predicate for existence checks.

## 16. Error / empty states

The homepage route retains its server-side error behavior:
- known CatalogServiceError values are preserved for the existing storefront error boundary
- unexpected failures are converted to a safe generic homepage loading error with the original cause retained server-side

Empty catalog states omit the relevant sections rather than displaying fabricated products or metrics.

Missing hero/product media uses existing visual fallbacks.

## 17. Provider neutrality

Source review found no homepage/provider branch for:
- Qikink
- Printrove
- Printful
- Printify
- supplier credentials
- provider API calls

Manual and imported/provider-backed products enter homepage discovery through the same canonical catalog boundary.

No provider ordering or provider media contract is used by homepage presentation.

## 18. Testing

Updated source-level homepage tests cover:
- server-rendered route
- SEO metadata
- public catalog service usage
- bounded discovery sets
- canonical merchandising usage
- canonical category/collection routes
- conditional empty-state sections
- no fake commerce/recommendation/provider behavior
- canonical money formatting
- Next Image usage
- populated category/collection discovery methods
- reuse of the canonical published-product predicate
- absence of fabricated editorial fallback copy
- accurate `Curated picks` wording

### Runtime validation

The available GitHub repository integration does not provide an executable project shell or browser automation for this repository.

Therefore the following are **not verified**:
- `npm run lint`
- `npm run typecheck`
- `npm test`
- `npm run build`
- desktop browser smoke
- mobile browser smoke
- hero CTA click-through in a real browser
- product/card link click-through in a real browser
- category/collection navigation in a real browser
- new-arrival runtime rendering
- keyboard navigation in a real browser
- image-loading runtime behavior
- horizontal-overflow runtime checks
- responsive viewport matrix
- reduced-motion browser verification
- screen-reader verification
- Core Web Vitals/performance profiling

The repository's current package scripts define these commands, but source access alone cannot truthfully represent their execution as passed.

## 19. Git diff / cleanup review

Phase 4.1 application changes are intentionally limited to:
- `lib/catalog/repository.ts`
- `lib/catalog/query.ts`
- `lib/storefront/catalog.ts`
- `components/storefront/homepage.tsx`
- `tests/storefront-homepage.test.ts`
- `docs/phase-4-1-homepage-final-audit.md`

The changes:
- add public populated category discovery
- add public populated collection discovery
- wire those methods through the existing catalog query service
- use those methods for homepage discovery
- rename the visually misleading `Featured` section to `Curated picks`
- remove an unreachable invented editorial fallback
- remove an unnecessary category decorative hover rotation
- extend homepage source-level tests
- document the audit

No unrelated database schema, commerce system, authentication system, payment system, shipping system, order system, dependency, or provider integration was changed.

## 20. Known limitations

1. Required runtime lint/typecheck/test/build execution remains unavailable through the repository integration.
2. Browser smoke and viewport validation remain unavailable.
3. Keyboard and reduced-motion behavior are source-reviewed but not runtime-verified.
4. Screen-reader verification remains unavailable.
5. Collection media is not available in the canonical Phase 2.11 model, so no collection-image system was invented.
6. Benefits/value content is not forced because no canonical data contract exists for it.
7. There is no global featured-product flag; curated picks intentionally use the canonical collection merchandising system instead.

## Final checklist

- [x] homepage architecture verified
- [x] canonical catalog data used
- [x] published products only
- [x] real merchandising only
- [x] no fake metrics
- [x] no fake reviews
- [x] no fake bestseller/trending data
- [x] hero CTA points to `/shop`
- [x] product links use canonical product paths
- [x] category links use canonical category paths
- [x] collection links use canonical collection paths
- [x] Bauhaus system preserved
- [ ] responsive browser validation
- [x] accessibility source audit
- [x] SEO source audit
- [x] performance architecture reviewed
- [x] public data safe by source review
- [x] no provider-specific storefront logic
- [x] no direct ORM access in homepage UI
- [ ] lint validated
- [ ] typecheck validated
- [ ] tests executed
- [ ] production build validated
- [x] Git diff/source cleanup reviewed
- [x] documentation complete

## Final readiness

NOT READY FOR PHASE 4.2

Blocking condition: required executable validation (lint, typecheck, tests, production build, browser smoke, responsive viewport, keyboard, reduced-motion, and accessibility runtime checks) is unavailable through the current GitHub repository integration.
