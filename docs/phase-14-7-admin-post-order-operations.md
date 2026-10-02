# Phase 14.7 — Admin Post-Order Operations

## Scope

Phase 14.7 adds a protected administrative control plane over the existing Cancellation, Return, Return Shipment and Customer Case domains.

Canonical flow remains:

Customer → Order → Fulfillment → Shipment → Return / Cancellation → Customer Case / Exception → Resolution

Admin is an operational interface. It does not introduce replacement Order, Payment, Fulfillment, Shipping, Return, Cancellation or Case state machines.

## Cancellation architecture

Cancellation requests remain owned by `lib/returns/application.ts` and the canonical Cancellation lifecycle. Admin cancellation review invokes `reviewCancellation()`; Admin does not write CancellationRequest rows directly.

The current repository does not expose a separate canonical cancellation-execution operation. Phase 14.7 therefore does not invent one and does not expose `cancellation.execute` as an operational action.

Eligibility is calculated server-side using the existing `cancellationEligibility()` domain rule. The Admin detail view shows the result and the persisted cancellation/domain audit history.

## Return architecture

Return requests remain owned by `lib/returns/application.ts`. Admin review, inspection and supported rejected-resolution operations invoke the canonical Return application service.

The current Return application explicitly stops financial/refund, replacement and store-credit resolutions at `REFUND_UNAVAILABLE`. Phase 14.7 does not bypass that boundary or create a direct refund path. Refunds remain owned by Payment.

Return item quantities, inspection quantities and lifecycle transitions are validated by the canonical Return domain.

## Return Shipment architecture

Outbound Shipment and Return Shipment remain distinct. Admin Return detail displays the existing Return Shipment relationship and sensitive tracking data is permission-gated.

The repository does not expose a provider-neutral Shipping application operation for Return Shipment creation/update. Phase 14.7 therefore does not invent a Return Shipment provider API or a second shipment state machine.

## Customer Case architecture

Cases remain owned by `lib/cases/application.ts`. Admin case creation, assignment, notes, transitions, resolution and closure continue through that application layer.

Internal notes are represented by CaseNote and are excluded from customer DTOs. Customer-visible communication is not invented because the repository has no complete authorized customer-message operation; the phase documents that limitation rather than introducing a replacement support system.

Case mutations use optimistic version checks, Serializable transactions and replay keys carried through CaseAuditEvent correlation IDs.

## Permissions

Granular permissions added for post-order operations include:

- cancellation.read
- cancellation.approve
- cancellation.execute (taxonomy only; no unsupported execution operation is exposed)
- cancellation.audit.read
- return.read
- return.review
- return.approve
- return.reject
- return.inspect
- return.resolve
- return.shipment.manage
- return.refund (taxonomy only; no unsupported refund shortcut is exposed)
- return.audit.read
- case.read
- case.create
- case.update
- case.assign
- case.respond (taxonomy only; no unsupported messaging shortcut is exposed)
- case.resolve
- case.reopen (taxonomy only where no reopen domain operation exists)
- case.audit.read

High-risk return resolution, return shipment and case resolution permissions are separated from read/review access. Existing legacy permissions remain for compatibility with earlier phases.

## Admin API

New protected endpoints:

- GET /api/admin/cancellations
- GET /api/admin/cancellations/:reference
- POST /api/admin/cancellations/:reference
- GET /api/admin/returns
- GET /api/admin/returns/:reference
- POST /api/admin/returns/:reference

Case endpoints from the existing Case domain were hardened to use granular permissions and replay keys.

All mutating Admin endpoints require same-origin validation, server-side RBAC, bounded JSON, operational reasons where applicable and an Idempotency-Key.

## Idempotency and concurrency

Cancellation and Return mutations propagate the Admin Idempotency-Key into canonical CommerceExceptionAuditEvent correlation IDs and use Serializable transactions. Case mutations use CaseAuditEvent correlation IDs plus optimistic version checks.

Payment refunds continue to use the existing Payment idempotency infrastructure. Phase 14.7 does not create a second payment/refund implementation.

Concurrent operations therefore rely on canonical lifecycle transitions, transaction isolation, expected-version checks and replay-key detection rather than UI button state.

## Audit

Privileged Admin mutations are recorded in the centralized AdminAuditLog where the Admin control plane performs the operation. Domain-specific CommerceExceptionAuditEvent and CaseAuditEvent records remain the authoritative domain histories.

Audit metadata is passed through the existing sanitizer. Passwords, tokens, credentials and payment/provider secrets are not logged.

## Security

- Server-side RBAC is enforced independently of UI visibility.
- Resource references are resolved server-side.
- Customer email/display information is permission-gated by customers.read.
- Return/cancellation/payment/shipment state is read from canonical persistence.
- No Admin route directly mutates CancellationRequest, ReturnRequest, ReturnItem, ReturnShipment, ReturnInspection or ReturnResolution.
- No direct Payment refund is created by Admin post-order code.
- Internal CaseNote data remains absent from customer DTOs.
- Same-origin checks protect state-changing Admin requests.
- Idempotency keys protect replay-sensitive mutations.
- No Qikink/provider calls are made from the browser or Admin post-order layer.

## UI

The Admin navigation now exposes Cancellations and Returns alongside the existing Cases workspace. Lists are bounded and searchable with validated date/status filters. Detail views show operational relationships, eligibility, domain timelines and permission-aware actions using the existing Bauhaus visual language.

## Database

No new canonical commerce tables were created. One migration adds the granular Admin permission records and role assignments:

`prisma/migrations/20261003040000_admin_post_order_permissions/migration.sql`

No historical cancellation, return, shipment or case records are rewritten.

## Testing

Added `tests/admin-post-order-operations.test.ts` covering:

- bounded/whitelisted query validation
- date-range validation
- no direct canonical persistence mutation in Admin APIs
- canonical Return application usage
- granular permission taxonomy
- unsupported refund boundary
- customer/internal case DTO separation
- case replay-key propagation

The complete existing test suite remains mandatory.

## Known limitations

1. There is no separate canonical cancellation execution operation, so Admin only reviews cancellation requests.
2. The existing Return domain does not implement refund/replacement/store-credit resolution; Admin does not invent one.
3. The current repository has no provider-neutral Return Shipment mutation service in Shipping, so Admin does not invent provider operations.
4. There is no complete customer-visible Case message service for Admin responses; internal notes remain separate.
5. Existing process-local Admin rate limiting remains the distributed-deployment limitation documented by Phase 14.1.
