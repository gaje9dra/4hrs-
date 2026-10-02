# Phase 12.11 — Manual 4HRS+ Catalog + Qikink Fulfillment Mapping

## Objective

4HRS+ owns the customer-facing product catalog. Qikink is a fulfillment provider and is not the source of the storefront catalog.

The implementation uses the existing canonical Product and ProductVariant models. Qikink product import, product browsing, catalog synchronization, and customer-facing Qikink calls are intentionally not implemented.

## Catalog ownership

4HRS+ owns product titles, descriptions, media, merchandising, options, Store SKUs, prices, SEO, publication state, and customer-facing availability.

Qikink is used only after a server-authoritative paid Order is eligible for fulfillment.

## ProductVariant architecture

Each canonical ProductVariant keeps its own 4HRS+ Store SKU. Fulfillment provider metadata is stored separately in FulfillmentProviderMapping.

A mapping contains:
- canonical ProductVariant
- provider identifier
- provider SKU
- optional provider variant reference
- active state

The database enforces one mapping per ProductVariant/provider and prevents the same provider SKU from being assigned to multiple variants for the same provider.

## Store SKU vs Qikink SKU

The Store SKU and Qikink SKU are independent identifiers.

Example:
- Store SKU: 4H-TS-BLK-M
- Qikink SKU: QK-XXXX-M

The Store SKU remains the customer/catalog identifier. The Qikink SKU is backend fulfillment metadata.

## Admin workflow

Authorized administrators use /admin and the protected admin API to:
1. Create a Product.
2. Create ProductVariants.
3. Set Store SKUs.
4. Configure Qikink provider mappings.
5. Publish or unpublish Products.

All writes go through the existing catalog service. The browser never writes directly to Prisma.

Admin access is server-side and controlled by the ADMIN_EMAILS environment allowlist.

## Publication rules

The canonical catalog lifecycle remains responsible for publication. When the Qikink fulfillment path is active, every active ProductVariant must have an active Qikink mapping before publication.

The same requirement is checked server-side by the catalog service and admin publication endpoint.

## Customer purchase flow

The storefront reads only the canonical 4HRS+ catalog:

Product → ProductVariant → Catalog Service → Public Catalog DTO

The browser does not call Qikink and does not receive Qikink credentials or unnecessary provider metadata.

## Order → Fulfillment resolution

After verified payment and Order creation:

OrderItem → ProductVariant → Provider Mapping → Qikink SKU → Fulfillment → Qikink Adapter

The provider mapping is resolved server-side from the canonical ProductVariant. A customer cannot inject a Qikink SKU into fulfillment.

If the required mapping is missing, fulfillment fails before any provider submission.

## Qikink adapter boundary

The existing provider-neutral Fulfillment resolver and Qikink adapter remain responsible for provider communication. The Product, Cart, Checkout, Payment, and Order domains do not make Qikink HTTP calls.

## Authentication and security

Qikink credentials remain backend-only. They are not stored in public environment variables, returned by APIs, or included in client bundles.

Admin mutations require an authenticated customer session whose email is present in ADMIN_EMAILS, plus same-origin protection for mutations.

## Idempotency, webhooks, and reconciliation

Existing Fulfillment idempotency, provider submission retry limits, terminal-state handling, webhook/reconciliation behavior, and Qikink adapter behavior remain in place.

Phase 12.11 changes SKU resolution; it does not replace the existing Fulfillment lifecycle.

## Inventory behavior

Qikink availability is not treated as local inventory. The existing 4HRS+ inventory architecture remains authoritative for storefront availability.

## Error handling

Missing or invalid provider mappings produce structured fulfillment failure before provider submission. The system does not silently substitute a Store SKU, another variant, another provider, or fabricated mapping data.

## Tests and validation

Coverage includes provider mapping validation, provider SKU separation, fulfillment mapping resolution, missing mapping rejection, and existing fulfillment regression behavior.

Required validation:
- npm run lint
- npm run typecheck
- npm test
- npm run build
- GitHub Actions CI

Phase 12.11 is not considered ready until all required checks are green.

## Future provider extensibility

The mapping model is provider-neutral. Adding another fulfillment provider requires another provider mapping for the canonical ProductVariant and a corresponding provider adapter; the storefront catalog does not need to be duplicated.
