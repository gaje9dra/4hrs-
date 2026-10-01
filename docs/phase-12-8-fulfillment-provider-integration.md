# Phase 12.8 — Qikink Fulfillment Provider Integration

## Selected provider

The repository-selected fulfillment provider is **Qikink**.

This is a repository configuration decision for Phase 12.8. No second provider is implemented.

Qikink's documented create-order API accepts JSON and requires an authentication token, an order number, line items, and shipping information. The documented order-number constraint is at most 15 alphanumeric characters. The adapter therefore derives a deterministic 15-character provider order number from the internal Fulfillment ID instead of forwarding the longer store Order number. citeturn9search0

## Architecture

The integration remains provider-isolated:

`Fulfillment Application → Provider Resolver → Qikink Adapter → Qikink API`

The Order domain does not import Qikink code. Generic Fulfillment services contain no Qikink request/response conditionals.

Adapter location:

`lib/fulfillment/providers/qikink.ts`

Registration:

`lib/fulfillment/resolver.ts`

## Configuration

Server-only environment variables:

- `FULFILLMENT_PROVIDER_ID=qikink`
- `FULFILLMENT_PROVIDER_ENABLED=false` by default
- `FULFILLMENT_PROVIDER_MODE=live`
- `FULFILLMENT_PROVIDER_SECRET_REFERENCE=QIKINK_AUTH_TOKEN`
- `FULFILLMENT_PROVIDER_TIMEOUT_MS=10000`
- `QIKINK_AUTH_TOKEN=<server-only secret>`

The real token must be configured in local/Netlify server environment variables and must never be committed or exposed through `NEXT_PUBLIC_*`.

The adapter uses Qikink's documented create-order endpoint:

`https://qikink.com/erp2/index.php/api/createOrder`

The current official API documentation describes `auth_token` as the Qikink credential and shows the token in the server-side JSON request. citeturn9search0

## Request mapping

The adapter receives only canonical server-side fulfillment data:

- internal Fulfillment ID
- historical Order reference/number
- historical Order total and currency
- historical OrderItem SKU/quantity/unit price
- historical Order shipping snapshot
- customer email needed by Qikink's shipping contract

The provider request never accepts browser-supplied customer identity, payment authority, pricing, or provider selection.

For Qikink:

- `gateway` is `online` because Phase 12.8 only permits fulfillment of Orders whose payment is already authoritative and succeeded.
- `qikink_shipping` is enabled so Qikink can fulfill the order through its documented order flow.
- `search_from_my_products` is enabled, so the stored historical SKU must be a Qikink My Products/store SKU.
- Missing/blank SKU, invalid quantity, non-Indian country code, or missing email fails before network submission.

Qikink documents that store SKUs are available from its My Products/variation view. citeturn11search0

## Provider response mapping

A successful Qikink response returns a provider order identifier. The adapter stores that identifier as `Fulfillment.providerFulfillmentReference` and normalizes the successful create operation to canonical `SUBMITTED`.

No raw Qikink response is returned to the generic Fulfillment layer.

Qikink's documented processing statuses are kept isolated from the canonical lifecycle. Known processing states map to `SUBMITTED`; `Delivered` maps to `COMPLETED`; unknown states remain `PENDING` rather than being guessed as terminal. citeturn6search0

## Status lookup

The adapter advertises `statusLookup=false`.

The current official Qikink API documentation used for this integration documents create-order behavior but does not provide a verified status-retrieval contract that this adapter can safely rely on. The adapter therefore does not invent a status endpoint.

Qikink order-status information remains documented and can be added through a future verified adapter capability without changing the canonical Fulfillment model. citeturn9search0turn6search0

## Submission flow

1. Validate idempotency and Order eligibility.
2. Create the local Fulfillment intent transactionally.
3. Resolve Qikink through the provider registry.
4. Build the provider request from authoritative historical Order data.
5. Call Qikink outside the database transaction.
6. Normalize the response.
7. Persist the Qikink order reference and canonical status in a short transaction.

The external request is never held open inside a database transaction.

## Idempotency and ambiguous outcomes

Qikink's documented create-order contract does not expose a native idempotency key in the request contract used here. The adapter therefore uses a deterministic Qikink `order_number` derived from the immutable local Fulfillment ID.

The adapter does **not** blindly retry a timed-out/network-failed create request because the documented contract does not provide a safe reconciliation lookup for this integration. Such failures are persisted as an ambiguous/reconciliation-required state. This prevents a later worker/request from creating a second Qikink fulfillment blindly.

Successful provider submission followed by local persistence failure is also treated as reconciliation-required rather than resubmitted.

## Retry policy

Create-order POST is intentionally single-attempt for ambiguous transport failures. This is a safety decision, not an omission: without a verified Qikink idempotency/reconciliation operation, automatically repeating the POST could create duplicate fulfillments.

Provider validation/authentication/authorization/rejection errors are not retried.

The timeout is bounded and configurable.

## Error normalization

The adapter maps:

- 401 → authentication
- 403 → authorization
- 404 → not found
- 429 → rate limited
- other 4xx → validation
- 5xx → network/temporary provider failure
- timeout → timeout
- malformed JSON/shape → invalid response
- documented provider rejection response → rejected

Raw provider messages are not exposed through customer-facing responses.

## Security

- Qikink credentials are server-only.
- No Qikink credential is committed.
- No provider URL is user-controlled.
- No provider SDK is imported by Order code.
- No browser code calls Qikink.
- Provider references remain separate from Order IDs and Order numbers.
- Provider responses are shape-validated.
- No raw provider payload is persisted.
- Logs contain provider identity and internal IDs only; credentials are never logged.

## No shipping/tracking UI

Qikink may operate printing and delivery after fulfillment submission, but this phase does not implement customer tracking, carrier integration, shipment pages, returns, refunds, exchanges, or shipping-provider abstractions.

Qikink's own documentation describes tracking/AWB information in its dashboard; that data is intentionally not exposed by this Phase 12.8 integration. citeturn9search9

## Tests

Added:

- Qikink request mapping contract test
- provider order-number length/character test
- missing-secret configuration test
- response/reference normalization test
- processing-status normalization test
- validation/authentication error tests
- bounded timeout test
- status-lookup capability guard
- application submission persistence test
- repeated submission/idempotency test
- historical snapshot/request minimization regression coverage

No test requires a real Qikink credential.

## CI

The Phase 12.8 branch is validated through the repository GitHub Actions CI workflow before readiness is declared.

Normal CI remains independent of Qikink credentials. `FULFILLMENT_PROVIDER_ENABLED` defaults to false, while the adapter contract can be fully tested with mocked HTTP responses.

Live Qikink submission requires the operator to set `QIKINK_AUTH_TOKEN` and explicitly enable the provider in the deployment environment.

## Known limitations

- Status lookup is disabled until a verified Qikink status API contract is available.
- No Qikink webhook is implemented because no verified webhook contract is present in the provider documentation used here.
- Qikink product mapping assumes historical SKU values are valid Qikink My Products/store SKUs.
- Ambiguous POST outcomes require reconciliation rather than automatic duplicate-prone retry.
- No customer-facing fulfillment/shipping UI is implemented.

## Future provider integration

A future provider can implement the same `FulfillmentProviderAdapter` contract and register behind the same resolver without changing Order schema, canonical Fulfillment lifecycle, checkout, payment, cart, or customer Order DTOs.

No second provider is implemented in Phase 12.8.

Qikink remains the only registered production provider adapter in this phase.

<!-- CI validation: fulfillment typecheck/test fixes applied. -->
