# Phase 15.27 — Production Autonomous Reliability, Adaptive Control & Safe Self-Healing Governance

Phase 15.27 adds deterministic reliability intelligence above Phase 15.26.

## Reliability intelligence
Signals are provider-neutral records with service, dependency, environment, severity, observation time, evidence and deterministic fingerprints. Correlation is bounded by service, environment and time window. Correlation is not treated as causality.

Hypotheses record evidence, competing hypotheses, validation method, confidence and expiration. Confidence levels are UNKNOWN, LOW, MEDIUM, HIGH and VERIFIED. UNKNOWN and LOW only observe, validate or escalate. MEDIUM never authorizes autonomous mutation. HIGH and VERIFIED may evaluate an approved safe strategy only after all server-side safety gates pass.

## Controlled self-healing
The only autonomous mutation-capable strategy is a registered synthetic diagnostic retry using the existing RERUN_SYNTHETIC_CHECK action. It is bounded to one step, one mutation, one synthetic workflow, a 300-second chain and deterministic pre/postconditions. No new provider protocol is introduced.

## Safety gates
Execution checks environment, strategy state, circuit state, idempotency, critical reconciliation cases, critical cost anomalies, major or critical security incidents, target validity, bounded scope and auditability. Failure of any mandatory gate blocks execution and escalates.

## Verification and regression
Postconditions are recorded separately from action completion. Pre/post metrics can be compared with deterministic thresholds. Automation-induced regression opens the strategy circuit, persists evidence, stops autonomous remediation and escalates for human review.

## Baselines and anomalies
Baselines are environment- and metric-specific, versioned and bounded. Frozen baselines do not adapt. Anomaly detection uses an explainable center/spread threshold and does not let one anomaly redefine normal.

## Governance
Reliability permissions cover read, simulation, approval, execution, management, disablement, override and evidence access. The admin control plane exposes signals, assessments, anomalies, strategies, circuits and regression events. Existing audit and incident infrastructure remains authoritative.

## Safety boundary
4HRS+ remains authoritative. Qikink remains fulfillment-only. Financial mutation, customer or catalog truth mutation, arbitrary SQL or shell, undocumented provider calls, provider credential operations, destructive repair, security-control disabling and governance bypass remain outside autonomous operation.

## CI and readiness
Completion requires Prisma validation and migration deployment, lint, typecheck, tests, build, recovery validation, migration audit, platform/reconciliation/synthetic/operations validation and exact-commit CI. Any failure is blocking.
