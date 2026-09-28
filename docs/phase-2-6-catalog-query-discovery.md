# Phase 2.6 — Catalog Query, Listing & Discovery Foundation

## 1. Query architecture

Phase 2.6 extends the Phase 2.5 catalog repository without introducing a second persistence abstraction.

Storefront / API / future search UI → Catalog Query Service (lib/catalog/query.ts) → Catalog Repository (lib/catalog/repository.ts) → Prisma / PostgreSQL.

The query service owns query contracts, normalization, validation, public visibility rules, result mapping, and pagination semantics. The repository owns database filters, sorting, pagination, selective field loading, and relation traversal.

No React, provider API, payment, checkout, order, shipping, or search-engine dependency is introduced.

## 2. Public vs internal queries

Public entry points are listPublishedProducts() and getPublishedProductBySlug(). Public queries always require Product.status = ACTIVE and at least one ACTIVE ProductVariant. Only active variants and active category/collection relationships are returned.

Draft and archived Products are not returned by the public repository query.

Phase 2.5's existing CatalogService.listProducts() / repository listProducts() remain the internal catalog boundary for operational/admin use. Authorization is outside this phase. The public query service does not expose a status parameter that can bypass publication visibility.

## 3. Product listing contract

CatalogQuery supports category slug, collection slug, tag slugs, tag mode, minimum price, maximum price, availability, allowlisted sort, page, and page size.

No text-search field is added because full-text/search-engine behavior is deferred.

CatalogListResult contains items, pagination, and appliedQuery. The result is a domain read model rather than a raw Prisma object.

A public listing item contains product ID, title, slug, primary product image, effective starting price, compare-at price, currency, active variant summaries, active categories, active collections, tags, and aggregate availability.

## 4. Product detail query

getPublishedProductBySlug(slug) returns the same compact public catalog representation for one published product. A missing, draft, archived, or otherwise unpublished product produces PRODUCT_NOT_FOUND.

Only active variants are returned.

## 5. Category filtering

Category filters use the canonical Category slug.

Category filtering is direct-membership only in this phase: selecting a category returns products directly attached to that category. Descendant-category products are not implicitly included. This follows the current explicit ProductCategory junction model and avoids silently inventing recursive catalog semantics.

listActiveCategories() provides deterministic active-category navigation data.

getCategoryTree() builds the complete active hierarchy from active category rows, supporting arbitrary category depth without adding a recursive database abstraction.

## 6. Collection filtering

Collection filters use the canonical Collection slug. Only active collections are considered by public filtering. Reusable operations are getCollectionBySlug() and listActiveCollections().

## 7. Tag filtering

Multiple tags default to AND semantics. A product must contain every selected logical tag.

The query contract also accepts tagMode = OR so future UI can support either behavior without redesigning the repository. Duplicate tag values are normalized away and tags are matched by canonical slug.

## 8. Price filtering

minPrice and maxPrice are validated as non-negative money values with the Phase 2.4 precision rules. No currency conversion or exchange-rate logic is introduced.

The canonical PostgreSQL/Prisma Decimal representation is retained through query execution.

A public Product matches a price range when at least one ACTIVE variant's effective price is inside the range. Effective variant price is Variant.price when present, otherwise Product.price.

The repository expresses both cases at database level. The listing's displayed starting price is the minimum effective price among active variants.

## 9. Availability semantics

Inventory semantics remain owned by Phase 2.3. For tracked variants, available = onHand - reserved.

A variant is available when tracking is disabled, no Inventory row exists, or tracked inventory has onHand greater than reserved.

getInventoryAvailability() remains the canonical classification: UNTRACKED, IN_STOCK, LOW_STOCK, or OUT_OF_STOCK.

A Product is considered available when at least one active variant is available. Out-of-stock products remain visible by default; inStock=true filters at database level to Products with at least one eligible available active variant.

No inventory quantities are mutated by catalog queries.

## 10. Sorting

The query service exposes only: newest, oldest, price_asc, price_desc, title_asc, title_desc, and updated.

No arbitrary database column name or SQL expression is accepted from query input.

Default public sort is createdAt DESC, id DESC. All other sorts also use id as a stable secondary key in the same direction.

