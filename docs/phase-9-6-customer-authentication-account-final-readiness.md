# Phase 9.6 — Customer Authentication & Account Final Readiness

## Final architecture
Browser authentication UI → /api/auth/* → authentication service → customer repository → PostgreSQL.
Customer identity is resolved from the server-side HttpOnly session cookie. UI does not access Prisma or credentials directly.

## Identity and authorization
Customer, credential and session records remain separate. Customer/admin boundaries are separate. Protected account and profile operations derive identity from requireCurrentCustomer() and do not accept browser-supplied customer IDs.
Customer DTOs exclude password hashes, session token material, credential records and admin permissions.

## Registration and login
Registration normalizes and validates email, hashes passwords with Node scrypt, transactionally creates customer/credential/session records, rejects duplicate identities and applies rate limiting.
Login verifies credentials server-side, rejects non-ACTIVE accounts, normalizes public failures, creates a fresh session and revokes a supplied prior session belonging to the same customer.

## Session security
Sessions use 32-byte random opaque tokens with SHA-256 hashes stored server-side. Cookies are HttpOnly, Secure in production, SameSite=Lax, root-path and 30 days. Revoked and expired sessions are rejected. lastUsedAt updates are throttled.
Logout revokes the server session and clears the cookie.

## Account/profile
Implemented protected surfaces: /account, /account/profile and PATCH /api/customer/profile.
Profile mutation is allowlisted to displayName. The displayName field is persisted on Customer. A prior schema defect that placed displayName on Product was corrected.
Email changes and password changes remain intentionally deferred; the UI does not falsely advertise those workflows.

## Redirect and CSRF security
Authentication redirects accept only validated same-origin relative paths. Protocol-relative paths, external origins, control characters and malformed destinations are rejected.
Authentication mutations enforce the request Origin when supplied. JSON request boundaries reject malformed/non-object bodies and enforce a size limit.

## Cart integration
Authenticated Cart access remains session → Customer ID → customer-owned Cart → Cart service. Cross-customer access is rejected server-side. Logout does not delete the customer's Cart. Guest Cart claim/merge remains deferred and no Cart redesign was introduced.

## Privacy/cache
Account and authentication pages are force-dynamic, revalidate=0 and noindex/nofollow/noarchive. Authenticated API responses use private/no-store caching. Customer data is not placed in public metadata, structured data or sitemaps.

## Accessibility/design
Authentication and profile surfaces use semantic labels, autocomplete, visible focus, keyboard-operable controls, accessible Alerts, submitting/disabled states, focus restoration and aria-busy. Existing Bauhaus primitives/tokens are reused; no new dashboard visual system was introduced.

## Performance/observability
Customer email and session token hashes are indexed. Session last-used writes are throttled. Password hashing remains intentionally expensive for security.
Authentication observability excludes passwords, hashes, session tokens, cookies, customer IDs, email addresses and request bodies.

## Runtime validation
The GitHub repository connector cannot execute the local PostgreSQL-backed tests, lint, TypeScript compiler, Next.js production build or browser smoke tests. Therefore npm test, lint, typecheck, build, migration execution and 320–1920px browser validation are not claimed as passed.

## Known limitations
- The default authentication rate limiter is bounded process-local memory, not a distributed/global limiter.
- Password change is deferred.
- Email verification and password recovery are deferred.
- Active-session listing/logout-all is deferred.
- Guest Cart claim/merge is deferred.
- Browser/runtime validation remains unavailable through the repository connector.

## Phase 9.6 corrections
- Corrected Customer displayName placement and retained the corresponding migration.
- Corrected the profile API error boundary.
- Restored authenticated Header → Account navigation.
- Updated stale authentication contract coverage for the implemented account surface.
- Added final Phase 9.6 security/integration audit tests.

## Deferred downstream commerce
No Wishlist, Checkout, Payments, Orders, Shipping/Fulfillment, Inventory Reservation or Reviews functionality was started.

## Final readiness
NOT READY FOR PHASE 10