# Phase 16.7 — Admin and RBAC Certification

## Objective
Certify the complete administrative control plane: authentication, identity, RBAC, permissions, resource authorization, privileged operations, auditability, observability, concurrency and failure recovery.

## Canonical architecture
Admin authentication uses the existing customer authentication/session boundary, then resolves AdminUser -> AdminRole -> AdminPermission -> server-side resource authorization -> operation -> AdminAuditLog.

## Critical remediation
A hardcoded privileged email previously granted effective SUPER_ADMIN authority independently of database role assignment. This was classified as a CRITICAL production authorization risk. The bypass was removed from authorization, admin management, provisioning and protected-identity code.

## Authentication and session security
Every admin API resolves the current authenticated customer server-side. Both customer status and AdminUser status must be ACTIVE. Existing session expiry/revocation protections therefore apply to admin access.

## RBAC and permission matrix
Roles are SUPER_ADMIN, ADMIN, OPERATIONS and VIEWER. Permissions are centralized in lib/admin/permissions.ts. High-risk permissions are explicitly classified. Database role assignments are authoritative.

## Server-side authorization and IDOR
Every admin API route is expected to invoke requireAdmin. Privileged domain/application services additionally enforce requirePermission. Resource identifiers are resolved server-side; order child resources are checked against their parent order.

## Privileged operations
Payments/refunds, fulfillment/Qikink, shipping, order post-order operations, customer management, administrator management and production-sensitive configuration are permission-controlled. Refunds and other retriable operations retain idempotency controls.

## Customer data
Customer access is granular through customers.read, customers.update, customers.status.manage and related permissions. No new administrative data bypass was introduced.

## Role assignment and privilege escalation
Only authorized administrators can grant roles. SUPER_ADMIN grants require a SUPER_ADMIN actor. Administrators cannot modify their own role or status. The final active SUPER_ADMIN cannot be removed or disabled. Changes use expected-version checks and serializable transactions.

## Audit trail
Authorization denials and privileged mutations use AdminAuditLog. Audit metadata is sanitized for credential-like fields and bounded in depth, entry count and serialized size. No admin audit update/delete control path was introduced.

## Admin UI and APIs
Admin APIs use private/no-store responses and dynamic rendering. State-changing routes use trusted-origin protection. Static scanning found no known database, payment, or Qikink credentials in admin client components.

## Bulk operations and rate limiting
Administrative reads are bounded. The existing admin rate limiter is process-local in memory, which is an operational limitation for horizontally scaled deployments; it does not replace authorization.

## Provider separation
Qikink/provider credentials remain server-side. Admin surfaces operate through provider-neutral application services.

## Unsupported capabilities
Impersonation and a separate break-glass workflow are not evidenced and are not fabricated. Distributed admin rate limiting is not currently implemented.

## Validation
Phase-specific regression tests cover canonical RBAC, hardcoded-bypass elimination, privileged-service permission/audit boundaries, role-escalation controls and audit metadata safety. Full repository CI remains mandatory: lint, typecheck, tests, build, Prisma validation/generation and established certification audits.

## Final gate
The Phase 16.7 certification audit fails on unresolved CRITICAL or HIGH findings and emits READY FOR PHASE 16.8 only when those findings are absent.
