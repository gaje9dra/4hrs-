# Phase 10.2 — Customer Address Data Model & Persistence Foundation

## Status

Implemented on branch `phase-10-2-customer-address`.

This phase establishes the production customer-address persistence/application boundary required by Phase 10.1. It does not implement the Checkout UI, payment processing, orders, shipping, fulfillment, inventory reservation, or Wishlist.

## Architecture

`Authenticated Customer → Address Service → Address Repository → Prisma/PostgreSQL`

The authenticated customer ID is obtained server-side from the existing session context. Address repository operations require that customer ID together with the address ID where applicable.

React/client code does not access Prisma directly, and public catalog/search/SEO surfaces do not consume address DTOs.

## Final persistence model

The existing Phase 10.1 `CustomerAddress` model is retained:

- `id`: UUID primary key.
- `customerId`: required UUID foreign key to `Customer`.
- `recipientName`: required, max 120.
- `phone`: optional, max 32.
- `addressLine1`: required, max 200.
- `addressLine2`: optional, max 200.
- `city`: required, max 100.
- `stateOrProvince`: required, max 100.
- `postalCode`: required, max 32.
- `countryCode`: required two-character country code.
- `label`: required, max 40.
- `isDefault`: boolean.
- `createdAt` / `updatedAt`: project-standard timestamps.

No payment data, provider-specific shipping IDs, landmark field, or unnecessary additional PII was introduced.

The existing migration is `prisma/migrations/20260930203100_customer_address_persistence_foundation/migration.sql`. It already provides customer foreign-key integrity, customer-scoped indexes, and a PostgreSQL partial unique index enforcing at most one default address per customer.

## Repository contract

Implemented in `lib/customer/address-repository.ts`:

- count customer addresses;
- list customer-owned addresses;
- find one customer-owned address;
- create;
- update;
- delete;
- clear the customer's default;
- set a customer-owned address as default;
- select the deterministic replacement candidate;
- mark a replacement default.

The repository uses explicit field selection rather than leaking raw ORM records to the application layer.

Address lists are ordered deterministically:

1. default addresses first;
2. newest creation time first;
3. UUID descending as a stable tie-breaker.

Customer ownership is part of every address read/mutation query.

## Service/application boundary

Implemented in `lib/customer/address-service.ts`.

The service owns:

- customer identity boundary checks;
- server-side validation;
- normalization;
- first-address default behavior;
- transactional default switching;
- deterministic default promotion after deletion;
- repository interaction;
- persistence error mapping;
- DTO conversion.

Default changes use the existing repository transaction pattern with Serializable isolation.

## Default-address invariant

Rules implemented:

- a customer can have zero or one default;
- the first address becomes default;
- creating an address with `isDefault=true` replaces the customer's existing default;
- different customers can each have a default;
- setting another customer's address as default resolves as not found because the operation is customer-scoped;
- deleting a non-default address leaves the default unchanged;
- deleting a default promotes the newest remaining address by `createdAt DESC, id DESC`;
- deleting the final address leaves zero addresses and therefore zero defaults;
- the database partial unique index remains the final integrity backstop.

The replacement policy is deterministic and transactionally applied.

## Validation and normalization

Implemented in `lib/customer/validation.ts`.

Before persistence:

- required values are checked;
- maximum lengths match the database model;
- surrounding whitespace is trimmed;
- repeated spaces/tabs are collapsed for address text;
- optional empty values become `null`;
- control characters are rejected;
- country codes are normalized to uppercase and require exactly two ASCII letters;
- postal codes must contain at least one alphanumeric character;
- optional phone values use a broadly compatible international representation;
- `isDefault` must be boolean when supplied.

No country-specific postal-code restriction is imposed because the current architecture does not define a single supported geography.

## Safe DTO

`CustomerAddressDto` exposes only address information needed by Account/Checkout consumers.

It does not expose:

- `customerId`;
- ORM metadata;
- database internals;
- credentials;
- session identifiers;
- provider metadata.

The DTO is stable independently of the Prisma representation.

## API boundary

Implemented:

- `GET /api/customer/addresses` — list authenticated customer's addresses.
- `POST /api/customer/addresses` — create an address.
- `GET /api/customer/addresses/:addressId` — retrieve one owned address.
- `PATCH /api/customer/addresses/:addressId` — replace editable address fields.
- `DELETE /api/customer/addresses/:addressId` — delete an owned address.
- `POST /api/customer/addresses/:addressId` — set the owned address as default; request body must be empty.

All routes are dynamic/private and use the existing `authJson` no-store response boundary.

Mutating routes require the existing same-origin check and authenticated session. Client-supplied `customerId` is not accepted as an authorization input.

## Security and privacy

Address access is customer-scoped at both service and repository boundaries, preventing IDOR and cross-customer mutation.

The API:

- requires authentication;
- does not accept ownership reassignment;
- rejects unsupported mutation fields;
- does not expose addresses through catalog/search/public SEO surfaces;
- uses private/no-store responses;
- avoids logging address contents in the new boundary;
- returns safe persistence errors rather than database details.

## Referential integrity

The existing foreign key is non-null and points to `Customer`. Customer deletion follows the Phase 10.1 lifecycle decision and cascades address deletion. No unrelated customer/account lifecycle behavior was changed.

## Tests

Added `tests/customer-address-data-model.test.ts` covering:

- normalization;
- required-field validation;
- field-length/security validation;
- optional empty values;
- ownership-scoped reads;
- first-address default behavior;
- independent customer defaults;
- default switching;
- deterministic default promotion after deletion;
- safe DTO shape.

Existing authentication, account, Cart, catalog, storefront, and Phase 10.1 architecture tests were not weakened.

## Validation

Repository inspection confirms the migration and Prisma schema are already aligned with the Phase 10.1 address foundation.

The connected GitHub environment can inspect and modify the repository, but it cannot execute the project's PostgreSQL-backed `npm test`, Prisma migration deployment, lint, typecheck, or production build in the user's local environment. Those runtime gates therefore require execution in the project's configured environment/CI before this phase can be declared ready.

## Deferred work

Not implemented in Phase 10.2:

- complete Account address-management UI;
- Checkout UI;
- Checkout session lifecycle;
- payment processing or providers;
- order creation;
- shipping providers;
- fulfillment;
- inventory reservation;
- Wishlist.

Those remain outside this phase's implementation boundary.
