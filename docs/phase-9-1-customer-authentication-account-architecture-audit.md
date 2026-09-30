# Phase 9.1 — Customer Authentication & Account Architecture Audit

## Status

Architecture and security audit completed against the current `main` branch.

This phase does not implement login, registration, session UI, account dashboard, password reset, email verification, social login, Wishlist, Checkout, Payments, Orders, Shipping, Fulfillment, Inventory Reservation, Reviews, or provider authentication integrations.

## 1. Existing authentication state

### Customer authentication

No customer authentication implementation currently exists.

Repository inspection found:

- no authentication library in `package.json`;
- no Customer/User model in `prisma/schema.prisma`;
- no password credential model;
- no session model;
- no authentication route handlers;
- no customer login/register/account pages;
- no password reset or email verification infrastructure;
- no social-login provider integration;
- no authentication middleware;
- no server-side customer identity resolver;
- no client authentication state store;
- no customer authentication tests.

`lib/auth/README.md` is an architectural placeholder stating that authentication/session infrastructure belongs in the auth boundary when introduced and that customer/admin/staff identity flows must remain outside presentation components.

### Administrator authentication

No customer or administrator authentication implementation was found in this repository. There is therefore no existing admin authentication system that can be reused as customer authentication.

This is an important security boundary: customer authentication must not be built by assuming or repurposing an administrator identity.

### Cookies, tokens and secrets

No repository-owned customer authentication cookie, session token, refresh token, password credential, OAuth credential, or authentication-specific environment contract was found.

The existing Cart API correctly remains private/no-store and does not expose ownership information. Cart ownership currently fails closed because trusted identity does not exist.

## 2. Existing customer/user data model

The current Prisma schema contains catalog, inventory, audit, and Cart entities but no Customer/User identity entity.

The current Cart model contains only its UUID and timestamps. It intentionally has no `customerId`, `userId`, browser identifier, or invented owner field.

This preserves the Phase 8 decision not to manufacture identity semantics before authentication exists.

### Required future minimum

A customer identity foundation should eventually provide only the data required by the selected authentication model:

- stable customer identifier;
- normalized/unique email identity if email authentication is supported;
- account status;
- display/profile fields required by the storefront;
- verification state where applicable;
- created/updated timestamps;
- secure credential representation only if password authentication is enabled;
- future ownership relations for Cart, orders, addresses, Wishlist, and preferences.

Plaintext passwords must never be stored.

Credential data should be isolated from public customer/profile DTOs.

## 3. Customer/admin identity separation

The intended boundary is:

Customer:
- storefront account identity;
- customer-owned Cart;
- future orders;
- future addresses;
- future Wishlist;
- future account preferences.

Administrator:
- internal administrative identity;
- administrative roles/permissions;
- catalog and operational access;
- separate authorization policy.

A customer identity must never gain administrator privileges merely because both identities use an email address, share a database table, or share a session mechanism.

If a shared identity infrastructure is eventually useful, customer/admin role assignment must still be explicit, server-side, and authorization-checked. Customer authentication alone is not authorization to administer the system.

## 4. Recommended customer identity architecture

The preferred future architecture is provider-neutral:

`Browser → Authentication Route/UI → Authentication Application/API → Authentication Service → Identity Repository → PostgreSQL`

The service should own:

- credential verification;
- registration policy;
- email verification policy;
- password reset policy;
- session issuance/revocation;
- account status checks;
- authentication event classification.

The identity repository should own:

- customer identity persistence;
- credential persistence;
- session persistence if server-side sessions are selected;
- lookup and uniqueness constraints.

Presentation components must not access Prisma directly.

No provider-specific SDK or authentication provider is introduced by Phase 9.1.

### Credential boundary

If password authentication is implemented, passwords must be processed only through a dedicated password-hashing/verification boundary using a modern adaptive password-hashing algorithm and an appropriate work factor. The application must store only the password hash and required algorithm metadata.

Password material must never be logged, returned in DTOs, stored in browser state, or placed in URLs.

### Social identity readiness

If social authentication is added later, provider identity should map to an internal customer identity through a provider-neutral external-identity record. Provider access tokens and secrets must remain server-side and must never become the customer primary key.

## 5. Session architecture

A server-side session model fits the existing Next.js/App Router architecture well because Cart ownership and protected account routes require trusted server-derived identity.

