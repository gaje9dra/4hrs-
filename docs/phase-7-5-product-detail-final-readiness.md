# Phase 7.5 — Product Detail Final Readiness

## Scope

This phase audits the existing Product Detail System and its purchase-intent boundary before Cart work. It does not implement Cart, Wishlist, authentication, checkout, payments, orders, shipping, fulfillment, inventory reservation, reviews, or provider-specific commerce APIs.

Audited areas:

- `app/(storefront)/product/[slug]/page.tsx`
- `components/storefront/product-detail.tsx`
- `components/storefront/product-detail-interactive.tsx`
- `components/storefront/product-detail-sections.tsx`
- `components/storefront/product-gallery.tsx`
- `components/storefront/product-options.tsx`
- `lib/storefront/catalog.ts`
- `lib/storefront/variant-selection.ts`
- `lib/catalog/query.ts`
- `lib/catalog/repository.ts`
- `lib/catalog/routes.ts`
- `lib/catalog/seo.ts`
- PDP regression tests

## Final PDP architecture

The route remains server-first:

`/product/[slug]` → storefront catalog service → catalog query service → repository → public storefront DTO → server ProductDetail → client-only gallery/options interactions.

The route does not access Prisma or the database directly. Product loading is request-cached so metadata and page rendering share the same canonical product resolution path.

Published-product enforcement remains at the catalog repository/query boundary. Invalid canonical slugs are rejected before repository access, and missing published products resolve through the storefront not-found path.

## Product and variant data flow

The PDP receives authoritative catalog fields for title, descriptions, media, catalog relationships, currency, price, compare-at price, options, variants, and public availability state.

Internal inventory quantities are not exposed through the storefront DTO. Variant SKU data is not included in the public mapped variant contract.

Variant integrity is validated server-side before the detail result is exposed. A variant must use declared option types and values, contain the complete option matrix, and not duplicate another combination.

Variant-specific price, compare-at price, availability, and media remain derived from the selected canonical variant.

## Purchase intent contract

The minimum future Cart handoff remains:

- `productId`
- `variantId`
- `quantity`

The current PDP prepares this contract only in memory. It is not persisted, submitted, or sent to a Cart API.

The fixed Phase 7 purchase-intent quantity is `1`. No quantity UI or client-controlled price is introduced in this phase.

The contract is provider-neutral: it contains no SKU requirement, fulfillment-provider identifier, payment data, shipping data, or reservation data.

## Variant selection and CTA state model

The centralized selection engine validates:

1. option type ownership;
2. declared option value ownership;
3. required option completion;
4. exact variant combination resolution;
5. current public availability.

Purchase intent states are:

- `PRODUCT_UNAVAILABLE`
- `MISSING_REQUIRED_SELECTION`
- `INVALID_SELECTION`
- `UNAVAILABLE`
- `READY`

The CTA remains deliberately disabled because Cart does not exist in this phase. A READY state means the selection contract is internally valid; it does not mean an order, reservation, payment, or Cart mutation occurred.

Pending action, duplicate-action prevention, recoverable mutation failures, and unexpected action failures remain Cart-phase concerns because there is intentionally no asynchronous purchase mutation in Phase 7.5.

## Cart readiness boundary

The intended boundary is:

Product Detail
→ Purchase Selection Contract
→ Cart Entry Boundary
→ Cart System

The PDP has no knowledge of Cart persistence, Cart schema, Cart totals, inventory reservation, order creation, payment processing, fulfillment providers, or shipping records.

No premature Cart coupling was introduced.

## Pricing and availability authority

Displayed pricing is derived from the canonical catalog query result. Variant price overrides product price when present. Compare-at price is sanitized against the effective selling price at the server boundary.

The client uses catalog values for display and selection only. The future Cart server must independently resolve current price and availability rather than trusting a client-provided price.

No inventory reservation occurs in this phase.

## Media and presentation

The existing gallery:

- uses Next Image;
- preserves stable aspect-ratio containers;
- supports multiple images;
- resets selection when variant media changes;
- provides a deliberate missing/broken-media fallback;
- provides keyboard-operable thumbnail buttons;
- uses catalog alt text with a product-title fallback;
- respects reduced-motion behavior.

No promotional or provider imagery was introduced.

## Merchandising

Related products continue to use existing collection/category merchandising surfaces. Results are deterministic, bounded, self-excluding, and deduplicated by public product slug.

No recommendation engine, personalization, popularity signal, fake bestseller/trending data, or fabricated social proof was introduced.

## SEO and indexing

