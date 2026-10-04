# Phase 15.37 — Production Deployment Orchestration

## Architecture
Phase 15.37 adds a provider-neutral coordination layer over the authoritative ChangeRequest, Release and Deployment objects. It does not create parallel commerce or provider ownership.

Flow: Change → Release → Deployment → Pipeline → Stage Graph → Validation → Certification.

## Safety
Only registered operations are accepted. The orchestration API requires RBAC and idempotency keys for mutations. Browser input is revalidated server-side. There is no arbitrary shell, SQL, infrastructure command, provider command, Qikink catalog operation, payment mutation, order mutation, or customer-data mutation.

## Pipeline and run model
DeliveryPipeline is versioned and links the exact change, release and deployment IDs. DeliveryRevision captures the definition hash. DeliveryRun provides bounded execution identity and concurrency protection. DeliveryStage stores prerequisites, dependencies, operation, timeout, retry, health-gate, failure and recovery policies.

## Preflight
Preflight checks authoritative change/release/deployment state, immutable artifact integrity, environment readiness, active freeze, rollback declaration, bounded target, graph acyclicity, unknown dependency policy, capacity policy, reconciliation policy, digital-twin reference and Qikink fulfillment-only boundaries. Results are deterministic and evidence-backed.

## Stage graph and dependency ordering
Stages are directed by explicit prerequisites. Cycles and unknown prerequisites are rejected. Parallelism is opt-in and only safe when dependency/resource boundaries permit it; otherwise stages remain sequential.

## Environment promotion and artifact consistency
Promotion remains governed by the existing release/deployment records. Artifact identity remains authoritative in Deployment. A pipeline cannot invent an artifact or deployment target.

## Migrations and sensitive domains
Migration, payment, fulfillment, shipping, feature-flag and provider stages are represented as governed registered operations and policies; this phase does not execute destructive migrations or mutate payment/order/provider truth.

## Progressive delivery
Phase 15.37 coordinates the existing Phase 15.35 progressive-delivery subsystem rather than duplicating rollout exposure logic.

## Incident, freeze and health controls
Preflight is repeatable, and blocking gates produce evidence. Pause/abort/rollback/forward-recovery are explicit lifecycle transitions. Existing deployment freeze and incident controls remain authoritative.

## Recovery
Recovery classification is explicit. Rollback is only eligible when policy proves ROLLBACK_SAFE; otherwise forward/manual recovery is required. No automatic rollback is selected merely because execution failed.

## Certification and evidence
Completion is distinct from production certification. Evidence is immutable, hashed and linked to pipeline/run/stage. Certification requires authoritative lineage and blocking-state checks; live production execution evidence is not fabricated.

## APIs and admin surface
/api/admin/delivery-orchestration supports create, preflight, schedule, start, registered stage execution, pause, abort, rollback, forward recovery, validation, certification and invalidation. /admin/delivery-orchestration provides operational visibility.

## Background execution
The domain is durable through database state, unique idempotency keys, bounded stage retries and explicit terminal states. A future worker can invoke the same registered operations without introducing arbitrary execution.

## Knowledge graph / digital twin / reconciliation
The pipeline stores references and evidence for these authoritative systems and blocks unknown dependency assumptions. It does not duplicate their domain models.

## Limitations
No live infrastructure adapter, real production metric feed, external deployment credential, Qikink mutation, payment mutation, or customer cohort targeting is implemented. Therefore no live production certification is claimed solely from this phase's control-plane implementation.
