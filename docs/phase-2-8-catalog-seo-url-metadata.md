# Phase 2.8 — Catalog SEO, URL Integrity & Metadata Foundation

## Objective
Phase 2.8 establishes a provider-neutral SEO and URL integrity foundation for the canonical catalog.

This phase does not implement storefront SEO rendering, sitemap generation, robots.txt generation, SEO dashboards, external SEO services, or frontend UI.

## Existing architecture
The catalog already had Product SEO title/description fields, globally unique Product/Category/Collection slugs, catalog validation/service/repository layers, Product lifecycle status, Phase 2.6 discovery/query contracts, and Phase 2.7 provider-neutral search.
Phase 2.8 extends those existing contracts rather than creating parallel SEO or slug systems.

## Canonical URL strategy
Customer-facing catalog paths are centralized in lib/catalog/routes.ts:
- Product: /products/{slug}
- Category: /categories/{slug}
- Collection: /collections/{slug}

Helpers: productPath, categoryPath, collectionPath, productCanonicalUrl, categoryCanonicalUrl, collectionCanonicalUrl.
The base origin comes from NEXT_PUBLIC_SITE_URL. Provider IDs are never used to construct canonical catalog URLs.

## Site URL safety
NEXT_PUBLIC_SITE_URL must be an absolute HTTP(S) URL. Canonical URL construction rejects missing configuration, malformed URLs, non-HTTP(S) protocols, credentials, query strings, and fragments.

## Slug strategy
Slug normalization is centralized in lib/catalog/validation.ts.
slugify trims/normalizes input, applies Unicode NFKD normalization, removes combining marks where applicable, lowercases, converts unsafe separators to hyphens, collapses repeated hyphens, removes leading/trailing hyphens, and produces a deterministic item-{hash} fallback when no usable ASCII slug characters remain.
Canonical slugs use [a-z0-9]+(?:-[a-z0-9]+)*. No separate slug-length scoring rule is introduced; the existing database TEXT representation and URL-safe validation remain the integrity boundary.
Product, Category, and Collection service writes normalize slugs before validation/persistence. Blank slugs derive deterministically from the entity title/name.

## Slug uniqueness
Existing Prisma constraints already make Product.slug, Category.slug, and Collection.slug globally unique.
The service layer now checks the relevant repository lookup before create/update, while the database remains the final integrity boundary for concurrent writes.
Duplicate slug errors use DUPLICATE_SLUG.

## Slug change policy
Published/ACTIVE Product, Category, and Collection slugs cannot currently change. A change returns SLUG_CHANGE_REQUIRES_REDIRECT.
This avoids silently breaking an existing canonical URL.
A future redirect system should retain the previous slug, map it to the current canonical entity, and return permanent HTTP 301 semantics.
Draft or archived entities may change slugs because they are not treated as currently published canonical URLs.

## SEO metadata model
Product already contained seoTitle and seoDescription.
Phase 2.8 adds seoTitle and seoDescription to Category and Collection.
No canonical URL is stored in the database; canonical URLs are derived at runtime.
No social-specific fields were added because frontend social metadata is deferred.

## SEO validation
Empty/whitespace-only SEO fields normalize to null.
Supported upper bounds are deliberately generous rather than SEO scoring rules: SEO title 200 characters and SEO description 500 characters.
No keyword-density, readability, pixel-width, or SEO score rules are enforced.

## SEO fallback strategy
Generated fallback values are derived at runtime and are not persisted.
Product title: custom seoTitle, otherwise Product title. Product description: custom seoDescription, otherwise shortDescription, description, then Product title.
Category title: custom seoTitle, otherwise category name. Category description: custom seoDescription, otherwise category description, then Browse {category name} products.
Collection title: custom seoTitle, otherwise collection name. Collection description: custom seoDescription, otherwise collection description, then Explore {collection name}.

## Public SEO contract
lib/catalog/seo.ts provides a provider-neutral customer-facing contract containing title, description, canonical URL, indexability, and robots directive.
Unpublished entities return null from public SEO metadata helpers rather than exposing private metadata.

## Publication and indexability
ACTIVE and valid Products are indexable with index,follow. DRAFT, ARCHIVED, and invalid Products are noindex,nofollow.
ACTIVE and valid Categories and Collections are indexable. ARCHIVED or invalid entities are not indexable.
The existing publication workflow remains responsible for sellable variants and product imagery before activation.
Tags are not treated as public landing-page entities in Phase 2.8.

## Manual and imported Products
Manual Products receive canonical slug and SEO treatment without provider mapping or external provider IDs.
Imported Products receive the same canonical Product ID/slug/SEO treatment after entering the canonical catalog.
Provider metadata remains integration/operational metadata. No provider-specific SEO logic exists.

## Search + SEO consistency
Phase 2.7 search results expose the canonical Product id and slug. Phase 2.8 route helpers use that same slug, so search result → product.slug → productPath(product) resolves to the same canonical Product identity.

## Database constraints and migration
No new slug indexes were added because existing unique slug constraints are sufficient.
No long-text SEO indexes were added.
Migration: prisma/migrations/20260928160000_catalog_seo_metadata/migration.sql
It adds nullable seoTitle and seoDescription columns to Category and Collection only. Existing data is preserved and historical migrations are untouched.

## Tests
Added tests/catalog-seo.test.ts covering slug normalization, punctuation, accents, Unicode deterministic fallback, SEO validation, canonical paths/URLs, malformed site configuration, custom/fallback metadata, lifecycle indexability, provider neutrality, search-to-slug consistency, published slug immutability, and application-level uniqueness.
Existing Phase 2.1–2.7 tests remain regression requirements.

## Deferred
- storefront SEO rendering
- sitemap generation
- robots.txt generation
- Google Search Console
- external SEO platforms
- SEO dashboard
- redirect history persistence
- frontend Open Graph/Twitter rendering
- image-processing infrastructure
- public tag landing pages

## Files changed
- prisma/schema.prisma
- prisma/migrations/20260928160000_catalog_seo_metadata/migration.sql
- lib/catalog/validation.ts
- lib/catalog/service.ts
- lib/catalog/repository.ts
- lib/catalog/routes.ts
- lib/catalog/seo.ts
- lib/catalog/index.ts
- tests/catalog-seo.test.ts
- docs/phase-2-8-catalog-seo-url-metadata.md

STOP — Phase 2.8 only.