Recommended model:

`Browser secure cookie → opaque session identifier → server session record → Customer identity`

The cookie should be:

- HttpOnly;
- Secure in production;
- SameSite=Lax by default, tightened where a concrete cross-site requirement permits;
- scoped to the required host/path;
- short-lived enough for the threat model;
- rotated on authentication and privilege-boundary transitions.

The server should resolve the customer identity from the session on every protected request rather than trusting a customer ID supplied by the browser.

### Session lifecycle

Required future controls:

1. Issue a fresh session after successful authentication.
2. Rotate the session identifier after login to prevent session fixation.
3. Invalidate the pre-authentication session when appropriate.
4. Revoke the session on logout.
5. Support server-side expiration.
6. Renew active sessions according to a defined absolute/idle lifetime.
7. Permit revocation after credential/security events.
8. Never expose the raw session identifier to application UI state.
9. Do not log raw session identifiers.
10. Treat an expired/revoked session as anonymous.

A signed/encrypted self-contained token can be evaluated later, but there is no current architectural requirement to introduce JWT infrastructure. The recommended default is an opaque server-side session because it provides straightforward revocation and ownership control for Cart/account data.

## 6. Authorization model

Authentication answers who the requester is. Authorization answers what that identity may access.

### Anonymous

May access public storefront/catalog/search surfaces.

May not access customer-owned Cart data unless a separately defined anonymous Cart/session model is introduced.

### Authenticated customer

May access only their own customer data:

- their Cart;
- their profile;
- their addresses;
- their orders;
- their Wishlist;
- their account/security controls.

A customer ID, Cart ID, order ID, address ID, or Wishlist ID supplied by the client is never proof of ownership.

### Administrator

May access administrative capabilities only through an independent admin authorization boundary.

Customer authentication must never imply admin capability.

## 7. Cart ownership integration strategy

Phase 8 Cart currently fails closed with `CART_OWNERSHIP_UNAVAILABLE` because no trusted identity mechanism exists. This behavior must remain intact until Phase 9 authentication provides the required server-side owner context.

### Target authenticated Cart model

The future Cart should have a durable owner relation to the internal customer identity.

The ownership lookup must be server-derived:

`Session → Customer ID → Cart ownership check → Cart service`

The Cart service should continue to accept an opaque ownership context rather than parsing authentication implementation details.

### Anonymous Cart decision

Anonymous Cart support has not been implemented and must be an explicit product/architecture decision before authentication rollout.

If anonymous Carts are supported, they should use a server-controlled session identity, not a raw client-supplied customer identifier.

### Login transition

If anonymous Carts are supported:

1. Resolve the anonymous Cart from the trusted session.
2. Authenticate the customer.
3. Resolve the customer's existing Cart.
4. Apply an explicit merge policy.
5. Merge logical Product/Variant identities transactionally.
6. Revalidate current catalog state and availability.
7. Resolve quantity conflicts according to a documented policy.
8. Preserve stale-line information rather than silently discarding it.
9. Bind the resulting Cart to the authenticated customer.
10. Rotate/invalidate the relevant session identifiers.

No merge behavior is implemented in Phase 9.1.

### Logout/login transitions

Logout must not expose another customer's Cart. Login must not accept a Cart ID from the browser as proof of ownership. Session changes must cause server-side Cart ownership to be re-resolved.

Concurrent merge/mutation behavior must use database transactions and the existing Cart uniqueness constraints.

## 8. Route architecture

The future customer authentication/account structure should remain within the existing App Router architecture:

- `/login`
- `/register`
- `/forgot-password`
- `/reset-password`
- `/verify-email`
- `/account`
- `/account/profile`
- `/account/addresses`
- `/account/orders`
- `/account/security`

These routes are architectural targets only. They were not created.

Authentication actions should have dedicated application/API boundaries rather than embedding credential logic in pages.

Authenticated account pages should be protected server-side before rendering or returning private data.

Authentication and account routes should use appropriate `noindex` metadata and must never become public SEO surfaces.

## 9. Security findings

### Password security

No password system currently exists. Future password authentication must use adaptive password hashing, never plaintext or reversible encryption.

### Credential exposure

No current customer credential exposure was found because credentials do not exist yet.

