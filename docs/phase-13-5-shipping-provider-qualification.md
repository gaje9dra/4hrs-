# Phase 13.5 — Shipping Provider Qualification

## 1. Current Shipping architecture

The repository implements a provider-neutral Shipping layer.

The canonical flow is:

4HRS+ Catalog → Cart → Checkout → Payment → Order → Fulfillment → Shipping → Shipment → Tracking → Customer

Provider-specific implementations are isolated behind the Shipping Provider interface and resolver.

The current Shipping contract contains normalized Shipment references, carrier, tracking number/URL, service, status, and normalized TrackingEvent data. Provider capabilities are declared separately from the domain contract.

## 2. Current blocker

Qikink remains the 4HRS+ Fulfillment Provider. The repository's Qikink Shipping adapter deliberately declares:

- createShipment: false
- trackingLookup: false
- webhooks: false

Qikink's official API documentation verifies order creation and includes a qikink_shipping option. Its public tracking material describes AWB/tracking, carrier, shipping mode, and status through the dashboard. That is not treated as a machine-to-machine Shipping API.

## 3. Required Shipping contract

Shipment creation:
- create shipment
- shipment/provider reference
- order reference
- shipment items and quantities
- destination address
- origin/warehouse
- package weight/dimensions where required
- declared value
- COD/prepaid information

Tracking:
- AWB/tracking reference
- carrier
- shipping mode/service
- tracking URL
- current status
- tracking events
- event timestamp
- location when available
- delivery confirmation
- exception/RTO status where required

Provider events:
- webhook or reliable polling
- event type
- event identity/deduplication strategy
- event timestamp
- authentication/signature mechanism
- retry behavior
- duplicate delivery behavior
- event ordering behavior

Operations:
- authentication
- idempotency
- timeout behavior
- retry behavior
- rate limits
- error schema
- reconciliation
- cancellation only if required by the existing domain

## 4. Qualification methodology

Only authoritative provider material was used to mark a capability VERIFIED.

Accepted evidence:
- official API documentation
- official developer documentation
- official webhook documentation
- official authentication documentation
- official sandbox/test documentation
- official provider support confirmation

Not accepted as proof of an API contract:
- blogs
- community posts
- screenshots
- dashboard UI
- marketing pages
- third-party API wrappers

## 5. Candidates investigated

Candidates investigated were Qikink, Shiprocket, NimbusPost, Shipmozo, and Pickrr.

Qikink is retained as Fulfillment-only. Shiprocket exposes the most complete publicly documented API surface found, but it still has unresolved contract details. NimbusPost, Shipmozo, and Pickrr have public API/product claims, but their publicly indexed authoritative technical documentation was insufficient to verify the complete Phase 13.4 gate.

No score, ranking, winner, or recommendation is assigned.

## 6. Official evidence

### Qikink

Qikink's official API documentation verifies authenticated order creation through its create-order API and includes qikink_shipping. Official tracking documentation says AWB/tracking IDs and provider/status/shipping-mode information are available through the Qikink dashboard.

Evidence:
- https://admins.qikink.com/api-docs/
- https://qikink.com/help/orders/how-to-track-an-order/
- https://qikink.com/shipping/

### Shiprocket

Shiprocket's official API documentation verifies:
- API user authentication and Bearer authorization
- order creation
- shipment/courier operations
- AWB assignment and courier name
- tracking by AWB
- tracking webhook delivery
- webhook POST/JSON contract
- optional x-api-key webhook security token
- tracking status, status IDs, AWB, courier name, current timestamp, and scan history in the documented webhook example
- HTTP 429 as the documented rate-limit response category
- HTTP 4xx/5xx response categories

Evidence:
- https://apidocs.shiprocket.in/
- https://support.shiprocket.in/support/solutions/articles/43000337456-shiprocket-api-document-helpsheet

### NimbusPost

Official NimbusPost material confirms API access and multi-courier capabilities. It does not provide enough publicly indexed authoritative technical detail to mark the full Phase 13.4 contract VERIFIED.

Evidence:
- https://nimbuspost.com/features/

### Shipmozo

Official Shipmozo material confirms shipment creation, AWB generation, courier selection, labels, and tracking as product capabilities. The full public machine-to-machine API contract required for Phase 13.4 was not established.

Evidence:
- https://www.shipmozo.com/
- https://www.shipmozo.com/shipmozo-faq

### Pickrr

Official Pickrr material confirms custom REST APIs and real-time tracking as product capabilities. The exact shipment, tracking-event, webhook, authentication, idempotency, and reconciliation contract was not publicly established from authoritative technical documentation.

Evidence:
- https://www.pickrr.com/faqs/
- https://www.pickrr.com/product/

## 7. Capability matrix

See docs/shipping-provider-qualification-matrix.md for the detailed factual matrix.

## 8. Authentication analysis

Qikink fulfillment API authentication uses a provider-issued auth token.

Shiprocket API users generate authentication credentials and receive a Bearer token for subsequent API calls.

For NimbusPost, Shipmozo, and Pickrr, a complete authoritative production credential contract was not established from the public technical sources reviewed.

