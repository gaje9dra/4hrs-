# Phase 15.33 — Production System Simulation, Dependency Simulation & Change-Impact Certification

## Architecture
Phase 15.33 extends the Phase 15.29 Digital Twin/rehearsal capabilities and consumes Phase 15.32 as the single authoritative dependency graph. It does not create a second graph, workflow engine, resilience engine, governance engine, or reconciliation engine.

## Execution modes and safety
Supported modes are SIMULATION, STAGING, SYNTHETIC_PRODUCTION, and CONTROLLED_PRODUCTION. The engine is side-effect-free at its execution boundary: it cannot create real payments, orders, fulfillment requests, shipments, mutate customer records, or call providers. Controlled-production mode requires explicit approval and commerce side-effect simulation remains prohibited.

## Scenario lifecycle
DRAFT → REVIEW_REQUIRED → APPROVED → READY → RUNNING → ASSERTING → COMPLETED → CERTIFIED. Terminal and failure states are explicit and arbitrary status updates are rejected.

## Snapshots and repeatability
Each run is bound to an immutable snapshot containing code, schema, configuration, feature flags, graph version, architecture version, scenario version, environment, fixture version, and optional random seed.

## Synthetic data
Simulation records are explicitly marked synthetic-only. No production credentials or customer secrets are copied into simulation state. Sensitive metadata is redacted before persistence.

## Provider, payment, order, fulfillment and shipping simulation
Provider-neutral simulation is represented as scenario assertions and outcomes. Qikink remains fulfillment-only. No live provider call is performed. Payment/order/fulfillment/shipping simulations are declarative and isolated.

## Database/API/event/failure simulation
Scenario types cover database, API, event, job, queue, cache, search, notification, provider, deployment, feature flag, capacity, security and architecture changes. Failure definitions record target, scope, expected behavior, abort conditions and recovery expectation.

## Change impact
Impact assessments resolve declared dependencies against Phase 15.32 graph nodes. Missing graph dependencies remain UNKNOWN rather than being fabricated. Results persist affected domains, APIs, tables, workflows, customer journeys, providers, SLOs, governance, reconciliation, resilience and Digital Twin references.

## Assertions and certification
Assertions are persisted with expected/actual/result/severity/evidence. Certifications require passing evidence, reviewer identity, policy version, limitations and expiry. Certification freshness is recalculated as CURRENT, AGING or STALE; obsolete evidence is never silently retained.

## Limits and observability
Runs are bounded to 900 seconds, 500 steps, graph depth 5, 1,000 records, 5 retries, concurrency 10 and 10,000 resource units. Simulation evidence is separately marked and integrity-hashed.

## Governance and RBAC
Administrative actions use simulation.read/create/approve/execute/certify/abort permissions. High-risk approval is explicit and cannot be downgraded by the simulation engine.

## Known limitations
The implementation provides a safe declarative simulation/certification layer. It does not claim live production execution, real provider contract testing, statistical significance, or production evidence that was not actually collected.

## Rollback
Rollback is migration-aware: revert the Phase 15.33 migration and code commit after confirming no dependent simulation records are required. No commerce state is mutated by simulation execution.
