# Phase 9.3 — Customer Authentication Service, Session Management & Security Foundation

## 1. Authentication service architecture

Authentication now has a dedicated server-side boundary under `lib/auth/`.

The intended flow is:

Browser/UI → Authentication API Boundary → Authentication Service → Customer Repository → PostgreSQL

The authentication service owns registration, login, password verification, session creation/rotation, session resolution, and logout. Routes do not perform ORM operations.

Customer identity remains separate from administrator authentication.

## 2. Registration workflow

Registration:

1. applies the authentication rate-limit abstraction;
2. validates and normalizes the email;
3. validates password requirements;
4. hashes the password using Node's built-in asynchronous scrypt KDF;
5. creates the Customer, CustomerCredential, and CustomerSession transactionally;
6. returns only the safe customer DTO plus an internal session token used immediately by the API boundary to set the HttpOnly cookie.

The password hash never enters a customer DTO.

Duplicate registration is normalized to the generic authentication failure contract at the authentication service boundary. No email verification message is sent because that infrastructure does not exist in this phase.

## 3. Login workflow

Login:

1. applies rate limiting;
2. normalizes the email;
3. retrieves the customer once by normalized email;
4. retrieves its credential;
5. verifies the password only inside the authentication service;
6. rejects non-ACTIVE account states;
7. creates a new opaque session;
8. revokes the prior session when a current session is supplied, providing session rotation;
9. returns only the safe customer DTO and internal session result.

Invalid credentials, missing credentials, and unavailable accounts use the same public authentication failure message so the API does not intentionally disclose account existence.

## 4. Session strategy

The Phase 9.1/9.2 architecture is retained:

- opaque random 256-bit session identifier;
- SHA-256 hash stored in CustomerSession;
- raw token held only by the cookie/application boundary;
- server-side session lookup;
- 30-day session lifetime;
- HttpOnly cookie;
- Secure cookie in production;
- SameSite=Lax;
- path=/.

The service never exposes the stored session hash.

## 5. Session lifecycle

Supported operations:

- creation during registration/login;
- server-side lookup;
- expiration enforcement;
- periodic last-used timestamp update;
- login session rotation;
- logout/revocation;
- invalid/expired session rejection.

Expired or revoked sessions cannot resolve an authenticated customer.

Repeated logout is intentionally idempotent: a missing or already-revoked token produces no secret-bearing response.

## 6. Current-customer resolution

`lib/auth/context.ts` is the canonical server-side customer context boundary.

It reads only the HttpOnly customer session cookie, resolves the session through the authentication service, and returns either:

- no authenticated customer; or
- the authenticated customer identity and session state.

No browser-supplied customer ID is used as an authentication claim.

## 7. Authorization boundary

`lib/auth/authorization.ts` provides minimum customer authorization primitives.

Authentication answers who the caller is. Authorization answers whether that authenticated identity may access a resource.

Customer-owned resources must compare the trusted server-side customer ID with the resource owner ID.

Customer authentication does not create administrator privileges.

## 8. Customer/admin separation

No admin authentication code, admin role, or admin session is reused.

Customer sessions resolve only to Customer records and customer DTOs. No administrative permissions are attached to CustomerSession.

## 9. Cart ownership integration

The Phase 8 Cart now has a server-side authenticated ownership boundary.

`lib/cart/auth-ownership.ts` verifies:

- a trusted authenticated customer ID exists;
- the requested Cart exists;
- Cart.customerId equals the authenticated customer ID.

The Cart application resolves the current authenticated customer from the session and initializes the customer's owned Cart when required.

Cart ownership is therefore not derived from a browser-provided customer ID.

The existing Cart business rules, pricing authority, availability validation, duplicate-item behavior, and transaction model remain intact.

Guest/anonymous Cart persistence was never enabled by the previous fail-closed ownership boundary; this phase does not invent a new anonymous Cart claim protocol.

## 10. Password security

Passwords use Node's asynchronous scrypt implementation.

Current parameters:

- N = 2^15;
- r = 8;
- p = 1;
- 16-byte random salt;
- 32-byte derived key;
- maximum password input: 1024 UTF-8 bytes;
- minimum password input: 12 UTF-8 bytes.

Stored representation is versioned and contains the scrypt parameters, salt, and derived key.

Verification uses constant-time comparison of derived keys.

Passwords are never logged, returned, or stored in plaintext.

The hashing implementation is isolated in `lib/auth/password.ts`, so future credential migration or a different approved password-hashing implementation remains a contained change.

## 11. Abuse/rate-limiting strategy

`lib/auth/rate-limit.ts` defines a reusable authentication rate-limiter interface rather than scattering counters across routes.

The current default implementation is a bounded process-local limiter:

- login: 8 attempts per 15 minutes per network/identity key;
- registration: 5 attempts per hour per network/identity key;
- bounded in-memory entries prevent unbounded process memory growth.

This is intentionally provider-neutral.

### Production deployment consideration

The current implementation is process-local and therefore is not a distributed rate-limit authority across multiple application instances. A horizontally scaled production deployment must inject a shared implementation behind the same interface before relying on the limits as a global abuse-control boundary.

