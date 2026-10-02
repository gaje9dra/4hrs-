# Phase 14.4 — Admin Payment Operations, Refund Controls & Financial Safety

## Scope
Phase 14.4 adds an administrative operations surface over the existing provider-neutral Payment architecture. Admin is not a payment authority: all financial state transitions and refund execution remain inside lib/payments.

Canonical boundary:

Admin authentication → RBAC → validation → Payment application service → Payment domain/provider adapter → persistence → audit → response.

Qikink is not involved in payment operations.

## Current Payment architecture audit
The repository already contains:
- lib/payments/domain.ts: canonical Payment statuses and transition table.
- lib/payments/application.ts: Payment creation, state transitions, retry, provider execution, normalized event processing.
- lib/payments/repository.ts: Prisma persistence, Serializable transactions, conditional status updates, attempts, events and idempotency.
- lib/payments/provider.ts: provider-neutral create/retrieve/verify/webhook/refund capability boundary.
- lib/payments/resolver.ts and registry.ts: server-controlled provider selection.
- lib/payments/webhooks.ts: normalized webhook contract.
- Payment, PaymentAttempt, PaymentEvent, and PaymentIdempotency persistence.
- Existing Payment statuses: CREATED, REQUIRES_ACTION, PROCESSING, SUCCEEDED, FAILED, CANCELLED, EXPIRED, REFUNDED, PARTIALLY_REFUNDED.

The repository had no canonical Refund entity or refund application operation before this phase. Refund support was therefore extended minimally rather than bypassed from Admin.

No real provider adapter is registered in the current registry. Refund/reconciliation operations therefore fail safely when no supported provider is configured.

## Refund architecture
A canonical PaymentRefund persistence record was added with:
- payment relationship
- exact amount/currency
- controlled reason enum
- idempotency key
- provider identity/reference
- PENDING, SUCCEEDED, FAILED, or AMBIGUOUS status
- bounded operational note
- completion timestamps.

Refundable balance is calculated server-side from the Payment amount minus successful, pending, and ambiguous refunds. Pending/ambiguous refunds reserve balance so concurrent requests cannot over-refund.

The Payment application service:
1. validates payment eligibility, currency and positive amount;
2. validates the controlled reason;
3. checks the existing Payment idempotency infrastructure;
4. creates the pending refund reservation in a Serializable transaction;
5. resolves the configured provider server-side;
6. calls the provider refund capability;
7. only records SUCCEEDED after a provider-confirmed refund state;
8. transitions the canonical Payment to PARTIALLY_REFUNDED or REFUNDED only when required;
9. records provider failures as failed;
10. records timeouts/network ambiguity as AMBIGUOUS and never fabricates success.

Provider-confirmed refunds followed by local finalization failures are also marked AMBIGUOUS, preventing a false financial failure.

## Reconciliation and verification
Admin verification/reconciliation invokes the canonical provider retrievePayment capability. It never manually sets a Payment status. A provider-returned state is accepted only through the existing Payment transition table.

If no provider is configured or the provider lacks status lookup, the operation returns a safe provider-unavailable error.

## Retry
Failed Payment retry uses the canonical Payment application service and creates a new PaymentAttempt without overwriting historical attempts. Admin retry requires an idempotency key and reuses the central PaymentIdempotency boundary.

## Admin permissions
Phase 14.4 adds:
- payments.read
- payments.view_sensitive
- payments.verify
- payments.capture
- payments.refund
- payments.refund_partial
- payments.reconcile
- payments.retry
- payments.audit.read

The existing RBAC model remains authoritative. High-risk payment permissions are not granted broadly. payments.capture is taxonomy-only in this phase because the current provider interface does not expose a capture capability.

## Admin API
Implemented:
- GET /api/admin/payments
- GET /api/admin/payments/:paymentId
- POST /api/admin/payments/:paymentId/actions

The API uses the existing Admin authentication, same-origin protection, bounded JSON body handling, stable error contracts, server-side RBAC and centralized audit logging.

List filters are server-side and bounded. Sorting is whitelisted and deterministic. The implementation does not load the full Payment table into the browser.

## Sensitive data
Admin DTOs expose only operationally required information. Provider references and provider event IDs are permission-gated by payments.view_sensitive. Provider credentials, webhook secrets, access tokens, authorization headers, card numbers and CVV/CVC are never returned.

Provider metadata is not exposed as an arbitrary raw payload.

## Audit
Privileged payment actions record:
- admin actor
- action
- Payment resource
- success/failure
- reason
- correlation/request ID where available
- bounded non-sensitive metadata.

The existing append-only Admin audit model is reused.

## Concurrency and idempotency
- Refund reservation and balance validation are performed inside Serializable transaction boundaries.
- Successful/pending/ambiguous refunds reserve refundable balance.
- Refund idempotency uses the existing PaymentIdempotency mechanism plus a unique refund idempotency key.
- Retry uses PaymentIdempotency.
- Payment state transitions retain expected-status conditional updates.
- Duplicate refund requests do not invoke the provider twice.

## UI
Admin Payments uses the existing 4HRS+ Bauhaus system:
- hard black borders
- offset shadows
- yellow/red/black blocks
- uppercase operational typography
- responsive layouts
- accessible labels, buttons, dialogs and error states.

Refund confirmation explicitly shows the amount and reason and requires an operational confirmation reason.

## Database changes
Added migration:
20261003011000_payment_refund_foundation

Added permission migration:
20261003010000_admin_payment_operations

No historical financial records are modified.

## Testing
Added tests/admin-payment-operations.test.ts covering:
- bounded payment query validation
- partial refund success
- remaining-balance enforcement
- concurrent refund protection
- refund idempotency
- direct Admin Prisma mutation prohibition
- sensitive-data source restrictions.

The existing full payment/order/admin test suites remain part of repository CI.

## Known limitations
1. No real payment provider adapter is currently registered, so live refund/reconciliation cannot execute until a supported provider is configured.
2. The provider-neutral interface has no capture capability; the capture permission is defined but no capture action is exposed.
3. Ambiguous refunds are deliberately not marked successful without provider-confirmed state. Operational reconciliation is required.
4. Payment provider method/type is not modeled by the current schema, so no invented payment-method filter or field is exposed.
5. Distributed rate limiting remains the existing process-local limitation documented by Phase 14.1.

## CI
Completion requires the repository's actual lint, typecheck, test, build, migration validation and GitHub CI workflow to pass. No check is weakened or suppressed.
