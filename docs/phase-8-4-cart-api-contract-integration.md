# Phase 8.4 — Cart Application/API Contract & Storefront Integration Foundation

## Status

**NOT READY FOR PHASE 8.5**

Phase 8.4 establishes the Cart application boundary and App Router route contracts without building the Cart page or storefront Cart UI. The current repository still has no customer authentication/session mechanism, so the default request-context resolver fails closed instead of accepting a client-supplied Cart ID or owner ID.

## Architecture

The canonical flow is:

Client / future storefront
→ App Router Cart API
→ Cart application boundary
→ Cart domain service
→ catalog services
→ Cart repository
→ PostgreSQL

Route handlers are intentionally thin. They parse the request through the application boundary, invoke exactly one application operation, and map errors to safe HTTP responses. ORM records never cross the HTTP boundary.

The application boundary lives in `lib/cart/api.ts`. It owns request validation, DTO mapping, request-context resolution, and orchestration of one Cart service operation. Business rules remain in `lib/cart/service.ts`; persistence remains in `lib/cart/repository.ts`.

## Route contract

| Method | Route | Operation |
|---|---|---|
| GET | `/api/cart` | Fetch the current authenticated/session Cart |
| POST | `/api/cart` | Add a canonical Product/ProductVariant selection |
| DELETE | `/api/cart` | Clear the current Cart |
| PATCH | `/api/cart/items/:cartItemId` | Update one CartItem quantity |
| DELETE | `/api/cart/items/:cartItemId` | Remove one CartItem |

No duplicate Cart routes, Checkout routes, Wishlist routes, payment routes, order routes, or shipping routes are introduced.

## Request DTOs

### Add item

```json
{
  "productId": "canonical-product-uuid",
  "variantId": "canonical-variant-uuid-or-null",
  "quantity": 1
}
```

The API rejects price, subtotal, total, inventory, title, description, provider identifiers, and fulfillment fields. Identifiers must be UUID-shaped and quantity must be an integer from 1 through 100.

### Update item

```json
{
  "quantity": 2
}
```

No Cart ID, owner ID, price, subtotal, inventory, or product data is accepted from the client.

### Remove / clear

No request body is accepted or required.

## Response DTO

The public response is independent from the Prisma model:

```text
CartDto
- id
- items[]
  - id
  - product { id, title, slug, media }
  - variant { id, displayName, size, color } | null
  - quantity
  - unitPrice
  - currency
  - subtotal
  - availability
- subtotal
- currency
- hasUnavailableItems
- warnings[]
```

Only catalog-backed display data and current server-authoritative monetary values are exposed. Provider IDs, provider SKUs, ownership identifiers, ORM internals, payment data, authentication secrets, audit fields, and fulfillment data are not exposed.

The Cart service resolves current catalog information on reads. Presentation data is not persisted into Cart rows. A changed price is therefore represented by the current authoritative price; no historical client-supplied price is accepted or echoed. A stale product/variant remains in persistence and is returned with a deterministic availability state and warning rather than being silently deleted.

## Error contract

Errors use:

```json
{
  "error": {
    "code": "INVALID_CART_INPUT",
    "message": "..."
  }
}
```

Internal causes, stack traces, SQL, Prisma details, file paths, provider credentials, and infrastructure details are never serialized.

| Domain code | HTTP |
|---|---:|
| INVALID_CART_INPUT | 400 |
| INVALID_QUANTITY | 400 |
| CART_NOT_FOUND | 404 |
| CART_ITEM_NOT_FOUND | 404 |
| PRODUCT_NOT_FOUND | 404 |
| VARIANT_NOT_FOUND | 404 |
| CART_UNAUTHORIZED | 403 |
| INVALID_VARIANT | 422 |
| PRODUCT_UNAVAILABLE | 409 |
| INSUFFICIENT_AVAILABILITY | 409 |
| INVALID_CART_STATE | 409 |
| CART_ITEM_CONFLICT | 409 |
| CART_OWNERSHIP_UNAVAILABLE | 503 |
| CART_DATABASE_ERROR | 503 |
| unexpected failure | 500 |

## Ownership and authorization

The API never trusts a Cart ID, owner ID, or session identity supplied by the request body. The request-context resolver is a server-side boundary designed to be replaced by the future supported authentication/session mechanism.

Until that mechanism exists, the default resolver returns `CART_OWNERSHIP_UNAVAILABLE`. This preserves Phase 8.1/8.3 fail-closed ownership behavior and prevents IDOR or cross-Cart access.

