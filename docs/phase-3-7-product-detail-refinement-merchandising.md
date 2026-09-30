# Phase 3.7 — Product Detail Refinement & Merchandising

## Changes

Phase 3.7 refines the Phase 3.6 `/product/[slug]` experience while preserving the existing server-first storefront and canonical catalog boundary.

Implemented:
- refined PDP hierarchy
- canonical breadcrumbs for collection/category/product context
- dynamic canonical option/variant UX
- deterministic default variant selection
- variant-specific pricing, compare-at pricing, availability, and media
- product media gallery with keyboard/touch controls
- broken/missing-image fallback without generated imagery
- structured product information using only fields present in the public DTO
- related-product discovery using existing catalog merchandising queries
- deterministic deduplication and self-exclusion
- accessible future-commerce presentation slot
- explicit Accordion focus and reduced-motion hardening
- expanded Phase 3.7 source-level tests
- this documentation

No cart, wishlist, checkout, payment, order, shipping, authentication, review/rating, provider-specific purchasing, or Qikink-specific storefront logic was added.

## Components

### `components/storefront/product-detail.tsx`

Server component responsible for the PDP composition and semantic breadcrumb trail.

Breadcrumb relationships are derived from canonical collection/category arrays and use canonical slug routes. Internal IDs are not placed in URLs.

### `components/storefront/product-detail-interactive.tsx`

Small client island containing only local gallery/variant interaction.

The initial media source prefers the first canonical variant that is not out of stock and falls back to product media.

### `components/storefront/product-options.tsx`

Reuses the Phase 2.9 option/variant data model.

Option types and values are rendered dynamically from `product.options`. No Size/Color-specific engine is introduced.

Combination availability is evaluated against the actual canonical variant option relationships. Out-of-stock combinations cannot be treated as selectable.

Selected controls expose `aria-pressed` and `aria-disabled`, retain native disabled behavior, and provide visible focus treatment.

### `components/storefront/product-gallery.tsx`

Uses canonical ordered product/variant media and Next Image.

Supports:
- one image
- multiple images
- no images
- broken image fallback
- meaningful primary-image alt text
- decorative thumbnail alt suppression
- fixed aspect-ratio media regions
- keyboard-operable buttons
- touch-sized controls
- reduced-motion interaction behavior

No fake imagery is generated.

### `components/storefront/product-detail-sections.tsx`

Uses the existing Phase 1 Accordion.

Only canonical public fields currently available are rendered:
- Description
- Categories
- Collections
- Tags

Materials, fit, care, shipping, delivery, return, sustainability, ratings, and reviews are not fabricated because they are not present in the current public product DTO.

### `components/ui/accordion.tsx`

Existing reusable Accordion is retained. Phase 3.7 adds explicit focus-visible treatment and reduced-motion transition suppression.

### `lib/storefront/catalog.ts`

Continues to be the public storefront boundary.

`getStorefrontRelatedProducts()`:
- uses canonical collection/category relationships
- uses canonical merchandising sorting
- bounds each source query to eight cards
- evaluates collection/category sources concurrently
- excludes the current product
- removes duplicates
- caps final related results at four

No complete catalog fetch, AI recommendation, popularity score, random selection, personalization, or provider query is used.

## Variant behavior

The canonical Phase 2.9 variant model remains authoritative.

The selection algorithm:
1. starts from the first variant whose public availability is not `OUT_OF_STOCK`
2. maps each configured option type to that variant's option value
3. evaluates every candidate value against actual variant relationships
4. disables combinations that have no non-out-of-stock matching variant
5. resolves the complete selection to the matching canonical variant
6. derives effective price, compare-at price, availability, and media from that variant

If no variant is available, the product-level canonical price/availability remains the fallback.

Internal SKU values are not rendered.

## Media behavior

Product media and variant media come from the canonical catalog projection.

When the selected variant supplies media, that media becomes the gallery source. Otherwise the product media remains the source.

Gallery selection resets whenever the media source changes.

If a selected image fails to load, the UI renders an explicit unavailable-image state instead of generating or substituting fake product imagery.

## Merchandising

The existing Phase 2 merchandising ordering remains authoritative.

The current canonical public product model does not expose a separate explicit related-product relationship. Therefore Phase 3.7 does not invent one.

Discovery precedence is deterministic:
1. canonical collection context
2. canonical category context

The resulting bounded product sets are merged, deduplicated, self-excluded, and capped at four products.

The existing `ProductGrid` / `ProductCard` implementation is reused.

## SEO

The Phase 2 SEO system remains authoritative.

The PDP:
- uses the canonical `/product/[slug]` route
- uses the canonical product URL helper
- uses public product SEO title/description
- provides canonical metadata
- provides Open Graph title/description/url
- preserves framework not-found behavior for unavailable products
- does not expose IDs in URLs

Product structured data is not added because the current canonical architecture does not expose a dedicated structured-data contract that can safely guarantee all required fields without introducing a separate SEO system.

No ratings, review counts, brand claims, invented pricing, or invented availability are emitted.

## Accessibility

