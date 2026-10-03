# Phase 15.11 — Production Feature Flags, Controlled Rollouts & Experimentation

## Architecture
4HRS+ uses one provider-neutral, database-backed feature-flag and experimentation service:

Application → FeatureFlagService → canonical database configuration

No third-party feature-flag SaaS is required. A narrow provider adapter interface exists only as a future isolation boundary.

Feature flags and experiments are infrastructure/configuration. They never own order, payment, pricing, fulfillment, shipping, inventory, authorization, privacy, or customer identity.

## Terminology
- Configuration: deployment/runtime setting that is not customer-targeted experimentation.
- Feature flag: boolean or multivariant capability availability decision.
- Experiment: deterministic assignment of an eligible subject to weighted variants for measurement.
- Assignment: the persisted experiment membership.
- Exposure: the recorded fact that an assigned subject actually reached an exposure point.
- Kill switch: a production flag configuration that rapidly returns the documented safe fallback.

## Lifecycle
Feature flags: DRAFT → ACTIVE → PAUSED → DEPRECATED → RETIRED.

- DRAFT: safe default; not enabled through production evaluation.
- ACTIVE: normal evaluation.
- PAUSED/DEPRECATED/RETIRED: safe fallback.
- RETIRED flags must be removed from application references during cleanup.

Experiments: DRAFT → ACTIVE/PAUSED → COMPLETED → RETIRED. Completed experiments stop new assignments; the winning implementation is adopted outside the experiment layer.

## Environment isolation
Supported environments are DEVELOPMENT, TEST, STAGING, and PRODUCTION. Evaluation defaults from server-side environment configuration and never trusts a browser-provided environment identifier.

Production changes are administrator-controlled. There is no cross-environment fallback.

## Evaluation
There is one canonical evaluation service. Application code should call evaluateFeatureFlag() or evaluateExperiment() instead of scattering environment-variable checks.

Feature evaluation requires only minimal context: environment plus authenticated customer ID or bounded anonymous session ID when percentage assignment needs a stable subject.

Customer ID is never returned to the browser as targeting configuration.

## Safe defaults and failures
Missing flags, inactive lifecycle states, expired flags, malformed configurations, database failures, and unexpected evaluator errors return safe defaults. Evaluation never throws infrastructure failures into core commerce paths.

There is no long-lived feature cache in Phase 15.11. Reads are database-backed, making administrative changes immediately visible to subsequent evaluations without a stale CDN/browser configuration layer. This intentionally favors kill-switch consistency over an additional cache subsystem.

## Deterministic rollout
Assignments use SHA-256 over a namespace and pseudonymous stable subject and map the first 32 bits into 10,000 basis-point buckets.

bucket = SHA256(namespace + NUL + subjectHash) mod 10,000

Boolean rollout percentages are represented as 0–100%. Multivariant weights are represented as basis points and must total exactly 10,000.

1%, 10%, 50%, and 100% therefore mean exactly 100, 1,000, 5,000, and 10,000 eligible buckets respectively.

No Math.random() or request-local random assignment is used.

The namespace includes the flag/experiment key so unrelated experiments do not intentionally share the same assignment stream.

## Identity
Authenticated customers use a SHA-256 pseudonym derived from the customer ID. Anonymous subjects use a bounded session identifier supplied to the evaluation boundary and are hashed before persistence.

Authenticated identity takes precedence when both customer and anonymous context exist. Consequently, anonymous → authenticated login can change assignment. This is explicit and deterministic rather than accidental.

No fingerprinting, user-agent targeting, IP targeting, or sensitive-attribute targeting exists.

## Feature flag configuration
A flag contains:
- stable key
- name/description
- BOOLEAN or MULTIVARIANT type
- lifecycle
- environment
- safe default
- rollout percentage
- optional default variant
- validated variants
- version
- optional expiration

Variants are limited to 2–8 and allocation must total exactly 100%.

## Experiments
Experiments contain:
- stable key
- name/description
- lifecycle status
- environment
- optional start/end
- version
- primary metric event reference
- weighted variants

Experiment assignments are persisted for stable attribution. The assignment stores only a pseudonymous subject hash, subject type, optional customer relation for privacy lifecycle cleanup, variant, version, and timestamps.

## Exposure semantics
Assignment is not exposure.

evaluateExperiment() creates or retrieves assignment. The application should call recordExperimentExposure() only at a real exposure point, after the chosen variant is actually rendered/experienced.

Exposure events use a deterministic event ID based on experiment/version/subject/variant. This prevents React rerenders, retries, refreshes, and duplicate requests from inflating one assignment into repeated exposure records.

## Analytics integration
Phase 15.10 remains the canonical analytics pipeline. The only new analytics event is EXPERIMENT_EXPOSURE, version 1, with an explicit property allowlist.

Analytics consent is mandatory. Evaluation itself does not grant analytics consent. If consent is absent, exposure telemetry is skipped without affecting the feature decision.

No separate experimentation analytics store or vendor SDK exists.

## Privacy and retention
Experiment assignments connected to a customer are included in the existing customer privacy export and deleted during customer deletion/anonymization.

Analytics exposure data follows Phase 15.10's 90-day raw event retention.

Flag/experiment configuration and admin audit history are operational configuration records, not customer behavioral profiles.

## Admin RBAC
Existing admin authorization is reused. New permissions:
- feature_flags.read
- feature_flags.manage
- experiments.read
- experiments.manage

SUPER_ADMIN and ADMIN receive read/manage permissions; OPERATIONS and VIEWER receive read-only permissions.

No second authorization system was introduced.

## Admin API
Protected routes:
- GET/POST /api/admin/feature-flags
- GET/PUT /api/admin/feature-flags/:id
- GET/POST /api/admin/experiments
- GET/PUT /api/admin/experiments/:id
- GET /api/admin/feature-flags/audit

