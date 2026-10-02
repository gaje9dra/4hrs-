# Phase 14.1 — Admin Platform Foundation, RBAC & Secure Operations Architecture

## Scope
Phase 14.1 establishes the reusable administrative security/control-plane foundation. It does not implement Catalog, Order, Payment, Fulfillment, Shipping, Returns, Cases, or Analytics administration as new domain modules.

The invariant remains: Storefront → canonical domain/application services ← Admin platform → authorized actions → persistence/integrations.

Admin routes are authorization/orchestration boundaries; they do not become a second business-domain implementation.

## Authentication boundary
Customer authentication remains the single session mechanism. Browser sessions use the existing opaque, server-stored customer_session cookie and existing authentication service. No second admin token/session framework was introduced.

A customer session is insufficient for administration. Administrative access additionally requires an active AdminUser record linked 1:1 to the authenticated Customer.

Admin authorization is re-resolved from the database on protected requests. Disabling the customer or AdminUser therefore invalidates administrative authority on subsequent requests even if the customer session itself has not expired.

Cookies remain HttpOnly, Secure in production, SameSite=Lax, root-scoped and bounded to the existing customer session lifetime. Administrative secrets are never stored in localStorage or returned to browser code.

## Administrative identity
AdminUser represents administrative authority for an existing Customer identity. It contains a stable administrative ID, linked Customer ID, active/disabled status, optimistic-concurrency version, last-login timestamp, and timestamps.

Passwords remain owned by CustomerCredential and use the existing scrypt implementation. AdminUser never stores passwords.

## RBAC
Authorization is centralized in lib/admin/authorization.ts.

Request path:
Authentication → AdminUser resolution → role resolution → permission check → application/domain service.

Roles:
- SUPER_ADMIN — complete permission taxonomy.
- ADMIN — broad operational administration without super-admin/security controls.
- OPERATIONS — operational commerce access.
- VIEWER — read-only access.

Roles resolve to permissions through persisted AdminRolePermission records. Application code does not treat a role name as the security boundary.

Permission namespaces established for future modules:
- catalog.*
- orders.*
- payments.*
- fulfillment.*
- shipping.*
- returns.*
- customers.*
- cases.*
- analytics.read
- admin.users.*
- admin.audit.read
- system.settings.*

High-risk permissions remain independently controllable, including refunds, customer mutation, fulfillment/shipping mutation, administrator management and system settings.

## Resource authorization
The foundation exposes server-side resource-policy helpers. Future modules must authenticate the actor, resolve the resource from trusted server state, check the required permission, apply any resource-level policy, then execute the canonical application/domain operation.

Client-provided ownership or role flags are never trusted.

## Admin route/API protection
The /admin UI is protected by app/admin/layout.tsx. Unauthorized administrative sessions are redirected to the existing customer login flow.

Admin APIs use centralized requireAdmin() permission checks. Existing Catalog, Fulfillment, Returns and Case administrative operations were moved onto permission checks without creating duplicate domain services.

State-changing requests use the existing same-origin request-integrity convention. JSON bodies are size-bounded and validated at the administrative boundary.

Admin responses use private/no-store headers, stable administrative error codes, and never expose Prisma entities, password hashes, session tokens, provider credentials, payment credentials or environment secrets. Administrator resource identifiers are validated as UUIDs before database access, and request correlation IDs are propagated into centralized audit records when supplied.

## Error contract
Administrative errors distinguish:
- ADMIN_REQUIRED
- FORBIDDEN
- INVALID_REQUEST
- NOT_FOUND
- CONFLICT
- RATE_LIMITED
- DATABASE_ERROR

Database, filesystem, provider and secret details are not exposed to clients.

## Dashboard shell
The admin UI uses the existing 4HRS+ Bauhaus language: geometric composition, strong typography, thick borders, hard shadows, solid color blocks and minimal radius.

