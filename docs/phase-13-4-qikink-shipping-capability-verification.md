# Phase 13.4-B — Qikink Shipping Capability Verification & Provider Contract Discovery

## 1. Executive finding

**Decision: NOT READY FOR PHASE 13.4 — SHIPPING PROVIDER NOT DETERMINED**

The current authoritative Qikink material verifies an order-creation API that can request Qikink shipping, but it does not provide a documented machine-to-machine Shipping/Tracking contract sufficient to safely implement the provider-neutral Shipping adapter.

Qikink's official API documentation exposes:

- `POST https://qikink.com/erp2/index.php/api/createOrder`
- authentication via the documented `auth_token`
- `qikink_shipping` to request Qikink shipping
- an `order_id` in the successful order-creation response

The same documentation does **not** establish a tracking/status lookup endpoint, tracking-event API, webhook contract, carrier field contract, or machine-readable AWB/tracking response contract.

Qikink's official shipping/help material does document tracking IDs/AWB, carrier/partner, shipping mode, and shipping statuses, but the documented access path is the Qikink dashboard. Those capabilities are therefore **DASHBOARD-ONLY / NOT VERIFIED FOR MACHINE-TO-MACHINE INTEGRATION** for this phase.

No production Shipping behavior is enabled by this phase.

## 2. Current Qikink integration

4HRS+ currently treats Qikink as a Fulfillment provider.

The repository's Shipping adapter is deliberately capability-limited:

| Capability | Current value |
|---|---:|
| createShipment | false |
| trackingLookup | false |
| webhooks | false |

The Fulfillment integration may create a Qikink order and receive a Qikink `order_id)/provider fulfillment reference. That reference is not treated as a Shipment ID, AWB, tracking number, carrier, or tracking URL.

## 3. Official API capabilities

### VERIFIED

**Order creation**

Endpoint:

`POST https://qikink.com/erp2/index.php/api/createOrder`

The official API documentation states that it creates orders in Qikink, accepts JSON, supports `qikink_shipping`, and returns a successful response containing `code: 1`, `order_id`, and a success message.

The documentation also states that `qikink_shipping` controls whether Qikink performs shipping.

**This is an order/fulfillment capability, not a verified Shipping Tracking API.**

### VERIFIED — order-creation authentication only

The official order-creation documentation specifies an `auth_token` supplied by Qikink.

This evidence is sufficient only for the documented order-creation operation. It must not be reused as evidence for an undocumented tracking/status endpoint.

## 4. Dashboard capabilities

Qikink's official shipping documentation states that after a shipping label is generated, orders can be tracked from the Qikink dashboard. It documents statuses including:

- Pickup Scheduled
- Pickup Error
- Out for Pick Up
- Pickup Exception
- Pickup Rescheduled
- Order Picked Up
- In-transit
- Out for Delivery
- Undelivered attempts
- Delivered
- RTO Initiated
- RTO Delivered

The same official material says the dashboard exposes shipping partner, status, and shipping mode and that clicking the tracking ID provides live transit updates.

These are classified as:

**DASHBOARD-ONLY / NOT VERIFIED FOR MACHINE-TO-MACHINE INTEGRATION**

No dashboard scraping or private endpoint discovery is permitted.

## 5. Machine-to-machine capability matrix

