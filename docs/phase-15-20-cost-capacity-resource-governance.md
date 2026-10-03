# Phase 15.20 — Cost, Capacity, Resource Governance & Financial-Operational Efficiency

## Objective
Provide provider-neutral operational visibility into production resource consumption, capacity constraints, workload anomalies and cost signals without becoming an accounting, billing, ERP or commerce-financial system.

## Resource inventory
The implementation records only dependencies supported by the repository architecture:
- PostgreSQL — canonical persistence.
- Netlify — application hosting/deployment runtime.
- GitHub Actions — CI/CD workloads.
- Qikink — fulfillment-only provider integration.
- Payment provider — PayU payment-processing dependency.
- Internal analytics, search and notification subsystems.

Provider pricing, quota and hard capacity values are UNKNOWN unless authoritative billing/configuration evidence is available. The system never fabricates provider invoices.

## Cost semantics
Every resource metric is classified as ACTUAL, ESTIMATED, ALLOCATED, PROJECTED or UNKNOWN.
- ACTUAL — measured with authoritative provider billing data.
- ESTIMATED — measured operational usage without authoritative billing.
- ALLOCATED — deterministic shared-resource allocation.
- PROJECTED — explicitly modeled future consumption.
- UNKNOWN — insufficient evidence.
Operational cost signals never mutate product prices, payments, refunds, orders, settlements or customer-visible financial truth.

## Capacity architecture
Capacity limits are explicit records with hard/soft classification, threshold and unit, severity, owner, runbook, action and escalation path. Unknown provider limits remain unknown. Capacity evaluation is bounded to configured limits and does not apply arbitrary guessed ceilings.

## Resource telemetry
Metrics are bounded by resource/service dimensions, metric key and unit, timestamp, optional correlation ID and sanitized metadata. Secrets, authentication material and customer PII are removed from metric metadata.

## Anomaly detection
Anomalies are available only where sufficient historical measurements exist. The implementation compares a current observation with the available historical baseline and records deviation. It does not infer monetary cost from resource volume.

## Governance integration
Cost/capacity operations use the existing admin RBAC and audit log. They do not create a second governance system. The Phase 15.19 governance subsystem remains authoritative for control evidence, verification and exceptions.

## Financial-data boundary
Commerce financial truth remains owned by the existing Payment/Order domains: product price, discount, tax, payment amount, refund, order total and settlement. Operational signals cover infrastructure usage, provider API consumption, storage, bandwidth, compute and estimated operational expense. No ambiguous profit or margin field is introduced.

## Qikink boundary
Qikink remains fulfillment infrastructure only. No provider catalog is imported, browsed or exposed as customer-facing product data, and provider credentials are never exposed through this subsystem.

## Admin API
The /api/admin/cost-capacity endpoint provides RBAC-protected operational reporting and bounded metric recording/evaluation. Arbitrary runtime infrastructure configuration is not exposed.
Required permissions: cost_capacity.read, cost_capacity.manage, cost_capacity.export.
All privileged operations are audited.

## Database
The schema adds resource inventory, resource metrics, capacity limits and anomaly records. Indexes are scoped to operational access patterns. The migration is additive and does not delete or rewrite production commerce data.

## Retention and privacy
Operational telemetry is intentionally separate from customer tracking. High-volume telemetry should be retained according to the existing Phase 15.6 lifecycle policy; this phase does not create an indefinite raw-event retention requirement.

## Known unknowns
The repository alone cannot establish provider invoice amounts, provider-specific billing tiers, production database backup pricing, provider contractual quotas, externally configured infrastructure ceilings or actual production traffic baselines before sufficient telemetry exists. These remain UNKNOWN.

## Operational runbooks
Capacity alerts identify an owner, action and escalation path. When a hard provider limit is externally controlled and not available in repository evidence, operators must attach authoritative provider evidence before promoting it from UNKNOWN to a governed limit.

## Quality gate
The implementation must pass Prisma validation/generation, migration validation, lint, typecheck, unit/integration tests, build and relevant governance/security regression tests. No test, assertion or Prisma validation is disabled to achieve a green build.