Future responses must exclude password hashes, reset tokens, verification secrets, session identifiers, and provider tokens.

### Session theft/fixation

The future session boundary must use HttpOnly/Secure cookies, session rotation at login, expiration, server-side revocation, and no raw token exposure to client JavaScript.

### CSRF

Cookie-based authenticated mutations require CSRF protection appropriate to the final request architecture. SameSite cookies provide defense-in-depth, not a universal substitute for an explicit CSRF strategy.

Authentication endpoints must validate origin/request context where appropriate and use a CSRF mechanism for state-changing browser requests when the final transport requires it.

### XSS

Authentication state should not be placed into unsafe HTML or arbitrary client state. HttpOnly session cookies reduce direct script access to session identifiers. Existing output escaping and framework defaults remain important.

### Brute force/login abuse

Future login and registration endpoints require rate limiting/abuse controls, bounded request sizes, credential verification cost controls, and safe failure responses.

### Registration/password-reset abuse

Registration, verification, and password-reset workflows require rate limits and replay-resistant, expiring tokens.

Reset/verification tokens must be stored or represented so disclosure does not reveal reusable credentials.

### Email/account enumeration

Authentication failures should use generic responses where revealing whether an email exists would enable enumeration. Password-reset and verification request responses should be similarly non-enumerating.

### Authorization bypass / IDOR

All private resources must derive ownership from the trusted session identity and perform authorization at the application/service boundary. Resource IDs from URLs or request bodies are selectors, not authorization claims.

### Privilege escalation

Customer roles must not be inferred from client fields. Administrator capability must require an independent, explicit authorization check.

### Logging and PII

Passwords, session IDs, access tokens, reset tokens, provider tokens, payment credentials, and unnecessary customer PII must never be logged.

## 10. Privacy/data exposure findings

Future DTO layers should distinguish:

### Customer-facing private DTO

May contain only information required by the authenticated customer, such as:

- stable public/account identifier where required;
- display name;
- verified email status;
- permitted profile information;
- account status appropriate for the UI.

### Server-only identity context

May contain:

- internal customer ID;
- authorization context;
- session metadata;
- security state.

This context must not be serialized into browser-visible DTOs.

### Administrator data

Administrative systems may require additional audit/security metadata, but customer-facing routes must never expose administrative role internals.

### Forbidden exposure

Never return:

- password hashes;
- password-reset secrets;
- email-verification secrets;
- session identifiers;
- access/refresh tokens;
- internal authorization metadata;
- another customer's records;
- sensitive authentication audit records.

## 11. API/service/repository boundaries

The future authentication layering should be:

`Route/UI → Authentication Application/API → Authentication Service → Identity Repository → Database`

Customer account features should follow:

`Account UI → Account Application/API → Account Service → Customer Repository → Database`

Cart remains:

`Cart UI → Cart API/Application → Cart Service → Cart Repository`

The authentication layer supplies trusted identity context to Cart; Cart retains ownership authorization and commerce validation.

No UI component should access Prisma.

No generic authentication helper should bypass the service/repository boundaries to mutate customer records.

## 12. Observability requirements

Safe authentication event categories should include:

- authentication success/failure;
- registration success/failure;
- session creation;
- session revocation/logout;
- session expiration;
- password reset request/success/failure;
- email verification request/success/failure;
- authorization denial;
- suspicious repeated authentication failures;
- persistence failure;
- identity lookup failure.

Safe diagnostic fields may include:

- event type;
- timestamp;
- request/correlation ID;
- coarse outcome classification;
- route/operation;
- non-sensitive internal event ID;
- duration;
- rate-limit classification.

Do not log passwords, raw tokens, session identifiers, full credential payloads, or unnecessary PII.

## 13. Performance/reliability findings

Authentication should not add a database lookup to every public storefront request unnecessarily.

Recommended approach:

- public catalog requests remain unauthenticated and unchanged;
- protected account/API routes resolve identity only when needed;
- Cart routes resolve trusted identity because ownership requires it;
- avoid repeated session lookups within one request by passing an internal identity context through the application boundary;
- do not cache private customer data in shared/public caches;
- handle session-store/database outages as controlled authentication failures;
- avoid automatic retries of credential mutations;
- keep authentication request bodies bounded;
- expire invalid sessions cleanly.

