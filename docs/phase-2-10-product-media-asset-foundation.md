# Phase 2.10 — Product Media & Asset Management Foundation

## Objective

Phase 2.10 establishes the provider-neutral canonical product-media foundation without adding upload UI, storefront gallery UI, a CDN, an image-processing pipeline, or a fulfillment/provider integration.

The existing ProductImage model from Phase 2.2 is the canonical media record. It is extended incrementally rather than replaced by a second ProductMedia table.

## ProductImage as canonical ProductMedia

The canonical media record now contains:
- internal UUID
- optional Product owner
- optional ProductVariant owner
- canonical public URL
- optional stable storageReference
- IMAGE media type
- optional alt text
- deterministic sortOrder
- isPrimary
- created/updated timestamps

The existing exactly-one-owner database constraint remains authoritative.

url remains required because the existing architecture already treats image URLs as canonical media references. storageReference is an optional provider/storage-neutral reference that allows a future storage layer to resolve URLs without forcing the catalog to depend on a vendor.

No provider-specific fields such as qikinkImageId or qikinkImageUrl were added.

## Product-level vs variant-level media

Both ownership forms are supported:
- Product-level media applies to the product generally.
- Variant-level media belongs to one ProductVariant.

A variant does not require dedicated media. A product may have only product-level media, one variant-specific image, or multiple variant-specific images.

Variant ownership is validated against the parent Product before persistence.

## Primary-image behavior

Only product-level media can be primary.

Primary assignment is handled in the Catalog Service transaction:
1. clear the previous primary product image;
2. mark the requested image primary.

The database retains the existing partial unique index Product_primary_image_unique, so a Product cannot persist multiple primary product images.

Primary reads are deterministic and use isPrimary, sortOrder, and id.

Variant-specific images are never promoted to the product primary slot.

## Ordering

Canonical ordering is numeric sortOrder.

Repository reads use deterministic tie-breaking:
- Product media: primary first, then sortOrder, then id
- Variant media: sortOrder, then id

Reordering is performed through the existing Catalog Service/Repository boundary and rejects mixed-owner batches so one operation cannot reorder media belonging to different Products or variants.

Provider ordering and database insertion order are not canonical ordering mechanisms.

## Alt-text strategy

Alt text is optional because decorative media must remain representable without invented copy.

When supplied, the service normalizes whitespace before persistence.

Current validation:
- maximum 200 characters
- no markup delimiters
- no keyword-stuffing behavior is introduced

Product title is not automatically copied into every image. A caller may supply image-specific descriptive text.

SEO metadata remains separate from accessibility metadata.

## Media type

The current catalog supports ProductMediaType.IMAGE.

No video infrastructure is implemented.

The enum provides an explicit extension point for future media types without pretending that unsupported infrastructure already exists.

## Image format validation

The catalog accepts absolute http or https image URLs and the current media type must be IMAGE.

The catalog does not infer binary MIME type from a URL extension.

The current application has no storage/upload pipeline that provides trusted binary metadata, so JPEG/PNG/WebP/AVIF acceptance cannot be safely enforced at the catalog boundary. Such validation belongs to the future MediaStorage implementation that actually receives the bytes.

## Asset-size and dimension limits

No arbitrary byte-size or dimension limit is hardcoded into the catalog domain.

The current media foundation does not receive image bytes, width/height metadata, or a storage upload stream. Future storage implementations can enforce infrastructure limits and report trusted metadata through the storage boundary.

This avoids coupling catalog rules to a particular CDN/object-storage provider.

## URL vs storage reference

The compatibility strategy is incremental:
- url remains the canonical public/resolved URL for the current application.
- storageReference is optional and stable.
- the catalog never stores storage credentials or vendor configuration.
- a future storage layer may resolve a stable reference into a public URL.

This preserves all existing ProductImage records and avoids a risky URL migration before storage infrastructure exists.

## Storage abstraction

lib/catalog/media.ts defines the provider-neutral MediaStorage contract.

Conceptually it supports:
- upload
- URL resolution
- delete
- existence checks
- optional metadata retrieval

The phase does not implement a storage adapter.

No Cloudinary, S3, R2, UploadThing, Qikink, Printrove, Printful, or Printify dependency was added.

## Provider-import behavior

Provider imports can map external image URLs and, when available, a stable storage/reference value into canonical ProductImage fields.

The canonical model does not require a provider mapping.

Provider-specific identifiers remain outside ProductImage. A later provider integration can maintain its own mapping data and then call the Catalog Service.

The canonical flow remains:
External Provider → provider mapping/transformation → canonical Product → canonical ProductImage

## Manual-product behavior

A manually created Product can create media using only canonical catalog fields.

No provider ID, fulfillment integration, payment integration, shipping integration, or storage vendor is required.

## Media validation

The Catalog validation layer now checks:
- exactly one Product or ProductVariant owner
- valid absolute URL
- HTTP/HTTPS protocol only
- safe non-empty storage reference when present
- storage-reference maximum length
- supported media type
- normalized alt text
- alt-text maximum length
- markup-free alt text
- non-negative integer sort order
- duplicate URL/reference prevention per canonical owner

Variant-specific media must reference a ProductVariant belonging to the same Product.

## Deduplication

The phase intentionally uses a scoped deduplication strategy rather than a global content-hash system.

