# Phase 12.7 — Fulfillment Domain & Provider-Neutral Foundation

## Scope
Phase 12.7 introduces the first real Fulfillment domain after Phase 12.6. It is provider-neutral. No Qikink, Printrove, Printful, Printify, shipping, tracking, returns, refunds, exchanges, cancellation, inventory reservation/deduction, customer Fulfillment UI, or admin Fulfillment UI is implemented.

## Architecture
Order -> Fulfillment Application Service -> Fulfillment Domain -> Fulfillment Repository -> Provider Resolver -> Provider Adapter -> future external/manual/inventory implementation.

The current repository contains no approved external fulfillment integration, so the adapter boundary exists but no network call is made.

## Data model
Fulfillment is attached to exactly one Order. It stores a provider-neutral provider identifier, optional provider fulfillment reference, lifecycle status, unique idempotency key, operational timestamps, and safe error/reconciliation metadata.

FulfillmentItem references exactly one historical OrderItem and stores quantity plus provider item/SKU/variant references. The current model enforces one coherent Fulfillment per Order and one FulfillmentItem per OrderItem. Split fulfillment is out of scope.

Order remains the historical commercial record. Fulfillment does not copy prices, totals, payment data, or mutable catalog data.

## Lifecycle
The smallest current lifecycle is PENDING -> SUBMITTED -> COMPLETED, with FAILED as a retryable failure state.

Allowed transitions:
- PENDING -> SUBMITTED
- PENDING -> FAILED
- SUBMITTED -> COMPLETED
- SUBMITTED -> FAILED
- FAILED -> SUBMITTED

COMPLETED is terminal. All transitions use centralized validation and expected-state compare-and-set persistence.

Fulfillment does not automatically overwrite Order status. Future orchestration must use an authorized Order lifecycle transition.

## Order eligibility
Creation verifies that the Order exists, is CONFIRMED, has an authoritative SUCCEEDED Payment with completedAt, has a complete historical shipping address, has fulfillable items, has positive quantities, and has historical SKU mappings. The client cannot declare an Order fulfillment-ready.

## Creation and idempotency
The application accepts an Order ID and an idempotency key. Provider selection is server-controlled and is not accepted from the browser.

Creation resolves the provider and validates configuration/capability, then creates the Fulfillment and all FulfillmentItems transactionally. The external adapter create operation is intentionally not invoked in this phase.

Uniqueness is enforced by Fulfillment.orderId and Fulfillment.idempotencyKey. Repeated requests with the same key for the same Order return the existing record; reuse for another Order is rejected.

## Concurrency
Creation and transitions use the established Prisma Serializable transaction convention. Creation retries serialization conflicts and reconciles unique conflicts by re-reading the committed record. Lifecycle updates use an expected-state compare-and-set.

Prisma documents Serializable transactions and retry handling for P2034 write conflicts. citeturn1search0turn1search2

## Provider adapter and resolver
FulfillmentProviderAdapter defines configuration validation, creation, status retrieval, status normalization, and safe provider-error normalization. A single registry is the server-side adapter registration boundary.

The resolver reads trusted server configuration and returns the registered adapter. There are currently zero production adapters.

Provider configuration is environment-driven through FULFILLMENT_PROVIDER_ID, FULFILLMENT_PROVIDER_ENABLED, FULFILLMENT_PROVIDER_MODE, FULFILLMENT_PROVIDER_SECRET_REFERENCE, and FULFILLMENT_PROVIDER_TIMEOUT_MS. No credentials or API keys are committed.

## Provider-neutral request
The internal provider request contains only Order reference, Order number, currency, fulfillment item references/SKU/variant/quantity, and the historical shipping snapshot. It excludes customer IDs, payment IDs, payment amounts, internal audit data, credentials, tokens, and unnecessary database data.

## Snapshot integrity
Mapping is Order -> OrderItem -> FulfillmentItem. Fulfillment input is built from immutable Order snapshots and does not rebuild purchased data from current Product or Variant records.

Provider metadata is isolated in Fulfillment and FulfillmentItem. No provider-specific field is added to Order, OrderItem, Payment, Cart, Checkout, or customer-facing Order DTOs.

## Manual and multi-provider readiness
The provider identifier is canonical and provider-neutral. Future adapters can represent external providers, manual fulfillment, or own inventory without changing Order schema or customer Order experience.

## Error model
Structured errors cover not eligible, already exists, invalid state, invalid transition, unsupported provider, provider not configured, invalid item mapping, concurrency conflict, idempotency conflict, Order not found, and database failure. Raw provider exceptions are not returned.

## Observability
Structured observations cover eligibility/mapping, creation, lifecycle transitions, and provider boundaries. Logs use stable internal identifiers and safe provider identifiers. Secrets, tokens, passwords, unnecessary full addresses, sensitive payment data, and provider credentials are not logged.

## Security
The foundation protects against forged Order IDs, arbitrary provider selection, duplicate/replayed creation, idempotency-key reuse, unsafe provider metadata, secret exposure, and raw provider exception leakage. No new public customer Fulfillment endpoint is exposed.

## Performance
Creation loads one Order with Payment, OrderItems, and shipping snapshot. It avoids N+1 catalog queries. Duplicate detection uses unique indexes and targeted lookups. Provider resolution is an in-process registry lookup.

## Customer/admin regression
No customer Fulfillment UI or admin Fulfillment UI was added. Phase 12.5 Order History and Order Detail continue to expose only the existing public Order DTO and do not expose internal Fulfillment implementation details.

## Database migration
Migration 20261001150000_add_fulfillment_foundation adds FulfillmentStatus, Fulfillment, FulfillmentItem, foreign keys, uniqueness constraints, and lookup indexes. Historical Order rows are not rewritten or deleted.

## Tests
tests/fulfillment-domain.test.ts covers eligible creation, non-eligible rejection, idempotent retries, concurrent duplicate prevention, lifecycle validation, terminal protection, unsupported provider handling, provider request data minimization, and historical snapshot preservation.

The mock provider adapter throws if its external create/retrieve methods are invoked, proving Phase 12.7 makes no real external provider calls.

## Known limitations
- No production provider adapter exists.
- No external API calls are made.
- Provider submission/status synchronization is future work.
- No shipment/tracking domain exists.
- No split fulfillment exists.
- Fulfillment is not customer-facing.
- Fulfillment does not automatically transition the Order.
- Inventory reservation/deduction is not implemented.

## Future provider integration requirements
A future provider phase must implement and register FulfillmentProviderAdapter, use server-side configuration, keep credentials out of source control, normalize provider statuses, keep external references in Fulfillment/FulfillmentItem, invoke providers outside database transactions, preserve idempotency/concurrency guarantees, and never mutate historical Order snapshots.

No real external fulfillment provider integration was implemented in Phase 12.7.
