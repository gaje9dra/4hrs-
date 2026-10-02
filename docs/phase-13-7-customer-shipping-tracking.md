# Phase 13.7 — Customer Shipping Tracking

## Architecture

Customer tracking is a server-only path:

Customer Browser → 4HRS+ Tracking API / Server Component → Shipping Application → Shipment Repository → canonical Shipment/TrackingEvent data.

The browser never calls Qikink or another provider. No provider credentials, authentication metadata, raw payloads, or provider-specific response formats are exposed.

The provider boundary from Phases 13.5–13.6 is unchanged. Qikink remains Fulfillment-only and does not become a customer-facing Shipping provider.

## Authorization

Customer tracking requires the existing `customer_session` authentication architecture.

The API resolves the authenticated customer on the server and passes that canonical customer ID to the Shipping application service. Repository access is scoped through the Order → Customer relationship.

A request cannot select an arbitrary customer ID. Knowing a Shipment reference is insufficient to retrieve another customer's Shipment.

A Shipment belonging to another customer is returned as the same safe not-found response as an unknown reference.

## Customer-safe identifier

The existing `Shipment.shipmentReference` is reused. It is generated as an `SHP-` prefixed UUID-derived reference and is not the Prisma Shipment primary key.

No new identifier or migration was necessary.

## Canonical customer DTO

The customer DTO contains only:

- shipment reference
- order reference
- canonical Shipment status
- customer-facing status label
- carrier, when available
- tracking number, when available
- validated HTTP(S) tracking URL, when available
- chronological customer-visible tracking events
- latest event
- created, shipped, updated, and delivered timestamps

The DTO does not contain:

- Shipment database ID
- Fulfillment ID
- provider ID
- provider reference
- reconciliation state
- recovery actions
- retry information
- provider credentials
- raw provider payloads
- internal errors
- internal operational notes

## Status mapping

Customer presentation uses the canonical Shipping state with a stable label:

| Canonical state | Customer label |
|---|---|
| CREATED | Shipment created |
| IN_TRANSIT | In transit |
| OUT_FOR_DELIVERY | Out for delivery |
| DELIVERED | Delivered |
| DELIVERY_FAILED | Delivery issue |
| RETURNED | Returned |

Internal reconciliation/recovery state is never exposed.

No `CANCELLED` state was invented because the current canonical Shipping state machine does not define one.

## Timeline

Tracking events come only from persisted canonical `TrackingEvent` records.

The repository orders events by `eventTimestamp ASC`. Phase 13.6 duplicate and out-of-order rules therefore remain authoritative.

The customer timeline:

- preserves chronological event timestamps;
- does not fabricate missing events;
- does not invent delivery dates;
- uses canonical normalized status labels;
- displays stored location only when available;
- uses a canonical status description when a stored event description is absent;
- does not expose provider processing metadata.

Events that reach the canonical repository but are not safely mapped to a customer vocabulary are not promoted to a new invented status.

## API

Canonical endpoint:

`GET /api/shipping/track/{shipmentReference}`

The endpoint:

1. authenticates the existing customer session;
2. applies a bounded authenticated request limit;
3. validates the shipment reference shape;
4. loads the Shipment through the Shipping application service;
5. enforces Order → Customer ownership in the repository;
6. returns only the customer DTO;
7. uses private, no-store caching headers.

Non-GET methods return 405.

The API has no provider calls.

## Error contract

Customer-safe errors include:

- `AUTHENTICATION_REQUIRED` — 401
- `TRACKING_NOT_FOUND` — 404
- `TRACKING_UNAVAILABLE` — 503
- `RATE_LIMITED` — 429
- `METHOD_NOT_ALLOWED` — 405

Unknown/internal Shipping or database failures are normalized and do not expose SQL, Prisma, provider response bodies, credentials, reconciliation details, or stack traces.

Unknown and cross-customer references use the same 404 tracking response.

## Tracking page

Canonical customer page:

`/track/{shipmentReference}`

The page is server-rendered through the existing application service and requires the existing customer session.

It provides:

1. shipment reference;
2. order reference;
3. current status;
4. carrier when authoritative;
5. tracking number when available;
6. validated HTTP(S) tracking link when available;
7. chronological tracking timeline.

