# Phase 3.6 — Storefront Product Detail & Product Experience

## Implementation summary

Implemented the customer-facing `/product/[slug]` product detail experience on top of the existing public catalog/storefront architecture. The implementation reuses the canonical published-product detail query and public storefront DTO, adds interactive media and option selection, and keeps commerce actions deferred.

No cart, wishlist, checkout, payment, order, shipping, review, authentication, provider-specific purchasing logic, or database schema change was introduced.

## Route architecture

~~~text
Browser
  → /product/[slug]
  → Storefront Product Query
  → Public Catalog Service
  → Catalog Repository
  → Canonical Catalog Data
~~~

The route remains a server component. Product data is resolved through `lib/storefront/catalog.ts`; storefront components do not import Prisma or provider APIs.

## Product data flow and public DTO

The existing `PublishedProductDetailResult` is mapped to `StorefrontProductDetail`. The public contract includes product content, SEO fields, ordered product media, active variants, option metadata, variant media/pricing/availability, category/collection/tag context, and aggregate availability.

Internal SKU, provider metadata, credentials, inventory quantities, reservations, audit data, fulfillment costs, and admin fields are not exposed.

## Media/gallery architecture

`ProductGallery` is a focused client component for image selection. Product media is ordered by the canonical repository projection, which prioritizes primary media. Secondary media uses native buttons for keyboard and touch interaction. The selected primary image is prioritized through Next Image.

Variant media replaces the gallery when a selected variant has media; product media remains the fallback.

## Option and variant-selection architecture

`ProductOptions` uses the actual option types and values from the canonical product detail DTO. It does not assume Size + Color. Selection is stored locally and matched against canonical variant option-value relationships.

Impossible combinations are disabled. Selection controls expose `aria-pressed`, visible selected state, focus-visible styling, keyboard operation, and adequate touch targets. Variant-specific price, compare-at price, availability, and media are used when a complete selection resolves to a variant.

No database mutation occurs from option selection.

## Pricing behavior

Displayed prices come from canonical product/variant effective prices and the existing storefront money formatter. Compare-at pricing is shown only when supplied by the canonical model. No discount percentage or UI-side pricing calculation is invented.

## Availability behavior

Customer-facing availability is reduced to `IN_STOCK`, `LOW_STOCK`, `OUT_OF_STOCK`, or `UNTRACKED`. Internal inventory quantities and reservation values are not rendered.

## SEO behavior

The product route uses the existing Phase 2 SEO helper and canonical URL helper. The canonical product URL is `/product/[slug]`. Metadata includes title, description, canonical URL, robots, and Open Graph website metadata.

Invalid/unavailable products use the existing `notFound()` path; unexpected query failures remain server errors handled by the storefront error boundary.

Product structured data was not added because the current architecture does not provide a dedicated structured-data contract that can safely guarantee all required fields without introducing a new SEO system.

## Merchandising / related products

`getStorefrontRelatedProducts()` reuses canonical category/collection merchandising queries. It chooses a deterministic collection context first, then category context, and filters the current product from the result.

No AI, popularity, bestseller, random, personalized, or synthetic recommendation logic is used. If no legitimate merchandising context exists, the related section is omitted.

## Accessibility

The page has one H1, semantic sections, a labelled media region, keyboard-operable gallery controls, keyboard-operable option controls, visible focus states, selected-state semantics, non-color-only option labels, meaningful primary-image alternatives, and no keyboard traps.

## Responsive behavior

The page is mobile-first. Gallery and product information stack on small screens and use an editorial split on desktop. Controls wrap rather than overflow. Existing Bauhaus borders, shadows, colors, and typography are reused.

Required viewport validation:
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

## Motion

Only restrained transform feedback is used on interactive controls. Existing CSS motion rules are reused, with interactive transforms disabled under `prefers-reduced-motion: reduce`.

## Performance

Initial product data remains server-fetched. Only gallery and option interaction is hydrated. Product and variant media use Next Image with fixed aspect-ratio containers. Related products are bounded and reuse ProductCard/ProductGrid.

No external carousel, animation, or recommendation dependency was added.

## Server/client boundaries

Server:
- product route and metadata
- canonical product query
- related-product query
- SEO resolution
- product description and discovery data

Client:
- gallery image selection
- option selection
- selected-variant presentation

No database access is moved into client code.

## Security/public-data considerations

The public detail projection excludes provider IDs/metadata, SKU, inventory quantities/reservations, audit data, internal costs, credentials, and database implementation details. Client selection is presentation-only and is not authoritative for future commerce operations.

## Error/loading/not-found

The existing storefront `loading.tsx`, `error.tsx`, and `not-found.tsx` boundaries remain authoritative. The product loader translates only `PRODUCT_NOT_FOUND` into `notFound()` and lets unexpected failures reach the existing safe error boundary.

## Tests and validation

Added static/source coverage for:
- singular product route
- canonical product URL
- public product query/service boundary
- product detail DTO safety
- dynamic option/variant UI
- variant-specific media/pricing behavior
- future-commerce-only action area
- related-product provider neutrality
- SEO/Open Graph metadata
- absence of cart/checkout/payment/review implementation

Runtime lint, typecheck, tests, production build, browser smoke, viewport, keyboard, and reduced-motion checks cannot be claimed from the GitHub integration.

## Known limitations

- Browser smoke testing requires the local executable repository environment.
- Exact visual validation across the full viewport matrix requires a browser.
- Product structured data is deferred until a canonical schema contract exists.
- Future cart/checkout integration must consume the selected canonical variant rather than trusting arbitrary client identifiers.

## Future integration boundary

The red future-action area is presentation-only. Cart, checkout, payment, order creation, and persistence are intentionally deferred to later phases.

## Files changed

- `app/(storefront)/product/[slug]/page.tsx`
- removed/renamed `app/(storefront)/products/[slug]/page.tsx`
- `components/storefront/product-detail.tsx`
- `components/storefront/product-detail-interactive.tsx`
- `components/storefront/product-gallery.tsx`
- `components/storefront/product-options.tsx`
- `lib/storefront/catalog.ts`
- `lib/catalog/routes.ts`
- `docs/phase-3-1-storefront-architecture.md`
- `tests/catalog-seo.test.ts`
- `tests/storefront-product-detail.test.ts`
- `docs/phase-3-6-storefront-product-detail.md`

## Final readiness

NOT READY FOR PHASE 3.7

Blocking condition: runtime validation must still be executed locally. No runtime pass is claimed.
