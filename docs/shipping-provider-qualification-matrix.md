# Shipping Provider Qualification Matrix

## Scope

This matrix records the Phase 13.5 technical qualification of candidate Shipping Providers for 4HRS+. It is factual only: no provider is scored, ranked, or selected by preference.

The canonical architecture remains:

4HRS+ Catalog → Cart → Checkout → Payment → Order → Fulfillment → Shipping → Shipment → Tracking → Customer

Qikink remains a Fulfillment Provider and is not promoted to a canonical Shipping dependency.

## Status vocabulary

- **VERIFIED** — supported by authoritative provider technical/API documentation.
- **UNVERIFIED** — public authoritative evidence located, but the exact machine-to-machine contract required by 4HRS+ is incomplete or unavailable.
- **NOT SUPPORTED** — authoritative material indicates the capability is unavailable.
- **NOT REQUIRED** — not required by the current 4HRS+ Shipping contract.

## Qualification matrix

| Capability | Qikink | Shiprocket | NimbusPost | Shipmozo | Pickrr |
|---|---|---|---|---|---|
| Shipment creation | VERIFIED as fulfillment order creation; not a separate Shipping contract | VERIFIED | UNVERIFIED | UNVERIFIED | UNVERIFIED |
| Shipment/provider reference | VERIFIED for Qikink order ID | VERIFIED | UNVERIFIED | UNVERIFIED | UNVERIFIED |
| AWB/tracking reference | DASHBOARD-ONLY for Qikink Shipping | VERIFIED | UNVERIFIED | UNVERIFIED | UNVERIFIED |
| Carrier identification | DASHBOARD-ONLY | VERIFIED | UNVERIFIED | UNVERIFIED | UNVERIFIED |
| Shipping mode/service | DASHBOARD-ONLY | UNVERIFIED in the public contract reviewed | UNVERIFIED | UNVERIFIED | UNVERIFIED |
| Shipment status | DASHBOARD-ONLY | VERIFIED | UNVERIFIED | UNVERIFIED | UNVERIFIED |
| Tracking events | DASHBOARD-ONLY | VERIFIED | UNVERIFIED | UNVERIFIED | UNVERIFIED |
| Event timestamp | DASHBOARD-ONLY | VERIFIED in webhook/tracking payload examples | UNVERIFIED | UNVERIFIED | UNVERIFIED |
| Event identifier | UNVERIFIED | UNVERIFIED | UNVERIFIED | UNVERIFIED | UNVERIFIED |
| Webhooks | UNVERIFIED for Qikink Shipping | VERIFIED | UNVERIFIED | UNVERIFIED | UNVERIFIED |
| Webhook authentication | UNVERIFIED | VERIFIED: optional x-api-key security token | UNVERIFIED | UNVERIFIED | UNVERIFIED |
| Polling/tracking lookup | UNVERIFIED machine-to-machine for Qikink | VERIFIED: tracking API by AWB is documented | VERIFIED in non-official/third-party package material only; therefore not authoritative for this phase | UNVERIFIED | UNVERIFIED |
| Authentication | VERIFIED for Qikink fulfillment API | VERIFIED: API user credentials + Bearer token | UNVERIFIED against current official technical documentation | UNVERIFIED | UNVERIFIED |
| Idempotency-key support | UNVERIFIED | UNVERIFIED in public API documentation reviewed | UNVERIFIED | UNVERIFIED | UNVERIFIED |
| Retry semantics | UNVERIFIED | UNVERIFIED as provider-specific retry contract | UNVERIFIED | UNVERIFIED | UNVERIFIED |
| Rate-limit behavior | UNVERIFIED | VERIFIED at HTTP contract level: 429 Too Many Requests | UNVERIFIED | UNVERIFIED | UNVERIFIED |
| Error contract | VERIFIED at documented fulfillment API response level | VERIFIED: documented HTTP/error response categories | UNVERIFIED | UNVERIFIED | UNVERIFIED |
| Reconciliation path | DASHBOARD-ONLY for Qikink Shipping | Partially evidenced through Shiprocket order/shipment/AWB/tracking references; exact ambiguous-create procedure is UNVERIFIED | UNVERIFIED | UNVERIFIED | UNVERIFIED |
| Sandbox/test environment | UNVERIFIED | UNVERIFIED in public documentation reviewed | UNVERIFIED | UNVERIFIED | UNVERIFIED |
| Production API | VERIFIED | VERIFIED | UNVERIFIED | UNVERIFIED | UNVERIFIED |
| India-specific shipping | VERIFIED | VERIFIED at API/domain level | UNVERIFIED | UNVERIFIED | UNVERIFIED |

## Candidate findings

### Qikink

Qikink's official API documentation verifies authenticated order creation and exposes a qikink_shipping option. Its official help/shipping material describes AWB/tracking IDs, carriers, shipping modes, and statuses through the Qikink dashboard. The current 4HRS+ repository therefore keeps Qikink as Fulfillment-only and does not treat dashboard tracking as a machine-to-machine Shipping API.

Sources:
- https://admins.qikink.com/api-docs/
- https://qikink.com/help/orders/how-to-track-an-order/
- https://qikink.com/shipping/

### Shiprocket

Shiprocket's official API documentation verifies REST API authentication, order creation, courier/AWB assignment, tracking, and tracking webhooks. The public documentation also documents HTTP error categories including 429 rate limiting and exposes carrier/status/tracking event fields in the webhook example.

The public material reviewed does not establish all Phase 13.4 production prerequisites. In particular, the reviewed documentation does not provide a provider idempotency-key contract, a stable provider event-ID contract for webhook deduplication, or a clearly documented sandbox/test environment for safe shipment creation.

Sources:
- https://apidocs.shiprocket.in/
- https://support.shiprocket.in/support/solutions/articles/43000337456-shiprocket-api-document-helpsheet

### NimbusPost

Official NimbusPost material confirms API access and multi-courier shipping capabilities. The publicly indexed technical contract reviewed for this phase was not sufficient to independently verify all required shipment, webhook, authentication, idempotency, error, and reconciliation details from authoritative NimbusPost technical documentation.

A third-party package references NimbusPost API endpoints, but that evidence is deliberately not treated as authoritative for this qualification.

Sources:
- https://nimbuspost.com/features/
- https://www.aftership.com/carriers/nimbuspost/api (non-authoritative; not used to mark critical capabilities VERIFIED)

### Shipmozo

Official Shipmozo material confirms shipment creation, AWB generation, labels, courier selection, and dashboard tracking at a product level. A complete authoritative public machine-to-machine API contract covering the Phase 13.4 gate was not located during this qualification.

Sources:
- https://www.shipmozo.com/
- https://www.shipmozo.com/shipmozo-faq

### Pickrr

Official Pickrr material states that custom REST APIs are available, and its product material describes real-time tracking. However, the public official material reviewed does not expose enough of the machine-to-machine shipment/tracking/webhook contract to verify all Phase 13.4 requirements.

Third-party API material exists, but it is not treated as authoritative for this phase.

Sources:
- https://www.pickrr.com/faqs/
- https://www.pickrr.com/product/
- https://www.pickrr.com/

## Qualification conclusion

No candidate currently has every Phase 13.4 entry-gate capability verified from authoritative public technical material.

Shiprocket has the broadest publicly documented API surface among the candidates investigated, but this phase does not convert that observation into a ranking or recommendation. The remaining provider-contract gaps are recorded explicitly instead of being inferred.

Therefore the Phase 13.4 gate remains blocked until a provider supplies authoritative confirmation for the remaining critical production contract details.