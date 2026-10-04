# Phase 15.38 — Production Continuous Delivery Intelligence, Dependency-Aware Promotion & Verified Delivery Governance

## Objective

Phase 15.38 adds a deterministic governance layer above the existing Phase 15.34–15.37 change, release, deployment-control, and delivery-orchestration architecture. It evaluates evidence, dependency health, risk, gates, approvals, locks, promotion windows, and certification without executing arbitrary infrastructure operations.

## Architecture

The implementation reuses the existing DeliveryPipeline, DeliveryRun, DeliveryGate, DeliveryEvidence, DeliveryApproval, DeliveryLock, and PlatformGraph infrastructure. It does not create a second deployment or release engine.

New persisted records: DeliveryIntelligenceSnapshot, PromotionAssessment, PromotionGateResult, DependencyHealthAssessment, DeliveryRiskAssessment, PromotionWindow, DeliveryPolicy, DeliveryCertification.

Existing DeliveryDecision was extended with optional delivery-run, decision-status, dependency, health, evidence-reference, affected-delivery, and previous-decision fields so historical decisions remain compatible.

## Deterministic promotion engine

evaluatePromotion() accepts an explicit evaluation timestamp, policy version, evidence version, dependencies, health signals, artifact identity, incident state, migration risk, payment/fulfillment/shipping impact, feature flags, simulation/resilience evidence, locks, and promotion-window state.

The same inputs produce the same deterministic SHA-256 input hash. Hard safety failures remain authoritative. Confidence never overrides a blocking gate.

UNKNOWN and expired required evidence cannot silently become PASS.

## Evidence freshness

Evidence records are evaluated against the explicit evaluatedAt timestamp. Expired evidence produces an EVIDENCE_FRESHNESS failure and blocks promotion. Promotion assessments and certifications have explicit expiry timestamps. Certification is rejected when its assessment is stale.

## Dependency-aware promotion

Dependency health is evaluated by class and severity. Critical unknown or unhealthy dependencies block promotion. Warning-level degradation can remain advisory.

The service consumes the existing Phase 15.32 platform knowledge graph through collectGraphImpact() and does not create a second graph implementation.

## Safety boundaries

The implementation contains no arbitrary shell, SQL, dynamic-code, provider-execution, or infrastructure-execution path.

Qikink remains fulfillment-only. Phase 15.38 performs health/evidence evaluation only and never creates provider orders.

Payment changes require additional validation and explicit approval requirements. Database destructive changes require approval and migration validation. Shipping and fulfillment degradation can block their respective delivery paths.

## Locks and concurrency

acquireDeliveryLock() uses the existing DeliveryLock uniqueness boundary for active scopes. Lock ownership is verified on release. Lock conflicts fail closed.

## Certification and invalidation

A delivery can be certified only when a non-expired assessment permits certification. Certifications contain policy and evidence references and explicit expiry.

Assessment invalidation changes the assessment to a blocking state with an audit reason. Certification invalidation records the invalidation timestamp and reason.

## Admin control plane

API endpoints are exposed under /api/admin/delivery/intelligence for assessment listing/detail, evaluation, invalidation, certification, certification invalidation, and lock acquisition/release.

Server-side permissions are reused from the existing admin authorization system.

Admin surface: app/admin/delivery-intelligence/page.tsx

## CI and tests

Phase-specific validation: npm run delivery-intelligence:validate

Unit coverage: tests/phase-15-38-delivery-intelligence.test.ts

The existing CI workflow now runs delivery-intelligence validation before the migration audit and test suite. The repository's normal gates remain authoritative: npm run lint, npm run typecheck, npm test, npm run build.

No CI weakening is introduced.

## Migration

Migration: prisma/migrations/20261004150000_phase_15_38_delivery_intelligence/migration.sql

The migration is additive and uses IF NOT EXISTS for newly introduced tables/indexes and optional columns on DeliveryDecision. It does not delete production data.

## Known limitations

Provider, incident, SLO, reconciliation, simulation, and capacity signals are consumed as typed evidence inputs rather than by inventing new provider APIs.

Background refresh scheduling remains behind the repository's existing job infrastructure; this phase does not introduce an unbounded polling loop.

Production completion remains dependent on repository-wide CI, migration, security, integration, E2E, failure-injection, and performance validation.

## Readiness

Phase 15.38 must not be marked READY FOR PHASE 15.39 until every required gate in the supplied Phase 15.38 specification is evidenced as passing.

## Phase 15.38 completion addendum

The completion layer closes the governance lifecycle gaps identified by the final readiness audit:
- explicit approval request/approve/hold/block/re-evaluate transitions;
- material-condition invalidation and bounded maintenance for stale assessments, approvals, locks and certifications;
- immutable-after-activation policy handling across DRAFT, REVIEW, APPROVED, ACTIVE, DEPRECATED and RETIRED states;
- structured governance-event audit records with actor, state transition, reason, policy and evidence references;
- idempotent maintenance job execution with bounded batches;
- privacy and cost/capacity promotion gates;
- completion validation plus security, failure-injection and performance-oriented automated tests.

The maintenance job is `npm run delivery-intelligence:maintenance`; CI enforces `delivery-intelligence:completion:validate` and the Phase 15.38 governance completion test suite. The job performs only typed database governance updates and does not execute infrastructure/provider commands.
