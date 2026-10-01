# Phase 12.4 — Order API Contract & Storefront Integration Foundation

## 1. Application architecture

The customer Order boundary is:

`Browser -> Order Route/API -> Order Application Service -> Order Domain/validation -> Order Repository -> Database`.

The browser never receives Prisma models or repository instances. Order creation continues to use the Phase 12.3 server-authoritative Payment -> Checkout -> Order conversion.

## 2. API/application boundaries

### Create

`POST /api/order`

Request body:
```json
{ "paymentId": "<internal payment UUID>" }
```

No customer ID, Checkout totals, price, currency, status, Order Number, address, or other commercial authority is accepted.

The route applies same-origin protection and delegates to `createOrderFromVerifiedPayment`. The response contains only the stable customer-safe creation result: Order ID, Order Number, status, total, currency, and creation timestamp.

### List

`GET /api/order?page=1&pageSize=20`

The customer is derived from the authenticated session. Query parameters are restricted to `page` and `pageSize`. Page size is bounded to 50. Results are newest-first with deterministic `createdAt DESC, id DESC` ordering.

### Detail

`GET /api/order/:orderId`

The identifier may be the internal UUID or the generated Order Number. Both are always resolved with the authenticated customer as part of the database predicate.

## 3. Authentication

All Order operations require an authenticated Customer session. Customer identity is never accepted as authoritative request data.

Missing or invalid sessions map to HTTP 401. State-changing Order creation also reuses the existing same-origin/CSRF protection convention.

## 4. Ownership and IDOR protection

Order detail lookup uses customer-scoped repository queries:
- UUID + authenticated customer ID;
- Order Number + authenticated customer ID.

A different customer's Order is returned as `ORDER_NOT_FOUND`, preventing the API from confirming that the object exists.

Order listing has no customer filter supplied by the caller. The authenticated customer ID is the only scope.

Payment-based Order creation remains scoped through the Phase 12.3 authenticated Payment lookup.

## 5. Order creation contract

The canonical application operation remains:

`createOrderFromVerifiedPayment({ paymentId, request })`

The route passes only the minimum payment identifier. Phase 12.3 then resolves the authenticated customer, authoritative Checkout, verified successful Payment, catalog/cart state, totals, currency, and address server-side.

Payment success is not inferred from a browser redirect or client flag.

## 6. Public DTO

Customer Order responses use a dedicated DTO rather than serializing Prisma models.

The DTO exposes:
- Order ID;
- Order Number;
- status;
- created timestamp;
- currency;
- subtotal;
- total;
- address snapshot;
- OrderItem historical snapshots;
- quantity;
- unit price;
- line total;
- selected options.

The current schema does not contain discount, tax, or shipping charge fields, so those values are not fabricated or exposed.

The DTO deliberately excludes:
- customer ID;
- Payment ID;
- Checkout reference;
- database audit/update internals;
- webhook/provider payloads;
- secrets;
- authentication data;
- reconciliation metadata;
- live catalog data.

Historical display data comes from OrderItem and OrderAddressSnapshot, never from the current Product/Variant/CustomerAddress records.

## 7. Error contract

Application errors are represented by stable `OrderDomainError` codes. API responses never expose Prisma, SQL, provider, stack-trace, or file-path details.

Important mappings include:
- unauthenticated -> 401;
- invalid request -> 400;
- Order not found / ownership failure -> 404;
- stale/invalid Checkout or unverified Payment -> 409;
- database/internal failure -> 503;
- safe concurrency/idempotency conflicts -> 409.

## 8. Idempotency

No second incompatible HTTP idempotency mechanism was introduced.

Phase 12.3 Payment-to-Order idempotency remains based on unique Payment/Checkout relationships and safe replay of an already-created authorized Order. Repeating `POST /api/order` with the same verified Payment returns the existing logical Order result.

## 9. Cache and privacy

All Order API responses are:
- `private`;
- `no-store`;
- `max-age=0`;
- `Vary: Cookie, Authorization`;
- `X-Content-Type-Options: nosniff`.

Order data is not public catalog data, is not statically generated, and is not intended for CDN/public cache reuse.

The account page already declares private/no-index behavior; Phase 12.4 does not create a public Order page or expose Order data to catalog caching.

## 10. Performance/query strategy

Customer detail queries load only the Order relations required for the public DTO: OrderItems and the immutable address snapshot. Current catalog/Product/Variant records are not joined for historical display.

Customer lists are bounded to 50 items per page and ordered deterministically. The repository performs a customer-scoped count and bounded page query rather than loading the complete Order history.

The existing Phase 12.2 customer/createdAt and Order status/createdAt indexes support the access patterns.

## 11. Security controls

Covered controls:
- authenticated session resolution;
- customer ownership predicates;
- IDOR-safe not-found behavior;
- strict request allowlists;
- identifier validation;
- same-origin protection for creation;
- bounded request body;
- bounded pagination;
- private/no-store caching;
- safe public DTO;
- no provider/payment secret exposure;
- no browser-supplied commercial authority.

No direct ORM access is exposed to the browser.

## 12. Testing

Phase 12.4 adds tests for:
- own Order retrieval by ID;
- own Order retrieval by Order Number;
- cross-customer IDOR by ID;
- cross-customer IDOR by Order Number;
- unauthenticated retrieval/listing;
- customer-scoped listing;
- bounded pagination;
- malformed identifiers;
- public DTO snapshot exposure;
- exclusion of internal Payment/Checkout/customer fields.

Phase 12.3 tests continue to cover verified Payment conversion, stale Checkout rejection, amount/currency validation, duplicate conversion, concurrent conversion, and historical snapshot integrity.

## 13. Phase 12.5 UI requirements

Phase 12.5 may consume:
- `GET /api/order` for authenticated Order history;
- `GET /api/order/:orderId` for authenticated Order detail;
- `POST /api/order` for post-payment Order conversion where the storefront workflow requires it.

Phase 12.5 should render only the public DTO and must not access Prisma or internal Order objects.

No final customer Order UI is implemented in Phase 12.4.

## 14. Explicitly deferred

Not implemented:
- complete customer Order-history UI;
- complete Order detail UI;
- admin Order management;
- fulfillment;
- shipping;
- inventory reservation;
- returns;
- refunds;
- cancellation;
- provider integrations;
- Checkout redesign;
- Cart redesign;
- additional payment providers;
- unrelated refactors.

## 15. CI and regression gate

Phase 12.4 must pass:
`npm test`
`npm run lint`
`npm run typecheck`
`npm run build`

The database migration/schema state and existing catalog, search, product, cart, authentication, account, address, checkout, payment, webhook, reconciliation, and Order creation tests remain part of the regression gate.
