# Phase 2.9 — Product Attributes, Variant Options & Merchandising Foundation

## Objective

Phase 2.9 adds a small provider-neutral canonical option layer on top of the existing catalog. It supports flexible product-specific options without replacing the existing ProductVariant.size and ProductVariant.color fields.

The phase intentionally does not build a generic PIM system, admin UI, storefront option selector, checkout, fulfillment, or provider-specific option models.

## Product vs ProductVariant

Product remains the customer-facing catalog entity.

ProductVariant remains the purchasable configuration and continues to own product relationship, canonical SKU, optional variant-level price and compare-at price, inventory relationship, active/inactive status, and legacy-compatible size and color fields.

A product may have zero or more explicit variants according to the existing catalog publishing rules. No artificial variant is created for a single-configuration product.

## Canonical option model

The normalized option architecture is:

VariantOptionType → VariantOptionValue → ProductOptionType → ProductVariantOptionValue → ProductVariant

VariantOptionType represents an option dimension such as Size, Color, Material, Fit, Style, Length, Waist, or Pattern. It stores display name, normalized name, and sort order.

VariantOptionValue represents a value belonging to an option type. It stores displayName, normalizedValue, sortOrder, and optional hex and swatch data.

ProductOptionType assigns an option type to a particular product and controls product-level option ordering.

ProductVariantOptionValue associates a variant with its canonical option values.

## Existing size/color compatibility

The existing ProductVariant.size and ProductVariant.color fields remain in place because the current catalog already uses them, publishes products through them, searches them, and validates duplicate size/color combinations.

The new option layer is the extensibility path for additional dimensions and richer future catalog workflows. This is intentionally incremental rather than a destructive migration.

## Size handling

Size is not a global enum. The canonical option model can represent XS, S, M, L, XL, XXL, XXXL, One Size, Free Size, numeric shoe sizes, waist sizes, and length-based sizes.

## Color handling

Color uses customer-facing displayName, normalized comparison identity, and optional hex and swatch data.

Example: displayName = Dark Navy Blue; normalizedValue = dark-navy-blue; hex = #001122.

Hex values are optional. Provider color identifiers are never canonical option identities.

## Future option extensibility

The schema is extensible through VariantOptionType and VariantOptionValue. No seed records are created for hypothetical options.

## Option ordering

Option types have product-specific sortOrder. Option values also have sortOrder. Repository reads use deterministic ordering. Provider ordering is not used as canonical ordering.

## Variant uniqueness

The service validates that a product cannot contain duplicate variants for the same canonical option combination.

Option IDs are normalized to a sorted set for comparison, so Color=Black + Size=M and Size=M + Color=Black represent the same combination.

A variant may contain only one value from each option type.

The database also prevents duplicate variant/value assignments with the composite (variantId, optionValueId) key.

The system does not generate the Cartesian product automatically. Variant combinations remain explicit.

## SKU behavior

Canonical SKU remains independent from provider SKU. Existing canonical SKU normalization and uniqueness rules remain active.

Example: Canonical SKU TSHIRT-BLK-M; Provider SKU QK-983472-M.

The option layer does not overwrite or derive canonical SKU automatically.

## Pricing interaction

The existing pricing architecture remains unchanged: Product has a base price, ProductVariant may override price, compare-at pricing remains supported, and existing money validation remains authoritative.

## Inventory interaction

Inventory remains attached directly to ProductVariant. Option values do not carry quantities.

## Search interaction

Phase 2.7 search remains the existing abstraction. Variant search continues to support display name, size, and color. Phase 2.9 additionally makes canonical option-value display names and option-type names searchable.

Internal search continues to support SKU search. No second search index or external search service was introduced.

## SEO interaction

Variant options do not create SEO pages. Phase 2.8 product-level canonical URLs remain authoritative. No variant-specific SEO URLs were added.

## Manual product compatibility

Manual products can eventually define option types, option values, product option assignments, explicit variants, canonical SKUs, pricing, and inventory without requiring a fulfillment provider.

No admin editor UI was added.

## Provider-import compatibility

Provider integrations remain outside the canonical option model. External provider products, variants, sizes, and colors can be mapped into canonical Product, ProductVariant, VariantOptionType, and VariantOptionValue records.

Provider identifiers such as qikinkSizeId or qikinkColorId are not stored on canonical option records.

## Validation rules

The existing catalog validation framework was extended rather than replaced.

Option type validation checks required name, normalized identity, and non-negative ordering.

Option value validation checks option type ownership, display name, URL-safe normalized identity, and non-negative ordering.

Variant option validation checks referenced option value existence, option-value ownership by a product-assigned option type, and one value per option type.

Variant combination validation checks duplicate canonical option combinations, existing SKU uniqueness, product ownership, variant status, and existing price rules.

## Data integrity

The schema uses foreign keys and restrictive deletion for option definitions referenced by variants. Product-option assignments cascade with Product. Variant-option assignments cascade with Variant. Referenced option values cannot be casually deleted.

## Migration strategy

Migration: prisma/migrations/20260928161000_variant_options/migration.sql

It adds VariantOptionType, VariantOptionValue, ProductOptionType, and ProductVariantOptionValue.

Existing ProductVariant.size, ProductVariant.color, SKU, inventory, and provider-related architecture are preserved. No existing rows are rewritten. No database reset is required. No historical migration is rewritten.

## Service/repository changes

The existing Catalog Service and Repository boundaries were extended with operations for creating and updating option types and values, assigning and removing product option types, listing product option metadata, replacing variant option values, retrieving variant option values, validating canonical option ownership, and preventing duplicate option combinations.

No separate disconnected Variant Service was introduced.

## Testing

tests/catalog-variant-options.test.ts covers option type normalization, option value display/normalized identity, duplicate option types on a variant, canonical option-combination uniqueness, Catalog Service option type creation, Catalog Service option value creation, and product option assignment.

The existing Phase 2.1–2.8 catalog tests remain regression coverage.

## Why this is not a generic PIM

The architecture intentionally stops at the minimum domain structure needed by the current fashion catalog. It does not introduce attribute families, configurable enterprise schemas, arbitrary nested product specifications, marketplace-specific attribute mappings, external PIM synchronization, automatic variant generation, or attribute workflow engines.

VariantOptionType and VariantOptionValue provide extensibility while keeping Product and ProductVariant as the canonical catalog entities.

## Known limitations

Existing size and color columns remain for backward compatibility rather than being migrated into normalized option tables.

Cross-representation duplicate detection between legacy size/color fields and newly assigned option values is intentionally not inferred because semantic mappings cannot be safely guessed.

Option values are explicitly assigned to variants; the system does not generate every possible combination.

No UI was added.

## Deferred functionality

Admin product/variant editor UI, storefront variant selector, automatic combination generation, variant-specific SEO URLs, cart/checkout/orders, provider implementations, external PIM/search integrations, and advanced attribute taxonomy management remain deferred.