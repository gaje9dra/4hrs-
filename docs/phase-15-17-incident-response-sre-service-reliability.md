# Phase 15.17 — Incident Response, SRE Operations & Service Reliability

## Executive summary

4HRS+ uses a provider-neutral reliability layer over the existing domain services. It detects customer-visible and business-state failures, persists incident signals, correlates repeated observations, exposes privileged operational incident state, and provides evidence-based runbooks. It does not mutate payment, order, fulfillment, shipping, catalog, privacy, or customer state automatically.

The monitor runs as a Netlify scheduled function every five minutes. Its output is structured telemetry and durable incident records that can be consumed by the existing observability/log pipeline. No speculative monitoring infrastructure is introduced.

## Reliability architecture

Request/application telemetry remains in `lib/observability`. Reliability checks live in `lib/reliability/checks.ts`; incident classification and fingerprinting live in `lib/reliability/incidents.ts`; persistence and deduplication live in `lib/reliability/service.ts`; operational access is through the existing admin RBAC boundary.

The monitor is read-only against commerce state. Incident persistence is operational state only.

## Critical service map

| Capability | Primary dependencies | Failure concern | Degraded behavior |
|---|---|---|---|
| Storefront | Database, application, CDN/cache | Availability/latency | Read-only/origin behavior where supported |
| Catalog | Database, search | Discovery failure | Catalog remains canonical; search failure must not mutate catalog |
| Search | Database/search infrastructure | Query/index failure | Safe fallback where existing architecture supports it |
| Authentication | Database/application | Login/session failure | Preserve account state; fail closed on authorization |
| Checkout | Database/payment provider | Timeout/failure | Never infer payment success |
| Payment | Payment provider/database | Callback or mutation ambiguity | Reconcile; no blind financial retry |
| Order | Database/payment | Paid-without-order or invalid payment state | Operator reconciliation through canonical services |
| Fulfillment | Qikink/provider adapter | Timeout/rejection/unknown outcome | Preserve fulfillment and reconcile |
| Shipping | Qualified shipping adapter | Creation/tracking failure | Preserve provider-neutral shipment state |
| Tracking | Shipping provider | Stale/missing events | Never fabricate status |
| Returns | Database/shipping/payment | Stuck resolution | Preserve canonical return state |
| Customer account | Database/auth/privacy workflows | Access or deletion failure | Preserve account/privacy state |
| Admin | Database/RBAC | Unauthorized operations | Existing RBAC and audit controls |
| Notifications | Notification provider | Retry backlog/delivery failure | Domain state succeeds independently |
| Analytics | First-party analytics pipeline | Ingestion failure | Must never block commerce |
| Content | Database/scheduler/cache | Publication delay | Preserve last known safe published content |
| Privacy | Database/jobs | Export/deletion failure | No destructive automatic correction |

## Dependency map and policy

Database readiness uses a bounded `SELECT 1`. Payment mutation, fulfillment creation, and shipment creation are not blindly retried. Qikink remains fulfillment-only. Notification failures do not roll back domain state. Analytics is best-effort. Search failure cannot mutate catalog state.

Timeout/retry policy is encoded in `lib/reliability/model.ts` and complements the existing payment, fulfillment, notification, and shipping retry implementations.

## SLO candidates

The repository does not contain sufficient production history to justify precise availability percentages. SLO candidates are therefore explicitly provisional and targetless. Candidates cover storefront availability, checkout success, payment callback processing, order creation, fulfillment handoff, shipment creation, and notification processing.

Production owners should establish targets only after a representative baseline exists. Measurement must use customer-visible populations and documented exclusions rather than raw log volume.

## Error-budget model

Budget consumption includes customer-visible failures, confirmed commerce failures, privacy/data-integrity incidents, and material provider degradation. Intentional validation failures, customer preference suppression, informational events, and isolated non-customer-visible diagnostics do not consume the budget.

The budget is an operational decision signal. Phase 15.16 release governance may use evidence from reliability history to increase release scrutiny, but releases are not mechanically blocked solely by an unproven budget threshold.

## Severity model

- **CRITICAL** — widespread customer impact, confirmed financial impact with customer impact, or confirmed severe integrity/privacy impact.
- **MAJOR** — major customer journey degradation or system/workflow-wide operational impact.
- **OPERATIONAL** — potential financial/privacy exposure or workflow-level operational degradation.
- **LOCALIZED** — single-resource or localized customer impact.
- **INFO** — informational signal.

Severity is based on impact, not raw error count.

## Detection strategy

## Alerting strategy

The scheduled monitor detects:
- database unavailability;
- stale payment processing;
- unprocessed payment callbacks;
- pending orders beyond the provisional threshold;
- stuck fulfillment handoffs;
- stale shipment creation;
- notification retry backlog;
- delayed scheduled content;
- successful payments without orders;
- confirmed orders without successful payment.