Canonical product URLs continue to come from the shared catalog route helper.

Active valid products receive canonical metadata, title, description, and index/follow directives. Draft, archived, invalid, and missing products are not exposed as indexable public products.

Open Graph metadata is derived from the same canonical SEO contract.

Product structured data is intentionally not fabricated. In particular, no reviews, ratings, aggregateRating, brand, or variant-ambiguous offers are synthesized. Structured data should only be added when its representation can exactly match authoritative visible product/variant data.

## Accessibility

The PDP uses a semantic H1, labeled product-media and option regions, fieldsets/legends for options, keyboard-operable buttons, visible focus rings, pressed/disabled option states, accessible image labels, and a polite live region for pricing/availability changes.

The deferred purchase CTA exposes its state with `aria-disabled` and `aria-describedby`.

No keyboard trap or custom focus-management system was introduced.

## Responsive and Bauhaus validation

The existing responsive structure and Bauhaus styling were preserved. No gradients, glassmorphism, soft shadows, generic rounded cards, or unrelated visual redesign was added.

Required manual viewport validation remains:

- 320px
- 375px
- 640px
- 768px
- 1024px
- 1280px
- 1440px
- 1920px

Because a browser/runtime was not available through the repository tooling for this phase, these viewports were not physically smoke-tested.

## Performance

The existing server-first product loader remains request-cached. Related product queries remain bounded to the existing merchandising page sizes and deduplicate before rendering.

No speculative cache, index, search engine, infrastructure, or state-management layer was introduced.

The existing client boundary is limited to interactive gallery/option behavior.

## Security and data exposure

The public route continues to consume the storefront service rather than direct database access.

The public DTO excludes internal availability quantities and provider-only data. Selection resolution rejects undeclared option types, non-string values, empty values, incomplete selections, and combinations that do not resolve to a displayed product variant.

Client-side price values are presentation data only.

Customer, authentication, payment, fulfillment, and provider credentials/data are not exposed by the PDP.

## Observability and failure handling

Existing catalog diagnostics distinguish invalid catalog queries, not-found conditions, catalog data-integrity failures, database failures, unexpected application failures, and slow-search observations.

PDP not-found handling remains safe and customer-facing catalog errors do not expose database details.

Invalid variant selection and unavailable-variant states are currently local purchase-intent states because there is no purchase mutation to submit or log. Invalid quantity, pending action, recoverable mutation failure, and unexpected purchase-action failure remain intentionally absent until a Cart action exists.

## Cross-surface regression

The PDP continues to consume the same public catalog route/query foundations used by Shop, Category, Collection, and Search.

This phase also corrected PDP detail-section navigation so category and collection links use the shared singular canonical route helpers rather than legacy plural paths.

The discovery chain remains:

Homepage
→ Shop
→ Category
→ Collection
→ Search
→ Product Detail

No duplicate PDP query implementation was introduced.

## Code-quality cleanup completed

- Restored canonical category/collection links in product detail sections.
- Updated stale Phase 7.3 regression assertions to the current deferred CTA label.
- Added Phase 7.5 regression coverage for canonical links.
- Added explicit product-level unavailable purchase-intent state.
- Added regression coverage for the minimal, provider-neutral purchase contract.
- Preserved the existing architecture and avoided unrelated refactors.

## Validation performed

Repository/source validation performed:

- inspected the current main-branch PDP route and shared catalog boundaries;
- inspected variant-selection and purchase-intent logic;
- inspected public storefront DTO mapping;
- inspected catalog repository/query boundaries;
- inspected SEO and canonical route helpers;
- inspected existing PDP tests;
- reviewed the resulting Phase 7.5 changes at source level.

Runtime validation was not available in this environment. The following therefore remain unverified:

- `npm run lint`
- `npm run typecheck`
- `npm test`
- integration tests
- production build
- browser/E2E tests
- production-style route checks
- live valid/missing/unpublished product smoke tests
- live variant/availability scenarios
- keyboard smoke tests
- all required responsive viewport checks

GitHub reported no CI status checks for the Phase 7.4 starting commit, so no CI result is being represented as validation.

## Known non-blocking / environment limitations

The PDP architecture is source-complete for the Phase 7 boundary, but production readiness cannot be certified without executing the repository checks and browser smoke suite.

Cart-specific mutation states and quantity validation are intentionally deferred because implementing them here would violate the phase boundary.

## Final readiness decision

Phase 7.5 source-level hardening is complete. Runtime and browser validation remain outstanding, so the Product Detail System cannot be certified as production-ready for Phase 8 from this environment.
