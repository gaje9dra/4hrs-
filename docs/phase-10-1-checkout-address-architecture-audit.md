# Phase 10.1 — Checkout & Address Architecture Audit

## Status

Phase 10.1 architecture audit completed against the current repository implementation.

This phase establishes the Checkout and customer-address boundaries required for Phase 10.2+. It does not implement the complete checkout flow, payment processing, order creation, shipping-provider integration, fulfillment, inventory reservation, Wishlist, or provider-specific commerce logic.

## 1. Checkout architecture

The intended production boundary is:

`Customer → Cart → Checkout → Address → Pricing/Validation → Payment → Order → Inventory/Reservation → Fulfillment → Shipping`

Phase 10.1 establishes only the Checkout and Address portions.

The boundaries are:

- **Customer**: authenticated identity and customer-owned resources.
- **Cart**: canonical Product/ProductVariant references, quantities, current catalog-derived price and availability.
- **Checkout**: orchestration boundary that prepares a validated purchase attempt; it must not become the owner of payment, order, inventory, fulfillment, or shipping logic.
- **Address**: customer-owned persisted delivery/contact destination.
- **Pricing**: server-side catalog/commercial authority.
- **Payment**: future provider-neutral service and adapter boundary.
- **Order**: future durable commercial record created only after the approved payment result.
- **Inventory**: future final availability/reservation authority.
- **Fulfillment**: future operational execution boundary.
- **Shipping**: future rate/label/tracking provider boundary.

No storefront component accesses Prisma directly.

## 2. Cart → Checkout handoff

The future Checkout initialization contract must derive its authoritative input from the authenticated customer's current Cart.

Required server-derived handoff data:

- Cart ID;
- authenticated customer identity;
- CartItem IDs;
- Product IDs;
- ProductVariant IDs where present;
- quantities;
- current authoritative unit prices;
- currency;
- availability state;
- item validity;
- authoritative subtotal/totals.

The browser must never be authoritative for:

- prices;
- product titles;
- SKUs;
- discounts;
- inventory quantities;
- subtotal/final totals;
- currency;
- customer ownership.

The existing Cart already resolves product/variant state and price through the server-side catalog boundary. Checkout must call that authority again rather than treating Cart presentation data as a permanent price snapshot.

Stale Cart behavior:

- unavailable product → checkout initialization fails with a safe validation state;
- unavailable variant → checkout initialization fails with a safe validation state;
- insufficient availability → checkout initialization fails with the current availability state;
- changed price → checkout displays/re-resolves the current server-authoritative price;
- empty Cart → checkout initialization is rejected;
- invalid quantity → checkout initialization is rejected.

Checkout must not silently remove stale lines or trust a browser-reconstructed total.

## 3. Checkout state model

A dedicated checkout state is architecturally required once checkout becomes a multi-step transactional workflow because the selected address, validated Cart reference, pricing state, status, and expiration must remain bound to one server-side attempt.

The minimum future state is:

- opaque checkout-session ID;
- customer ID;
- Cart ID;
- selected CustomerAddress ID;
- validated Cart/reference version or validation timestamp;
- pricing/currency state sufficient to detect revalidation;
- checkout status;
- created/updated timestamps;
- expiration timestamp;
- idempotency/replay protection reference where needed.

The state must not contain:

- raw card numbers;
- CVVs;
- bank credentials;
- payment passwords;
- provider secrets;
- raw payment credentials.

Phase 10.1 does not create the checkout-session model or checkout lifecycle because payment/order transitions are intentionally deferred. Phase 10.2 must define the minimum persistent state together with its lifecycle before payment integration.

## 4. Customer authentication requirement

Checkout is authenticated-customer-only under the current architecture.

There is no approved guest Cart identity or guest-to-customer Cart claim/merge protocol. Therefore Phase 10.1 does not invent guest checkout.

The future boundary is:

`HttpOnly session → Customer → customer-owned Cart/Address → Checkout`

Authentication must be enforced server-side. Client route guards may improve UX but cannot provide authorization.

The existing Phase 9 session model remains authoritative:

- opaque random session identifier;
- server-side session record;
- HttpOnly cookie;
- Secure in production;
- SameSite=Lax;
- server-derived Customer identity;
- revoked/expired sessions rejected.