Price sorting uses canonical Product.price because that field is directly sortable in the current schema. Effective variant price remains the documented rule for price-range matching and displayed starting price.

## 11. Pagination

Offset pagination follows the existing project convention.

Defaults: page = 1 and pageSize = 24. Maximum pageSize = 100.

The query rejects invalid or unsafe page/pageSize values. Result metadata contains page, pageSize, total, totalPages, and hasNextPage.

Database skip/take performs pagination rather than loading the full catalog into JavaScript.

## 12. Query validation and normalization

Before repository execution, slugs are trimmed and lowercased, duplicate tags are removed, empty tag collections normalize to no tag filter, price boundaries use Phase 2.4 money validation, sort values are checked against the allowlist, page/pageSize are bounded, and tag mode is restricted to AND/OR.

Referenced category, collection, and tag slugs are checked for existence.

Errors use the existing CatalogServiceError model: INVALID_QUERY, INVALID_SORT, INVALID_PAGE, INVALID_PRICE_RANGE, CATEGORY_NOT_FOUND, COLLECTION_NOT_FOUND, TAG_NOT_FOUND, and PRODUCT_NOT_FOUND.

## 13. Database query efficiency

Filtering, sorting, counting, and pagination execute in the repository/database layer.

The main public listing uses one findMany for the requested page and one intentional count for pagination metadata. The page query uses a selective ProductSelect rather than loading every Product scalar field.

Nested relations are constrained to active variants, active categories, active collections, compact tag fields, and product-level images ordered by primary/sort order. Inventory is selected with the active variant relation, avoiding product-by-product inventory queries.

## 14. Index review

Existing useful indexes include Product.status, Product.createdAt, Product.slug unique, ProductVariant.productId, ProductVariant.status, ProductVariant.productId + size + color, Inventory.variantId unique, Inventory.trackingEnabled, ProductCategory.categoryId, ProductCollection.collectionId, ProductTag.tagId, and category/collection status indexes.

Phase 2.6 adds only the query-specific Product.price index through prisma/migrations/20260928150000_catalog_query_indexes/migration.sql.

## 15. Query result and ORM boundary

lib/catalog/query.ts maps repository records into domain query models. Consumers do not need Prisma Decimal objects, Prisma relation wrappers, or database-specific junction-table shapes.

Money values in the query result are serialized as decimal strings so callers do not accidentally perform floating-point canonical money operations.

## 16. Search preparation

Full-text search is intentionally deferred. No Elasticsearch, Algolia, Meilisearch, semantic search, or recommendation system is introduced.

The query boundary remains compatible with a future architecture in which search produces Product IDs and the canonical catalog query resolves the final published representation.

## 17. Provider independence

Catalog discovery operates only on canonical catalog and inventory data. It never calls Qikink, Printrove, Printful, Printify, or any other provider API.

Manually created and future imported Products resolve through the same canonical Product/ProductVariant/catalog query path.

## 18. Tests

Added tests/catalog-query.test.ts.

Coverage includes query normalization, duplicate tag normalization, price-range validation, allowlisted sorting, page-size bounds, category/collection/tag existence errors, Decimal-safe effective variant pricing, availability result mapping, stable pagination result shape, and prevention of repository execution on invalid query input.

Existing Phase 2.4 and Phase 2.5 tests remain unchanged in scope.

## 19. Deferred functionality

Not implemented in Phase 2.6: full-text search, Elasticsearch, Algolia, Meilisearch, semantic search, AI recommendations, recommendation engine, search UI, filter UI, sort UI, category/collection storefront pages, product grid UI, admin UI, provider synchronization, provider APIs, cart, wishlist, checkout, payments, orders, shipping, reservation or stock deduction, currency conversion, multi-currency pricing, recursive category filtering for product listings, and authorization.

## 20. Files

Implemented/updated:

- lib/catalog/query.ts
- lib/catalog/repository.ts
- lib/catalog/errors.ts
- lib/catalog/index.ts
- tests/catalog-query.test.ts
- prisma/schema.prisma
- prisma/migrations/20260928150000_catalog_query_indexes/migration.sql
- docs/phase-2-6-catalog-query-discovery.md

No provider or storefront files were introduced.

STOP — Phase 2.6 implementation scope only.
