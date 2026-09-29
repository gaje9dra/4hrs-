# Phase 2.11 — Catalog Merchandising & Collection Rules Foundation

## Objective
Establish the provider-neutral merchandising/domain foundation for the canonical catalog. This phase supports future curated collections, featured products, category merchandising, new arrivals, seasonal groups, campaigns, and promotional groups.

Storefront UI, admin merchandising UI, recommendations, bestseller/trending algorithms, automatic collection rules, and analytics are intentionally deferred.

## Category vs Collection
Category describes what a product is, such as T-Shirts, Hoodies, Shoes, Pants, and Accessories.
Collection describes how products are grouped for merchandising, such as Streetwear, Summer Drop, Festive Edit, Minimal Collection, and Sale.
Category and Collection remain separate canonical entities.

## Collection architecture
The existing Collection model is reused. Its existing ACTIVE/ARCHIVED lifecycle remains authoritative: ACTIVE is publicly available; ARCHIVED is not public.
Collections are manually curated in this phase. No automatic/rule-based collection engine is implemented.
Existing name, slug, description, SEO fields, status, and timestamps remain canonical. Phase 2.8 remains authoritative for collection SEO.

## Curated collections
Existing ProductCollection is the canonical membership relationship. It now stores position, priority, and isFeatured.
Membership remains independent of provider origin.

## Product ordering
Deterministic merchandising order is: isFeatured descending, priority descending, position ascending, Product createdAt descending, Product title ascending, Product ID ascending.
Duplicate positions are allowed and resolved by the remaining deterministic tie-breakers. Database insertion order and provider ordering are never canonical.

## Featured products
Featured state is scoped to a Category or Collection relationship. This avoids separate global/category/collection featured systems. A product can be featured in one collection without being featured everywhere.
No provider-specific featured state is stored.

## Merchandising priority
Priority is an explicit integer merchandising preference. Higher values sort before lower values. It is not an analytics, relevance, sales, or recommendation score.

## New arrivals
No redundant isNew boolean was added. New arrivals use the canonical Product createdAt timestamp through the existing newest sort.

## Best sellers and trending
No bestseller or trending score is fabricated. There is currently no authoritative order-history or behavioral dataset for those rankings. Future commerce/analytics phases can calculate them from legitimate data.

## Promotional collections
Sale, clearance, launch, seasonal, campaign, and limited-drop groups can be represented by ordinary curated Collections. Discount calculation, coupons, and promotional pricing are deferred.

## Visibility
Product visibility remains controlled by Product status. Public merchandising excludes draft and archived products and requires the existing active-product/active-variant conditions.
Collection visibility remains controlled by Collection status. Only ACTIVE collections participate in public merchandising queries.
No duplicate publication state is stored on membership rows.

## Category merchandising
ProductCategory receives the same position, priority, and isFeatured metadata so category ordering uses the same relationship-level mechanism rather than a second ordering system.

## Service and repository
Extended the existing Catalog Service/Repository with collection/category membership metadata, membership lookup/update operations, collection/category reordering, ordered membership reads, and merchandising-aware catalog query sorting.
Duplicate membership remains prevented by the existing composite primary keys.
Reordering validates membership and executes multi-row changes transactionally.

## Product relationship compatibility
Product relationship replacement now preserves existing category/collection merchandising metadata when a membership remains present. Removed memberships are deleted and new memberships receive deterministic defaults.

## Query contract
The existing Phase 2.6 catalog query remains the single query system. Category, collection, tags, price, availability, sorting, and pagination continue to compose.
A new explicit merchandising sort is available when a category or collection context exists. It is rejected without such context.

## Sorting and pagination
Normal sorts remain unchanged. Merchandising sorting uses relationship metadata followed by createdAt, title, and ID tie-breakers.
Merchandising ordering is applied before offset/limit pagination, producing stable pages.

## Search
Phase 2.7 search remains the search abstraction. Search can combine text, collection, category, tags, price, inventory availability, and explicit merchandising sorting.
Search relevance is not silently replaced: merchandising ordering is used only when explicitly requested.
No second search index was introduced.

## Inventory
Merchandising never mutates inventory. Existing inStock filtering remains owned by the inventory domain.

## SEO and media
Phase 2.8 remains authoritative for collection/category SEO. Phase 2.10 remains authoritative for Product/Variant media. No duplicate SEO or media model was added.

## Manual and provider-imported products
Manual products and provider-imported products use exactly the same canonical merchandising architecture. Provider IDs and provider ordering never determine collection/category membership, position, priority, or featured state.

## Database constraints and indexes
Existing Collection slug uniqueness and ProductCollection/ProductCategory composite uniqueness remain authoritative.
Added indexes are limited to concrete merchandising lookup paths:
- ProductCollection(collectionId, isFeatured, priority, position)
- ProductCategory(categoryId, isFeatured, priority, position)

## Future automatic collections
A future rule engine can derive membership from conditions such as category, price, status, tags, and availability without changing the canonical Product model. The rule engine itself is deferred.

## Future analytics
No fake analytics were added. Future systems may use impressions, clicks, add-to-cart rate, conversion rate, revenue, and units sold for legitimate merchandising algorithms.

## Migration
Migration: prisma/migrations/20260929093000_catalog_merchandising_foundation/migration.sql
Changes are additive. Existing relationship rows remain valid and receive defaults of position 0, priority 0, and isFeatured false.
No historical migration was rewritten and no production data is deleted.

## Tests
Added tests/catalog-merchandising.test.ts covering validation, duplicate membership, membership updates, transactional reordering, merchandising query sorting, sort scope validation, and provider-neutral behavior.
Existing Phase 2.1–2.10 tests remain required regression coverage.

## Known limitations
- No admin merchandising UI.
- No storefront collection UI.
- No automatic collections.
- No bestseller/trending/recommendation algorithms.
- No analytics.
- No global featured-product flag; featured state is relationship-scoped.
- No collection-specific media model.
- Collection lifecycle remains ACTIVE/ARCHIVED because those states already exist in the catalog.
- Runtime validation was not executable in this environment.

## Deferred functionality
- Storefront collection pages
- Homepage merchandising sections
- Admin merchandising UI
- automatic/rule-based collections
- AI recommendations
- recommendation algorithms
- bestseller/trending calculation
- analytics
- order-derived merchandising
- promotion/discount engine
- campaign automation
- payments, checkout, orders, shipping, and fulfillment

## Phase boundary
Phase 2.11 stops at the canonical catalog merchandising/domain foundation. No Phase 3 UI work is included.