The shell provides protected layout, responsive/collapsible mobile navigation, administrator identity, role display, permission-aware navigation, logout, dashboard overview and an administration/user-management entry point. Active navigation is presentation-only; the server remains the authorization boundary.

Navigation visibility is only a UX optimization. APIs and routes independently enforce permissions.

No full future module is implemented by this phase.

## Administrator management
Protected administrator APIs provide list, view, create, role assignment, enable/disable, and optimistic-version protection.

Least privilege:
- new administrators default to VIEWER when roles are omitted;
- granting SUPER_ADMIN requires an existing SUPER_ADMIN;
- administrators cannot change their own authorization/status;
- ordinary administrators cannot modify super-administrator accounts;
- the final active super-administrator cannot be disabled;
- stale administrator versions are rejected.

Administrator creation/change operations require a server-validated privileged-action reason and are rate-limited using the existing authentication rate-limiter implementation.

## Secure provisioning
npm run admin:provision uses ADMIN_PROVISION_EMAIL, ADMIN_PROVISION_PASSWORD and ADMIN_PROVISION_ROLE.

These are environment inputs only. They are not committed, returned by APIs, or printed. The default role is VIEWER; elevated roles must be explicitly selected.

ADMIN_EMAILS is documented as legacy and is no longer the authorization source.

## Audit logging
AdminAuditLog is the centralized append-only application boundary for meaningful administrative actions.

Recorded fields include actor admin ID, action, resource type/ID, success/failure, privileged-action reason where required, correlation ID, sanitized metadata and timestamp.

Secret-shaped metadata keys such as password, token, cookie, credential, authorization and API-key fields are removed before persistence. Metadata is bounded.

Ordinary administrative APIs have no update/delete operation for audit history. Authorization denials for an identified administrator are recorded centrally. Existing domains retain their domain-specific audit trails; future admin modules must also write the centralized administrative audit record for privileged operations.

## Session/security hardening
The existing customer session remains the security source of truth:
- opaque random session tokens
- SHA-256 token hashes stored server-side
- expiry and revocation
- disabled-customer rejection
- throttled last-used writes
- HttpOnly/Secure/SameSite cookie controls
- same-origin protection for state-changing authentication/admin requests

The default rate limiter remains process-local memory. It is reused rather than introducing a second rate-limiter implementation. Distributed deployments must replace or front this limiter with shared infrastructure before relying on it for global enforcement.

## Database changes
Migration 20261002230000_admin_platform_foundation adds AdminUser, AdminRole, AdminPermission, AdminUserRole, AdminRolePermission, AdminAuditLog and AdminAccountStatus.

The migration is additive, preserves existing data, adds foreign keys/indexes/unique constraints, and seeds the fixed role and permission taxonomy. It does not create an administrator account automatically.

No database reset, old-migration rewrite, destructive migration or provider-specific schema was introduced.

## Testing
Added tests/admin-platform-foundation.test.ts covering explicit admin authority, role-to-permission resolution, missing-permission rejection, disabled-admin rejection, self-escalation, final-super-admin protection, privileged-reason validation and audit metadata secret stripping.

The existing full regression suite remains required.

## Known limitations
- The repository's actual dependency configuration remains authoritative; no unrelated dependency upgrade was performed.
- The default rate limiter is process-local and therefore not globally consistent across multiple instances.
- Email verification, password recovery, MFA and active-session management remain outside this phase.
- Existing domain-specific administrative operations retain their existing domain audit records; future phases must add the centralized AdminAuditLog entry for each privileged action.
- No full Catalog, Order, Payment, Fulfillment, Shipping, Returns, Case or Analytics administration module is introduced here.

## Future-phase rule
All future admin modules MUST use the existing customer session, AdminUser authority, centralized role/permission resolution, server-side resource authorization, stable admin error contracts, centralized administrative audit logging and canonical domain/application services.

A future module must not create its own session, RBAC, permission, audit or parallel business-domain implementation.
