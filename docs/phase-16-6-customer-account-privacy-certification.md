# Phase 16.6 — Customer Account and Privacy Certification

## 1. Objective
Production-grade certification of the existing customer identity, authentication, session, account, profile, orders, privacy, self-service, lifecycle, admin boundary, audit and retention architecture. No second identity, authentication, authorization or privacy engine is introduced.

## 2. Scope
The certification covers registration, authentication, session security, customer authorization/IDOR, profile and address ownership, order/post-order access, credentials, privacy export/deletion, account lifecycle, retention evidence, admin access, notifications, rate limiting, API/cache boundaries, concurrency, security regressions, database integrity, observability and auditability.

## 3. Customer identity architecture
The canonical path is customer credential -> hashed customer session -> server-side session resolution -> authenticated customer identity -> customer-scoped repository/application operations. The browser does not supply the authoritative customer ID for customer-owned operations.

## 4. Registration certification
Registration validates credentials, normalizes email, hashes passwords, prevents duplicate normalized email identities, uses a rate limit and returns generic authentication failures. A separate email-verification workflow is not evidenced and is not fabricated.

## 5. Authentication certification
Login verifies the stored password hash, requires ACTIVE customer status, rotates a newly issued opaque session and revokes a prior session when appropriate. Authentication failures use generic public responses.

## 6. Session certification
Session tokens are random opaque values; only SHA-256 hashes are persisted. Customer cookies are HttpOnly, SameSite=Lax and secure in production. Sessions have expiry and revocation checks. Password changes revoke other sessions; logout and session-management routes revoke sessions server-side.

## 7. Authorization certification
Customer resources use authenticated identity from the server. Orders are queried by customer ID, addresses are scoped by customer ID, privacy exports/deletion derive identity from the authenticated session, and admin customer endpoints require explicit RBAC permissions.

## 8. IDOR certification
The certification specifically covers manipulated order, address and privacy customer identifiers. Customer endpoints do not accept a browser-supplied customer ID as the ownership authority.

## 9. Profile certification
Profile mutation is allow-listed to displayName. Server-controlled identity, role, permissions, status and other internal fields are not accepted by the customer profile route.

## 10. Address certification
Address creation/update/delete/default operations receive the authenticated customer ID from the session and pass it into the repository boundary. Historical order addresses are stored as order snapshots rather than destructively rewritten from later profile changes.

## 11. Customer-order access certification
Order detail and list operations require authentication and customer-scoped repository queries. Customer-visible order state is produced from canonical order data.

## 12. Post-order data certification
Post-order resources remain under the existing authenticated customer boundary. Shipment/tracking access is handled by the canonical shipping/customer projection established in earlier phases.

## 13. Credential security
Passwords are hashed and are not part of customer DTOs or privacy exports. Password-change operations require the current password, are rate-limited, and revoke other sessions.

## 14. Account recovery
No password-recovery token workflow is evidenced by the current repository tree. This phase records the capability as unsupported rather than inventing one.

## 15. Privacy controls
Customer privacy operations are server-authorized, rate-limited and audited. UI controls are not treated as security boundaries.

## 16. Data export
The export is derived from the authenticated customer identity, explicitly selects fields, excludes credential/session secrets, is bounded at 5000 records per category and is returned with private no-store cache policy. It is synchronous; asynchronous export expiry is not implemented.

## 17. Account deactivation
The existing account status model includes ACTIVE, DISABLED, SUSPENDED and PENDING_VERIFICATION. Session resolution rejects non-ACTIVE customers, preventing disabled/deactivated identities from continuing to use existing sessions.

## 18. Account deletion
Customer deletion is an explicit confirmation workflow implemented as anonymization. Credentials, sessions and mutable customer data are removed/scrubbed while historical commercial records are preserved. Administrative identities are protected from this customer endpoint.

## 19. Data retention
The repository contains a Phase 15 privacy/retention architecture and the customer anonymization marker. This certification documents repository behavior and does not invent legal retention periods.

## 20. Personal-data inventory
The privacy export demonstrates the currently surfaced categories: profile/contact identity, addresses, orders/order snapshots, payments/refunds, returns, cancellations, support cases, notifications, communication preferences, analytics and experiment assignments. Provider secrets and authentication secrets are excluded.

## 21. Data-flow analysis
Customer data flows from browser requests through authenticated API/application boundaries into the database and existing payment/order/fulfillment/shipping/notification/admin/audit systems. Provider credentials are server-only; customer export and notifications are explicitly minimized.