Administrative mutation APIs are same-origin protected, rate-limited by existing admin controls, validated, and non-cacheable.

Customer-facing endpoints do not expose targeting rules or administrative metadata.

## Audit logging
Material create/update operations use the existing AdminAuditLog through auditAdminAction(). Failed authorization and failed mutations also use the existing audit path.

Production activation/rollout mutations require an administrator reason. Audit metadata records key, environment, lifecycle/status, rollout and configuration version without secrets.

## Concurrency
Feature and experiment updates require expectedVersion. Updates are performed inside a transaction and the version predicate is checked atomically. A stale writer receives a conflict instead of silently overwriting another administrator's change.

Variant replacement occurs in the same transaction as the configuration version update.

## Kill switches
Set a feature to PAUSED or otherwise move its rollout to a safe disabled configuration. Subsequent evaluations use the safe fallback immediately from the database.

There is no browser cache dependency for kill-switch propagation.

Kill switches cannot bypass authentication, authorization, payment verification, privacy, consent, or other domain controls.

## Provider boundary
No vendor SDK is installed. FeatureFlagProviderAdapter is a narrow optional future interface. The internal database service remains canonical and operational if no provider exists.

A future provider must remain server-side, minimize context, fail safely, and never become the application's direct dependency.

## Business safety
Feature flags never calculate prices or mutate order/payment/fulfillment state. Pricing, tax, payment amounts, inventory, authorization, fulfillment, shipping, returns, cancellations, and customer status remain canonical in their existing domains.

A UI experiment may select presentation, but the underlying business service still determines the authoritative outcome.

## I18n / SEO / accessibility
Flag evaluation is locale-aware only where a caller explicitly supplies locale; locale is not inferred into financial/legal authority.

Variants must use existing translation/i18n infrastructure. Feature infrastructure does not embed English-only business copy.

No crawler-specific flag evaluation is supported. Canonical metadata and public routing remain authoritative.

Customer UI variants must preserve semantic HTML, keyboard operation, focus management, labels, contrast, reduced-motion behavior, and responsive rendering.

## Performance
The evaluator performs one bounded indexed configuration read and avoids loading customer profiles. No client-side SDK or large flag bundle is introduced.

Evaluation latency and failures are recorded through the existing observability metric system.

## Observability
Metrics distinguish:
- evaluation success/error
- evaluation latency
- assignment success/error
- exposure success/failure

Metric labels are bounded by the existing observability layer. Customer PII is not logged.

## Failure scenarios
- Database unavailable: safe default.
- Provider unavailable: no provider is required; future adapters must fail safely.
- Cache unavailable: no cache is required for correctness.
- Malformed configuration: rejected before activation.
- Invalid rollout: rejected.
- Duplicate assignment: unique composite key/upsert.
- Duplicate exposure: deterministic analytics event ID.
- Analytics unavailable: exposure recording fails closed without affecting business behavior.
- Consent unavailable/opted out: exposure analytics is skipped.
- Customer deletion: assignments are removed.
- Unauthorized admin: existing RBAC returns 401/403 and audit/security telemetry remains authoritative.
- Concurrent admin edit: version conflict.
- Deployment during experiment: persisted versioned assignment remains deterministic.
- Locale change: assignment does not silently change unless the caller explicitly makes locale an evaluation dimension; current service does not target by locale.
- Currency display change: feature infrastructure never changes transaction currency.

## Emergency runbook
1. Identify the flag/experiment key and environment.
2. Verify the current version and audit history.
3. Pause the feature/experiment or set the safe rollout.
4. Confirm subsequent server evaluations return the fallback.
5. Verify core commerce endpoints independently.
6. Review observability metrics and admin audit events.
7. Preserve the audit record and investigate before reactivation.

## Cleanup and retirement
Every production flag/experiment should have an owner/process outside this infrastructure. Expiration metadata is visible through configuration records but does not silently delete behavior.

Before retiring a flag:
1. remove all active application references;
2. deploy the canonical replacement behavior;
3. mark the flag RETIRED;
4. preserve required audit history;
5. remove the database record only under an explicit cleanup migration/process.

Experiments follow the same rule: stop assignment, adopt the canonical implementation, remove branching, then retire.

## Testing
Unit coverage includes deterministic hashing, namespace isolation, identity precedence, allocation validation, lifecycle/default behavior, experiment validation, and analytics event schema.

Repository CI remains authoritative for lint, typecheck, tests, build, Prisma validation/generation, migrations, and security/static checks.

## Production readiness scenarios
A–F: default/1%/10%/50%/100% rollout behavior is deterministic by bucket.

G: emergency disable uses database-backed safe fallback without browser cache dependency.

H–I: database/cache/provider failure does not enable privileged behavior.

J–K: privacy deletion and analytics opt-out remove/prevent attributable experimentation telemetry.

L–M: existing RBAC and optimistic versioning protect admin operations.

N–O: versioned assignments survive deployment; completed experiments stop new assignments and require removal of branching.

P: login changes identity source explicitly from anonymous to customer identity.

Q: locale is not an implicit targeting dimension.

R: no feature infrastructure changes responsive or accessibility primitives.

S: server evaluation is authoritative; client UI cannot become an authorization boundary.

## Known limitations
- No admin UI was added in this phase; the protected admin API is the configuration control surface.
- No automatic crawler/SEO experimentation is supported.
- No sensitive targeting dimensions are supported.
- No third-party provider synchronization is implemented.
- No automatic flag deletion is performed.
- No automatic winner selection is performed for experiments; business owners must adopt the winning implementation outside the experiment layer.