Implemented/source-verified:
- one meaningful PDP H1
- semantic ordered breadcrumb navigation
- fieldset/legend option groups
- keyboard-operable option buttons
- selected-state semantics
- unavailable-state semantics
- visible focus treatment
- keyboard-operable gallery thumbnails
- meaningful primary-image alt text
- decorative thumbnail alt suppression
- semantic Accordion button/region relationships
- no color-only availability messaging
- reduced-motion handling
- no intentional keyboard traps

Decorative Bauhaus geometry remains separate from meaningful content.

## Responsive behavior

The existing Phase 1 mobile-first system is reused.

PDP structure:
- stacked gallery/details on smaller screens
- editorial gallery/details split on desktop
- wrapping option controls
- touch-sized controls
- bounded media aspect ratios
- no new viewport JavaScript or breakpoint system

Required viewport matrix for runtime validation:
- 320px
- 375px
- 390px
- 430px
- 768px
- 1024px
- 1280px
- 1440px

Phase 1 also defines 640px, 820px and 1920px verification points; those remain useful supplemental checks.

## Performance

- product data remains server-fetched
- only gallery and variant interaction are hydrated
- related queries are bounded
- collection/category related queries execute concurrently
- no full-catalog fetch is introduced
- no N+1 product fetch loop is introduced
- existing ProductCard is reused
- no new animation/carousel/recommendation dependency is introduced

## Provider-neutrality verification

The PDP consumes `StorefrontProductDetail` only.

Repository-wide storefront source review found no:
- `provider === "qikink"`
- Qikink-specific storefront branch
- direct provider API call
- provider credential access
- provider metadata rendering

Manual and imported/provider-backed products therefore enter the PDP through the same canonical public product model.

Provider-specific mapping remains outside storefront presentation.

## Public-data safety

The storefront mapper reduces catalog availability to public states and does not expose internal inventory quantities.

The PDP does not render:
- SKU
- provider metadata
- provider credentials
- supplier costs
- inventory quantities
- reservation data
- audit information
- admin fields
- internal integration state

No storefront component imports Prisma or the database client.

## Testing

Added/updated source-level coverage for:
- canonical product route
- server/public catalog boundary
- PDP hierarchy
- dynamic variant options
- deterministic variant selection
- invalid/unavailable combinations
- variant pricing/media
- one/multiple/no-image behavior
- broken-image fallback
- canonical breadcrumbs
- Accordion reuse
- related-product bounds
- deduplication
- self-product exclusion
- commerce/review/provider-specific exclusions
- public DTO safety

### Runtime validation

The repository integration can inspect and modify GitHub source but does not provide an executable project shell or browser automation for this repository.

Therefore the following cannot truthfully be marked passed from this environment:
- `npm run lint`
- `npm run typecheck`
- `npm test`
- `npm run build`
- browser smoke tests
- mobile/desktop viewport checks
- keyboard interaction checks in a real browser
- reduced-motion checks in a real browser
- manual vs imported product runtime comparison

No runtime pass is claimed.

## Known limitations

1. The canonical public DTO currently has no structured Materials/Fit/Care fields, so those sections are omitted rather than fabricated.
2. The canonical public model has no separate explicit related-product relation; collection/category merchandising is therefore used.
3. Product structured data remains deferred until a dedicated safe canonical schema contract exists.
4. Runtime and browser validation require an executable local project environment.

## Future commerce integration

The red future-commerce slot is presentation-only.

A later commerce phase can consume the selected canonical variant for transactional behavior. Phase 3.7 does not create cart state, order state, payment state, or client-authoritative purchase identifiers.

## Files changed in Phase 3.7

- `components/storefront/product-detail.tsx`
- `components/storefront/product-detail-sections.tsx`
- `components/storefront/product-options.tsx`
- `components/storefront/product-gallery.tsx`
- `components/storefront/product-detail-interactive.tsx`
- `lib/storefront/catalog.ts`
- `components/ui/accordion.tsx`
- `tests/storefront-product-detail-refinement.test.ts`
- `docs/phase-3-7-product-detail-refinement-merchandising.md`

## Final checklist

- [x] PDP refined
- [x] variants work at source level
- [x] media behavior implemented
- [x] availability behavior implemented
- [x] breadcrumbs use canonical relationships
- [x] related products use supported catalog relationships
- [x] no fake recommendations
- [x] no fake reviews/ratings
- [x] Bauhaus design preserved
- [x] responsive architecture preserved
- [x] accessibility semantics implemented
- [x] SEO integration preserved
- [x] public DTO safety preserved
- [x] provider-neutral storefront verified by source review
- [x] no direct ORM access in storefront
- [x] tests added/updated
- [ ] runtime tests pass
- [ ] production build validated
- [x] GitHub source/diff review performed
- [x] documentation complete

## Final readiness

NOT READY FOR PHASE 3.8

Blocking condition: the required runtime lint, typecheck, tests, production build, browser smoke, responsive, keyboard, reduced-motion, and manual/imported-product runtime checks cannot be executed through the available GitHub repository integration.
