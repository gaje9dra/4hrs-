# Phase 15.25 — Production Operations Control Plane, Post-Go-Live Validation & Continuous Service Assurance

## Scope
This phase adds the operational layer around the certified platform. It reuses existing observability, incident response, governance, cost/capacity, dependency governance, reconciliation, synthetic monitoring and certification. It does not create duplicate monitoring, alerting, incident, feature-flag, reconciliation, audit or RBAC systems.

## Service inventory and health
The service inventory covers storefront, application/API, database, cache, search, storage, queues/background jobs, payment, notifications, analytics, fulfillment, Qikink, shipping, tracking, authentication, observability and deployment. Every record contains ownership, criticality, runtime, dependency metadata, health/readiness mechanism, failure mode, recovery, escalation and maintenance requirements.

The health model is explicit: HEALTHY, DEGRADED, FAILING, BLOCKED, MAINTENANCE, UNKNOWN and UNAVAILABLE. UNKNOWN is never treated as healthy. Dependency state propagates to dependent components.

## Existing-system integration
The control plane consumes database health, Phase 15.17 reliability incidents, Phase 15.22 reconciliation, Phase 15.23 synthetic evidence, Phase 15.19 governance, Phase 15.20 cost/capacity, the existing Qikink adapter, Prisma migration history and Phase 14.1 audit events.

## Post-deployment verification
The operations verification script performs only non-destructive reads against /api/health and /api/readiness. It requires a controlled RELEASE_BASE_URL. It never performs real payment, refund, fulfillment, SQL, customer, catalog or provider mutations.

## Safe operator controls
POST /api/admin/operations supports only bounded operations: refresh health, run the existing reconciliation engine, and trigger an existing safety-gated synthetic workflow. Every state-changing request is authenticated, RBAC-protected, reason-bound and audited. No shell/code execution, arbitrary URL fetching, SQL execution, payment transaction, provider fulfillment creation or uncontrolled mutation is exposed.

## Incident and runbook integration
Reliability incidents remain the incident source of truth. The dashboard correlates incident, synthetic, reconciliation, governance, migration, cost/capacity and audit evidence. The runbook registry covers database, payment, Qikink, fulfillment, shipping, tracking, queues, notifications, search, deployment, migration, authentication, error rate, latency, reconciliation and backup failures.

## Background jobs and drift
Where no authoritative centralized job telemetry exists, the dashboard explicitly reports UNKNOWN. Existing governance/certification systems remain responsible for configuration, dependency, schema, migration, feature-flag, provider, monitoring and RBAC drift. This phase does not auto-repair configuration or secrets.

## Qikink safety
Qikink remains fulfillment-only and server-side. The operational control plane does not import a Qikink catalog, create products, expose credentials, call undocumented APIs, fabricate tracking, bypass the provider adapter or duplicate fulfillment orders.

## Performance
Operational queries are bounded: migration history is capped at 100 rows, audit history at 25 rows, reliability incidents at 100 rows, and service inventory is static. Existing retention policies remain authoritative.

## CI gate
The phase adds architecture validation, unit coverage, the post-deployment verification script, an admin operational API/dashboard, and the service/dependency/runbook documentation. Existing lint, typecheck, test and build gates remain mandatory. Phase 15.26 is not implemented.