## 22. Admin-data boundary
Admin customer detail/profile/status endpoints require permission-specific RBAC and emit audit evidence. Sensitive access is not treated as equivalent to generic customer-read access.

## 23. Support-data certification
Customer cases are part of the existing customer data/privacy model. Customer-facing case routes remain behind authenticated customer context and administrative case access is governed by admin permissions.

## 24. Notification privacy
Security notifications carry event metadata rather than passwords, reset tokens or session material. Customer communication preferences are authenticated, same-origin and rate-limited.

## 25. Security events
Authentication, privacy and privileged customer-data operations have structured audit/observability paths. Secrets are not intended to appear in those events.

## 26. Rate limiting
Registration/login, password change, session management, privacy and communication preference operations have rate-limit controls. The current implementation is process-local in memory; distributed cross-instance enforcement is not evidenced and is recorded as an operational limitation.

## 27. API certification
Customer mutation routes use server-side identity, input validation, same-origin protection where state changes occur, response minimization and ownership-scoped services.

## 28. Cache isolation
Customer-specific APIs are dynamic. Privacy export responses explicitly use private no-store caching and noindex headers. Future customer-specific cached responses require explicit isolation.

## 29. Concurrency
Authentication registration/session mutation and privacy deletion/export use transaction boundaries. Privacy deletion/export use serializable transactions. Existing order and fulfillment/shipping certifications cover their own lifecycle concurrency.

## 30. Commerce/account interaction
Deletion anonymizes the customer rather than deleting orders, payments, fulfillment, shipping or refunds. This preserves active and historical commerce records instead of corrupting them.

## 31. Security testing
Existing tests cover authentication architecture, authorization, account security, customer profile and privacy. Phase-specific tests additionally assert identity derivation, IDOR boundaries, privacy deletion safety, admin RBAC and cache/secret boundaries.

## 32. Privacy failure-injection results
Static adversarial checks cover manipulated customer IDs, order IDs and address IDs, while existing service tests exercise cross-customer authorization failures. Expired/revoked session behavior is exercised through the authentication service test suite.

## 33. Database integrity
The customer/session/credential model and anonymization marker are retained through additive migrations. CI validates and generates Prisma before tests and audits migration safety.

## 34. Observability
Authentication events, privacy operations and admin customer-data access are auditable. Credential/session secrets are excluded from customer-facing and audit payloads.

## 35. Audit trail
Customer privacy export/deletion and privileged admin customer access emit audit evidence with correlation/request identifiers where available.

## 36. Test results
Phase 16.6 adds `tests/phase-16-6-customer-account-privacy-certification.test.ts`. Existing authentication, authorization, account-security and privacy regression suites remain required; no failing security tests are removed or weakened.

## 37. CI results
Required gates are `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, `npx prisma validate` and `npx prisma generate`, plus the earlier mandatory certification/audit commands. The Phase 16.6 certification command is added to CI.

## 38. Blockers
Certification blockers are emitted by the audit script. A genuine CRITICAL/HIGH finding prevents readiness; unsupported capabilities are explicitly classified as limitations rather than fabricated as PASS.

## 39. Remediation
Any Phase 16.6 blocker must be reproduced, classified, fixed within scope, and retested. No authentication bypass, weakened authorization, disabled lint/test, or fabricated privacy capability is acceptable.

## 40. Final certification decision
The CI run and the Phase 16.6 certification audit are the final evidence. The repository must have zero unresolved CRITICAL/HIGH/BLOCKED findings before the phase can be declared ready.

## Production-readiness matrix
| Area | Status |
|---|---|
| Identity/authentication/session | PASS |
| Customer authorization / IDOR | PASS |
| Profile / addresses / orders | PASS |
| Privacy controls/export/deletion | PASS |
| Admin customer-data boundary | PASS |
| Credentials/security events | PASS |
| Rate limiting | PASS with distributed operational limitation |
| Cache isolation | PASS |
| Database integrity | PASS |
| Observability/audit | PASS |
| Password recovery | NOT APPLICABLE — not implemented |
| Email verification | NOT APPLICABLE — not implemented |
| Async export | NOT APPLICABLE — bounded synchronous export |
| Distributed rate limiting | NOT APPLICABLE — process-local implementation |

## Final gate
The certification command is authoritative for the phase decision. It must emit READY FOR PHASE 16.7 only when no CRITICAL, HIGH or BLOCKED finding remains.