Account creation during checkout is not introduced. Registration remains a separate authenticated flow.

## 5. Address data model

A canonical `CustomerAddress` persistence model was added because checkout needs a durable, customer-owned address reference.

Current fields:

- `id`: UUID primary key;
- `customerId`: UUID owner;
- `recipientName`: required, max 120;
- `phone`: optional, max 32;
- `addressLine1`: required, max 200;
- `addressLine2`: optional, max 200;
- `city`: required, max 100;
- `stateOrProvince`: required, max 100;
- `postalCode`: required, max 32;
- `countryCode`: required two-character country code;
- `label`: required, max 40;
- `isDefault`: boolean;
- `createdAt`;
- `updatedAt`.

A separate landmark field was not added because it is not established as a required business field.

Phone remains optional at this architectural stage rather than collecting unnecessary PII before shipping/contact requirements are established.

Migration:

`prisma/migrations/20260930203100_customer_address_persistence_foundation/migration.sql`

The migration adds only the address persistence foundation. It does not change Cart records or commerce behavior.

## 6. Address ownership

Every address belongs to exactly one Customer through a non-null foreign key.

Database ownership is:

`Customer 1 → N CustomerAddress`

The foreign key uses customer-owned persistence semantics and cascades with customer deletion.

Application authorization must always derive the Customer ID from `requireCurrentCustomer()`.

The future address API must:

- ignore client-supplied customer IDs for authorization;
- query by authenticated customer plus address ID;
- reject an address ID owned by another customer;
- never permit `customerId` reassignment;
- never return another customer's address in list/get operations.

This prevents IDOR and broken-access-control paths.

## 7. Address validation

The future address service must validate before persistence:

- required fields;
- maximum field sizes;
- trimming/whitespace normalization;
- control-character rejection;
- recipient name;
- address lines;
- city;
- state/province;
- postal code;
- country code;
- optional phone;
- label.

Country/state validation must remain compatible with the intended international-address policy. The architecture does not assume a third-party validation API.

Country code is stored as a bounded two-character field; application validation should normalize it to uppercase and validate it against the supported country policy before persistence.

Postal-code validation must be country-aware where the shipping policy requires it, without applying an India-only pattern to all international addresses.

Phone validation should use a broadly compatible international representation if phone becomes a required shipping/contact field.

## 8. Default-address rules

The database now enforces:

- at most one default address per customer.

The enforcement is a PostgreSQL partial unique index:

`CustomerAddress_one_default_per_customer`

with the predicate `isDefault = true`.

Future address service rules:

1. The first address should become the default deterministically if no address exists.
2. Explicitly setting an address as default must replace the previous default inside one transaction.
3. Creating a non-default address must not unset an existing default.
4. Updating a default address must preserve the single-default invariant.
5. Deleting a non-default address is straightforward.
6. Deleting the default while other addresses exist must deterministically promote another address in the same transaction, or require a replacement default by explicit product policy; Phase 10.2 must choose one policy before exposing deletion.
7. Deleting the final address is permitted and leaves the customer with no default.
8. Concurrent default changes must be transactional and must handle the database uniqueness conflict safely.

No contradictory two-default database state is acceptable.

## 9. Checkout pricing authority

The existing catalog/Cart architecture remains the pricing authority.

Future Checkout must obtain:

- current unit price from the canonical catalog resolution;
- variant price where applicable;
- product/base price where no variant price applies;
- currency from the server;
- subtotal from server-resolved Decimal values.

Compare-at/reference prices are presentation information, not payment authority.

Discounts, taxes and shipping charges are not currently implemented as authoritative engines. Phase 10.2 must introduce explicit provider-neutral service boundaries for them if the business requires them.

The browser cannot submit a trusted final payable total.

## 10. Inventory validation boundary

Cart availability is not a final inventory reservation.

The future sequence is:

`Checkout validation → Inventory availability verification → Payment → Order/Reservation`

The Inventory model already exposes variant-level on-hand/reserved state, but Phase 10.1 does not introduce reservation behavior.

Before payment/order progression, Checkout must revalidate the current requested quantities against the authoritative inventory boundary.

Out-of-stock or insufficient-stock lines must stop checkout progression with a safe, deterministic error.

## 11. Payment boundary

Payment remains provider-neutral:

`Checkout → Payment Service → Payment Provider Adapter → Provider`