Session lookup infrastructure should use the same database connection conventions already used by Prisma rather than adding a second persistence system without justification.

## 14. Accessibility & UX readiness

Future authentication UI should reuse existing UI primitives and provide:

- semantic `form` elements;
- explicit labels;
- correctly associated validation messages;
- keyboard navigation;
- visible focus states;
- accessible loading states;
- server/client error announcements where appropriate;
- password input controls that support password managers;
- mobile-friendly touch targets;
- responsive layouts;
- recovery paths for failed authentication;
- reduced-motion compliance.

No complete authentication UI is implemented.

## 15. Bauhaus design readiness

Future authentication/account surfaces should reuse the established design system:

- Bauhaus palette;
- Outfit typography;
- 2px/4px borders;
- hard offset shadows;
- square/limited-radius geometry;
- existing buttons;
- existing inputs;
- existing cards;
- existing alerts;
- existing focus states;
- responsive layout system;
- existing motion/reduced-motion rules.

No separate authentication visual language is justified.

## 16. Testing coverage

Added architecture-level regression coverage in:

`tests/customer-authentication-architecture.test.ts`

The tests verify:

- the auth boundary remains provider-neutral and separate from presentation;
- Cart ownership remains fail-closed until trusted identity exists;
- the Cart schema does not invent a customer owner field during the audit phase;
- customer authentication routes are not prematurely introduced.

Future authentication implementation must add integration coverage for:

- customer/admin identity separation;
- password hashing and verification;
- session issuance;
- session rotation;
- session expiration/revocation;
- logout;
- authorization failures;
- IDOR protection;
- protected-route behavior;
- private DTO exposure;
- CSRF behavior;
- enumeration-safe responses;
- rate limiting;
- Cart ownership binding;
- anonymous-to-authenticated Cart transition if anonymous Carts are supported.

## 17. Validation status

The repository integration does not provide a runnable local PostgreSQL/application process for this audit.

The current GitHub commit status reports no configured CI status checks.

Therefore:

- source-level architecture inspection was performed;
- the architecture regression test was added;
- `npm run lint` was not executed;
- `npm run typecheck` was not executed;
- `npm test` was not executed;
- `npm run build` was not executed;
- browser authentication smoke tests cannot be executed because authentication UI does not yet exist.

No runtime command is represented as passed without execution.

## 18. Remaining blockers

### Blocker 1 — No customer identity model

There is no Customer/User identity model or ownership relation.

### Blocker 2 — No session mechanism

There is no trusted server-side customer session from which Cart/account ownership can be resolved.

### Blocker 3 — Cart ownership binding

Phase 8 Cart deliberately fails closed because ownership is unavailable. Phase 9.2 must establish the supported identity/session contract and then bind Cart ownership without accepting client-controlled owner IDs.

### Blocker 4 — Authentication runtime validation

Lint, typecheck, tests, and build still require execution in a local/CI environment.

These blockers are expected for an architecture audit and do not justify implementing authentication prematurely in Phase 9.1.

## 19. Exact Phase 9.2 scope

Phase 9.2 should implement only the customer identity/session foundation required by the documented architecture:

1. Introduce the minimal customer identity data model.
2. Introduce secure credential representation only if password authentication is selected.
3. Introduce the server-side session model and secure cookie contract.
4. Implement trusted server-side identity resolution.
5. Implement customer/admin authorization separation without reusing admin authentication as customer authorization.
6. Bind the existing Cart ownership boundary to the trusted customer identity.
7. Decide and implement anonymous Cart semantics only if the product explicitly supports guest Carts.
8. Do not implement complete account dashboard functionality.
9. Do not implement Wishlist, Checkout, Payments, Orders, Shipping, Fulfillment, Reviews, or provider authentication.
10. Add unit/integration security tests.
11. Run lint, typecheck, tests, and build in a runnable environment.
12. Preserve all existing catalog, search, product, storefront, and Cart behavior.

## 20. Git diff scope

Phase 9.1 changes are limited to:

- `tests/customer-authentication-architecture.test.ts`
- `docs/phase-9-1-customer-authentication-account-architecture-audit.md`

No existing storefront, catalog, search, Product Detail, Cart service, Cart API, Cart UI, database schema, or authentication implementation was changed.

## Final readiness decision

NOT READY FOR PHASE 9.2
