# Phase 14.3 — Admin Order Management, Order Operations & Customer Order Control

## Scope
Phase 14.3 adds a protected administrative control plane over the existing canonical Order, Payment, Fulfillment, Shipping and Returns/Cancellations domains. It does not create a second Order lifecycle.

The canonical boundary remains:
Catalog → Cart → Checkout → Payment → Order → Fulfillment → Shipment → Tracking → Customer.

Admin UI → Admin API → Phase 14.1 Authentication/RBAC → Admin Order application facade → canonical domain/application services and authoritative persistence.

## Order read model
The admin order list is bounded and server-side. It supports validated search, status/payment/fulfillment/shipment/cancellation/return filters, date range, deterministic sorting and pagination. Search targets order number, checkout reference, customer email/name and Store SKU. UUID search is exact.

The detail DTO is admin-safe and selectively exposes customer/order/payment/provider/shipping information required for legitimate operations. It does not expose passwords, sessions, credentials, payment secrets, provider credentials or payment-event metadata.

Historical OrderItem and address snapshots are read from persisted Order snapshots. Current catalog values do not replace historical commercial data.

## Operational boundaries
- Payment remains authoritative for payment state. No payment mutation or refund shortcut was added because the existing Payment application does not expose a canonical admin refund operation.
- Fulfillment remains authoritative for fulfillment state. Retry and reconciliation invoke the existing Fulfillment application service.
- Shipping remains authoritative for shipment/tracking state. Reconciliation invokes the existing Shipping application service.
- Cancellation and Returns remain in the existing Returns/Cancellations application service. Admin Order actions resolve the requested resource to the target Order before invoking those operations.
- Qikink is never called from the browser and is not exposed as a catalog/order management system.

## Actions
Supported actions are deliberately narrow:
- cancellation request review: orders.cancel plus returns.manage
- return request review: returns.manage
- fulfillment retry/reconciliation: fulfillment.manage
- shipment reconciliation: shipping.manage

No generic Edit Order action exists. Historical prices, quantities, totals, payment state, fulfillment state and shipment state cannot be arbitrarily edited.

## Security and audit
Every API authenticates and authorizes server-side. Resource IDs supplied by the client are resolved server-side and checked against the selected Order, preventing cross-order action/IDOR. State-changing requests use same-origin protection, bounded JSON bodies and privileged reasons.

Successful and failed order mutations are written to centralized AdminAuditLog with actor, Order resource, reason, result, correlation ID and sanitized metadata. Domain-specific CommerceExceptionAuditEvent records remain separate from the centralized admin audit stream.

## Timeline
The Order detail timeline is composed only from persisted domain events/timestamps: PaymentEvent, Fulfillment timestamps, Shipment/Tracking records and cancellation/return audit records. Current status alone is never converted into a fabricated historical event. Centralized AdminAuditLog is displayed separately.

## Performance
List queries use bounded take, indexed Order fields, selective relations and deterministic secondary ID sorting. Detail queries are deeper by design. No full Order table is loaded into memory and no provider calls occur in list/detail reads.

## Database
No migration was added. Existing Order/Payment/Fulfillment/Shipment/Returns/Cases/Admin schemas already provide the required persistence.

## Testing and quality
Added tests/admin-order-management.test.ts covering query validation, bounds, sorting, operational filters and date-range validation. Repository-wide lint, typecheck, test, build and Prisma gates remain mandatory.

## Operational limitations
- Payment refunds are intentionally unavailable through Admin Order Management because no canonical Payment refund application operation exists.
- Direct administrator cancellation of an Order is not invented because the canonical Order lifecycle has no CANCELLED state; cancellation is owned by the existing cancellation request domain and is reviewed through its canonical service.
- The process-local admin rate limiter remains a distributed deployment limitation inherited from Phase 14.1.
