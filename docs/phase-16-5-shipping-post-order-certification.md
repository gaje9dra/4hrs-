# Phase 16.5 — Shipping and Post-Order Certification

## Objective and scope
Production certification of the canonical path: Fulfillment → Shipping eligibility → Shipment → Tracking → Delivery → Cancellation/Return → Refund boundary → Reconciliation → Customer/Admin operations.

## Shipping architecture
The canonical implementation is in `lib/shipping/application.ts`, with lifecycle rules in `lib/shipping/domain.ts`, persistence in `lib/shipping/repository.ts`, contracts in `lib/shipping/contracts.ts`, and provider resolution in `lib/shipping/resolver.ts`. No second shipping or tracking engine is introduced.

## Provider capability matrix
| Provider | Shipment creation | Tracking lookup | Webhooks | Result |
|---|---|---|---|---|
| Qikink | Unsupported | Unsupported | Unsupported | PASS — capability is not fabricated |

Qikink remains fulfillment-only until an independently verified shipping contract exists.

## Shipment and tracking certification
Shipment eligibility validates fulfillment status, order/fulfillment ownership, provider reference and historical shipping address. Creation is protected by durable idempotency, database uniqueness and serializable transactions. Tracking validates provider identity, status, timestamp and bounded metadata; duplicate/stale/out-of-order events are not allowed to regress authoritative state. Terminal delivery/return states are protected.

## Delivery, cancellation and returns
Delivery is server-authoritative. Customer cancellation/return flows use the existing Returns domain and its lifecycle transitions. Customer access is object-scoped to the authenticated customer.

## Refund boundary
Returns does not become the financial authority. Non-rejected refund/replacement/store-credit resolutions currently stop at `REFUND_UNAVAILABLE`; financial execution remains a future payment-domain integration rather than an invented shipping capability.

## Admin operations
Admin shipping routes require shipping RBAC. Sensitive provider/tracking/address fields are permission-gated. Admin mutations use the canonical Shipping application rather than direct shipment/tracking persistence.

## Webhooks and polling
No Qikink webhook or tracking polling is enabled because the verified provider contract does not support those operations. This is an operational limitation, not a fabricated success.

## Reconciliation and recovery
The application explicitly distinguishes `PROVIDER_UNSUPPORTED` from `RECONCILIATION_REQUIRED`. Recovery requests are authorization-gated and idempotent. Unknown provider state is not silently treated as delivered or successful.

## Security, privacy and observability
Controls include customer object authorization, admin RBAC, provider isolation, idempotency, serializable transactions, state validation, sensitive-field gating, structured correlation IDs and safe operational observations. Provider/payment secrets are not accepted as client-controlled shipping state.

## Failure injection and testing
Phase-specific tests validate provider capability truth, tracking state integrity, customer authorization, admin mutation boundaries, and refund separation. CI uses deterministic tests and does not require live provider credentials or uncontrolled shipments.

## Production readiness matrix
| Area | Status |
|---|---|
| Shipping architecture | PASS |
| Provider capability truth | PASS |
| Shipment eligibility/idempotency | PASS |
| Tracking/delivery integrity | PASS |
| Customer authorization | PASS |
| Admin/RBAC | PASS |
| Cancellation/returns | PASS |
| Refund execution | NOT APPLICABLE — payment-domain boundary |
| Qikink shipment/tracking/webhooks | NOT APPLICABLE — unsupported contract |
| Reconciliation | PASS |
| Concurrency/retries | PASS |
| Security/privacy | PASS |
| Observability/audit | PASS |
| Database integrity | PASS |
| CI/deployment safety | PASS |

## Final certification gate
`scripts/phase-16-5-shipping-post-order-certification.ts` emits PASS/FAIL/BLOCKED findings. READY FOR PHASE 16.6 is permitted only with zero CRITICAL, HIGH or BLOCKED findings.