No provider-specific Redis or external security dependency was introduced.

## 12. Error contract

Authentication errors are structured internally:

- INVALID_INPUT;
- INVALID_CREDENTIALS;
- ACCOUNT_DISABLED;
- ACCOUNT_UNAVAILABLE;
- SESSION_INVALID;
- SESSION_EXPIRED;
- CSRF_REJECTED;
- RATE_LIMITED;
- AUTH_DATABASE_ERROR.

The public API normalizes credential/account-state failures to INVALID_CREDENTIALS.

Database details, SQL errors, password-hash errors, stack traces, and secrets are not returned.

## 13. DTO boundaries

Authentication API responses contain only:

- authenticated boolean;
- safe CustomerDto.

CustomerDto contains:

- id;
- email;
- status;
- emailVerifiedAt;
- createdAt;
- updatedAt.

It does not contain:

- passwordHash;
- credentials;
- session token;
- session token hash;
- admin privileges;
- internal audit/security data.

## 14. API/application boundary

Server endpoints were added only for authentication infrastructure:

- POST `/api/auth/register`;
- POST `/api/auth/login`;
- GET `/api/auth/session`;
- POST `/api/auth/logout`.

No authentication UI was created.

Mutating authentication endpoints perform same-origin Origin validation when an Origin header is present and use the HttpOnly/SameSite cookie configuration.

Authentication responses are private/no-store.

## 15. Session fixation and CSRF

Login can rotate an existing authenticated session rather than continuing to use the previous session identifier.

Registration creates a fresh session.

Logout revokes the server-side session before clearing the cookie.

Cookie-based mutations use SameSite=Lax and same-origin validation.

No session identifier is exposed to client JavaScript through the cookie.

## 16. Observability

`lib/auth/observability.ts` records only coarse authentication event classifications.

Events include:

- registration success/failure;
- login success/failure;
- logout;
- authorization denial.

The logger deliberately excludes passwords, password hashes, session tokens, cookies, customer IDs, email addresses, and request bodies.

## 17. Performance considerations

- Customer lookup is by the unique normalized email index.
- Credential lookup is by the unique CustomerCredential.customerId index.
- Session lookup is by the unique sessionTokenHash index.
- Session last-used timestamps are updated only after a five-minute interval.
- Registration and login session writes are transactionally bounded.
- Password hashing remains deliberately computationally expensive; security is not weakened for throughput.

## 18. Security findings and mitigations

### Authentication bypass
Session identity is derived from the server-side HttpOnly cookie and database session record.

### Authorization bypass / IDOR
Cart ownership compares the authenticated customer ID with Cart.customerId. Client-controlled customer IDs are not accepted.

### Privilege escalation
CustomerSession has no administrator capability and does not participate in admin authorization.

### Session fixation
Login creates a new token and revokes the prior session when a current session is supplied.

### Session reuse
Revoked and expired sessions fail server-side resolution.

### Cookie misconfiguration
HttpOnly, SameSite=Lax, production Secure, root path, and explicit expiry are applied.

### CSRF
Mutating authentication routes enforce same-origin validation when Origin is supplied and use SameSite cookie protection.

### Credential leakage
Credential hashes and session hashes remain inside server-side persistence/service boundaries.

### Enumeration
Credential and unavailable-account failures use a generic public authentication failure contract.

### Sensitive logging
Authentication diagnostics exclude credential and session secrets and unnecessary customer PII.

### Client-controlled identity
Current customer resolution never trusts a browser-supplied customer ID.

## 19. Tests performed

Added service-level coverage for:

- password hashing;
- password verification;
- wrong-password rejection;
- registration;
- duplicate registration;
- email normalization;
- inactive-account rejection;
- session creation;
- session lookup;
- logout/revocation;
- login session rotation;
- rate limiting.

Added authorization/Cart coverage for:

- cross-customer Cart rejection;
- matching-customer Cart authorization;
- anonymous authorization rejection.

Existing DTO and architecture tests continue to enforce credential isolation and customer/admin separation.

### Runtime limitation

The available repository connector does not execute the project's PostgreSQL-backed test, lint, typecheck, or build commands. Therefore those commands were not truthfully marked as passed here.

The repository currently reports no configured GitHub combined status checks.

## 20. Remaining Phase 9.4 work

Phase 9.4 can consume these stable authentication boundaries to build the customer-facing authentication/account experience.

The following were deliberately not implemented:

- login UI;
- registration UI;
- forgot-password UI/flow;
- reset-password UI/flow;
- email verification UI/flow;
- account UI;
- Wishlist;
- Checkout;
- Payments;
- Orders;
- Shipping/Fulfillment;
- Inventory Reservation;
- Reviews;
- external authentication provider integration.

## Final readiness

The server-side authentication foundation is implemented, but two readiness conditions remain environment/deployment dependent:

1. PostgreSQL-backed migration/tests and the project's lint/typecheck/build commands have not been executed through the available repository connector.
2. The default abuse-control implementation is process-local; a horizontally scaled production deployment must inject a shared rate-limit implementation before treating it as a global production control.

For those reasons this phase is not marked production-ready for Phase 9.4.