For the same canonical owner, a media record is considered duplicate when its URL or storage reference is already associated with that owner.

The same physical asset may still be referenced by different Products/variants when the catalog explicitly associates it with those owners.

No global binary hashing or perceptual image matching system was introduced.

## Deletion and archival

The existing catalog convention is explicit deletion rather than a new media lifecycle enum.

Removing ProductImage deletes the canonical relationship record.

It does not automatically delete a physical asset from storage because:
- storage is not implemented yet;
- physical assets may be shared;
- relationship deletion and physical asset deletion are separate operations.

A future storage integration can perform reference-aware cleanup or defer cleanup to storage lifecycle tooling.

No background cleanup worker was added.

Product deletion continues to cascade its ProductImage relationships through the existing database foreign key.

## Replacement behavior

Updating media occurs through the Catalog Service.

Primary replacement is transactional:
- previous product primary is cleared;
- replacement becomes primary.

Media metadata replacement preserves Product/Variant ownership.

Duplicate URL/storage-reference associations are rejected.

Reordering is transactional and cannot mix owners.

No physical storage object is deleted as a side effect of metadata replacement.

## Publishing readiness

Phase 2.4 already requires at least one product-level image for a publishable fashion product.

Phase 2.10 preserves that rule rather than inventing a new publishing requirement.

Media validation remains part of validatePublishingReadiness().

The phase does not add a requirement for:
- variant-specific images
- one image per size
- one image per variant
- a specific image format
- a storage vendor

## Search integration

Phase 2.7 search continues to retrieve the primary image through the canonical ProductImage relationship.

Media is not copied into a second search index.

Search/listing responses expose the canonical public image fields needed by the current result contract rather than storage credentials or internal storage configuration.

## SEO integration

Phase 2.8 remains product-level and URL-focused.

Media remains a separate canonical concern. SEO code can consume the canonical primary-media URL when a future SEO response requires an image, without duplicating media records or storage configuration into SEO tables.

No variant-specific SEO URLs were added.

## Variant integration

ProductVariant remains the purchasable unit.

Media is independent of SKU, price, compare-at price, and inventory.

A variant may have zero, one, or multiple images.

Color-specific imagery is therefore possible without creating size-specific copies.

## Inventory integration

Media has no relationship to Inventory.

The architecture remains:
ProductVariant → Inventory
and separately:
Product / ProductVariant → ProductImage

Changing, deleting, or reordering media does not mutate inventory.

## Performance

The repository provides separate reads for:
- ordered product media
- ordered variant media
- primary product media

This keeps the service boundary ready for primary-image-only listing reads and full-media detail reads.

Existing Phase 2.7 search continues to use canonical media relationships. No caching layer was added.

## Service / repository changes

The existing Catalog Service/Repository architecture was extended with:
- media DTO/contract definitions
- ordered product media retrieval
- ordered variant media retrieval
- primary product media retrieval
- storage-reference and media-type persistence
- safer reorder ownership validation
- media deduplication validation
- provider-neutral storage interface

No disconnected Media Service was introduced.

## DTOs

CatalogMediaDto exposes:
- media ID
- Product/variant association
- resolved/current URL
- storage reference where the internal service contract requires it
- media type
- alt text
- sort order
- primary state
- timestamps

The public search contract does not expose storage credentials or storage configuration.

## Migration

Migration:
prisma/migrations/20260929085200_product_media_foundation/migration.sql

Changes are additive:
- creates ProductMediaType with IMAGE
- adds nullable storageReference
- adds non-null mediaType with IMAGE default
- adds a safe non-empty storage-reference check
- adds deterministic media lookup indexes

Existing ProductImage rows remain intact. Existing URLs, ownership, ordering, and primary flags are preserved.

No reset, historical migration rewrite, asset deletion, or destructive media replacement was introduced.

## Tests

Added:
tests/catalog-media.test.ts

Coverage includes:
- valid media creation input
- URL protocol validation
- storage-reference validation
- media-type validation
- alt-text normalization and validation
- exactly-one-owner validation
- duplicate media detection
- Catalog Service media creation
- cross-product variant ownership rejection
- ordered Product/variant media DTO reads

Existing Phase 2.1–2.9 tests remain in the repository for regression execution.

## Known limitations

- No binary upload pipeline exists yet.
- JPEG/PNG/WebP/AVIF binary validation is deferred to storage infrastructure.
- File-size and dimension limits are not enforced because the catalog does not receive image bytes.
- No storage provider adapter exists.
- No provider media mapping table exists yet because no provider integration exists.
- Existing url remains required for compatibility.
- No soft-delete/archival state was added to ProductImage.
- Existing list/search query shapes are preserved; a future detail-specific read model can load complete media collections where needed.

## Deferred functionality

- Admin media upload UI
- Storefront product gallery UI
- Product detail UI
- CDN implementation
- image optimization/transformation
- image background removal
- AI image generation
- storage provider adapters
- Qikink/Printrove/Printful/Printify integrations
- provider synchronization
- payment/checkout/orders
- fulfillment/shipping
- authentication
- media lifecycle worker
- global binary hashing/deduplication
- video infrastructure
- variant-specific SEO pages

## Phase boundary

Phase 2.10 stops at the canonical catalog media/asset foundation.

No Phase 3 UI work is included.