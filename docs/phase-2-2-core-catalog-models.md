# Phase 2.2 — Core Catalog Data Models

## Implemented

Phase 2.2 introduces the canonical catalog persistence layer using Prisma + PostgreSQL.

Models:
- Product
- ProductVariant
- ProductImage
- Category
- Collection
- Tag
- ProductCategory
- ProductCollection
- ProductTag

No provider-specific catalog fields or provider integration models are included.

## Database

- PostgreSQL
- Prisma ORM
- UUID internal identifiers
- DECIMAL(12,2) monetary fields
- Product currency stored as a 3-character value, defaulting to INR
- Prisma DateTime timestamps
- DATABASE_URL environment configuration

Phase 2.1 intentionally contained no database implementation, so Phase 2.2 makes this first concrete persistence choice.

## Product

Product is the canonical store-owned catalog entity.

It contains title, unique slug, description, optional short description, DRAFT/ACTIVE/ARCHIVED status, selling price, optional compare-at price, currency, optional SEO title/description, and created/updated timestamps.

Product has no provider dependency or provider ID.

## Variant

ProductVariant is a child of Product.

It supports optional size, optional color, optional display name, unique store-owned SKU, ACTIVE/INACTIVE status, timestamps, and optional price/compare-at-price overrides.

Pricing strategy:
- Product price is the default.
- A null variant price means inherit Product.price.
- A non-null variant price is an explicit override.
- The same rule applies to compare-at price.
- Currency is inherited from Product.

This keeps the catalog simple while supporting legitimate variant-level pricing.

## Product images

ProductImage supports either a Product owner or a ProductVariant owner.

A database CHECK constraint requires exactly one owner, so an image cannot be detached from both or attached to both simultaneously.

Fields include URL/storage reference, optional alt text, sort order, primary-image flag, and timestamps.

## Categories

Category supports hierarchical catalog organization through an optional parent Category.

Fields include name, unique slug, optional description, parent, ACTIVE/ARCHIVED status, and timestamps.

The database prevents a category from directly being its own parent. More complex multi-level cycle detection remains an application/domain validation concern.

Products use a many-to-many ProductCategory junction.

## Collections

Collection is a merchandising concept distinct from Category.

It supports name, unique slug, optional description, ACTIVE/ARCHIVED status, and timestamps.

Products and collections use ProductCollection.

## Tags

Tag is lightweight provider-neutral catalog metadata.

It supports name, unique slug, and timestamps.

Products and tags use ProductTag.

## Relationship diagram

Product
├── ProductVariant[]
│   └── ProductImage[]
├── ProductImage[]
├── ProductCategory[]
│   └── Category
├── ProductCollection[]
│   └── Collection
└── ProductTag[]
    └── Tag

Category
└── parent Category (optional)

Provider mappings remain outside this structure.

## Constraints

- Product.slug unique
- ProductVariant.sku unique
- Category.slug unique
- Collection.slug unique
- Tag.slug unique
- Junction pairs unique through composite primary keys
- ProductImage has exactly one owner
- Category cannot directly parent itself
- Money uses DECIMAL(12,2)
- Foreign keys enforce catalog relationships

## Indexes

Indexes cover the documented access patterns:
- Product status and creation time
- ProductVariant product/status and product+size+color
- ProductImage product/variant ownership and ordering
- Category parent/status
- Collection status
- Reverse foreign keys on junction tables

Unique slugs/SKU are indexed by their unique constraints.

No provider, search-engine, recommendation, or analytics indexes were added.

## Deletion and archive behavior

Archival is represented by explicit status values.

Relationship behavior:
- Product deletion cascades its variants, images, and junction relationships.
- Collection and Tag deletion cascades their junction rows.
- Category deletion is restricted when referenced by products or children.
- Category relationships therefore cannot silently destroy catalog structure.

These are catalog-specific rules and are not a template for later order/payment data.

## Migration

Created:
prisma/migrations/20260928120000_core_catalog/migration.sql

The migration creates PostgreSQL enums, catalog tables, foreign keys, CHECK constraints, unique constraints, and indexes.

It does not reset or wipe a database.

## Seed data

No seed data was added. There was no existing seed system, and Phase 2.2 does not require fake production-like catalog data.

## Data-access boundary

lib/db/client.ts is the Prisma client boundary.

No storefront, admin, provider, order, payment, shipping, or inventory functionality was added.

## Provider compatibility

The catalog supports:
1. Manual products with no provider.
2. Future Qikink products through a later provider mapping.
3. Future Printful products through a later provider mapping.
4. Own-inventory products without provider identity.

Provider-specific IDs and fields remain outside Product and ProductVariant.

## Deferred

- Provider mappings and integrations
- Qikink / Printrove / Printful integrations
- Product importing
- Admin product CRUD
- Inventory
- Orders
- Payments
- Fulfillment
- Shipping
- Customers/authentication
- Checkout
- Search
- Recommendations
- Analytics
- Pricing/promotion/tax engines

## Validation

Static repository review:
- Required model coverage: PASS
- Canonical ownership: PASS
- Provider neutrality: PASS
- Scope review: PASS
- Migration review: PASS

The repository exposes lint, typecheck, and build scripts, but this GitHub execution environment cannot install/run the repository dependencies or connect to a PostgreSQL database. Therefore no runtime command is claimed as passed.

There is no test script in package.json.

**STOP — Phase 2.2 is complete at the repository implementation level.**
