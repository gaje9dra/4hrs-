# Phase 3.3 — Storefront Homepage & Catalog Discovery Experience

## 1. Objective
Replace the Phase 1 foundation homepage with the customer-facing 4HRS storefront homepage while keeping all catalog access behind the Phase 3.1 storefront data boundary.

## 2. Homepage architecture
The route is now app/(storefront)/page.tsx.

Browser → homepage route → getStorefrontHomeCatalogData() → public catalog query/merchandising services → canonical repository/database.

The homepage UI does not import Prisma, the database client, provider APIs, or provider-specific product models.

## 3. Section structure
The homepage uses a limited narrative:
1. Hero
2. Featured catalog discovery
3. Shop by category
4. New arrivals
5. Collections
6. Editorial collection block when verified collection description exists
7. Final Shop All CTA

Empty optional discovery sections collapse instead of rendering awkward empty-state blocks.

## 4. Homepage data contract
StorefrontHomeData contains only homepage-safe data:
- featuredProducts
- newArrivals
- categories
- collections
- editorialCollection

Product data is the existing StorefrontProductCard DTO. Internal SKU, inventory quantities, audit data, provider metadata, and credentials are not exposed.

## 5. Product discovery strategy
Featured discovery is sourced from the first active canonical collection with a usable editorial description returned by the existing catalog service and ordered through the existing merchandising query contract. No artificial score is introduced.

New arrivals use the existing newest catalog sort. Featured product IDs are removed from the new-arrival set so the two sections do not intentionally duplicate the same products.

The homepage uses four featured products and up to four new arrivals.

No bestseller, trending, popularity, view-count, recommendation, AI, or behavioral ranking is implemented.

## 6. Category discovery
Categories come from listActiveCategories() and are bounded to six entries in the homepage data layer.

Every category link is generated with the canonical categoryPath() helper. No category is invented for visual completeness.

## 7. Collection discovery
Collections come from listActiveCollections() and are bounded to three entries.

Every collection link is generated with the canonical collectionPath() helper. Only active collections returned by the public catalog service are exposed.

## 8. Hero implementation
The hero is server-rendered and split asymmetrically:
- blue editorial copy panel
- yellow primary CTA
- catalog-backed product media when available
- geometric red/yellow/blue treatment when media is unavailable

The primary CTA links to /shop.

The hero contains one semantic H1 and does not introduce cart or checkout actions.

## 9. Media strategy
Homepage product imagery uses the canonical product media URL/alt-text fields already exposed by the storefront DTO.

The hero prioritizes its first real catalog image for the initial visual. Product-card images remain below-the-fold lazy images.

No provider URL is hardcoded.

The existing aspect-ratio treatment prevents image regions from collapsing while loading.

## 10. Pricing
lib/storefront/money.ts formats the canonical money representation without performing sale, tax, shipping, or discount arithmetic.

Product cards use this formatter for both canonical price and compare-at price.

## 11. Responsive behavior
The homepage is mobile-first and uses the existing container, typography, breakpoint, border, shadow, and spacing tokens.

The main layout transitions through stacked mobile sections, responsive grids, and larger asymmetric editorial layouts on desktop.

No separate responsive design system was introduced.

## 12. Accessibility
Implemented/retained:
- one logical homepage H1
- semantic section landmarks
- labelled discovery sections
- keyboard-accessible links and CTAs
- descriptive product image alt text
- decorative geometric elements marked aria-hidden
- visible focus states from the existing design system
- touch-sized primary controls
- existing reduced-motion behavior

The hero product image is not hidden behind a decorative parent role, preserving its meaningful alternative text.

## 13. SEO
The homepage route provides:
- title
- meta description
- root canonical path
- index/follow robots behavior
- Open Graph title/description

No new SEO package or duplicate catalog SEO service was introduced.

Product/category/collection SEO remains owned by the existing Phase 2/3.1 helpers.

## 14. Performance
Homepage catalog loading is batched:
- newest products, active categories, and active collections are requested concurrently
- featured products are fetched with one bounded collection query when a collection exists
- no query is executed per product, category, or collection
- product discovery limits are small and deterministic
- no client-side useEffect catalog fetching was introduced
- no new cache, Redis layer, external search engine, or aggressive revalidation strategy was added

## 15. Server/client boundaries
The homepage route and all homepage presentation components are server components.

No homepage component was converted to a client component.

Existing interactive client components from the global shell remain isolated to their required scope.

## 16. Provider neutrality
The homepage has no provider branching and does not distinguish manual products from imported/provider-backed products.

All products enter the UI through the canonical storefront product DTO.

## 17. Tests
Added tests/storefront-homepage.test.ts covering:
- server-rendered homepage route and SEO metadata
- homepage data contract
- bounded discovery sets
- canonical collection merchandising source
- conditional section rendering
- canonical category/collection routes
- provider/commerce boundary checks
- money formatting without UI arithmetic

The test suite was not executable in the available repository runtime during this phase.

## 18. Validation results
GitHub source/diff review was performed after implementation.

The following runtime commands were not successfully executed in the available environment:
- npm run lint
- npm run typecheck
- npm test
- npm run build
- browser smoke tests at the required viewport sizes

No runtime pass is claimed.

## 19. Known limitations / blockers
The implementation is source-reviewed, but runtime validation remains unverified because the project dependencies/runtime are not available for reliable local execution in this environment.

This blocks the final readiness gate because the phase specification requires lint, typecheck, tests, production build, and browser smoke validation before readiness can be declared.

## 20. Deferred functionality
Not implemented in Phase 3.3:
- catalog listing page changes
- category/collection page redesign
- advanced search
- product detail changes
- cart
- wishlist
- authentication/accounts
- checkout
- payments
- orders
- shipping/returns
- provider integrations
- Qikink integration
- admin UI
- CMS
- recommendation engines
- bestseller/trending algorithms
- discount/coupon systems
- inventory management UI

## 21. Files/components changed
- app/(storefront)/page.tsx
- components/storefront/homepage.tsx
- components/storefront/product-card.tsx
- lib/storefront/catalog.ts
- lib/storefront/money.ts
- tests/storefront-homepage.test.ts
- docs/phase-3-3-storefront-homepage.md
- removed the previous foundation-only app/page.tsx

## Final readiness
NOT READY FOR PHASE 3.4

Blocking issue: the connected GitHub repository integration supports source and diff inspection but does not provide a project shell for dependency installation, npm command execution, or browser automation. Required runtime lint, typecheck, test, build, browser smoke, responsive viewport, keyboard, and reduced-motion checks therefore remain unverified. No runtime pass is claimed.