No provider credentials are stored in this repository.

## 9. Sandbox analysis

A production Shipping adapter must not create real customer shipments merely to prove integration.

For the candidates reviewed, the public material available for this phase did not establish a complete authoritative sandbox/test-shipment contract sufficient for Phase 13.4.

The absence of public sandbox documentation is recorded as UNVERIFIED rather than assumed to mean no sandbox exists.

## 10. Webhook/polling analysis

Shiprocket publicly documents tracking webhooks and provides a webhook payload containing AWB, courier, current status, timestamps, and scan history.

However, the reviewed public documentation does not establish a stable provider event identifier suitable to use as the sole event identity. 4HRS+ therefore cannot safely claim a complete provider webhook deduplication contract from the public material alone.

Qikink dashboard tracking is not treated as a webhook or polling API.

NimbusPost, Shipmozo, and Pickrr remain unverified for the complete required webhook/polling contract.

## 11. Idempotency analysis

4HRS+ already maintains internal shipment creation idempotency.

The provider contract must additionally be understood well enough to recover from:

request sent → timeout → provider may have created shipment → response unknown

The reviewed public candidate documentation does not establish a complete provider-specific idempotency-key/duplicate-request contract. This remains a Phase 13.4 integration prerequisite.

## 12. Retry/rate-limit analysis

Shiprocket documents HTTP 429 for exceeded API call rate and documents 4xx/5xx response classes.

Provider-specific retry-after semantics and safe shipment-creation retry behavior are not established by the public material reviewed.

4HRS+ must not blindly retry shipment creation after an ambiguous timeout.

## 13. Failure semantics

The eventual adapter must normalize authentication failure, invalid request/address/package, rate limiting, provider server errors, connection failure, timeout, malformed response, duplicate request, unknown shipment, provider maintenance, and ambiguous results.

The current repository already has provider-neutral Shipping error boundaries. Phase 13.4 must map a real provider's documented errors into those boundaries without exposing raw provider errors to customers.

## 14. Reconciliation capability

The minimum safe recovery path is:

4HRS+ Shipment ↔ provider shipment reference ↔ AWB/tracking reference ↔ carrier ↔ provider status ↔ internal Shipment status

Shiprocket publicly documents multiple references and tracking by AWB, which provides a basis for reconciliation. However, the exact ambiguous-create recovery procedure and duplicate-create semantics still require provider confirmation before production shipment creation is enabled.

For Qikink, the current machine-to-machine reconciliation contract remains unavailable.

## 15. Data security / privacy

Provider credentials must remain server-only and must never be exposed through NEXT_PUBLIC_* variables, browser JavaScript, customer DTOs, API responses, logs, telemetry, error pages, Git, or documentation.

The eventual provider payload should contain only the customer/order fields actually required for shipping.

Sensitive fields include customer name, phone, email, address, PIN/postal code, and order/package information.

## 16. Observability requirements

The eventual adapter should record structured diagnostics for internal Shipment ID, provider, operation, provider reference, request correlation ID, duration, response category, retry count, and final outcome.

Never log credentials, authorization headers, full customer addresses, payment information, or unnecessary raw provider payloads.

## 17. Integration prerequisites

Before Phase 13.4 production implementation can begin, the selected provider must provide authoritative confirmation for:

1. shipment creation contract and response
2. provider shipment reference
3. AWB/tracking reference
4. carrier field
5. shipment status field/mapping
6. tracking-event retrieval or webhook contract
7. webhook authentication or documented polling
8. event identity/deduplication behavior
9. authentication lifecycle
10. safe retry semantics
11. rate-limit behavior
12. ambiguous-create reconciliation
13. test/sandbox procedure

## 18. Exact remaining blockers

For Shiprocket:
- provider idempotency/duplicate-request semantics: UNVERIFIED
- stable provider event identifier: UNVERIFIED
- authoritative sandbox/test-shipment procedure: UNVERIFIED
- exact ambiguous shipment-creation recovery procedure: UNVERIFIED

For NimbusPost, Shipmozo, and Pickrr:
- multiple critical machine-to-machine capabilities remain UNVERIFIED from authoritative public documentation.

For Qikink:
- machine-to-machine Shipping/tracking contract remains unavailable; dashboard tracking is not sufficient.

## 19. Phase 13.4 entry criteria

Phase 13.4 can begin only after one provider has a sufficiently verified machine-to-machine contract covering:

1. Shipment creation
2. Shipment/provider reference
3. AWB/tracking reference
4. Carrier
5. Shipment status
6. Tracking events or reliable status/event retrieval
7. Webhook or documented polling
8. Authentication
9. Error handling
10. Retry/rate-limit behavior
11. Idempotency/reconciliation strategy

The current qualification does not satisfy that gate.

## 20. Final decision

NOT READY FOR PHASE 13.4 — SHIPPING PROVIDER NOT DETERMINED

The phase is intentionally stopped here. No real Shipping adapter, live provider call, provider credential, tracking implementation, webhook implementation, polling implementation, or customer tracking UI is added.