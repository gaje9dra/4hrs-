# Phase 11.4 — Payment Provider Adapter Framework

## Scope
This phase establishes provider abstraction, adapter contracts, resolver/configuration boundaries, normalized request/response contracts, webhook verification boundaries, and Payment Application Service integration. No real provider SDK, account, credential, live request, or production webhook registration is introduced.

## Dependency direction
Browser → Checkout → Payment Application Service → Payment Domain → Provider Resolver → Payment Provider Adapter → External Provider.

The Payment domain knows only provider-neutral types. Provider SDK types and provider-specific HTTP/signature logic belong inside a future adapter.

## Provider interface
The canonical adapter supports only capabilities required by the current architecture: create payment, retrieve payment, verify payment, verify/normalize webhook, normalize provider status, normalize provider errors, and optional cancellation/refund operations. Capabilities are explicit so unsupported operations are rejected by infrastructure rather than scattered through Checkout or Storefront.

## Provider request/response
Adapters receive a narrow request containing internal Payment/Attempt references, authoritative amount/currency, optional safe customer/callback context, a provider-safe idempotency reference, and safe metadata. ORM entities, database clients, HTTP requests, browser objects, provider SDK objects, credentials, card data, CVV/CVC, PINs, and banking passwords are excluded.

Adapter results contain provider identity/reference, normalized canonical Payment status, optional provider-attempt reference, safe client-action data, safe metadata, and normalized provider error classification.

## Resolver and multi-provider support
`createPaymentProviderResolver()` is the only application-level provider selection boundary. It uses trusted server configuration and a registry. The caller cannot select an arbitrary implementation; an explicit provider identifier must match the configured provider.

A future provider requires an adapter, registry registration, secure configuration, provider-specific tests, and normalization rules. Checkout, Storefront, Cart, Product, and Payment domain models do not need provider-specific branches.

## Configuration
Configuration is loaded from server-side environment variables: `PAYMENT_PROVIDER_ID`, `PAYMENT_PROVIDER_ENABLED`, `PAYMENT_PROVIDER_MODE`, `PAYMENT_PROVIDER_PUBLIC_KEY`, `PAYMENT_PROVIDER_SECRET_REFERENCE`, `PAYMENT_PROVIDER_WEBHOOK_SECRET_REFERENCE`, and `PAYMENT_PROVIDER_TIMEOUT_MS`.

Only id, mode, and a legitimately public key can be exposed by the public configuration helper. Private secret references are explicitly rejected when they use `NEXT_PUBLIC_` naming. No provider credentials are stored in the database.

## Status and error normalization
Provider-specific status vocabulary is converted by `adapter.normalizeStatus()` before entering the canonical Payment state machine.

Provider errors are converted into canonical categories such as timeout, network failure, decline, invalid request, not found, already processed, webhook verification failure, and unknown provider failure. Raw provider messages are not returned to customers.

## Idempotency
The Payment Application Service remains the application idempotency boundary. Provider execution derives a stable provider-safe reference from the internal Payment and Attempt: `payment:<internal-payment-id>:attempt:<attempt-id>`.

The adapter receives that reference without needing to know the database idempotency implementation. This preserves compatibility with provider-side idempotency mechanisms without introducing a second application idempotency model.

## HTTP/network boundary
No HTTP client or provider network call is implemented in Phase 11.4. The adapter interface is the future boundary where authentication, serialization, parsing, timeout handling, retry policy, and provider-specific error mapping belong.

A future adapter must not blindly retry payment creation. A timeout after possible provider acceptance is ambiguous and must remain compatible with PROCESSING, REQUIRES_ACTION, or later status reconciliation.

## Webhook boundary
The generic endpoint is `POST /api/payment/webhook/<providerId>`.

The endpoint resolves only a server-configured adapter, applies payload-size limits, delegates provider-specific signature/authenticity verification to the adapter, and passes only a verified normalized event to the Payment Application Service.

Unverified webhook data cannot mutate Payment state. The Payment domain remains responsible for event validation, deduplication, lifecycle transitions, and persistence.

## Client actions
Client actions are normalized into REDIRECT, EMBEDDED, SDK_ACTION, or NONE. Redirect URLs must use HTTPS. Public tokens are bounded. Secrets and private configuration cannot enter client-action data.

## Transaction boundaries
Provider network calls are intentionally outside database transactions. The intended sequence is: validate internal state; commit internal Payment/Attempt state; call the adapter; normalize the result; persist provider references and the canonical Payment transition. There is no distributed transaction between the database and an external provider.

## Ambiguous responses
Timeouts, delayed confirmation, webhook-before-response, duplicate webhook delivery, and unknown immediate status are not automatically treated as failure. The normalized result must support PROCESSING or REQUIRES_ACTION, followed by status lookup or verified webhook reconciliation.

## Observability
Safe structured logs may include Payment reference, provider ID, Attempt ID, provider reference when non-sensitive, operation, normalized status/error category, latency, and correlation/request ID.

Secrets, tokens, card data, CVV/CVC, private keys, webhook secrets, and raw sensitive provider responses must never be logged.

## Testing
Phase tests cover provider interface compatibility, registry and resolver, supported/unsupported/disabled providers, configuration public/private separation, provider-neutral request shape, response/client-action normalization, status normalization, error taxonomy, provider-selection security, Payment Application Service adapter invocation, provider-reference persistence boundary, webhook verification contract, duplicate event handling through the existing Phase 11.3 service, provider SDK isolation, and Checkout/Payment-state regression.

All provider tests use deterministic fake adapters. No external network request is made.

## Future provider implementation contract
1. Create an isolated adapter module.
2. Implement the provider-neutral interface.
3. Keep authentication inside the adapter.
4. Map internal requests to provider requests.
5. Map provider responses to normalized results.
6. Normalize statuses and errors.
7. Implement webhook verification and event normalization.
8. Register the adapter.
9. Supply secure server-side configuration.
10. Add provider-specific tests.
11. Validate idempotency.
12. Validate timeout/ambiguous-response behavior.
13. Run full CI.

Adding the provider must not require provider branches in Checkout, Storefront, Cart, Product, or the Payment domain.

## Explicit phase boundary
No Razorpay, PayU, Stripe, or other real provider was integrated. No production credentials, live payment requests, real webhook registration, Orders, Shipping, Fulfillment, Inventory Reservation, Refund workflow, or Wishlist were implemented.

## Phase 11.5 readiness
The repository is ready for Phase 11.5 when full validation passes. Phase 11.5 may introduce a real provider only behind this adapter/resolver boundary and must preserve server-authoritative Checkout amounts, durable idempotency, PaymentAttempt auditability, normalized lifecycle transitions, verified webhooks, and provider-neutral application contracts.
