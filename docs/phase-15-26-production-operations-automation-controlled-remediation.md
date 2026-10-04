# Phase 15.26 — Production Operations Automation, Self-Healing Guardrails & Controlled Remediation

## Objective

Phase 15.26 extends the existing Phase 15.25 operations control plane with a provider-neutral automation domain and controlled remediation guardrails. It does not replace the existing operations, incident, reconciliation, synthetic, governance, cost/capacity, authentication, RBAC, payment, fulfillment, shipping, or provider boundaries.

## Implemented

- Versioned AutomationPolicy and immutable AutomationPolicyVersion records.
- Explicit risk classes: OBSERVE_ONLY, SAFE_AUTOMATION, CONTROLLED_AUTOMATION, APPROVAL_REQUIRED, HIGH_RISK, PROHIBITED.
- Structured, non-executable predicates with deterministic comparison operators.
- Registered action catalog; unknown action names are never executable.
- Execution state machine with invalid transition rejection.
- Idempotency key and trigger-fingerprint persistence.
- Bounded target scope, timeout, retry, cooldown, and execution-frequency metadata.
- Approval records bound to execution/policy version, with separation-of-duties checks.
- Circuit-breaker state, failure, escalation, rollback, evidence, dry-run, simulation, suppression, safety-evaluation and lock persistence models.
- Protected admin API for evaluation, simulation, approval/rejection, controlled execution, and emergency disablement.
- Admin automation control-plane view using the existing Bauhaus visual system.
- Automation-specific RBAC permissions.
- Default policies are disabled and dry-run by default.
- RERUN_SYNTHETIC_CHECK is the only mutation-capable registered action and is constrained to the existing synthetic-monitoring boundary.
- No Qikink catalog/shipping API is introduced and no provider credentials are exposed.

## Risk model

OBSERVE_ONLY cannot mutate. SAFE_AUTOMATION and CONTROLLED_AUTOMATION are the only classes eligible for autonomous execution, and mutation-capable policies retain dry-run capability. APPROVAL_REQUIRED and HIGH_RISK require human approval. PROHIBITED cannot be executed.

## Safety boundary

The framework contains no arbitrary shell execution, arbitrary SQL, credential extraction, uncontrolled deletion, financial mutation, catalog mutation, arbitrary provider operation, security-control disabling, or governance bypass.

## Approval and emergency controls

Approval is explicit, expires, is bound to the exact execution and policy version, and rejects self-approval/self-rejection. Emergency disablement sets the policy disabled state and opens its circuit.

## Autonomous actions enabled

None. The seeded synthetic rerun policy is enabled=false and dryRun=true. The observe-only policy is also disabled. No newly introduced automation is autonomous in production by default.

## Production safety matrix

| Action | Risk | Autonomous | Approval | Rollback | Max scope | Timeout | Retry | Cooldown | Audit | Escalation |
|---|---|---:|---:|---|---|---:|---:|---:|---:|---|
| Record diagnostic | OBSERVE_ONLY | No | No | Not applicable | Single target | 60s | 0 | 60s | Yes | Escalate |
| Rerun synthetic check | SAFE_AUTOMATION | No (disabled policy) | No when explicitly enabled | No automatic rollback claimed | Single workflow | 300s | 0 | 300s | Yes | Open circuit + escalate |

## Verification status

This implementation was added incrementally on the Phase 15.26 branch. Final readiness is intentionally not claimed until repository CI (npm run lint, npm run typecheck, npm test, npm run build) and migration validation complete successfully.

## Known limitations

- Existing repository infrastructure does not expose a generic production job queue, distributed lock service, or infrastructure deployment API. The phase therefore persists lock/circuit metadata without inventing a new infrastructure provider.
- Automatic rollback is not implemented for the synthetic diagnostic action because its effect is recording/running diagnostics rather than a deterministic reversible business mutation.
- Incident creation/escalation adapters are represented by persisted automation escalation records; no undocumented incident-provider API is introduced.
- Policy-management CRUD beyond the protected evaluation/approval/disable controls is deliberately not exposed as arbitrary JSON configuration.

## Hard stop

Phase 15.27 is not implemented by this phase.
