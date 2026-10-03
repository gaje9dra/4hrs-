# Phase 15.2 — Performance Engineering, Core Web Vitals & Storefront Delivery Optimization

## Scope

Phase 15.2 optimizes the existing 4HRS+ application without changing catalog semantics, checkout/payment behavior, fulfillment/shipping behavior, authorization, or provider ownership. The work is intentionally limited to verified repository-level performance improvements and regression guards.

## Baseline established from the repository

A source-level production performance audit identified these relevant conditions before the Phase 15.2 changes:

- Public catalog listing queries used a broad `publicCatalogListSelect` projection.
- Listing results selected active variant pricing/inventory data and also loaded category, collection, and tag relations even though `StorefrontProductCard` only renders title, image, price, compare-at price, currency, and availability.
- The primary product-card image already used Next.js `Image`, explicit responsive `sizes`, and lazy loading.
- The homepage hero image already used `priority` and an explicit responsive `sizes` value, making it the appropriate LCP candidate rather than prioritizing the entire product grid.
- Catalog pagination is bounded by `CATALOG_QUERY_PAGE_MAX = 100` and `CATALOG_QUERY_PAGE_NUMBER_MAX = 10000`.
- Public storefront catalog reads are routed through the canonical catalog service/repository layer; no Qikink dependency is present in `lib/storefront/catalog.ts`.
- The root layout uses `next/font/google` with the existing Outfit design-system font and only the 400 weight, avoiding loading unused font weights.
- No application-wide `unstable_cache`, `revalidatePath`, or `revalidateTag` architecture was present. This phase therefore does not introduce a new cache invalidation system that could become inconsistent with admin catalog mutations.

No numerical Core Web Vitals measurements are claimed because a production browser/Lighthouse run is not available in this repository-only validation environment.

## Implemented optimizations

### 1. Bounded public catalog list projection

The public listing projection was narrowed to fields required to construct the canonical storefront product-card DTO:

- product identity/title/slug
- canonical product price fields
- currency/status
- one primary image
- active variant price/compare-at price
- inventory fields required to calculate availability

The listing projection no longer loads:

- product category relations
- collection relations
- tag relations
- product timestamps not consumed by the listing DTO

This reduces database result width and server-side serialization/hydration work for every catalog grid page while preserving the existing price and inventory calculation path.

### 2. Image delivery preservation

The existing image strategy was audited rather than replaced:

- Product cards remain lazy-loaded.
- Product cards retain responsive `sizes`.
- The homepage visual candidate remains the only explicitly prioritized storefront image.
- Image dimensions remain stabilized by the existing aspect-ratio container and Next.js `fill` architecture.
- No blanket image priority was introduced.

### 3. Server/client boundary preservation

The storefront remains server-rendered for catalog data. The genuinely interactive product detail control remains a Client Component because it owns variant selection and media state. No client-only conversion was introduced merely for performance.

### 4. Caching safety

No blanket `force-cache` or shared caching was introduced. User-specific cart/account/checkout/admin data therefore does not gain a new shared-cache path. Public catalog data remains behind its canonical service/repository architecture.

A new application-wide invalidation layer was deliberately avoided because the repository does not currently have a corresponding tag/path invalidation architecture. Introducing one without wiring every catalog mutation would create a correctness risk.

### 5. Provider boundary

Public storefront catalog rendering continues to use 4HRS+ canonical catalog data. Qikink remains behind provider-neutral fulfillment architecture and is not introduced as a storefront rendering dependency.

## Core Web Vitals review

### LCP

The homepage already prioritizes its principal visual image and supplies responsive sizing. Product-card images remain lazy. The phase therefore avoids the common regression of prioritizing every image.

### INP

The main interactive product-detail boundary remains intentionally client-side because variant selection changes the displayed media. No unnecessary client state was added to catalog listing components.

### CLS

Product cards use a fixed aspect-ratio image container. This preserves media space before image arrival and avoids layout movement from intrinsic image loading.

## Database/query improvements

The most material verified query improvement is the narrower public listing projection. Catalog pagination remains bounded and deterministic.

The phase does not add speculative indexes. Existing catalog indexes were reviewed against the canonical query patterns; no new index was added without measured query-plan evidence.

## Security and correctness

The following boundaries remain unchanged:

- public catalog responses do not load customer/account data
- private/admin data is not introduced into public caches
- payment and checkout validation remains server-authoritative
- authorization is not bypassed
- provider credentials are not moved to the browser
- Qikink is not made the public catalog media authority
- canonical catalog service/repository ownership remains intact

## Regression coverage

Added Phase 15.2 tests verify:

- the public catalog list projection remains bounded
- product-card and homepage image-priority behavior remains intentional
- catalog pagination remains bounded
- storefront catalog code contains no provider-specific Qikink dependency

These tests are architecture/invariant checks and do not depend on machine timing.

## Validation

The repository CI contract requires:

- Prisma validation
- tests
- ESLint
- TypeScript typecheck
- production build

Phase 15.2 does not weaken or bypass any of those checks.

This environment cannot execute the repository's GitHub Actions runner locally because external GitHub network access is unavailable. Final CI status must therefore be taken from the actual GitHub Actions run on the Phase 15.2 pull request; no CI result is fabricated here.

## Remaining limitations

- No numerical LCP/INP/CLS/TTFB before/after measurements are recorded.
- No speculative database indexes were added without query-plan evidence.
- The existing sitemap cap from Phase 15.1 remains unchanged.
- A future cache-tag/path invalidation architecture would need to be designed together with every catalog mutation boundary before shared persistent caching is introduced.

## Definition-of-done status

The repository-level optimization work and regression coverage for Phase 15.2 are implemented. The phase is not considered complete until the actual GitHub CI workflow is green after the branch changes.