Authentication itself is deliberately not implemented in Phase 8.4.

## Product Detail → Cart handoff

The Phase 7 purchase selection contract remains canonical:

- `productId`
- `variantId`
- `quantity`

The Product Detail layer can hand this selection to `POST /api/cart`. The API ignores all presentation or provider data and delegates business validation to the Cart service, which re-resolves the current catalog, price, and availability.

No payment or checkout behavior is triggered.

## Validation and security

Application validation rejects malformed JSON, empty bodies, oversized bodies above 64 KiB, unexpected fields, malformed UUID identifiers, non-integer quantities, and quantities outside 1–100.

Security-sensitive behavior is fail-closed:

- no client-supplied ownership
- no client-supplied Cart ID for current-Cart operations
- no direct ORM exposure
- no provider identifiers in mutation input
- no authoritative client price/total/inventory fields
- cross-Cart access remains guarded by the domain service
- public API responses use `private, no-store`
- `Vary: Cookie, Authorization` prevents shared-cache assumptions
- route handlers are dynamic and revalidation is disabled

The 64 KiB body limit is an application-layer abuse guard. Existing project infrastructure does not provide a dedicated Cart rate limiter, so mutation rate limiting is deferred.

## Transaction boundaries and retry behavior

Mutation transactions remain inside the Cart repository/service boundary. Route handlers do not orchestrate database writes, duplicate detection, quantity changes, or catalog operations.

Phase 8.3's Serializable transaction and bounded conflict retry behavior is preserved. The API layer adds no distributed idempotency system. Repeated add requests therefore retain the domain service's logical-item accumulation semantics; an explicit idempotency-key facility is deferred until the architecture requires it.

## Observability

The existing Cart observation mechanism records operation, classification, duration, and safe domain error code. Request bodies, authentication secrets, payment data, provider credentials, and sensitive customer data are not logged.

## Performance

The application boundary deliberately performs one authoritative Cart mutation followed by a current Cart read so every mutation response has the same stable DTO shape as GET. This can perform additional catalog resolution, but it avoids duplicated response shaping and keeps price/availability authority in the domain service. No speculative caching is introduced.

The current Cart read resolves lines concurrently through the Phase 8.3 service. There is no public API-side N+1 loop or repeated ORM access.

## Testing

Added `tests/cart-api-contract.test.ts` covering:

- public DTO shape and ORM-field exclusion
- deterministic stale-item warnings
- strict add-item input
- rejection of client price/total/provider fields
- malformed identifiers
- bounded quantity validation
- malformed/empty/oversized JSON
- fail-closed ownership behavior

Phase 8.3 domain tests remain the authority for canonical business behavior, including duplicate accumulation, availability, price resolution, cross-Cart authorization, stale catalog state, update, remove, and clear behavior.

## Regression validation

The GitHub integration environment does not provide the repository's local PostgreSQL runtime, so database-backed `npm test`, full integration execution, and a local production build cannot be truthfully reported as passed from this environment. Source-level inspection was performed against the current Cart service, repository, catalog query boundary, storefront purchase-selection contract, and App Router structure.

The required local validation sequence is:

1. `npm run lint`
2. `npm run typecheck`
3. `npm test`
4. `npm run build`

Before declaring Phase 8.5 ready, run those commands against the migrated Phase 8.2 database and verify homepage, shop, category, collection, search, PDP, Cart persistence, and Cart service regressions.

## Known limitations

1. Customer authentication/session ownership is not implemented, by explicit Phase 8.4 scope.
2. Consequently the production route handlers fail closed with `CART_OWNERSHIP_UNAVAILABLE` until the supported identity mechanism is supplied.
3. Distributed idempotency keys are deferred; repeated requests use Phase 8.3 transactional conflict handling.
4. Dedicated rate limiting is deferred.
5. Runtime PostgreSQL, lint, typecheck, tests, and build were not executable through the GitHub integration environment.

## Phase 8.5 prerequisites

- A supported customer/session identity mechanism that can resolve the current Cart server-side.
- Local/CI execution of lint, typecheck, unit/integration/database tests, and build.
- Verification that the final Cart UI consumes only `CartDto`, mutation contracts, and structured errors.
- No ORM, pricing, availability, or ownership logic may be moved into the UI.

## Final readiness decision

**NOT READY FOR PHASE 8.5**