Possible providers are implementation choices for a later phase. No provider-specific code is introduced here.

Checkout UI must never call a provider SDK directly.

Payment credentials and secrets remain server-side.

No payment intent, transaction, capture, refund, webhook, provider customer, or provider-specific identifier is introduced in Phase 10.1.

## 12. Order boundary

The future relationship is:

`Validated Checkout → Payment Result → Order Creation`

Checkout must pass only server-derived information to the future Order service:

- customer identity;
- validated Cart lines;
- authoritative quantities;
- authoritative prices/currency;
- selected address reference/snapshot according to the future order schema;
- validated totals;
- payment result/reference;
- relevant immutable commercial context.

The Order implementation is deliberately absent from Phase 10.1.

Customer-controlled address/price/title fields must not be treated as trusted Order authority.

## 13. Shipping boundary

Shipping remains separate from Checkout.

Future integration:

`Checkout → Shipping Service → Shipping Provider Adapter`

The boundary will eventually handle shipping-rate calculation, address/serviceability checks, labels, tracking and fulfillment handoff.

No Shiprocket, Delhivery, DTDC, Blue Dart or other provider integration is present.

No shipping labels or tracking data are introduced.

## 14. Security findings

### IDOR / broken access control
Mitigation: address ownership is a database relation, and future access must always combine authenticated customer identity with address ID.

### Customer-ID spoofing
Mitigation: customer identity comes from the server session; client `customerId` fields are not authorization claims.

### Cart ownership spoofing
Mitigation: existing Cart authorization compares Cart.customerId with the authenticated customer ID.

### Mass assignment
Mitigation: future address mutation APIs must allowlist address fields and explicitly reject `id`, `customerId`, ownership fields and server-controlled timestamps.

### Price manipulation
Mitigation: Checkout re-resolves prices from canonical catalog/Cart authority.

### Quantity manipulation
Mitigation: Cart and Checkout validate bounded positive integers and revalidate availability.

### Total manipulation
Mitigation: totals are recomputed server-side.

### Currency manipulation
Mitigation: currency is server-derived.

### Stale Cart manipulation
Mitigation: Checkout revalidates product lifecycle, variant lifecycle, price and availability.

### CSRF
Mitigation: authenticated mutations use the existing cookie/session model and same-origin protections; future address/checkout mutations must preserve the same boundary.

### Unsafe redirects
Mitigation: existing authentication redirect validation permits only safe internal destinations.

### Cache leakage
Mitigation: private customer surfaces remain dynamic/no-store and non-indexable.

### Request replay
Mitigation: future checkout/payment progression must introduce explicit idempotency/replay protection before payment/order creation.

### Excessive request complexity
Mitigation: retain bounded JSON payloads, strict field allowlists, bounded quantities and bounded string lengths.

### Sensitive logging
Mitigation: address/checkout observability must log coarse event classifications and safe identifiers only; complete addresses and authentication/payment secrets must not be logged.

## 15. Privacy requirements

Customer addresses are sensitive private data.

They must never be:

- included in public catalog APIs;
- placed in public page metadata;
- exposed to search engines;
- put into public caches;
- encoded into URLs;
- stored unnecessarily in localStorage/sessionStorage;
- emitted in structured data for public pages.

Address APIs must use private/no-store responses.

Server logs should not contain full address objects. Diagnostics should use safe event names, operation outcomes, coarse error codes and non-sensitive correlation information.

Checkout/account pages must remain `force-dynamic`, `revalidate = 0`, and `noindex, nofollow, noarchive`.

## 16. Performance considerations

Future checkout should avoid redundant private-data queries.

Recommended access pattern:

1. Resolve authenticated customer/session once for the request.
2. Resolve the customer-owned Cart.
3. Resolve customer-owned selected address in the same authorization boundary.
4. Reuse server-resolved Cart lines for checkout validation where safe.
5. Batch catalog/availability reads through existing repository/service boundaries.
6. Avoid N+1 address access.
7. Keep checkout payloads minimal.
8. Do not prematurely cache customer checkout/address data.

Current address indexes:

- `CustomerAddress(customerId, createdAt)`;
- `CustomerAddress(customerId, updatedAt)`;
- partial unique index for the default address.

The existing Cart/customer ownership indexes remain unchanged.

## 17. Observability requirements

