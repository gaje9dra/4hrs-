# Phase 14.8 — Admin Analytics, Reporting & Operational KPI Dashboard

## Objective

Provide a production-grade, read-only Admin analytics projection over the canonical 4HRS+ commerce domains.

Canonical domains remain authoritative. Analytics does not own or mutate Order, Payment, Refund, Fulfillment, Shipment, Tracking, Return, Cancellation, Case or Customer state.

## Existing-state audit

Before Phase 14.8 the Admin dashboard contained an Analytics navigation/module placeholder and the centralized RBAC contained only the broad `analytics.read` permission. There was no dedicated analytics application service, report API, analytics read model, materialized view, export implementation or chart/reporting persistence.

Phase 14.8 therefore adds a single analytics application/reporting service rather than duplicating existing reporting infrastructure.

## Architecture

`Admin authentication/RBAC → analytics query validation → canonical database aggregation → safe Analytics DTO → Admin UI`

The implementation is intentionally read-only. It does not call fulfillment/shipping providers and does not create an analytics state machine.

### Data sources

- Sales/orders: `Order` joined to canonical `Payment`.
- Refunds: successful `PaymentRefund` records, grouped once by Payment before joining to Orders.
- Payment attempts: `PaymentAttempt`.
- Fulfillment operations: `FulfillmentOperationIdempotency`.
- Shipments/tracking availability: `Shipment`.
- Returns: `ReturnRequest` and `ReturnItem`.
- Cancellations: `CancellationRequest`.
- Cases: `Case`.
- Customer aggregates: `Customer` and paid-order relationships.

No raw provider payloads or customer PII are returned by the analytics DTO.

## Reporting time semantics

Reporting timezone is explicit. Default: `Asia/Kolkata`.

Date inputs are calendar dates in the requested reporting timezone. Reports use a half-open interval:

`[from 00:00:00, day after to 00:00:00)`

PostgreSQL performs timezone-aware conversion and database-side date bucketing. Maximum range is 366 calendar days.

Supported grouping:

- day
- week
- month

Unsupported grouping and invalid timezone/date/range values are rejected server-side.

## Financial safety

The application currently supports one reporting currency: INR.

If the selected range contains another currency, analytics rejects the report rather than silently converting or mixing currencies.

Paid revenue is based on Orders whose canonical Payment status is:

- SUCCEEDED
- REFUNDED
- PARTIALLY_REFUNDED

Refunds include only PaymentRefund records with `SUCCEEDED` status. Refund rows are aggregated by Payment before joining to Orders, preventing multiple refund records from multiplying order revenue.

No floating-point arithmetic is used for monetary formulas. Prisma Decimal/PostgreSQL numeric values are used.

### Financial definitions

- Gross sales = sum of Order.total for paid orders in the reporting range.
- Refund amount = sum of successful PaymentRefund.amount associated with those paid payments.
- Net sales = gross sales - successful refunds.
- Paid order count = count of Orders whose Payment has a paid status.
- AOV = gross sales / paid order count.
- Payment success rate = successful PaymentAttempt count / (successful + failed PaymentAttempt count).
- Refund count = successful PaymentRefund row count.

The repository does not expose a canonical discount ledger, so discount amount is not fabricated.

The repository's OrderStatus does not contain a CANCELLED state. Cancellation analytics therefore report CancellationRequest activity rather than inventing an Order cancellation status.

## Operational KPI definitions

- Fulfillment attempts = FulfillmentOperationIdempotency SUBMIT records.
- Fulfillment success/failure/pending = SUBMIT records by canonical operation status.
- Retry/reconciliation counts = corresponding canonical operation records.
- Shipment count = Shipment rows created in the reporting range.
- Delivery failures = Shipment rows in DELIVERY_FAILED status.
- Tracking available = Shipments with a canonical tracking number.
- Delivered = Shipment rows in DELIVERED status.
- In transit = IN_TRANSIT or OUT_FOR_DELIVERY.
- Pending shipment = CREATED.
- Return requests = ReturnRequest rows created in range.
- Approved/rejected/resolved returns = corresponding canonical ReturnRequest statuses.
- Received item quantity = ReturnItem quantity for returns that reached receipt/inspection/resolution states.
- Cancellation requests = CancellationRequest rows created in range.
- Completed cancellations = CancellationRequest rows in COMPLETED status.
- Cancellation rate = completed cancellations / paid order count. If denominator is zero, the result is N/A.
- Open cases = Case rows in OPEN, TRIAGED, ASSIGNED, IN_PROGRESS or WAITING.
- New cases = Case rows created in range.
- Resolved cases = Case rows in RESOLVED or CLOSED.
- New customers = Customer rows created in range.
- Customers with paid orders = distinct customers with a paid Order in the range.

