# Phase 13.9 — Post-Order Operations, Customer Case Management & Exception Resolution

## Architecture
The Case domain coordinates human intervention around existing Order, Payment, Fulfillment, Shipping, Returns, and Cancellation objects. It does not own their lifecycle state and does not directly mutate their tables to force resolution.

## Case lifecycle
`OPEN → TRIAGED → ASSIGNED → IN_PROGRESS → WAITING → RESOLVED → CLOSED`.

Transitions are explicit and validated. Closure requires the case to already be resolved. Optimistic version checks plus serializable transactions protect concurrent assignment, priority, transition, note, resolution, and closure operations.

## Categories and priority
Controlled categories cover order, payment, fulfillment, shipping, delivery, tracking, cancellation review, return review/inspection, refund issues, provider/reconciliation exceptions, and customer support. Priority is `LOW | NORMAL | HIGH | URGENT` and is assigned only by authorized operations.

## Customer vs internal visibility
Customer APIs expose only customer-safe status, description, and related references. Internal priority, source, assignment, correlation data, resolution metadata, and internal notes are excluded from customer DTOs. Customer cases are ownership-scoped.

## Internal notes and audit
Internal notes are append-only through the application boundary and require an authorized admin. Case assignments and important lifecycle actions are persisted in dedicated audit/assignment records.

## Domain action boundaries
Case resolution delegates to the authoritative domain service:
- Return decisions → Returns application service.
- Cancellation decisions → Returns/Cancellation application service.
- Shipment reconciliation → Shipping application service.
- Fulfillment reconciliation → Fulfillment application service.
- Refund execution is rejected at this boundary until a Payment refund application service exists.

The Case domain never calls Qikink and never exposes provider credentials or undocumented provider capabilities.

## Automated exception boundary
System-generated cases require both a source reference and deterministic deduplication key. Duplicate events return the existing case instead of creating case storms. The application exposes this provider-neutral boundary for existing reconciliation/exception producers; transient retryable failures should not be converted into cases automatically.

## APIs
Customer:
- `GET/POST /api/cases`
- `GET /api/cases/[caseReference]`

Operations:
- `GET /api/admin/cases`
- `GET /api/admin/cases/[caseReference]`
- explicit assign, note, priority, transition, resolve, and close endpoints.

All endpoints are private/no-store, authenticated where required, input-bounded, and authorization-aware.

## Database
Migration `20261002223000_post_order_cases` adds Case, CaseNote, CaseAssignment, and CaseAuditEvent with foreign keys, indexes, controlled enums, deduplication uniqueness, and optimistic versioning. No destructive migration or backfill is required.

## UI
Customer support case list, creation, and detail pages were added under the existing account architecture. The existing admin area now has a minimal case listing; this phase does not build a complete admin dashboard.

## Security
No customer can assign cases, change internal priority, add internal notes, invoke admin actions, or access another customer's case. Operational actions require the existing admin authorization boundary. Financial values are never accepted from case payloads.

## Testing
Added case lifecycle/taxonomy tests. Full repository CI remains the final gate for Prisma generation/migration validation, typecheck, tests, lint, and production build.

## Known limitations
- Historical note: Phase 13.9 used the then-existing `ADMIN_EMAILS` boundary. Phase 14.1 supersedes that administrative authorization with explicit AdminUser authority and centralized RBAC; the Case domain now consumes that foundation.
- Payment refund execution is still owned by Payment and is not implemented by Cases.
- No additional shipping or fulfillment provider is introduced.
- Qikink remains fulfillment-only.
