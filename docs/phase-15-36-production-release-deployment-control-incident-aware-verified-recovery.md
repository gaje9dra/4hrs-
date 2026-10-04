# Phase 15.36 — Production Release Deployment Control, Incident-Aware Deployment & Verified Recovery

## Scope
Phase 15.36 adds a provider-neutral deployment-control layer on top of Phase 15.34 ChangeRequest and Phase 15.35 Release governance. It does not replace release/progressive-rollout logic.

Control path: ChangeRequest -> Release -> Deployment -> registered operations -> health/validation -> certification.

## Safety boundaries
- No arbitrary shell or SQL execution.
- No user-supplied deployment commands.
- No infrastructure mutation from the browser.
- No deployment, rollback, payment, order, customer, fulfillment, shipping, or Qikink side effects are executed by the control service.
- Qikink remains fulfillment-only.
- Browser input is untrusted and high-risk actions require existing admin RBAC.
- Mutating deployment API calls require an Idempotency-Key.
- Artifact, environment, release, change and recovery inputs are revalidated server-side.

## Domain
The Prisma migration adds Deployment, DeploymentArtifact, DeploymentEnvironment, DeploymentPlan, DeploymentStep, DeploymentGate, DeploymentHealthSnapshot, DeploymentDecision, DeploymentPause, DeploymentAbort, DeploymentRollback, DeploymentRecovery, DeploymentValidation, DeploymentEvidence, DeploymentCertification, DeploymentPolicy, DeploymentLock, DeploymentConflict, DeploymentIncident, DeploymentBaseline, DeploymentObservation and DeploymentFreeze.

Deployment objects retain stable IDs, revision, change/release/artifact linkage, environment, target, policy, actor and correlation metadata.

## Lifecycle
The service implements bounded transitions through DRAFT, READY_CHECK, APPROVED, SCHEDULED, PREPARING, PRE_DEPLOYMENT_VALIDATING, DEPLOYING, DEPLOYMENT_VALIDATING, PROGRESSIVE_EXPOSURE, POST_DEPLOYMENT_VALIDATING, VERIFIED and CERTIFIED, with explicit blocked, paused, aborted, failed, rollback and forward-recovery states.

Every transition is validated and audited. Terminal states cannot silently reopen.

## Inputs and provenance
A deployment must link to an approved ChangeRequest, an eligible Phase 15.35 Release and an approved immutable DeploymentArtifact. Artifact provenance fields include commit SHA, build identifier, package identifier, migration/configuration/feature-flag versions and dependency-lock hash.

## Environment governance
Only development, test, staging and production are accepted. Environment state, health, incidents, maintenance mode, freeze state, migrations, capacity, dependency health and policy are persisted.

## Gates
Readiness checks cover approval/release state, artifact integrity, environment eligibility, incident/freeze state, conflicts, recovery classification, bounded targets and policy version. Failed blocking gates prevent start.

## Plans and execution contract
Plans are deterministic and hashable. Steps have prerequisites, bounded timeouts, retry policy, idempotency keys, expected outcomes, failure handling, recovery behavior and evidence requirements.

Only registered operation types are accepted. The service records governed operation state/evidence but does not execute arbitrary deployment commands.

## Incident-aware deployment and freezes
Incidents support ALLOW, ALLOW_WITH_APPROVAL, DELAY and BLOCK decisions. Deployment freezes support global, environment, domain, provider, incident, security and migration scopes with owner, expiry and audit evidence.

## Locking and conflicts
Deployment locks are bounded by scope and expiry. Active conflicts are persisted rather than bypassed. Stale locks are not silently ignored.

## Progressive delivery integration
Phase 15.36 does not duplicate Phase 15.35 rollout logic. It provides deployment state, artifact state, environment state, health evidence and recovery state needed by the existing release/progressive rollout layer.

## Rollback and forward recovery
Recovery is classified as rollback, forward fix, manual recovery or unknown. A rollback request moves to ROLLBACK_PENDING; rollback is not reported successful merely because a request exists. ROLLED_BACK is reached only after persisted verification evidence.

Forward recovery requires a governed plan and approval record before validation/certification.

## Evidence and certification
Evidence is hashed, timestamped, correlated and persisted. Certification requires approved change/release/artifact state, passing validation, no unresolved deployment conflicts and an approved immutable artifact.

## APIs and admin surface
The admin deployment API provides create, readiness, plan, environment state, incident correlation, freeze, lock, start, registered-operation recording, health evidence, validation, rollback request/verification, forward recovery, certification, pause and abort.

The admin deployment page provides the existing Bauhaus-style deployment dashboard.

## Testing and CI
Repository validation includes deployment-control:validate, Phase 15.36 safety tests, and the existing lint/typecheck/test/build and governance/recovery checks.

## Limitations
This phase provides deployment governance and execution contracts, not a cloud-provider deployment engine. Live infrastructure credentials, provider APIs, production metric ingestion, real customer cohort targeting, live migration execution, production rollback execution and production certification evidence are not claimed.

Simulation/digital-twin results remain rehearsal evidence and are never treated as proof of production success.

## Readiness interpretation
Phase completion requires repository CI gates and repository-specific safety validation to pass. Any live-production capability not backed by an available contract or evidence remains explicitly unimplemented rather than simulated as successful.
