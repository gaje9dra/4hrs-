# Phase 9.4 — Customer Authentication UI, Routes & Storefront Integration

## 1. Scope

Phase 9.4 adds the customer-facing authentication experience on top of the Phase 9.3 server-side authentication service.

Implemented:
- /login;
- /register;
- reusable customer authentication form;
- safe internal redirect handling;
- storefront customer session presentation;
- logout control;
- global Header integration;
- accessible validation/loading/error states;
- authentication-page SEO controls.

Not implemented:
- account dashboard;
- forgot-password;
- reset-password;
- email verification;
- Wishlist;
- Checkout;
- Payments;
- Orders;
- Shipping/Fulfillment;
- Inventory Reservation;
- Reviews;
- external authentication providers.

## 2. Authentication routes

The customer-facing routes are app/(storefront)/login/page.tsx and app/(storefront)/register/page.tsx.

Both routes are dynamic because authenticated-session state is evaluated server-side before rendering.

Already-authenticated customers are redirected to a validated internal destination, defaulting to /.

The server-side route uses resolveCurrentCustomer() rather than trusting browser state.

## 3. Login flow

The login form collects only email and password.

Client-side validation is limited to immediate user feedback:
- non-empty email;
- basic email shape/length checks;
- password presence;
- minimum 12-character password;
- maximum 1024 UTF-8 bytes.

The browser submits credentials only to POST /api/auth/login.

The UI never hashes, verifies, stores, or logs passwords.

The API remains responsible for normalization, password verification, rate limiting, session creation/rotation, generic credential/account errors, and HttpOnly session-cookie establishment.

On success the form navigates to a validated internal destination. External, protocol-relative, malformed, control-character, and backslash-containing destinations are rejected by the shared redirect boundary.

## 4. Registration flow

Registration collects only the fields required by the existing Phase 9.3 contract: email and password.

The browser submits only to POST /api/auth/register.

The server performs normalization, password hashing, customer creation, credential persistence, session creation, and public error normalization.

Registration therefore establishes the Phase 9.3 authenticated session immediately.

No password confirmation field was introduced because it is not required by the approved service contract.

## 5. Password recovery status

Phase 9.3 did not implement password recovery infrastructure. Therefore Phase 9.4 deliberately does not create forgot-password or reset-password routes.

No recovery tokens, email workflow, reset persistence, or provider integration has been fabricated.

## 6. Email verification status

Phase 9.3 did not establish an email verification workflow.

The customer model contains verification state, but no verification-token or delivery workflow exists.

Phase 9.4 therefore does not create a fake verification page or claim verification completion.

## 7. Session/UI integration

components/storefront/customer-auth-status.tsx consumes only GET /api/auth/session.

The component treats the server response as the presentation source for authenticated/anonymous state.

It does not trust localStorage, sessionStorage, arbitrary cookies, client-controlled customer IDs, query parameters, or hidden fields.

Authenticated state exposes only the safe customer email for presentation and a server-backed sign-out action.

Logout uses POST /api/auth/logout, which revokes the server session before clearing the cookie.

No session token is exposed to JavaScript.

## 8. Header integration

The existing Header remains the global storefront shell.

CustomerAuthStatus is placed alongside the existing DesktopNav and MobileNav without replacing catalog navigation.

Anonymous customers receive a Sign in entry point.

Authenticated customers receive their safe email presentation and a Sign out control.

An account dashboard does not yet exist, so no /account link is fabricated.

No administrative navigation is exposed.

The existing Search, Shop, Categories, Collections, responsive mobile navigation, and Cart entries remain intact.

## 9. Cart integration

Phase 9.3 explicitly did not enable anonymous persistent Cart ownership. The authenticated Cart boundary requires a trusted customer session.

Phase 9.4 therefore preserves that behavior rather than inventing a guest Cart claim/merge algorithm.

Consequences:
- anonymous customers do not receive an implicitly owned persistent Cart;
- authenticated customers continue to use the server-authoritative Cart ownership boundary;
- login/registration establishes the customer session before authenticated Cart access;
- no Cart data is silently assigned to another customer;
- no guest Cart is silently discarded because no guest persistent Cart exists in the approved architecture.