| Capability | Verified? | Official source | Exact contract | Can Phase 13.4 use it? |
|---|---|---|---|---|
| Create shipment | NO | Official API documents order creation | No separate shipment-creation endpoint/contract verified | NO |
| Create shipping label | NO | Shipping docs describe label generation operationally | No API endpoint/response contract verified | NO |
| Obtain AWB/tracking ID | NO | Dashboard/help material | Dashboard tracking ID/AWB is documented, but no API response field/endpoint is verified | NO |
| Lookup shipment status | NO | Dashboard/help material | No documented status lookup API verified | NO |
| Retrieve tracking events | NO | Dashboard/help material | No documented event-history API verified | NO |
| Retrieve carrier | NO | Shipping page | Partner is shown in dashboard; no machine-readable API field verified | NO |
| Retrieve shipping mode | NO | Shipping page | Shipping mode is shown in dashboard; no API field verified | NO |
| Webhooks | NO | No authoritative webhook contract found | No registration, signature, headers, payload, or retry contract verified | NO |
| Webhook authentication | NO | No authoritative webhook contract found | Not documented | NO |
| Event ID | NO | No tracking-event API contract | No field verified | NO |
| Event timestamp | NO | No tracking-event API contract | No field verified | NO |
| Status mapping | NO for machine-readable source | Dashboard status terminology exists | Status values are documented for dashboard tracking, not as an API response contract | NO |
| Retry semantics | NO | No tracking API/webhook contract | Not documented | NO |
| Idempotency | NO for Shipping | Order creation is documented, but no Shipping idempotency contract is verified | No provider Shipping idempotency mechanism verified | NO |
| Rate limits | NO | No Shipping API contract | Not documented | NO |
| Error contract | PARTIAL | Order creation only | `code`, `order_id`, `msg` are documented for order creation | NO for Shipping |

Every capability required to implement the Shipping adapter is therefore either **DASHBOARD-ONLY** or **UNVERIFIED**.

## 6. Shipment creation contract

Qikink's documented order-creation API accepts shipping information and can request Qikink shipping through `qikink_shipping`.

A successful response provides:

- `code`
- `order_id`
- `msg`

The response does **not**, in the verified documentation, establish:

- `shipment_id`
- AWB
- tracking number
- carrier
- tracking URL
- tracking event ID
- tracking timestamp

Therefore:

**Qikink order creation ≠ verified Shipping shipment creation contract.**

4HRS+ must continue deriving its internal Shipment from its own Fulfillment handoff rather than pretending the Qikink order reference is an external Shipment identifier.

## 7. AWB / tracking contract

Qikink officially documents Tracking ID/AWB as a dashboard-visible tracking mechanism.

No authoritative machine-readable endpoint or response schema was verified for retrieving:

- AWB
- tracking ID
- tracking URL
- shipment status
- tracking events
- delivery status
- RTO status
- exception status

Classification:

**DASHBOARD-ONLY / NOT VERIFIED FOR MACHINE-TO-MACHINE INTEGRATION**

## 8. Carrier contract

Qikink documents multiple shipping partners and says partner information is visible in the dashboard.

No verified machine-readable field such as `carrier`, `courier`, `shipping_partner`, or `logistics_partner` was found in the authoritative Shipping/Tracking API material.

Therefore no hard-coded carrier mapping is added.

## 9. Status contract

Qikink officially documents dashboard shipping statuses. These cannot be treated as provider API values until a machine-readable source is verified.

Consequently no provider-to-internal status mapping is enabled.

The provider-neutral Shipping lifecycle remains authoritative:

- CREATED
- IN_TRANSIT
- OUT_FOR_DELIVERY
- DELIVERED
- DELIVERY_FAILED
- RETURNED

No Qikink dashboard status is automatically mapped into this lifecycle.

## 10. Webhook contract

No authoritative Qikink documentation/support material available for this verification established a webhook contract for shipment creation, status changes, tracking updates, delivery, RTO, or exceptions.

Missing:

- registration process
- HTTP method
- authentication
- signature mechanism
- headers
- payload schema
- event identifier
- event timestamp
- retry behavior
- duplicate delivery behavior
- timeout requirements

Classification:

**NOT VERIFIED**

No webhook endpoint is implemented.

## 11. Polling contract

No authoritative Qikink Shipping/Tracking polling endpoint was verified.

Missing:

- endpoint
- HTTP method
- authentication
- request parameters
- response schema
- pagination
- rate limits
- status values
- tracking events
- retry behavior
- recommended polling interval

Classification:

**NOT VERIFIED**

