# Phase 12.9 — Fulfillment Webhooks, Reconciliation & State Consistency Hardening

## Result

Phase 12.9 hardens the existing provider-neutral Fulfillment flow without adding a second provider or redesigning the Phase 12.7/12.8 architecture.

Qikink remains the only registered fulfillment provider.

## Provider event architecture

The current Qikink integration does **not** have a verified webhook contract in the official Open API documentation used by this repository. The official API documents the create-order endpoint and the authentication token, while Qikink documents order-processing statuses in its dashboard/help center. This phase therefore does not invent a webhook signature algorithm, webhook endpoint, or unsupported event format.

Official references:
- https://admins.qikink.com/api-docs/
- https://qikink.com/help/orders/order-statuses-or-processing/

Because the selected adapter currently advertises `statusLookup=false`, no generic polling loop is introduced. A reconciliation operation is available at the application boundary and safely refuses reconciliation when the selected provider has no verified status lookup capability.

## Reconciliation flow

For providers that support verified status retrieval:

`Fulfillment → Provider Resolver → Provider Status Lookup → Provider Response Validation → Canonical State Transition → Persistence`

The application verifies:

- provider identity matches the configured adapter
- provider fulfillment reference matches the stored reference
- current internal state is still valid
- the provider result is a canonical Fulfillment lifecycle status
- the transition is allowed by the domain state machine
- terminal Fulfillments cannot be reopened
- concurrent state changes are rejected safely

A provider status equal to the current internal state is recorded as a reconciliation match without performing a duplicate transition.

## Qikink-specific limitation

The current Qikink adapter does not expose a verified status lookup endpoint, so ambiguous Qikink create-order outcomes remain reconciliation-required rather than being blindly resubmitted.

This is important for timeout/network failures: the application must not issue a second create-order request when Qikink may already have accepted the first request.

Qikink's documented create-order API requires an `auth_token` and returns a provider `order_id`; the repository stores that value as the provider fulfillment reference.

## State consistency hardening

The application now:

- validates the caller's expected Fulfillment status before applying a transition
- performs the same check again inside the serializable transaction
- protects terminal `COMPLETED` Fulfillments from later mutation
- records reconciliation outcomes in server-side reconciliation metadata
- uses conditional database updates for state transitions
- rejects provider identity/reference mismatches
- avoids duplicate provider submission after successful persistence
- preserves ambiguous-submission protection already established in Phase 12.8

## Webhook security decision

No Qikink webhook endpoint is added in this phase because the repository does not have a verified Qikink webhook authentication/event contract to implement.

Therefore this phase does **not**:
- invent HMAC/signature verification
- accept browser-supplied provider events
- persist untrusted raw provider payloads
- create a fake webhook event schema
- allow direct provider-to-database mutation

If Qikink later provides a documented webhook contract, it must be implemented through the provider adapter boundary with raw-body verification, replay protection, persistent event deduplication, canonical event normalization, and the existing Fulfillment state machine.

## Testing

Regression coverage includes:

- stale expected-state rejection
- terminal Fulfillment protection
- reconciliation refusal when status lookup is unsupported
- existing provider submission/idempotency behavior
- historical snapshot isolation
- lifecycle transition validation

The Qikink adapter tests continue to verify credential handling, request mapping, response normalization, timeout classification, and the disabled status-lookup capability.

## Security

Provider credentials remain server-only.

No webhook or reconciliation operation accepts a client-controlled provider URL or Fulfillment ID as authoritative provider identity.

Provider references are validated against the stored Fulfillment/provider mapping.

Operational reconciliation metadata is not part of customer-facing Order DTOs.

## Scope protection

This phase does not add:

- a second fulfillment provider
- shipping/carrier integration
- shipment creation
- tracking UI
- returns
- refunds
- exchanges
- customer fulfillment UI
- checkout/payment/cart redesign
- inventory redesign
- admin fulfillment dashboard
- provider-specific fields in the generic Order model

## Validation

Run the repository CI-equivalent validation before declaring Phase 12.9 ready:

- lint
- typecheck
- unit tests
- integration/API tests
- database migration validation
- production build
- browser/e2e tests when available

Do not declare Phase 12.9 ready while known validation failures remain.