The page does not display Qikink branding as the store identity.

## UI states

Implemented route-level states:

- loading;
- shipment/tracking not found;
- tracking temporarily unavailable;
- shipment created with no tracking events yet;
- tracking timeline available;
- delivered/returned/other canonical terminal presentation through the canonical status.

The current domain does not define a cancelled Shipment state, so the implementation does not invent one.

## Responsive and accessibility controls

The tracking page uses the existing storefront Container and Bauhaus visual conventions:

- geometric bordered cards;
- hard offset shadows;
- solid blocks;
- strong typography;
- no gradients or glassmorphism.

The layout uses responsive grid behavior for mobile, tablet, and desktop.

Accessibility includes:

- semantic headings;
- `dl` for shipment metadata;
- semantic `ol` timeline;
- `time` elements;
- `role="status"` for unavailable tracking;
- `role="alert"` for page errors;
- visible keyboard focus styles;
- screen-reader text for loading;
- status labels that do not depend on color.

## Freshness and caching

The tracking page and API are dynamic and explicitly non-revalidated.

Customer-specific API responses use:

`Cache-Control: private, no-store, max-age=0`

and the tracking response also sends `X-Robots-Tag: noindex, nofollow, noarchive`.

The page metadata sets:

- `robots: noindex`
- `nofollow`
- `noarchive`

No tracking route is added to a sitemap or public structured data.

The page does not implement browser polling. Refresh is server-driven and bounded by the normal request rate limit.

## Security and privacy

Verified controls:

- server-side authentication;
- server-side Shipment ownership enforcement;
- no client-supplied customer identity;
- customer-safe Shipment reference;
- no database primary key in the public DTO;
- no provider credentials in the client;
- no raw provider payloads;
- no internal reconciliation/retry state;
- private/no-store customer responses;
- noindex tracking page;
- HTTP(S)-only external tracking links;
- bounded authenticated request rate;
- safe indistinguishable 404 behavior for unknown/cross-customer references.

## Observability

Customer tracking records structured Shipping observations for:

- tracking request;
- successful tracking response;
- not-found tracking request;
- unauthorized authentication attempt.

Observability does not include customer PII, authorization headers, credentials, or raw provider payloads.

## Performance

The customer read uses one Shipment query with:

- ownership constrained through the Order relation;
- Shipment metadata;
- chronologically ordered TrackingEvent records.

No provider request is made.

No N+1 tracking-event queries are introduced.

The current implementation reads the persisted tracking timeline in full because the existing domain model and customer tracking experience do not require a separate unbounded pagination contract. If future event volume requires bounding, pagination must preserve chronological correctness and must be added at the application/repository boundary rather than the browser.

## Database and migration safety

No schema migration was required.

Existing `Shipment.shipmentReference`, `Shipment`, `TrackingEvent`, and `Order` records are reused.

No production data is reset, deleted, or backfilled.

## Tests

Added coverage verifies:

- authenticated customer can access its own Shipment;
- another customer cannot access that Shipment by reference;
- malformed/nonexistent references resolve safely;
- customer DTO exposes shipment/order references;
- internal Shipment ID is not exposed;
- provider reference is not exposed;
- reconciliation state is not exposed.

Existing Shipping tests continue to cover handoff idempotency, concurrency, tracking-event ordering, duplicate events, terminal states, and provider boundaries.

## Known limitations

1. Qikink remains Fulfillment-only; the customer tracking layer does not invent Qikink tracking APIs.
2. Tracking data is only as fresh as persisted canonical TrackingEvent data.
3. No browser polling or provider synchronization is introduced.
4. The current canonical Shipping model has no CANCELLED state, so no customer cancellation presentation was fabricated.
5. A future verified Shipping provider may add provider-derived tracking data through the existing adapter/application path without changing the customer API contract.

## Definition-of-done review

The implementation keeps Catalog, Cart, Checkout, Payment, Order, Fulfillment, and Shipping architecture intact.

Provider-specific logic remains behind the provider adapter boundary.

Phase 13.8, returns, exchanges, refunds, and additional providers are intentionally not implemented.
