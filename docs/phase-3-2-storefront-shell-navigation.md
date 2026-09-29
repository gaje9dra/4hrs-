# Phase 3.2 — Storefront Global Shell, Header, Navigation & Footer Integration

## 1. Objective

Integrate the existing Phase 1 global shell into the Phase 3.1 customer storefront without adding commerce functionality.

## 2. Existing shell reused

The existing root app/layout.tsx, Container, HeaderBrand, SkipLink, Footer, Bauhaus tokens, and established responsive/focus styles remain the shell foundation.

The root layout now fetches storefront navigation data once and passes the resulting public navigation model to the server-rendered Header and Footer; only interactive navigation subcomponents require client behavior.

## 3. Header architecture

The Header is server-rendered. Route-aware desktop state lives in DesktopNav and mobile menu state/focus behavior lives in MobileNav.

The brand continues to use the existing HeaderBrand implementation and links to /.

The desktop navigation is rendered by DesktopNav. The mobile menu is rendered by the existing MobileNav. No second shell or mobile-navigation architecture was introduced.

## 4. Navigation architecture

lib/storefront/navigation.ts is the provider-neutral navigation boundary.

Navigation contains only implemented public destinations:

- Home: /
- Shop: /shop
- Categories: published/active category links
- Collections: published/active collection links
- Search: /search

Category and collection URLs are generated through categoryPath() and collectionPath() from the canonical catalog route helper.

No provider IDs, database IDs, provider URLs, admin URLs, or unpublished entities are placed into navigation.

## 5. Navigation data source

The navigation data layer uses createCatalogQueryService() and its public listActiveCategories() / listActiveCollections() methods.

The Header does not query Prisma or the database directly.

The Footer derives its catalog link groups from the same navigation model, preventing duplicate catalog-fetching logic.

## 6. Mobile navigation behavior

The existing mobile navigation was extended to render the same canonical navigation tree.

Behavior includes:

- accessible menu trigger
- visible focus states
- Escape-to-close
- focus return to the trigger
- keyboard Tab containment while open
- body scroll suppression while open
- route navigation through Next.js links
- active route state
- nested category/collection links
- no hover-only dependency

The implementation remains a client component; the rest of the shell stays server-rendered where possible.

## 7. Footer architecture

The existing near-black Bauhaus Footer remains authoritative.

Footer catalog groups are derived from the public navigation model and include only supported Shop, Category, and Collection links. Search is included under Shop.

Empty legal/social groups remain empty rather than inventing unsupported pages or external destinations.

## 8. Route integration

The shell wraps the existing Phase 3.1 routes through the root layout:

- /
- /shop
- /categories/[slug]
- /collections/[slug]
- /products/[slug]
- /search

The Shop navigation section remains active for /shop, category, collection, and product routes. Search remains active for /search and its query-string variants. Home uses exact matching.

The repository's canonical routes are plural (/categories, /collections, /products) and remain authoritative over illustrative singular examples in the phase brief.

## 9. Server/client boundaries

Server:
- root layout
- storefront navigation data
- Footer
- desktop navigation
- brand and other presentational shell components

Client:
- Desktop navigation, because it reads the current pathname
- Mobile navigation, because it owns menu state, pathname state, focus, Escape, and body interaction

No catalog page was converted into a client application.

## 10. Accessibility behavior

The shell preserves:

- skip navigation to #main-content
- semantic header, nav, main, and footer
- labeled primary/mobile navigation regions
- aria-current active states
- keyboard-visible focus
- accessible menu trigger and close control
- Escape handling
- focus containment while mobile navigation is open
- focus return to the trigger
- touch-sized controls

Navigation meaning is not communicated by color alone.

## 11. Responsive behavior

The existing Phase 1 responsive strategy remains in use.

Desktop navigation is shown at the established md breakpoint. Mobile navigation is shown below it.

The shell continues to use the shared Container, existing typography, borders, hard shadows, solid color blocks, and Bauhaus breakpoints. No separate shell breakpoint or container system was introduced.

## 12. Data/caching strategy

Navigation is resolved server-side through the existing catalog service during root-layout rendering.

No new cache, Redis layer, external search service, provider API, or aggressive static revalidation strategy was introduced.

Because navigation is derived from active catalog entities, archived/inactive category and collection records are not exposed through this boundary.

## 13. Tests performed

Added tests/storefront-shell.test.ts covering:

- root shell landmarks and skip link
- catalog-backed navigation source
- implemented navigation destinations
- active-state wiring
- mobile Escape/focus behavior
- search entry without an external search engine
- footer navigation derivation
- Bauhaus design-token preservation

## 14. Validation results

Static source review and GitHub diff review were performed.

Runtime validation could not be completed in the available execution environment. The repository/dependency environment is not available locally for reliable execution of:

- npm run lint
- npm run typecheck
- npm test
- npm run build
- browser smoke tests at the required viewport sizes

No runtime pass is claimed.

## 15. Known limitations

1. Dynamic category and collection navigation increases the root-layout data dependency because the global shell needs current public catalog navigation.
2. Legal and social footer sections remain empty because no corresponding supported destinations are currently implemented.
3. Browser-level responsive, hydration, keyboard, and visual validation remain unverified until the project can be executed with its dependencies.

## 16. Deferred functionality

This phase does not implement:

- cart
- wishlist
- authentication/accounts
- checkout
- payments
- orders
- shipping/returns
- provider integrations
- navigation CMS
- admin navigation management
- search-engine implementation
- product/category/collection CRUD

## 17. Files/components changed

- app/layout.tsx
- components/layout/header.tsx
- components/layout/desktop-nav.tsx
- components/layout/mobile-nav.tsx
- components/layout/footer.tsx
- config/navigation.ts
- types/navigation.ts
- lib/storefront/navigation.ts
- tests/storefront-shell.test.ts
- docs/phase-3-2-storefront-shell-navigation.md

## Final readiness

NOT READY FOR PHASE 3.3

Blocking reason: runtime lint, typecheck, tests, production build, and browser smoke validation have not been executed successfully in the available environment. The implementation is therefore not being represented as runtime-validated.
