# Phase 14.9 — Admin Customer Management, Customer Insights & CRM Operations

## Architecture
Admin Customer Management is an operational interface over the canonical Customer domain. Customer identity, authentication, addresses and lifecycle remain authoritative in the Customer/Auth architecture. Orders, Payments, Refunds, Returns, Cancellations and Cases remain authoritative in their respective domains.

The admin module never exposes credentials or provider secrets and never implements a second customer state machine.

## List/search
The customer list is server-side, bounded and deterministically sorted. Search is limited to exact UUID lookup or bounded prefix search over email/display name; wildcard characters are escaped. Unsupported sort/filter values and unbounded page sizes are rejected. Order counts and financial values are database-derived.

Financial customer values require the customers.financial.read permission. Only INR-compatible paid-order totals are treated as financial purchase value; mixed currencies are represented as unavailable rather than silently converted.

## Detail
The detail view contains customer identity, a bounded recent order history, payment status/attempt/refund summaries, return/cancellation history, and permission-gated cases and addresses.

Financial metrics follow Phase 14.8 semantics:
- paid payments: SUCCEEDED, REFUNDED, PARTIALLY_REFUNDED
- gross purchase value: paid Order.total
- refund value: successful PaymentRefund amounts
- net purchase value: gross less successful refunds
- AOV: gross / paid orders, with null when the denominator is zero

No raw provider payloads, payment credentials or authentication data are exposed.

## Mutations
Only supported profile/status operations are exposed. Profile mutation is limited to displayName. Email changes are deferred because the current authentication architecture has no dedicated secure administrator email-change/verification workflow.

Supported account transitions are ACTIVE ↔ DISABLED/SUSPENDED. Pending verification remains owned by the verification workflow. Customer session resolution already requires ACTIVE status, so disabled/suspended accounts cannot continue normal authenticated access without creating a parallel session mechanism.

Profile/status writes use the canonical Customer application service and optimistic concurrency based on the authoritative updatedAt value. Privileged changes require an audit record.

## RBAC
Granular permissions added:
- customers.read
- customers.search
- customers.update
- customers.status.manage
- customers.address.read
- customers.financial.read
- customers.case.read
- customers.case.create
- customers.audit.read

SUPER_ADMIN and ADMIN receive the full customer-management surface. OPERATIONS receive basic customer/search/case visibility and case creation. VIEWER receives basic customer/search visibility.

## Privacy
Admin customer APIs are private/no-store. Authentication secrets, password hashes, session tokens, reset tokens, OAuth secrets, provider credentials and raw payment/provider payloads are excluded. Address, financial and case data are independently permission-gated. Sensitive customer-detail access and privileged mutations use the existing AdminAuditLog.

## Concurrency/idempotency
Profile and status changes compare the loaded updatedAt value inside a serializable Customer application transaction. A stale administrator receives a conflict rather than overwriting newer state. Status changes are naturally idempotent when the requested state already matches the current state.

## Performance
Customer list aggregation is performed in one bounded PostgreSQL query with database-side aggregates and window-count pagination. Detail relation loads are bounded to recent records. No unbounded customer-specific relation graph or cache is used.

## Database changes
Migration 20261003060000_admin_customer_permissions adds only the required AdminPermission rows and role grants. No Customer data or domain schema is rewritten.

## API
- GET /api/admin/customers
- GET /api/admin/customers/[customerId]
- PATCH /api/admin/customers/[customerId]/profile
- POST /api/admin/customers/[customerId]/status

All routes are server-authorized, validated, bounded and return canonical DTO-shaped responses. No export endpoint is introduced.

## UI
- /admin/customers — search/filter/sort/pagination
- /admin/customers/[customerId] — identity, metrics, orders, payments, returns/cancellations, restricted cases/addresses, profile/status controls

Loading/error/forbidden behavior uses the existing Next.js/admin boundaries; mutations expose pending and result states. The UI does not enforce authorization by itself.

## Deferred
- Administrator email change and verification workflow
- Customer export
- Marketing segmentation/campaigns
- Customer tags or free-form customer notes outside the Case domain
- Destructive deletion/anonymization without a canonical application workflow
- Loyalty/rewards
