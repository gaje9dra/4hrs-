# Phase 12.8 — Fulfillment Provider Selection Audit

## Result

**Qikink is now the explicitly selected provider for Phase 12.8.**

The repository previously had a provider-neutral Phase 12.7 boundary with zero production adapters. Phase 12.8 now registers exactly one production adapter: Qikink.

## Evidence

- `lib/fulfillment/providers/qikink.ts` implements `FulfillmentProviderAdapter`.
- `lib/fulfillment/resolver.ts` registers Qikink behind the existing provider registry.
- `lib/fulfillment/config.ts` selects `qikink` as the repository default provider identifier while keeping enablement opt-in.
- `.env.example` documents the server-only Qikink credential.
- `lib/fulfillment/application.ts` performs local intent creation transactionally, calls the provider outside the transaction, and persists the normalized provider result.
- Provider-specific request/response/status/error logic remains isolated to the Qikink adapter.
- Qikink contract tests do not require real credentials.

## External contract basis

The adapter uses Qikink's documented create-order API and its documented order-status vocabulary. citeturn9search0turn6search0

## Scope protection

Phase 12.8 does not add a second provider, shipping/carrier integration, tracking UI, returns, refunds, exchanges, cancellation workflows, inventory redesign, checkout/payment/cart redesign, admin fulfillment UI, or provider-specific fields to the canonical Order model.

## Validation status

The implementation must pass the repository's complete CI-equivalent validation before Phase 12.8 can be declared ready.
