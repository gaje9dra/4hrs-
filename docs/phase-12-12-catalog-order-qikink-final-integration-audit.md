# Phase 12.12 — 4HRS+ Catalog, Order & Qikink Final Integration Audit

## Audit scope

This phase audits the Phase 12.11 architecture without introducing a second catalog or fulfillment provider.

Canonical ownership:

- 4HRS+ owns Product, ProductVariant, Store SKU, pricing, merchandising, media, and SEO.
- Qikink is a fulfillment provider only.
- Provider mappings connect a canonical ProductVariant to a provider SKU.
- Customer-facing catalog data does not require Qikink access.

## Catalog and mapping audit

The repository uses the canonical Product/ProductVariant catalog and a provider-neutral FulfillmentProviderMapping model.

A ProductVariant has its own 4HRS+ Store SKU. Qikink providerSku is stored separately in FulfillmentProviderMapping with uniqueness constraints for both (variantId, providerId) and (providerId, providerSku).

Publication requires an active Qikink mapping for every active ProductVariant.

Fulfillment resolves:

OrderItem -> ProductVariant -> active provider mapping -> providerSku -> provider adapter.

The fulfillment application does not fall back to the Store SKU.

## Authentication and admin security

The admin API requires an authenticated customer session and checks the normalized customer email against the server-side ADMIN_EMAILS allowlist. Mutating admin endpoints also require same-origin requests.

Qikink credentials are server-side configuration only. They are not part of public catalog DTOs or the admin form.

## Payment -> Order -> Fulfillment boundary

Verified payment remains authoritative for Order creation. Order creation is idempotent by payment and checkout identity.

The Order API now confirms a newly-created paid Order and, when the fulfillment provider configuration is enabled, creates and submits the provider-neutral Fulfillment using a deterministic order-derived idempotency key.

Payment success does not imply fulfillment success. A provider failure leaves the paid Order authoritative while the Fulfillment service owns its own failure/retry/reconciliation state.

## Qikink integration

Qikink-specific behavior remains inside the Qikink adapter and authentication module.

The adapter uses the configured server-side credentials, resolves the provider SKU from the mapping, sends the historical Order shipping/customer information required for fulfillment, and persists the provider fulfillment reference returned by Qikink.

Qikink sandbox order creation remains unsupported by the current fulfillment contract because the sandbox flow requires design metadata that is not represented by the current generic FulfillmentProviderRequest. Live My Products fulfillment is therefore the supported production path.

Qikink status lookup is currently disabled because a verified status endpoint is not part of the documented adapter contract. Reconciliation therefore remains manual/provider-side for ambiguous submissions.

## Idempotency and failure handling

The existing fulfillment application protects:

- duplicate Fulfillment creation by database uniqueness and idempotency keys;
- concurrent creation with serializable transactions;
- duplicate provider submission after successful persistence;
- bounded retry of retryable provider failures;
- ambiguous timeout/network outcomes from unsafe automatic resubmission;
- terminal Fulfillment states.

The Order API uses an order-derived fulfillment idempotency key so repeated requests for the same paid Order resolve to the same Fulfillment.

## Inventory, price, and address authority

- Catalog inventory remains owned by the canonical ProductVariant inventory model.
- Checkout/Order remains authoritative for customer-facing price and historical price snapshots.
- OrderAddressSnapshot remains authoritative for fulfillment shipping data.
- Qikink responses do not overwrite historical Order pricing or address snapshots.

## Remaining audit limitations

1. The repository cannot prove a live Qikink transaction without production credentials and a real Qikink account/wallet.
2. Qikink status lookup is not enabled; ambiguous provider outcomes require reconciliation outside the adapter.
3. CI validation must be run on this branch/PR before production readiness is declared.
4. Production fulfillment requires FULFILLMENT_PROVIDER_ENABLED=true and valid server-side Qikink credentials.

## Validation requirement

Run the repository's complete validation suite:

- npm run lint
- npm run typecheck
- npm test
- npm run build
- Prisma validation/generation/migration checks
- relevant catalog, payment, order, mapping, and fulfillment tests

Do not declare final readiness until the complete CI workflow is green.
