# Phase 14.5 — Admin Fulfillment Operations, Provider Control & Order Handoff

## Architecture
Admin Fulfillment is an operational interface over the canonical Fulfillment application/domain layer:

Admin authentication → RBAC → validation → canonical Fulfillment application service → provider-neutral adapter → persistence → audit → response.

The canonical commerce chain remains:

Catalog → Cart → Checkout → Payment → Order → Fulfillment → Shipment → Tracking → Customer

Payment remains authoritative for payment state, Order remains authoritative for order state, Shipping remains authoritative for Shipment/Tracking state, and cancellation/return domains remain authoritative for their own state.

## Fulfillment implementation audited
The existing repository already provides:
- Fulfillment and FulfillmentItem persistence.
- PENDING → SUBMITTED/FAILED and SUBMITTED → COMPLETED/FAILED state transitions.
- Order/payment/address eligibility checks.
- ProductVariant provider-SKU mapping validation.
- Provider resolver and server-only provider configuration.
- Qikink adapter behind the provider-neutral interface.
- Provider submission and normalized failure handling.
- Ambiguous provider outcomes requiring reconciliation.
- Provider status reconciliation where an adapter supports verified status lookup.
- Serializable transaction boundaries and conditional state updates.
- Shipment handoff owned by the canonical Shipping service.

No Admin-specific fulfillment state machine was introduced.

## Admin permissions
Phase 14.5 adds:
- fulfillment.read
- fulfillment.view_sensitive
- fulfillment.create
- fulfillment.submit
- fulfillment.retry
- fulfillment.reconcile
- fulfillment.cancel
- fulfillment.provider.manage
- fulfillment.audit.read

The existing fulfillment.manage permission is preserved for compatibility. High-risk provider operations are not automatically granted to ordinary administrators.

## Listing and detail
Admin listing provides:
- bounded pagination
- deterministic sorting
- status/provider/date/shipment filters
- failure filtering
- order/customer/provider search
- permission-gated provider references
- no full-table browser loading

Admin detail provides:
- fulfillment/order/customer identity
- canonical fulfillment status and timestamps
- historical OrderItem snapshot SKU/title information
- provider mapping references when permitted
- provider reference when permitted
- failure/reconciliation state
- shipment handoff state
- cancellation/return relationships
- append-only admin audit history

Provider credentials, access tokens, authorization headers, secrets and raw provider payloads are never exposed.

## Order → Fulfillment handoff
The existing canonical createFulfillment service is exposed through an authorized Admin collection action. It validates:
- order status
- authoritative successful payment
- historical shipping address
- historical OrderItem SKU
- ProductVariant/provider mapping
- configured provider capability

Admin never creates a Fulfillment row directly.

## Submission and retry
Admin submission and retry invoke submitFulfillment in the canonical application service.

Retry remains subject to the existing service rules:
- ambiguous outcomes cannot be blindly retried
- retryable failure metadata is checked
- attempt count is bounded
- completed/submitted Fulfillments are not duplicated
- historical provider attempts are represented in canonical reconciliation metadata

Admin cannot manually mark a Fulfillment submitted or completed.

## Reconciliation
Admin reconciliation invokes reconcileFulfillment.

The canonical service:
- requires a provider reference
- requires verified provider status lookup capability
- validates provider identity/reference
- accepts only state transitions allowed by the canonical state machine
- uses Serializable persistence and expected-state checks
- leaves unsupported/ambiguous outcomes in a recoverable state

The current Qikink adapter deliberately reports status lookup as unsupported because the repository does not have a verified documented status endpoint in its provider contract. Admin therefore surfaces reconciliation as unavailable rather than inventing an endpoint.

## Idempotency and concurrency
Phase 14.5 adds canonical FulfillmentOperationIdempotency persistence for provider-affecting Submit, Retry and Reconcile operations.

Repeated idempotency keys do not execute a second provider operation. Conflicting reuse of a key is rejected. Pending operations block duplicate execution; ambiguous operations require reconciliation.

Fulfillment creation continues to use the existing Fulfillment.idempotencyKey.

Database Serializable transactions and expected-status updates remain the concurrency boundary. UI button disabling is not relied upon for safety.

## Qikink boundary
Qikink remains only a FulfillmentProviderAdapter.

Admin never calls Qikink directly and no browser code receives provider credentials. Provider responses are normalized into generic Fulfillment results before reaching Admin.

No catalog import, product synchronization, provider browser, new provider, or Qikink-specific Admin service was added.

## Shipment handoff
Admin Fulfillment reads Shipment information but does not create or mutate Shipment state. Shipment creation/tracking/reconciliation remain owned by the canonical Shipping service.

## Cancellation and returns
Admin Fulfillment only displays existing cancellation/return relationships. It does not introduce or mutate those state machines.

## Audit
Privileged create, submit, retry and reconcile actions write centralized AdminAuditLog entries with:
- actor
- action
- Fulfillment resource
- result
- operational reason
- correlation ID
- idempotency key and safe normalized metadata

Secret-like metadata is filtered by the existing audit sanitizer.

## Database changes
Added:
- 20261003020000_admin_fulfillment_operations
- 20261003021000_fulfillment_operation_idempotency

The first migration seeds granular Admin permissions. The second adds canonical Fulfillment operation idempotency records.

No historical Fulfillment records are rewritten.

## Tests
Added tests/admin-fulfillment-operations.test.ts covering:
- bounded/deterministic list validation
- direct Prisma mutation prohibition in Admin
- canonical service usage
- provider secret exclusion
- operation idempotency presence
- application construction

The full existing test suite remains mandatory CI coverage.

## Known limitations
1. Qikink status lookup is intentionally unsupported by the current verified adapter contract, so reconciliation against Qikink cannot fabricate a provider status.
2. fulfillment.cancel and fulfillment.provider.manage are permission taxonomy entries only; no arbitrary cancellation/provider reassignment operation is exposed because the canonical Fulfillment service does not support those mutations.
3. Attempt history is represented from canonical submission-attempt metadata because there is no separate FulfillmentAttempt model in the existing schema. No synthetic provider attempts are written.
4. Distributed rate limiting remains the process-local limitation documented by Phase 14.1.

## CI
Completion requires lint, typecheck, PostgreSQL migration/test execution, build, Prisma validation/generation, and the GitHub CI workflow to pass. No check is weakened or suppressed.
