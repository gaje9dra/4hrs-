# Phase 15.30 — Production Continuous Improvement, Reliability Learning & Platform Evolution Governance

## Purpose
4HRS+ now has a governed feedback loop:
**observe → measure → learn → identify improvement → prioritize → review → implement → validate → certify → learn again**.

The system is evidence-backed and provider-neutral. It does not become a second source of truth and does not directly mutate financial, fulfillment, catalog, authentication, privacy, or compliance state.

## Evidence and learning
Improvement opportunities reference authoritative source records by type and ID. Evidence is minimized, redacted, integrity-hashed, and stored with environment, domain, severity, observed/expected behavior, impact and metrics. Patterns retain confidence, observation window, methodology version, supporting events, counter-evidence and provenance.

Confidence is explicit: UNKNOWN, LOW, MEDIUM, HIGH, VERIFIED. The platform does not fabricate evidence or collapse uncertainty into an opaque AI decision.

## Prioritization
Priorities use persisted, explainable factors: customer impact, severity, recurrence, SLO/error-budget impact, reliability gain, security/privacy risk, engineering effort, blast radius, reversibility and confidence. Methodology version 15.30-v1 makes scoring reproducible.

## Risk
Actions are classified as OBSERVE_ONLY, SAFE_AUTOMATION, CONTROLLED_AUTOMATION, APPROVAL_REQUIRED, HIGH_RISK or PROHIBITED. The recommendation layer cannot promote its own risk class.

## Proposal and state machine
Proposals are versioned and include problem, hypothesis, change, affected components/domains, expected benefits/failures, rollback, validation, monitoring, acceptance criteria, customer impact and integration references. Lifecycle transitions are strict and stale updates are rejected.

Lifecycle:
DISCOVERED → TRIAGED → ANALYZING → PROPOSED → REVIEW_REQUIRED → APPROVED → IMPLEMENTING → VALIDATING → VERIFIED → CERTIFIED.

Terminal alternatives are REJECTED, DEFERRED, ROLLED_BACK and ABANDONED.

## Approval
Approvals bind proposal version, evidence version, policy version, approver, role, decision and rationale. Self-approval is blocked where separation of duties is required.

## Validation and outcome
Validation records required tests, evidence, blockers, rollback verification, observability, customer impact, governance, digital-twin and resilience verification. Outcome measurement records expected/actual benefit, regression, operational, customer, cost, reliability, SLO and error-budget impact.

Deployment success is never treated as improvement success.

## Automation safety
Automation guardrails persist maximum executions, windows, cooldowns, circuit-breaker thresholds, blast radius, preconditions, postconditions, rollback conditions and loop keys. High-risk/prohibited actions cannot execute through this service. Idempotency belongs to the execution record.

No unrestricted shell, SQL, network, payment, provider or destructive data-repair operation is exposed.

## Integration
The proposal model carries references for:
- Phase 15.21 architectural debt/dependencies
- Phase 15.22 reconciliation
- Phase 15.23 synthetic monitoring
- Phase 15.25 operations/release health
- Phase 15.26/15.27 automation and self-healing
- Phase 15.28 resilience/chaos
- Phase 15.29 digital-twin rehearsal
- feature flags, governance, cost/capacity and security/privacy.

These references are contracts, not duplicate implementations.

## Database safety
The migration is additive only. It creates governance records, indexes and foreign keys; it does not alter or delete authoritative commerce records and does not perform production data repair.

## Admin control plane
Admin API and dashboard expose opportunities, proposals, validations, outcomes and certifications with dedicated RBAC permissions. State-changing routes use the existing trusted-request and admin authorization controls.

## Security/privacy
Secrets are redacted before evidence persistence. Evidence references authoritative records instead of copying sensitive payloads. No browser-to-provider behavior or provider credentials are introduced. Qikink remains fulfillment-only.

## Rollback
The feature is isolated in new tables, services, routes, permissions and migration. Rollback is code rollback plus controlled migration forward-recovery; no automated deletion of production commerce data is permitted. Existing domain services remain untouched.

## Testing
Tests cover lifecycle validity, deterministic prioritization, automation guardrails, outcome classification, evidence redaction and prohibited risk. CI also runs the dedicated Phase 15.30 safety validator.

## Known limitations
This phase does not invent live incident/SLO/provider integrations. Existing systems remain authoritative and are referenced by stable source IDs. Production improvement certification still requires actual evidence from those systems and successful digital-twin/resilience validation; the certification API intentionally reports NOT_READY when required gates are absent.
