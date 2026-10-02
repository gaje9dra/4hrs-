# Phase 14.6 — Admin Shipping Operations, Shipment Control & Tracking Management

## Shipping architecture
The existing Shipping domain remains the canonical authority for:
- Shipment lifecycle and status transitions
- Shipment creation from eligible Fulfillment
- Tracking-event normalization and ingestion
- Tracking-event deduplication
- Out-of-order event handling
- Shipment reconciliation
- Shipping-provider interaction

Admin is an operational control plane over that architecture. It does not create a second Shipment or Tracking state machine.

Canonical flow:

Catalog → Cart → Checkout → Payment → Order → Fulfillment → Shipment → Tracking → Customer

## Admin boundary
Admin Shipping provides:
- bounded Shipment listing
- Shipment detail
- tracking timeline visibility
- controlled Shipment creation from an eligible Fulfillment
- supported reconciliation visibility/action
- operational recovery/reconciliation requests
- audit visibility

Admin never directly mutates Shipment or TrackingEvent records.

All mutations invoke createShippingApplication() and the existing canonical Shipping service.

## Permissions
Phase 14.6 uses the centralized Phase 14.1 RBAC system:
- shipping.read
- shipping.view_sensitive
- shipping.create
- shipping.reconcile
- shipping.recovery
- shipping.tracking.read
- shipping.audit.read
- existing shipping.manage remains for compatibility

High-risk Shipping operations are not granted merely because a user can view the Admin UI.

## Shipment listing
The listing is server-side and bounded:
- pagination is capped at 100
- deterministic sorting is whitelisted
- status/provider/carrier filters are validated
- reconciliation filtering is supported
- date ranges are validated
- search covers Shipment/order/customer identity
- provider reference/tracking-number search is sensitive-permission gated

The UI never loads the full Shipment table.

## Shipment detail
The detail view exposes canonical:
- Shipment identity and lifecycle status
- Order/customer relationship
- Fulfillment relationship
- provider identity
- carrier/service
- tracking timeline
- reconciliation state
- Return Shipment separation
- related Cases
- administrative audit history

Sensitive provider references, tracking numbers, tracking URLs and full shipping address data are permission-gated.

## Shipment creation
Admin creation calls the canonical createShipmentFromFulfillment() application service.

The existing Shipping domain validates:
- Fulfillment existence
- Order/Fulfillment ownership
- eligible Fulfillment status
- trusted provider reference
- historical shipping-address availability
- Shipment idempotency
- concurrent creation races

Admin cannot manufacture a Shipment record directly.

Shipment creation is a domain handoff, not an undocumented provider API call.

## Tracking management
Tracking events are read-only from the Admin interface.

Admin does not:
- insert fake TrackingEvents
- edit TrackingEvents
- manually mark a Shipment delivered
- invent AWBs
- invent tracking numbers
- bypass provider normalization

Existing Shipping logic continues to:
- deduplicate provider events
- preserve historical events
- treat out-of-order events as history-only where appropriate
- protect terminal Shipment states
- transition Shipment state only through the canonical domain rules

## Reconciliation
Admin can invoke the existing reconcileShipment() operation where supported.

The current implementation intentionally reports the provider as unsupported when a verified machine-to-machine tracking/status capability is unavailable.

The current Qikink adapter explicitly declares:
- createShipment: false
- trackingLookup: false
- webhooks: false

Therefore this phase does not invent a Qikink shipping API, webhook, polling endpoint, AWB creation endpoint, or tracking endpoint.

If a Shipment lacks a provider reference, the canonical Shipping service can mark it as requiring reconciliation. This is not an artificial provider status update.

## Retry
A provider retry operation is not exposed because the current Shipping provider abstraction does not provide a verified, canonical retry operation.

The phase therefore does not invent retry semantics.

Operational recovery is exposed only through the existing requestShipmentReconciliation() service, with:
- centralized RBAC
- operator identity
- required reason
- idempotency key
- Serializable transaction
- audit logging

## Tracking deduplication and ordering
Existing Shipping persistence remains responsible for deduplication using the canonical Shipment/provider/deduplication key.

Tracking events remain immutable records.

Existing application logic preserves:
- duplicate detection
- historical/out-of-order events
- valid forward Shipment transitions
- terminal-state protection
- concurrency checks

No Admin duplicate tracking mechanism was introduced.

## Return Shipments
ReturnShipment is displayed separately from outbound Shipment.

Admin Shipping does not mutate Return Shipment state. Return and cancellation workflows remain owned by their existing domains.

## Provider boundary
Qikink remains behind the provider-neutral Shipping/Fulfillment architecture.

Admin never calls Qikink directly.
Browser code never receives provider credentials.
Raw provider responses are not returned by Admin APIs.

No undocumented Qikink shipping capability is claimed.

## Idempotency and concurrency
Shipment creation uses the existing creationIdempotencyKey.

Operational recovery uses the existing ShipmentRecoveryAction.idempotencyKey.

Canonical Shipping creation and tracking processing already use Serializable transactions and expected-state checks.

Admin UI button disabling is not treated as a security boundary.

## Audit
Privileged Admin Shipping create, reconcile and recovery operations write centralized AdminAuditLog records with:
- actor
- resource
- success/failure
- operational reason
- correlation ID
- safe normalized metadata

The existing audit sanitizer prevents credential-like metadata from being persisted.

## Database changes
Added migration:
- 20261003030000_admin_shipping_permissions

No Shipment or Tracking schema changes were required because the existing Shipping persistence already provides the required idempotency, deduplication, reconciliation and recovery structures.

## Tests
Added:
- tests/admin-shipping-operations.test.ts

Coverage includes:
- bounded/whitelisted list queries
- date validation
- no direct Admin Shipment/Tracking persistence mutations
- canonical Shipping service usage
- sensitive-field permission gating
- no fabricated tracking/status behavior
- Qikink capability boundary verification

The existing Shipping tests remain part of the mandatory CI suite.

## Known limitations
1. The current Qikink Shipping adapter has no verified machine-to-machine Shipment creation, tracking lookup or webhook capability in the repository contract.
2. Consequently, Admin does not fabricate Qikink shipment creation, tracking polling, webhook ingestion or reconciliation.
3. No generic provider retry operation exists in the current Shipping application contract; Admin therefore exposes recovery/reconciliation rather than a fake retry.
4. Distributed rate limiting remains the process-local limitation documented by Phase 14.1.

## Verification
Required:
- npm run lint
- npm run typecheck
- npm test
- npm run build
- Prisma validation/generation
- migration/test verification
- full GitHub CI

No CI check may be weakened or suppressed.
