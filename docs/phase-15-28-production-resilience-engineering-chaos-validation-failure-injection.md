# Phase 15.28 — Production Resilience Engineering, Chaos Validation & Failure-Injection

## Safety posture
Failure injection is privileged infrastructure. The default path is safe and non-destructive: experiments are explicit, targets are allowlisted, faults are predefined, customer impact is zero for simulation and synthetic-production modes, and arbitrary URLs, IPs, SQL, shell commands, code and provider resources are not accepted.

## Lifecycle
DRAFT → REVIEW → APPROVED → SCHEDULED → READY → RUNNING → COMPLETED/FAILED/ABORTED. Invalid transitions are rejected. Production approvals are bound to the exact experiment version, target, fault, duration and blast radius; material changes require a new approval.

## Modes
- SIMULATION — evaluates the decision path without fault injection.
- STAGING — non-production controlled execution.
- SYNTHETIC_PRODUCTION — isolated synthetic workflows only.
- CONTROLLED_PRODUCTION — explicitly approved production-safe targets only.
- PROHIBITED — never executable.

The current implementation intentionally uses a registered no-op fault contract for execution until a target-specific safe adapter is explicitly integrated. This prevents Phase 15.28 from becoming arbitrary chaos infrastructure.

## Catalog
The predefined fault registry covers delay, timeout, transient/permanent error, connection failure, resource unavailable, job crash/delay, queue backlog, cache miss, search index failure, notification failure and dependency degradation. Each fault carries target support, duration limits, affected request/job limits, rollback behavior and observability requirements.

## Guardrails
Experiments require owner, reviewer, hypothesis, expected behavior, abort conditions, expiration, target, fault, environment and blast radius. High-risk concurrency is bounded to one active experiment per affected environment by default. Emergency suppression is reason-bound and expires.

## Evidence and certification
Executions record steps, observations, metrics, evidence hashes, expected versus actual behavior, recovery status, customer impact and residual risk. Certification is explainable and records tested/passed/failed/untested scenarios and limitations.

## Payment, fulfillment and data safety
No real customer charges, orders, refunds or uncontrolled Qikink operations are created. Database resilience remains non-destructive. Provider credentials and arbitrary destinations are never accepted. Financial truth is not mutated by experiments.

## Operational runbook
1. Define a measurable hypothesis.
2. Register or select an allowlisted target and predefined fault.
3. Review and approve the exact version.
4. Revalidate target, fault, environment, deployment/incident safety and approval immediately before execution.
5. Abort on any guardrail breach.
6. Preserve evidence and evaluate recovery/reconciliation.
7. Certify only what was actually tested; unknown dimensions remain unknown.

## Known limitation
Non-noop fault adapters are deliberately not invented. Real staging/synthetic/controlled-production fault injection requires an existing safe adapter contract for the specific target.