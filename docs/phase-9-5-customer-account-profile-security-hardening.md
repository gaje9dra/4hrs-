# Phase 9.5 — Customer Account, Profile & Security Hardening

## Scope
Phase 9.5 implements the authenticated customer account/profile experience on top of the Phase 9.3 authentication architecture.

Implemented:
- `/account`;
- `/account/profile`;
- authenticated profile retrieval/update;
- allowlisted `displayName` profile mutation;
- authenticated Header → Account navigation;
- private/no-store account data boundaries;
- account/cart navigation compatibility.

Deferred:
- email changes;
- password changes;
- active-session listing/logout-all;
- password recovery/email verification;
- guest Cart claim/merge;
- Orders, Wishlist, Checkout, Payments, Shipping/Fulfillment, Reviews.

## Architecture
`Authenticated Session → Customer ID → Customer Profile Service → Customer Repository → Database`.

Account routes use `requireCurrentCustomer()`. No customer ID is accepted from query parameters, form fields, request bodies, local storage, or browser-controlled authorization state.

## Profile model
The Customer model now includes nullable `displayName String? @db.VarChar(120)`.

The customer DTO exposes only customer-facing identity/profile fields. Password hashes, credentials, session identifiers and admin/security metadata are excluded.

## Profile update
`PATCH /api/customer/profile` accepts only `displayName`.

Validation rejects unsupported fields, control characters and values over 120 characters. Repository mutation updates only the approved field.

Email mutation is unavailable because the existing architecture has `emailVerifiedAt` but no verification-token/delivery workflow. No fake verification system was added.

Password change remains deferred because a complete authenticated current-password verification plus credential update/session-rotation workflow was not already established.

## Session and logout
The Phase 9.3 opaque HttpOnly session architecture remains authoritative. The global authenticated Header continues to revoke the server session through `POST /api/auth/logout`, clear the cookie, navigate to `/`, and refresh the shell.

The account page does not create an independent session system.

## Privacy and cache safety
Account pages are `force-dynamic`, `revalidate = 0`, and use `noindex, nofollow, noarchive`.

Profile API responses use the existing `authJson()` boundary with private/no-store caching headers.

No password hash, session token/hash, credential record or admin field is serialized to customer UI.

## Cart compatibility
The account page links to the existing Cart without changing Cart persistence or ownership semantics. Logout does not delete or overwrite the authenticated Cart. Guest Cart claim/merge remains deferred.

## Accessibility/responsive behavior
The account and profile surfaces use existing Container, Card, Button, Input, FormField and Alert primitives, semantic headings, explicit labels, keyboard-operable controls, visible focus, accessible feedback and touch-friendly controls.

No new gradients, glass effects, soft dashboard shadows or generic rounded styling were introduced.

Browser verification at 320–1920px requires a runnable local browser environment and is not claimed as executed through the repository connector.

## Testing
Added source-level coverage for account protection, identity boundaries, profile allowlisting, secret-free DTOs, email-change limitation, navigation, logout integration, private caching and downstream-route absence.

The repository connector cannot execute local PostgreSQL-backed tests, lint, typecheck, build or browser smoke tests. These are therefore not claimed as passed.

## Final status
Implementation and repository-side audit for the approved Phase 9.5 scope are complete. Runtime validation remains an environment limitation, so production readiness cannot be claimed from repository inspection alone.