Each signal has a stable fingerprint. Incident persistence increments occurrences and emits an alert only after a bounded cooldown. The alert payload contains no secrets or sensitive customer content.

The monitor distinguishes dependency failures from application/business-state failures through the finding capability and dependency fields.

## Correlation

Existing request IDs, correlation IDs, provider identifiers, deployment identity, feature flags, webhook IDs, and domain resource identifiers remain the correlation vocabulary. Incident records use bounded fingerprints and optional correlation/deployment fields; sensitive identifiers are not exposed through public endpoints.

## Customer-impact detection

The monitor focuses on business-state anomalies rather than infrastructure health alone. In particular, a healthy database with stale payments, orders, fulfillment, shipments, notifications, or scheduled content is still observable as a reliability incident.

## Degraded mode

- Analytics may fail without blocking core commerce.
- Notifications may fail without rolling back successful domain operations.
- Search may degrade without changing canonical catalog state.
- Content publication may fail without destroying the last published content.
- Payment failure never implies payment success.
- Fulfillment/shipping ambiguity is preserved for reconciliation.

No generic circuit breaker is introduced because the repository does not provide evidence that one would be safe or useful for every dependency.

## Payment incident handling

Investigate callback delay, duplicate/out-of-order callbacks, payment success without order, refund ambiguity, provider outage, and deployment overlap using the existing payment event/idempotency state. Never automatically mark payment successful or perform financial correction from the reliability monitor.

## Order and fulfillment incident handling

Stuck orders and fulfillment handoffs create operational signals only. Existing canonical domain/admin services remain responsible for recovery. The monitor never submits another provider order.

## Qikink incident handling

Qikink is classified as a fulfillment dependency. The reliability layer distinguishes provider delay/failure from application failures and does not create browser-side fallback calls or bypass the provider adapter.

## Shipping incident handling

Shipment creation dwell and reconciliation flags are observable. Tracking state is never fabricated. Existing shipping recovery/reconciliation operations remain the only corrective path.

## Notification incidents

The notification worker already has bounded retry state. Reliability adds visibility for retry backlog/dwell anomalies. Notification failure does not imply order/payment failure.

## Search/content incidents

Search and content are isolated from canonical commerce state. Content schedule lag is detected; publication state is not changed by the monitor.

## Analytics isolation

Analytics is not a dependency of checkout, order creation, or account state. Reliability treats analytics as best-effort.

## Background jobs

The repository has scheduled Netlify functions for notifications and content scheduling. Phase 15.17 adds a scheduled reliability monitor with the same platform model. Each scheduled function logs start/completion/failure telemetry and uses bounded work. There is no infinite retry loop.

## Stuck-state detection

Thresholds are environment-configurable and explicitly provisional because production dwell distributions are not yet available. Defaults are 30 minutes for payment processing, 15 minutes for payment callback processing, 30 minutes for pending orders, 60 minutes for fulfillment/shipment operations, 30 minutes for notification retry backlog, and 15 minutes for scheduled content lag.

Operators should replace provisional thresholds with evidence-backed values after observing real production baselines.

## Data integrity monitoring

The current monitor checks:
- successful payment without an order after the reconciliation threshold;
- confirmed order referencing a payment that is not successful.

Foreign-key constraints and unique idempotency keys already protect several other relationships. Reliability checks do not mutate production state.

## Reconciliation

Payment, fulfillment, and shipping discrepancies are surfaced for existing canonical reconciliation workflows. No destructive automatic reconciliation is performed.

## Kill switches and admin emergency controls

Phase 15.11 feature flags remain the controlled rollout/disablement mechanism. Phase 15.17 does not create hidden emergency backdoors or generic universal kill switches.

Incident acknowledgment/resolution is exposed only through admin RBAC. Read access requires `analytics.operations.read`; incident state mutation requires the existing high-privilege `system.settings.manage` permission. Every manual transition is recorded in the existing admin audit log.

## Incident communication

Internal operational state is separated from customer messaging. Incident records contain bounded operational summaries. Customer-facing messaging must be deliberately authored and must not expose architecture, credentials, private data, or unsupported speculation.

## Security/privacy incidents

Potential credential leakage, unauthorized access, PII exposure, account takeover, authentication bypass, and payment-data exposure remain security incidents and must use the Phase 15.3/15.6 escalation and evidence-preservation controls. Reliability telemetry uses the existing redaction boundary.

## Runbooks

### 1. Storefront/API outage
Check `/api/health` first, then `/api/readiness`, deployment identity, recent release changes, and database health. If readiness fails, contain traffic/deployment according to Phase 15.16. Do not expose internal diagnostics publicly.

