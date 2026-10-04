# Phase 15.31 — Production Platform Evolution, Architectural Governance & Controlled System Modernization

## Purpose
Phase 15.31 establishes a provider-neutral architecture-evolution registry. It governs modernization from evidence through assessment, proposal, architecture decision, rehearsal, migration, validation and certification without authorizing an application rewrite.

## Architecture inventory
The registry is the governance layer for architecture inventory and evolution records. Existing commerce domains remain authoritative: 4HRS+ owns commerce; Qikink remains fulfillment-only. No second catalog, payment, order, shipping or fulfillment implementation is introduced.

## Lifecycle and ADR governance
IDENTIFIED → ASSESSED → PROPOSED → ARCHITECTURE_REVIEW → APPROVED → REHEARSAL → MIGRATING → VALIDATING → CERTIFIED. REJECTED, DEFERRED, ROLLED_BACK and ABANDONED are terminal alternatives. Transitions use compare-and-set semantics and create audit records. Material proposals support options, decision criteria, tradeoffs, rejected alternatives, risks, approvals and immutable decision versions.

## Evidence and assessment
Evidence stores source references, environment, observation time, redacted metrics and an integrity hash. A proposal requires a concrete problem and measurable success criteria. Assessment methodology is versioned as 15.31-v1.

## Migration and data safety
Supported strategies are IN_PLACE, EXPAND_CONTRACT, STRANGLER, DUAL_READ, DUAL_WRITE, SHADOW, FEATURE_FLAG, BLUE_GREEN, CANARY and PHASED_ROLLOUT. DUAL_WRITE is blocked by the baseline safety validator until explicit consistency and reconciliation governance is supplied. Database evolution continues through existing Prisma migration governance.

## Domain, provider and drift governance
The registry records domain-boundary violations, cross-domain imports, direct database access, provider leakage, undocumented APIs/events, stale flags and missing ownership/observability as governed findings. Findings do not trigger automatic restructuring. Qikink-specific types remain behind provider-neutral interfaces and Qikink catalog ownership is not introduced.

## Rehearsal, resilience and observability
High-risk proposals retain references to Phase 15.29 digital-twin rehearsal and Phase 15.28 resilience validation. Certification records readiness only when rollback, observability, reconciliation, digital-twin and resilience inputs are supplied. The framework never fabricates execution evidence.

## Automation safety
Automation is limited to analysis, evidence gathering, validation, simulation, diagnostics and safe reversible operations. Payment/order mutation, destructive database work, customer-data deletion, provider credential changes, security-policy weakening and production architecture rewrites are blocked.

## Admin control plane
The admin architecture page and API expose evolution inventory, proposals, decisions, migrations, validation, drift, roadmap and certification state. Mutations require dedicated RBAC permissions and trusted admin requests.

## Testing and CI
Phase-specific tests cover lifecycle, category/risk validation, migration guardrails, assessment requirements, automation safety and drift integrity. The architecture:validate command is a deterministic safety check. Repository lint, typecheck, test, build, Prisma validation, migration validation and existing governance audits remain mandatory.

## Known limitations and rollback
The phase does not claim every repository hotspot is a defect; findings must be evidence-backed. It does not execute production migrations, provider changes or failure injection. Digital-twin, resilience, reconciliation and operational evidence must come from governed systems. Irreversible migrations require documented forward recovery rather than a false rollback promise.

## Certification
The registry can record READY_WITH_DOCUMENTED_LIMITATIONS only when required readiness inputs are supplied; missing digital-twin, resilience or reconciliation evidence blocks certification. Phase 15.32 must not begin under this phase.
