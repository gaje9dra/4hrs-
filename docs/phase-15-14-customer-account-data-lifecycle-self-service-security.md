# Phase 15.14 — Production Customer Account Data, Self-Service Data Controls & Account Lifecycle Hardening

## Scope
The phase hardens the existing canonical Customer/Auth/Privacy architecture without creating a second identity, authentication, consent, privacy, customer database, order, payment, fulfillment, or shipping authority.

## Account lifecycle
Customer states remain ACTIVE, SUSPENDED, DISABLED and PENDING_VERIFICATION. Customer anonymization is represented by anonymizedAt and is terminal for self-service access. No additional lifecycle state machine was introduced.

## Profile ownership
Profile mutation remains allowlisted to display name and derives identity only from requireCurrentCustomer(). Email changes remain unsupported because the repository has no dedicated verified email-change workflow. Phone remains an address/contact field rather than a primary authentication identity.

## Address self-service
The existing CustomerAddress service remains authoritative. The account profile now supports create, edit, remove, set-default and list operations. All operations are scoped to the authenticated customer. Historical order/shipment snapshots are never rewritten.

## Password change
Password changes require the authenticated session and current password, use the existing scrypt policy, reject reuse of the current password, apply same-origin protection and rate limiting, preserve the current session, revoke other sessions, and enqueue a canonical security notification.

## Active sessions
Customers can list active sessions, identify the current session, revoke an individual owned session, and sign out all active sessions. The UI exposes only creation time, last activity, expiry and current-session status. Raw session tokens and token hashes are never exposed.

## Security notifications
SECURITY_PASSWORD_CHANGED and SECURITY_SESSIONS_REVOKED were added to the existing NotificationEvent architecture. They use REQUIRED_TRANSACTIONAL communication and the existing notification delivery pipeline. Notification failure cannot roll back or falsely report a successful security mutation.

## Privacy
Phase 15.6 remains the canonical privacy/deletion authority. Export is authenticated, bounded, private/no-store and excludes passwords, session secrets, provider credentials and internal admin notes. Existing deletion/anonymization removes credentials and sessions, current addresses, mutable preference/analytics identity data and queued notification recipient data while preserving historical commercial and operational records.

The privacy workflow remains synchronous because the current implementation bounds its relation work and the repository has no separate account job runner. No isolated job infrastructure was introduced.

## Communication preferences and consent
The account surface continues to use the Phase 15.8 canonical communication-preference system. No duplicate preference or consent store was introduced.

## Authorization and cache isolation
Customer APIs derive identity from the server-side session. Account pages and customer account APIs remain private/no-store and non-indexable. No customer-specific account data is placed in public caches.

## Admin lifecycle
Phase 14.9 remains the canonical admin customer-control surface. Existing status transitions suspend, disable and reactivate customers. Session resolution checks current Customer status on every authenticated request, so suspended/disabled accounts cannot continue normal authenticated access.

## Analytics and experimentation
Existing privacy lifecycle behavior remains authoritative: customer analytics events and experiment assignments are removed during anonymization. No independent analytics identity store is created.

## Recovery limitations
A full forgot-password/email-recovery flow is not introduced because the repository has no established verified recovery-channel infrastructure. Introducing an unverified reset mechanism would create a second security subsystem and weaken the existing authentication boundary.

Current supported recovery is the authenticated password-change workflow plus the existing operational/admin customer-support path. Email verification, email change and MFA/2FA recovery remain outside the implemented repository capabilities and are documented rather than represented as insecure UI.

## Failure and retry semantics
Password changes and session revocation are transactionally safe. Individual session revocation is ownership-scoped. Logout-all is retry-safe. Deletion/anonymization is already idempotent. Notification delivery uses the existing idempotency/retry architecture.

## Testing
Phase-specific service tests cover safe active-session metadata, current-session identification, password-change verification, rejection of the old password after a successful change, preservation of the current session, revocation of other sessions, and ownership-scoped session revocation.

## Known limitations
- Email change remains deferred until a dedicated verified workflow exists.
- Forgot-password/recovery remains deferred until a verified recovery-channel/token-delivery boundary exists.
- Phone is not a separate primary authentication identity.
- MFA/2FA is not present in the existing repository and was not invented here.
- The existing process-local rate limiter remains a deployment limitation for horizontally scaled environments.
- The repository has no dedicated account lifecycle job runner.

## CI gate
Phase completion requires npm run lint, npm run typecheck, npm test, npm run build, Prisma validation/generation/migration checks, existing recovery/security/integration checks, and the phase-specific account security tests. CI configuration must not be weakened to make the phase pass.