No polling engine is implemented.

## 12. Authentication contract

The verified Qikink order-creation documentation specifies an `auth_token`.

The repository also contains Qikink Fulfillment authentication code for the existing Fulfillment integration. That does not establish authentication for an undocumented Shipping/Tracking API.

Therefore:

- order-creation authentication: **VERIFIED**
- Shipping/Tracking authentication: **UNVERIFIED**
- Shipping credentials: **not added**
- client exposure: **not permitted**

Any future Shipping credentials must remain server-only and must never appear in `NEXT_PUBLIC_*`, client bundles, customer DTOs, logs, or raw provider errors.

## 13. Idempotency contract

No authoritative Qikink Shipping idempotency mechanism was verified.

Internal 4HRS+ idempotency remains valid and is independent of any provider guarantee.

The application may continue using its own Shipment creation idempotency key and TrackingEvent deduplication, but must not claim that Qikink itself guarantees idempotency for Shipping operations.

## 14. Retry and rate-limit contract

No authoritative Shipping/Tracking retry semantics or rate limits were verified.

The existing provider-neutral Shipping boundary therefore remains responsible for controlling future retries and provider failures without assuming undocumented provider behavior.

## 15. Reconciliation capability

The verified contract is insufficient to reconcile all of:

**Internal Shipment ↔ Qikink Order ↔ AWB/Tracking ↔ Carrier ↔ Status**

The Qikink order reference is available from order creation, but the remaining Shipping identifiers/status data are not available through a verified machine-to-machine contract.

Classification:

**RECONCILIATION BLOCKED**

No dashboard scraping or private endpoint use is permitted.

## 16. Security requirements

A future provider implementation must maintain:

- server-only credentials
- secrets-managed configuration
- redacted provider responses
- safe structured logging
- no customer access to provider APIs
- no provider credential exposure
- no raw provider payload exposure
- request timeouts
- explicit retry boundaries
- rate-limit handling once officially documented

No new Shipping credential was introduced in this phase.

## 17. Exact blockers

The following provider capabilities remain missing for Phase 13.4:

1. A documented machine-to-machine shipment creation contract, if Qikink expects 4HRS+ to create/confirm shipments separately from order creation.
2. A documented API response/endpoint for AWB or tracking ID.
3. A documented shipment-status lookup endpoint.
4. A documented tracking-event retrieval contract.
5. Machine-readable carrier and shipping-mode fields.
6. A documented webhook contract, or alternatively a documented polling contract.
7. Tracking event IDs and event timestamps.
8. Authoritative status semantics suitable for mapping to the 4HRS+ lifecycle.
9. Shipping-specific authentication details.
10. Shipping-specific retry and rate-limit semantics.
11. Provider Shipping idempotency semantics, if supported.
12. A complete machine-readable reconciliation path from Qikink order to tracking/carrier/status.

## 18. Evidence / source URLs

Authoritative Qikink API documentation:

- https://admins.qikink.com/api-docs/

Authoritative Qikink shipping documentation:

- https://qikink.com/shipping/

Authoritative Qikink Orders & Shipping help index:

- https://qikink.com/help/orders/

Authoritative Qikink shipment tracking-status documentation:

- https://qikink.com/help/orders/shipping-statuses/

## 19. Phase 13.4 implementation prerequisites

Phase 13.4 may proceed only after Qikink provides authoritative machine-to-machine documentation or direct official support confirmation covering the missing Shipping/Tracking contract.

At minimum, obtain:

- endpoint and HTTP method
- authentication
- request schema
- response schema
- AWB/tracking field
- carrier field
- tracking URL field
- status values
- event ID
- event timestamp
- webhook or polling contract
- retry behavior
- rate limits
- idempotency semantics
- reconciliation identifiers

Until then:

**Qikink = Fulfillment Provider**

**Shipping Provider = unresolved / not yet integrated**

The provider-neutral Shipping architecture must remain unchanged.