## API

`GET /api/admin/analytics`

Supported query parameters:

- `from=YYYY-MM-DD`
- `to=YYYY-MM-DD`
- `timezone=IANA timezone`
- `grouping=day|week|month`

The endpoint is read-only. State-changing methods are explicitly rejected.

Responses contain a stable Analytics DTO rather than raw Prisma rows.

No unlimited report export endpoint was added. Export is deferred until a safe bounded export contract is justified.

## RBAC

Centralized permissions:

- `analytics.read`
- `analytics.financial.read`
- `analytics.operations.read`
- `analytics.customer.read`

Financial and customer analytics are not automatically exposed to every admin.

Role allocation:

- SUPER_ADMIN: all analytics permissions.
- ADMIN: all analytics permissions.
- OPERATIONS: base + operational analytics.
- VIEWER: base analytics only.

No ad-hoc role checks are used.

## Performance

Analytics uses a fixed set of database-side aggregate queries and one bounded trend query. It does not load entire domain tables into application memory and does not use N+1 relation loading.

No analytics materialized view or rollup table was introduced because the current repository does not provide evidence that a derived read model is necessary.

The report is live canonical aggregation; cache TTL is zero.

## Caching/freshness

No cross-user analytics cache is used. Every request computes against canonical persisted records, avoiding authorization-scope cache leakage and stale financial totals.

The response reports a generation timestamp and identifies the model as `live-canonical-aggregation`.

## Security/privacy

- Server-side Admin authentication and RBAC are mandatory.
- Date/time/grouping inputs are validated.
- Query range is bounded.
- SQL values are parameterized through Prisma's safe tagged SQL API.
- No dynamic table/column identifiers are accepted from clients.
- No browser-to-provider calls exist.
- No Qikink-specific analytics structures are used.
- Customer analytics is aggregated.
- Customer email, phone, address and payment/provider identifiers are not exposed.
- Sensitive financial/customer analytics access is recorded through the existing AdminAuditLog.
- Analytics has no business-domain mutation path.

## Database changes

One migration adds only the granular analytics Admin permissions and role assignments:

`prisma/migrations/20261003050000_admin_analytics_permissions/migration.sql`

No canonical commerce tables were added or modified.

## Testing

Added `tests/admin-analytics.test.ts` covering:

- bounded and deterministic date/timezone/grouping validation
- zero-denominator handling
- Decimal financial formulas
- negative legitimate net sales
- read-only implementation
- no provider calls
- database-side aggregation
- refund deduplication semantics
- centralized RBAC
- deferred export boundary
- customer PII exclusion

The complete existing suite remains mandatory.

## Known limitations / deferred work

1. Only INR is currently supported for analytics aggregation; mixed-currency reporting is rejected.
2. Discounts are not reported because the current canonical schema does not provide a dedicated discount ledger.
3. Order cancellation is represented through CancellationRequest because OrderStatus has no CANCELLED state.
4. No analytics export is implemented; an export contract requires bounded, permission-safe, audited behavior.
5. No materialized/rollup read model is currently necessary; if production scale later requires one, it must remain rebuildable from canonical data.
6. No predictive or causal analytics are inferred from the canonical operational records.

## Operational guidance

Use the Admin Analytics page for bounded reporting periods. Always verify the displayed reporting timezone before comparing periods. Financial totals should be reconciled against the canonical Order, Payment and PaymentRefund records before external accounting use.

Phase 14.8 does not redesign any completed commerce domain.
