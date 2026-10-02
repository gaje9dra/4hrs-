# Phase 15.1 — SEO, Indexability, Canonical URLs & Search Engine Architecture

## Implemented
The public SEO surface is limited to the homepage, shop landing page, active published products, active categories containing published products, and active collections containing published products.

Product/category/collection metadata derives from canonical catalog SEO fields and lifecycle state. Search remains noindex. Private/internal route families are excluded from crawl policy and protected by existing authentication/authorization plus page-level metadata where implemented.

## Canonical URLs
NEXT_PUBLIC_SITE_URL is the trusted canonical origin. It must be an absolute HTTP(S) origin without credentials, query parameters, or fragments; production robots/sitemap surfaces require HTTPS. Host, X-Forwarded-Host, Referer, session identifiers, and query parameters are never used to construct the public origin.

## Robots
app/robots.ts allows the public site and disallows admin, account, authentication, cart, wishlist, checkout, payment, order, tracking, API, development, preview, and debug route families. Robots is only a crawl policy, not authorization. The sitemap reference uses the trusted production origin.

## Sitemap
app/sitemap.ts selects only slug and authoritative updatedAt fields and includes the homepage, shop, ACTIVE products, ACTIVE categories with published products, and ACTIVE collections with published products. Search, filters, pagination, admin, API, account, cart, checkout, orders, tracking, and provider routes are excluded.

Each entity query is bounded to 1,000 records. A sitemap index/chunking implementation is required before a larger catalog is supported without truncation.

## Structured data
Product pages emit Product JSON-LD from visible canonical catalog data: name, description, canonical URL, images, price, currency, 4HRS brand, and supported availability. Ratings, review counts, fabricated offers, shipping claims, and provider credentials are not emitted.

Breadcrumb JSON-LD uses visible breadcrumb hierarchy. JSON-LD serialization escapes HTML-significant characters before insertion into script context.

## Open Graph
Homepage and catalog entity pages expose canonical title/description/URL. Product pages additionally expose the first canonical product image when available. No customer/provider/private information is used.

## Search/filter/pagination
Search remains noindex/follow. Arbitrary search/filter/sort/page variants are not in the sitemap. Category and collection variants retain their canonical entity URL and are not introduced as new SEO identities. Pagination remains owned by the existing bounded catalog query system.

## Publication and 404 behavior
Only published/active catalog data reaches SEO surfaces. Existing notFound behavior remains authoritative for invalid or unpublished resources. No slug-history persistence was invented.

## Security/performance
Canonical origins use trusted configuration only. Metadata is server-derived. Sitemap queries avoid relation loading and select only required fields. Sitemap revalidates hourly. No provider-only catalog identity or credentials enter public SEO output.

## Testing
SEO infrastructure tests cover origin validation, robots policy, sitemap source constraints, JSON-LD escaping, product schema safety, and route exclusions.

## Known limitations
The sitemap caps each entity class at 1,000 entries; sitemap index/chunking is required before larger catalogs are supported without truncation.