### 2. Database outage
Confirm readiness failure and provider/database status. Preserve domain state. Do not perform blind retries or destructive recovery. Follow backup/restore procedures from Phase 15.5.

### 3. Elevated 5xx/latency
Correlate request IDs, release identity, route, dependency, and feature-flag state. Check whether failures are customer-visible or dependency-specific before mitigation.

### 4. Authentication outage
Check database/application dependency and session failure telemetry. Fail closed for unauthorized access; do not weaken authentication to restore availability.

### 5. Payment provider outage/callback failure
Inspect provider status and PaymentEvent processing state. Do not retry non-idempotent payment mutations. Identify successful payments without orders and use canonical reconciliation.

### 6. Order creation failure
Inspect payment state, idempotency state, and order creation observations. Never create a second order outside the canonical service.

### 7. Qikink/fulfillment outage
Inspect fulfillment status, provider reference, operation idempotency and reconciliation metadata. Preserve unknown outcomes and reconcile through the existing fulfillment service.

### 8. Shipping/tracking outage
Inspect shipment status, provider reference, reconciliation flag, and tracking events. Never invent an AWB/tracking state.

### 9. Notification outage
Inspect retry backlog, attempts, next-attempt timestamps and provider failures. Core domain state remains authoritative.

### 10. Search/content/analytics outage
Verify canonical catalog/content state first. Keep commerce operational where possible and treat these systems as isolated dependencies.

### 11. Privacy export/deletion failure
Preserve the privacy workflow state and audit evidence. Do not manually delete or mutate customer records outside the existing lifecycle service.

### 12. Deployment/migration failure
Use Phase 15.16 release verification and migration audit. Stop further rollout if evidence indicates a release-caused regression. Do not claim readiness with failing CI.

### 13. Stuck jobs/duplicate side effects
Identify the job/resource and idempotency key. Stop only the affected operation where an existing control supports it; use canonical replay/reconciliation rather than manual database edits.

### 14. Data-integrity discrepancy
Capture the incident fingerprint, affected resource, release/provider context and evidence. Do not automatically correct production state.

### 15. Suspected security incident
Restrict access through existing RBAC/security controls, preserve logs/evidence, rotate credentials through established secret-management procedures, and follow the security/privacy incident process.

## Incident timeline and post-incident review

A significant incident should capture detection, acknowledgment, first mitigation, customer impact, decisions, deployments/configuration/flag changes, provider status, recovery and verification. Post-incident review is blameless and focuses on technical causes, contributing factors, detection, mitigation, recovery, impact and corrective actions with owners.

## Recurrence prevention

Corrective actions are classified as code, tests, observability, configuration, runbook, architecture, provider mitigation, migration improvement, or operational process. Repeated fingerprints increase occurrence counts and remain visible until resolved.

## Capacity and performance risk

The repository is serverless/Netlify-based. Concrete risks include database connection pressure, function duration, provider rate limits, notification work volume, search load and payload size. No speculative infrastructure is added. Phase 15.2 performance telemetry should be used to establish evidence-backed capacity limits.

## Release correlation

Phase 15.16 release identity remains the source of deployed version information. Incident records support optional deployment/correlation fields so operators can compare incidents with releases, configuration, flags and provider events without assuming causation.

## Testing

Phase 15.17 adds unit coverage for severity, fingerprinting, alert cooldown, provisional SLO policy, dependency retry policy, RBAC boundaries, redaction and monitor non-mutation. Full CI remains mandatory.

## Known limitations

- SLO percentages are provisional until production data exists.
- Alert delivery is represented through structured reliability telemetry; no new external paging provider is introduced.
- Some business-flow thresholds are provisional.
- Tracking staleness cannot be asserted without an evidence-backed expected-event window.
- The Phase 15.16 authoritative npm lockfile blocker remains external to this phase.

## Deferred work

- Evidence-backed SLO targets after sufficient production baseline.
- External paging/escalation integration if operationally required.
- Advanced burn-rate alerting after reliable historical measurements exist.
- Provider-specific SLA dashboards where provider contracts and telemetry are available.

## Production readiness decision

**PHASE: 15.17**

**STATUS: NOT READY**

Reliability architecture, incident persistence, scheduled detection, severity classification, dependency policies, operational access, runbooks and tests are implemented.

The readiness gate remains **NOT READY** while the inherited Phase 15.16 production reproducibility blocker—an authoritative committed `package-lock.json`—remains unresolved. Phase 15.17 does not conceal or override that blocker.

**NEXT_PHASE: 15.18**

Do not begin Phase 15.18 until the inherited blocker is resolved and the complete CI/release validation is green.