Future checkout/address diagnostics may record:

- checkout initialization success/failure;
- Cart validation failure;
- address create/update/delete outcome;
- address authorization denial;
- invalid checkout state;
- checkout expiration;
- inventory validation failure;
- checkout replay/idempotency rejection.

Never log:

- passwords;
- session tokens;
- password hashes;
- payment credentials;
- raw card information;
- CVV;
- provider secrets;
- complete unnecessary address PII.

Observability remains provider-neutral and must not become a second persistence model.

## 18. Testing strategy

Static architecture coverage added in:

`tests/phase-10-1-checkout-address-architecture.test.ts`

Coverage includes:

- CustomerAddress ownership relation;
- address field bounds;
- default-address uniqueness migration;
- authenticated Customer identity boundaries;
- Cart server-authoritative pricing/availability;
- private/non-indexable account and Cart surfaces;
- deferred checkout/payment/order surfaces.

Required future address tests for Phase 10.2:

- create;
- read;
- update;
- delete;
- default address;
- duplicate-default prevention;
- invalid fields;
- malformed postal code;
- invalid ownership;
- customer-ID spoofing;
- concurrent default updates.

Required future checkout tests:

- valid initialization;
- empty Cart;
- stale Cart;
- unavailable variant;
- invalid quantity;
- changed price;
- changed product lifecycle;
- changed availability;
- invalid address;
- expired checkout state;
- repeated initialization;
- safe failure behavior;
- request replay/idempotency.

Security regression tests must cover IDOR, mass assignment, price/quantity/total/currency manipulation, cache leakage and sensitive logging.

Full payment/order tests remain outside this phase.

## 19. Remaining blockers

### Runtime validation
The available GitHub repository integration cannot execute the local PostgreSQL-backed test suite, Prisma migration application, lint, TypeScript typecheck, Next.js production build, or browser smoke tests. Therefore none of these are represented as passed.

### Address service/API
The canonical address persistence model is established, but CRUD service/API/UI implementation is intentionally deferred to Phase 10.2 rather than prematurely expanding this audit into the complete address-management experience.

### Checkout state lifecycle
A persistent checkout-session lifecycle is architecturally required for the multi-step payment/order workflow, but its implementation is deferred until Phase 10.2 because payment and order transitions are outside this phase.

### Authentication rate limiting
The inherited default authentication limiter is process-local. A horizontally scaled production deployment requires a shared implementation before treating it as a global abuse-control boundary.

## 20. Exact scope of Phase 10.2

Phase 10.2 should implement only the next approved Checkout/Address foundation:

- CustomerAddress repository boundary;
- address validation/service boundary;
- authenticated address CRUD API;
- default-address transactional behavior;
- customer-owned address UI;
- Checkout initialization boundary;
- Cart → Checkout revalidation;
- authenticated address selection;
- checkout state lifecycle and expiration;
- server-authoritative pricing/availability validation;
- safe checkout errors;
- checkout accessibility/responsive behavior;
- checkout private/no-store/SEO boundaries;
- tests for address ownership and checkout initialization.

It must still exclude payment processing, payment-provider adapters, order creation, fulfillment, shipping-provider integrations and inventory reservation unless a later phase explicitly authorizes them.

## Implementation changes in Phase 10.1

- Added `CustomerAddress` Prisma model.
- Added customer → addresses relation.
- Added migration `20260930203100_customer_address_persistence_foundation`.
- Added a partial unique database index enforcing at most one default address per customer.
- Added static architecture/security regression tests.
- Corrected an existing Cart API contract test that still expected the obsolete pre-authentication `CART_OWNERSHIP_UNAVAILABLE` response; the current authenticated architecture correctly returns `CART_UNAUTHORIZED` for anonymous access.
- No Cart business logic was changed.
- No authentication behavior was changed.
- No checkout/payment/order/shipping/fulfillment/inventory-reservation behavior was implemented.

## Verification result

Repository-side inspection confirms the Checkout → Address boundaries, authenticated ownership model, Cart authority, privacy constraints, provider-neutral downstream boundaries, and address persistence invariant.

However, PostgreSQL migration execution, full tests, lint, typecheck, production build and browser validation remain unexecuted through the available repository integration.

Therefore this phase is not marked production-ready for implementation of Phase 10.2.
