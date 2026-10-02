# Phase 13.1 — Shipping Architecture Audit

## Decision
NOT READY FOR PHASE 13.2.

Phase 13.1 defines the Shipping boundary and contracts only. It does not implement shipment persistence, tracking UI, shipping webhooks, returns, or Phase 13.2.

## Canonical flow
4HRS+ Catalog → ProductVariant → Store SKU → Provider Mapping → Qikink SKU → Customer → Cart → Checkout → Payment → Order → Fulfillment → Qikink → Shipping → Tracking → Customer.

Qikink remains a fulfillment provider. Shipping is a separate domain boundary.

## Repository audit
The current Prisma schema contains Order, OrderItem, OrderAddressSnapshot, Fulfillment, FulfillmentItem, and FulfillmentProviderMapping. Order currently has one Fulfillment. There are no Shipment, TrackingEvent, ShippingProviderReference, or ShippingWebhookEvent models.

The existing Fulfillment application consumes the historical Order address snapshot and provider mapping. Shipping must consume that canonical data and must never substitute a mutable CustomerAddress.

## Boundary
Fulfillment owns eligibility, mapping, provider SKU resolution, creation, submission, lifecycle, reconciliation, and provider interaction.

Shipping owns shipment identity, carrier/reference, tracking reference, normalized shipment lifecycle, tracking events, and shipping-provider communication.

The Shipping contract requires canonical Order and Fulfillment identity at the handoff so a Shipment cannot be attached to a different Order or Fulfillment.

## Provider-neutral contract
ShipmentReference carries internal shipment identity, Order/Fulfillment IDs, provider ID, shipment reference, carrier, tracking number/URL when verified, service, normalized status, provider reference, and timestamps.

TrackingEvent separates provider status from normalized status and supports provider event IDs for deduplication.

CustomerShipmentDto contains only customer-safe normalized data.

No Qikink credentials, Qikink SKU, provider cost, raw provider response, webhook payload, internal mapping IDs, or secret metadata belongs in the public DTO.

## Shipment lifecycle
The minimum normalized states are CREATED, IN_TRANSIT, OUT_FOR_DELIVERY, DELIVERED, DELIVERY_FAILED, and RETURNED.

DELIVERED and RETURNED are terminal. Duplicate events are ignored; stale/out-of-order events cannot move a terminal shipment backwards.

## Qikink capability audit
Qikink publicly documents tracking IDs/AWB numbers and says shipment details include provider, status, and shipping mode in its dashboard. Its documented shipment statuses include pickup stages, In-transit, Out for Delivery, delivery exceptions, Delivered, RTO, and returned states.

Qikink's API documentation verified for this project documents order creation and a returned Qikink order ID, but it does not provide a verified authenticated tracking/status endpoint or shipping webhook contract.

Therefore the existing Qikink adapter must not invent a tracking API. Its status lookup remains unsupported until Qikink provides a verified machine-to-machine contract.

## Address and price authority
Address authority remains CustomerAddress → Checkout → OrderAddressSnapshot → Fulfillment → Shipment.

Shipping cannot change historical Order address data.

No shipping-price calculation is introduced. Shipping operational state and the customer-charged amount remain separate authorities.

## Security
Future Shipping APIs must enforce authenticated Order ownership, Shipment ownership, no IDOR, server-only provider communication, input validation, webhook signature/replay protection when supported, deduplication, rate limiting, safe errors, and secret-free logs.

Customer tracking must use normalized internal data rather than browser-to-provider requests.

## Future database readiness
Phase 13.1 does not add a Shipping migration. Phase 13.2 should introduce only models justified by the verified provider contract, likely Shipment and TrackingEvent, plus webhook/reference entities only if the provider actually supports them.

## Future application contracts
The future boundary may expose Create Shipment, Get Shipment, List Shipments for Order, Get Tracking, Process Shipping Webhook, and Reconcile Shipment. Provider operations remain behind a server-side resolver/adapter.

## Tests
Added provider-neutral architecture tests for lifecycle transitions, terminal-state protection, stale/duplicate tracking events, Order/Fulfillment ownership, and separation of provider status from normalized Shipment status.

## Blocking issue
Subsystem: Qikink Shipping/Tracking integration.

Exact problem: the repository can create Qikink fulfillment orders, but there is no verified machine-to-machine Qikink tracking/status API or webhook contract in the documented integration.

Production impact: implementing guessed tracking endpoints could create false tracking data, incorrect shipment state, or unsafe reconciliation.

Required resolution: verify the official Qikink API/webhook contract for authentication, endpoint/schema, event identity, AWB/carrier fields, status mapping, replay behavior, and failure semantics.

## Scope verification
No complete Shipping system, tracking UI, returns/exchanges/refunds, second fulfillment provider, Qikink catalog import, Checkout/Payment/Order/Fulfillment redesign, fake tracking, or stack change is introduced.

STOP AFTER PHASE 13.1.