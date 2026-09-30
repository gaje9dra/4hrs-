# Phase 3.7 — Product Detail Refinement, Merchandising & Conversion Layer

## Status
Phase 3.7 source implementation is complete. Runtime validation is intentionally not claimed until the local project validation gate is executed.

## Refinement goals
Phase 3.7 builds directly on Phase 3.6 and improves information hierarchy, detail readability, variant semantics, merchandising continuity, accessibility, responsive behavior, and future commerce readiness without implementing commerce transactions.

## Product-detail composition
The page now follows the established composition:
1. Breadcrumb/context
2. Product identity and short description
3. Availability and options
4. Variant-aware price/availability presentation
5. Deferred commerce action area
6. Structured product information
7. Curated discovery

The existing Bauhaus layout, borders, hard shadows, typography, and color tokens are reused.

## Product information sections
ProductDetailSections reuses the existing Phase 1 Accordion component. It creates sections only from canonical public fields currently available:
- Description
- Categories
- Collections
- Tags

Materials, fit, care, shipping, delivery, returns, sustainability, and other unsupported claims are deliberately omitted because those fields are not present in the canonical product DTO.

Long descriptions are split at paragraph boundaries instead of being rendered as one monolithic text block.

## Variant UX
The existing canonical variant matrix remains authoritative. Option values are evaluated against actual variant option-value relationships.

Unavailable combinations are disabled using canonical availability. Controls expose selected state through aria-pressed, retain native disabled semantics, and keep visible text indicating unavailable combinations.

Initial selection is deterministic: the first available canonical variant is preferred; otherwise the first variant is used. An unavailable variant is never intentionally selected when an available variant exists.

Variant-specific price, compare-at price, availability, and media remain derived from the selected canonical variant.

## Media behavior
The existing product gallery remains the only media component. Product media ordering comes from the canonical query projection. Variant media replaces the displayed gallery when supplied and falls back to product media when absent.

Gallery selection resets when its media source changes, preventing stale thumbnail indexes after variant changes.

Products without media receive the existing Bauhaus-compatible fallback rather than a fake image or broken media control.

## Merchandising / related products
The current canonical catalog model does not expose a dedicated explicit related-product relationship. Therefore no fabricated merchandising relationship was introduced.

Related discovery uses deterministic precedence:
1. the first canonical collection by stable slug ordering
2. the first canonical category by stable slug ordering

Both bounded collection/category queries are evaluated concurrently. Results are merged deterministically, the current product is excluded, duplicates are removed, and the result is capped at four cards.

No AI, popularity, bestseller, random, personalized, or provider-specific recommendation logic is used.

## Category / collection discovery
Canonical category and collection relationships are rendered as links using the existing storefront route conventions. Internal IDs are not exposed in URLs.

## Breadcrumbs
Breadcrumb context remains semantic and accessible. Collection context is preferred over category context, with stable slug ordering used when multiple relationships exist. Only existing relationships are rendered.

## Future commerce boundary
The existing future-action area remains presentation-only. No cart state, Add to Cart, Buy Now, checkout, payment, order, shipping, wishlist, review, or authentication behavior was added.

## Accessibility
The refinement preserves:
- one meaningful H1
- semantic breadcrumb navigation
- fieldset/legend option groups
- native disabled controls
- aria-pressed selected state
- keyboard gallery controls
- visible focus states
- semantic Accordion controls
- aria-expanded/aria-controls accordion relationships
- meaningful primary image alt text
- decorative thumbnail alt suppression
- no color-only availability state
- no keyboard trap

The existing Accordion received an explicit focus-visible treatment and reduced-motion transition suppression.

## Responsive behavior
The existing mobile-first product split is retained. Detail sections use stacked accordion presentation on smaller screens and a two-column arrangement at larger widths.

Target validation remains:
- 320px
- 375px
- 390px
- 430px
- 1024px
- 1280px
- 1440px
- 1920px

No horizontal-scroll behavior was intentionally introduced.

## SEO
Phase 3.6 canonical product routing and metadata remain unchanged. The refinement does not create alternate product URLs or query-parameter canonical URLs.

## Performance
The refinement avoids new data fetching in client components. Related-product discovery is bounded and executes the collection/category queries concurrently. Only local interactive components remain hydrated.

No dependency was added for accordion, carousel, animation, recommendations, or search.

## Server/client boundaries
Server-side:
- product retrieval
- SEO metadata
- related-product discovery
- product detail section rendering
- canonical catalog relationships

Client-side:
- gallery selection
- option selection
- local accordion state

No storefront component accesses Prisma or a provider API directly.

## Public-data safety
The refinement continues to consume StorefrontProductDetail, which maps the canonical public product detail result and strips inventory quantities and other internal availability data down to public states.

No provider credentials, provider metadata, supplier costs, audit history, or administrative fields are added to the browser-facing model.

## Testing
Added static/source coverage for:
- reuse of existing product-detail architecture
- Accordion reuse
- canonical-field-only detail sections
- semantic variant states
- bounded deterministic related-product discovery
- exclusion of commerce transaction implementation

Runtime lint, typecheck, unit/integration tests, production build, browser smoke, responsive, keyboard, and reduced-motion checks remain pending local execution.

## Known limitations
- The current canonical model has no explicit related-product relationship, so explicit merchandising precedence cannot be implemented without extending the catalog model/service in a later dedicated phase.
- Materials, fit, care, shipping, return, delivery, and sustainability fields are not currently part of the public product DTO and therefore are not rendered.
- Browser visual validation requires a local running application.

## Future integration points
Future commerce phases can attach transactional actions to the existing action area and consume the canonical selected variant. The current client state is presentation-only.

## Files changed
- components/storefront/product-detail.tsx
- components/storefront/product-detail-sections.tsx
- components/storefront/product-options.tsx
- components/storefront/product-gallery.tsx
- components/storefront/product-detail-interactive.tsx
- lib/storefront/catalog.ts
- components/ui/accordion.tsx
- tests/storefront-product-detail-refinement.test.ts
- docs/phase-3-7-product-detail-refinement-merchandising.md

## Validation status
Required local commands:

npm run lint
npm run typecheck
npm test
npm run build

Required browser checks include valid/invalid products, unpublished products where testable, variants, variant media, pricing, out-of-stock state, mobile/desktop layouts, keyboard interaction, gallery interaction, canonical URL, metadata, and reduced-motion behavior.

Final readiness:

NOT READY FOR PHASE 3.8

Blocking condition: runtime validation has not been executed through the available repository integration.