Future guest Cart persistence and guest-to-customer merge/claim behavior remain deferred until an explicit ownership protocol is designed and approved.

## 10. Protected-route behavior

Only authentication pages are protected by this phase.

An authenticated customer visiting /login or /register is handled server-side and redirected to a validated internal destination.

No future account dashboard is created merely to satisfy route protection requirements.

Customer resource authorization remains enforced by the Phase 9.3 server-side identity and authorization boundaries.

## 11. Redirect security

lib/auth/redirect.ts is the shared redirect validation boundary for authentication UI.

Accepted values must be relative paths, begin with /, not begin with //, contain no control characters, contain no backslashes, and resolve against a fixed same-origin sentinel without changing origin.

Rejected values fall back to /.

The API does not accept a redirect URL as an authentication credential or persistence field.

## 12. Accessibility

The authentication forms use the existing FormField, Input, Button, Card, and Alert primitives.

Implemented accessibility behavior includes semantic forms, explicit labels, email/password input types, autocomplete, keyboard-submit support, visible focus, field-level aria-describedby, aria-invalid, required-state semantics, alert/status announcements, aria-busy during submission, focus restoration after errors, and touch-friendly control heights.

The shared Input now supports forwarded refs so authentication error handling can restore focus without bypassing the design-system primitive.

## 13. Responsive behavior

Authentication content uses the existing responsive Container and Card primitives.

The form is constrained to the existing narrow content width and expands naturally from small mobile screens through desktop widths.

No fixed viewport-dependent decorative geometry was introduced.

Actual browser viewport verification requires a runnable local environment.

## 14. SEO behavior

Login and registration are private account-entry surfaces.

Both routes set index=false, follow=false, and noarchive=true.

No structured data or private customer information is emitted.

## 15. Security controls

The UI relies on Phase 9.3 controls rather than duplicating security logic:
- HttpOnly customer session cookie;
- Secure cookie in production;
- SameSite=Lax;
- same-origin validation on authentication mutations;
- server-side session resolution;
- server-side password hashing/verification;
- server-side rate-limiting abstraction;
- generic credential/account failures;
- no sensitive browser persistence;
- no client-side authorization;
- no admin/customer identity mixing.

The UI does not expose password hashes, session tokens, session hashes, customer IDs as authorization claims, database errors, or stack traces.

## 16. Performance

Authentication UI uses minimal client-side code.

The Header auth status makes one session request and does not expose a session token.

Public catalog navigation is unchanged and no authentication provider SDK was added.

No ORM access exists in React components.

Authentication pages perform a server-side session check only to intentionally handle already-authenticated customers.

## 17. Testing performed

Added/updated source-level coverage for login/register route existence, deferred password-recovery and verification routes, server-side authenticated-page redirects, safe redirect constraints, credential/API boundary separation, form semantics and validation wiring, sensitive-data exclusion, same-origin browser credential handling, Header session/logout integration, customer/admin separation, Cart ownership, and existing Bauhaus tokens/navigation.

The repository connector does not execute the local PostgreSQL-backed test suite, lint, typecheck, or production build. No such command is represented as passed.

Browser smoke tests at 320–1920px likewise require the project running in a local/browser-capable environment and are not claimed as executed here.

## 18. Deferred authentication/account functionality

Deferred because the required backend infrastructure does not exist:
- forgot-password;
- reset-password;
- email verification;
- account dashboard;
- account management;
- guest persistent Cart;
- guest Cart claim/merge.

## 19. Validation status

Implemented and statically audited through the repository boundary.

Not runtime-verified through the available connector:
- unit tests;
- integration tests;
- lint;
- typecheck;
- production build;
- browser smoke testing;
- PostgreSQL-backed authentication execution.

The Phase 9.3 process-local rate limiter also remains a deployment concern for horizontal scaling; Phase 9.4 does not replace it with an unapproved provider.

## 20. Final assessment

The customer authentication UI, routes, and direct storefront integration are implemented within the approved Phase 9.3 architecture.

Runtime verification remains an environment limitation, so production readiness cannot be claimed solely from repository-side inspection.