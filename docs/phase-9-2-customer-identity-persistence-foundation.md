# Phase 9.2 — Customer Identity Data Model & Authentication Persistence Foundation

## Status
Implemented the customer identity persistence foundation defined by Phase 9.1. No complete authentication flow or customer account UI was introduced.

## 1. Customer identity model

Customer is the canonical customer identity:
- UUID primary key;
- normalized, unique email identity;
- controlled CustomerAccountStatus;
- nullable emailVerifiedAt for future verification state;
- created/updated timestamps.

No unnecessary profile fields were added. Email normalization is centralized in lib/customer/validation.ts and currently uses trim + lowercase semantics. Database uniqueness is enforced on the normalized stored value.

## 2. Authentication credential model

CustomerCredential is separate from Customer and has a one-to-one customer relationship.

Only passwordHash is persisted. No plaintext password field, password DTO, or credential-bearing customer DTO exists.

The persistence service accepts an already-generated password hash. Password hashing/verification is intentionally a separate adaptive-hashing responsibility for the later authentication implementation phase; this phase does not introduce a hashing provider or login flow.

Credential deletion cascades from the customer because credentials have no independent business ownership.

## 3. Session persistence model

Phase 9.1 selected an opaque, server-side session architecture.

CustomerSession persists:
- internal UUID;
- customer ownership;
- one-way sessionTokenHash;
- creation time;
- expiration time;
- optional revocation time;
- optional last-used timestamp.

The raw session identifier is not stored by the persistence layer. Session lookup is by the stored hash.

Indexes support customer/session-state lookup and expiration cleanup.

The service never returns sessionTokenHash to callers. Session resolution also rejects missing, revoked, expired, or non-active-customer sessions.

No cookie issuance, login flow, rotation UI, or logout route is implemented here.

## 4. Customer/admin separation

No administrator identity model was reused or introduced. Customer identity, customer credentials, and customer sessions are isolated under lib/customer/. Administrator authorization remains a separate concern. There is no shared customer/admin role field.

## 5. Cart ownership relationship

The existing Cart model now has an optional, unique customerId relation.

This preserves existing anonymous Cart rows because the new column is nullable. Existing Cart items and Cart behavior are otherwise unchanged.

A customer can own at most one current Cart through the unique customer ownership constraint.

Cart.customerId uses ON DELETE RESTRICT, preventing customer deletion while a customer-owned Cart remains attached. This deliberately avoids destructive deletion of commerce data.

Cart business behavior, merge logic, and claiming logic remain outside this phase. The existing Cart service remains responsible for Cart authorization and currently fails closed until trusted identity is supplied.

## 6. Account status model

CustomerAccountStatus contains only the states required by the Phase 9.1 architecture:
- ACTIVE
- DISABLED
- SUSPENDED
- PENDING_VERIFICATION

The identity service exposes controlled status persistence. Session resolution permits only ACTIVE customers to resolve an active session. No additional business rules were invented.

## 7. Database relationships

Customer 1 — 0..1 CustomerCredential
Customer 1 — N CustomerSession
Customer 1 — 0..1 Cart

Deletion behavior is deliberate:
- Customer → credential: CASCADE;
- Customer → sessions: CASCADE;
- Cart → customer: RESTRICT.

Existing Cart → CartItem and Cart → catalog relationships are untouched.

## 8. Indexes and access patterns

Implemented indexes are limited to actual persistence access patterns:
- Customer.email unique lookup;
- Customer.status;
- CustomerCredential.customerId unique;
- CustomerSession.sessionTokenHash unique lookup;
- CustomerSession(customerId, revokedAt, expiresAt) for active-session/customer queries;
- CustomerSession.expiresAt for cleanup;
- Cart.customerId unique ownership lookup.

No speculative profile/search indexes were added.

## 9. Migration details

Migration: prisma/migrations/20260930190000_customer_identity_persistence_foundation/migration.sql

The migration creates the customer status enum, Customer, CustomerCredential, CustomerSession, nullable Cart.customerId, and the customer-to-Cart foreign key. Existing Cart rows remain anonymous with customerId NULL.

No existing records are deleted or rewritten. Production review should apply it only after normal database backup/change-control procedures.

## 10. Repository boundaries

lib/customer/repository.ts contains persistence operations only: customer lookup/creation/status, credential hash persistence, session persistence, customer Cart lookup, and transactional repository execution.

ORM objects remain behind the repository/service boundary.

## 11. Service boundaries

lib/customer/service.ts provides the persistence-facing customer identity service. It owns email normalization before persistence, duplicate identity handling, controlled status persistence, credential-hash input validation, session validity checks, safe service error mapping, and explicit customer DTO mapping.

It does not implement login, registration UI/API, password verification, password reset, email verification, OAuth/social login, or account dashboard workflows.

## 12. Security considerations

- Password plaintext is not modeled or persisted.
- Password hashes are isolated from customer DTOs.
- Session persistence stores only a one-way token hash.
- Raw session identifiers are not returned by the service.
- Customer email uniqueness is database-enforced.
- Customer ownership is server-side data, not a client-supplied authorization claim.
- Customer sessions are rejected after expiry/revocation or when the customer is not active.
- Customer-to-Cart deletion is restrictive to avoid destructive commerce-data deletion.
- Prisma parameterization remains the persistence mechanism; no raw SQL interpolation was introduced.
- Authentication secrets are not logged by the new repository/service layer.

## 13. Privacy considerations

The public/customer DTO contains only customer ID, email, account status, email verification timestamp, and created/updated timestamps. It excludes password hashes, credentials, session hashes, session identifiers, authorization internals, and database records.

No new customer-facing route or public API was added.

## 14. Testing performed

Added tests/customer-identity-persistence-foundation.test.ts covering customer DTO sanitization, deterministic email normalization, migration structure/referential behavior, and customer service boundary existence.

Updated tests/customer-authentication-architecture.test.ts to verify the new nullable Cart ownership relationship while preserving the no-auth-flow constraint.

A database-backed integration test was not executed through the available repository connector. Therefore PostgreSQL migration application, full test execution, lint, typecheck, and build remain unverified in this environment.

## 15. Remaining authentication implementation work

Phase 9.3 must still implement the actual authentication workflow, including the approved registration/login/session transport behavior, secure password hashing/verification boundary, cookie/session issuance and rotation, authentication API contracts, abuse controls, CSRF protections appropriate to the final transport, and customer-facing authentication UI as specified by that phase.

Password reset, email verification, social login/OAuth, account UI, and downstream commerce functionality remain intentionally outside Phase 9.2.

## Scope verification

This phase did not add login/register UI, authentication routes, password reset, email verification flow, social login/OAuth, Wishlist, Checkout, Payments, Orders, Shipping/Fulfillment, inventory reservation, Reviews, or provider-specific authentication SDKs.

The locked technology stack was not intentionally changed.