# Phase 14.8 — KPI Definitions

This document is the canonical KPI reference for the Admin Analytics module.

| KPI | Formula / definition | Canonical source | Permission |
|---|---|---|---|
| Gross sales | Sum Order.total where Payment.status is SUCCEEDED, REFUNDED or PARTIALLY_REFUNDED | Order + Payment | analytics.financial.read |
| Net sales | Gross sales minus successful PaymentRefund amounts | Order + Payment + PaymentRefund | analytics.financial.read |
| Paid orders | Count of Orders with a paid Payment status | Order + Payment | analytics.financial.read |
| AOV | Gross sales / paid orders; N/A when paid orders = 0 | Order + Payment | analytics.financial.read |
| Successful payments | PaymentAttempt rows with paid status | PaymentAttempt | analytics.financial.read |
| Failed payments | PaymentAttempt rows with FAILED status | PaymentAttempt | analytics.financial.read |
| Pending payments | PaymentAttempt rows with CREATED, REQUIRES_ACTION or PROCESSING | PaymentAttempt | analytics.financial.read |
| Payment success rate | Successful attempts / (successful + failed attempts); N/A when denominator = 0 | PaymentAttempt | analytics.financial.read |
| Refund amount | Successful PaymentRefund.amount | PaymentRefund | analytics.financial.read |
| Refund count | Successful PaymentRefund rows | PaymentRefund | analytics.financial.read |
| Fulfillment attempts | SUBMIT operation records | FulfillmentOperationIdempotency | analytics.operations.read |
| Fulfillment success | SUBMIT records with SUCCEEDED status | FulfillmentOperationIdempotency | analytics.operations.read |
| Fulfillment failure | SUBMIT records with FAILED status | FulfillmentOperationIdempotency | analytics.operations.read |
| Fulfillment pending | SUBMIT records with PENDING status | FulfillmentOperationIdempotency | analytics.operations.read |
| Fulfillment retries | RETRY operation records | FulfillmentOperationIdempotency | analytics.operations.read |
| Fulfillment reconciliations | RECONCILE operation records | FulfillmentOperationIdempotency | analytics.operations.read |
| Shipments | Shipment rows created in range | Shipment | analytics.operations.read |
| Delivery failures | Shipment rows with DELIVERY_FAILED | Shipment | analytics.operations.read |
| Tracking available | Shipment rows with non-null tracking number | Shipment | analytics.operations.read |
| Delivered | Shipment rows with DELIVERED | Shipment | analytics.operations.read |
| In transit | IN_TRANSIT or OUT_FOR_DELIVERY shipments | Shipment | analytics.operations.read |
| Pending shipment | CREATED shipments | Shipment | analytics.operations.read |
| Return requests | ReturnRequest rows created in range | ReturnRequest | analytics.operations.read |
| Approved returns | ReturnRequest rows with APPROVED | ReturnRequest | analytics.operations.read |
| Rejected returns | ReturnRequest rows with REJECTED | ReturnRequest | analytics.operations.read |
| Resolved returns | ReturnRequest rows with RESOLVED | ReturnRequest | analytics.operations.read |
| Received item quantity | ReturnItem.quantity for returns that reached receipt/inspection/resolution states | ReturnRequest + ReturnItem | analytics.operations.read |
| Cancellation requests | CancellationRequest rows created in range | CancellationRequest | analytics.operations.read |
| Completed cancellations | CancellationRequest rows with COMPLETED | CancellationRequest | analytics.operations.read |
| Cancellation rate | Completed cancellations / paid orders; N/A for zero denominator | CancellationRequest + Order + Payment | analytics.operations.read |
| Open cases | Case rows in OPEN, TRIAGED, ASSIGNED, IN_PROGRESS or WAITING | Case | analytics.operations.read |
| New cases | Case rows created in range | Case | analytics.operations.read |
| Resolved cases | Case rows in RESOLVED or CLOSED | Case | analytics.operations.read |
| New customers | Customer rows created in range | Customer | analytics.customer.read |
| Customers with paid orders | Distinct customers with a paid Order in range | Customer + Order + Payment | analytics.customer.read |

## Time semantics

All KPIs use the selected reporting timezone and the half-open interval:

`[from 00:00:00, day after to 00:00:00)`.

No browser-local timezone is trusted.

## Financial semantics

Only INR is aggregated. If the selected range contains another currency, the report is rejected rather than converted or mixed.

Successful refunds are counted from PaymentRefund rows with status SUCCEEDED. Refunds are grouped by Payment before joining to Orders for sales calculations, preventing duplicate refund rows from multiplying revenue.

Money calculations use PostgreSQL numeric/Prisma Decimal, never JavaScript floating-point arithmetic.

## Null and edge-case semantics

- Zero denominators produce N/A/null rather than division-by-zero.
- Negative net sales are preserved when successful refunds exceed gross sales.
- Unpaid Orders do not contribute to gross/net sales or paid-order AOV.
- Cancelled paid Orders remain part of historical gross sales; their successful refunds reduce net sales.
- Cancellation requests do not create a fabricated Order CANCELLED state.
- Missing tracking numbers are represented as unavailable, not inferred.
- Missing case/return/fulfillment records contribute zero to aggregate counts.
- Unsupported currencies cause a validation error.

## Deferred metrics

The current canonical schema does not provide authoritative definitions for discount amount, profit/margin, customer lifetime value, causal conversion attribution, or multi-currency conversion. These are intentionally not fabricated.
