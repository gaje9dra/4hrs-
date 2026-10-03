# Phase 15.18 — Production Business Continuity, Operational Resilience & Disaster Recovery Validation

## 1. Executive summary

Phase 15.18 validates the recovery architecture already present in 4HRS+ and adds an evidence-oriented continuity and recovery record. It does not replace Netlify, introduce speculative multi-region infrastructure, or redesign completed commerce domains.

The repository has three important recovery controls:

1. a read-only restored-database validation service in `lib/recovery/restore-validation.ts`;
2. a domain integrity audit in `lib/recovery/integrity.ts`;
3. a non-production `pg_dump` → isolated database creation → `pg_restore` → validation drill in `scripts/recovery-drill.ts`.

The Phase 15.18 drill is explicitly prohibited in production, creates a uniquely named temporary database, removes that database during cleanup, and now records backup, database-available, validation-complete, measured restore/validation/recovery durations, and an explicit data-loss boundary.

This phase distinguishes **repository-verifiable recovery capability** from **production-provider capability**. A successful CI restore drill proves that the repository's PostgreSQL dump/restore/validation path works against the CI PostgreSQL service. It does not prove the existence, retention, immutability, PITR window, or recoverability of the actual production database provider's backups.

**Current readiness decision: NOT READY until the end-to-end recovery exercise and complete CI suite have produced current evidence.**

## 2. Current recovery architecture

Canonical recovery sequence:

`production failure → containment → select recovery point → isolated PostgreSQL restore → schema/migration validation → domain integrity validation → compatible application deployment → external-provider reconciliation → controlled resumption → post-recovery verification`

Canonical business state remains authoritative in PostgreSQL. Search, caches and other derived state must be rebuilt from canonical state and must never overwrite it during recovery.

Existing Phase 15.5 and 15.17 controls remain in force. Recovery does not introduce a second business-domain state machine.

### Existing repository controls

- PostgreSQL schema and Prisma migrations are versioned in Git.
- Migration safety is audited by `scripts/audit-migrations.ts`.
- Restore validation checks database connectivity, required tables, migration completion, indexes, constraints and invalid domain values.
- Integrity validation checks order totals, payment/order relationships, refund bounds, fulfillment/return quantities, orphan relationships and duplicate provider/business references.
- Recovery repair is intentionally narrow and authorized; there is no generic SQL repair endpoint.
- Netlify remains the deployment platform.
- Qikink remains fulfillment-only.
- Payment, fulfillment, shipping and webhook recovery preserve canonical records and idempotency boundaries.

## 3. Business continuity model

| Capability | Criticality | Dependencies | Acceptable outage behavior | Recovery sequence | Data-loss tolerance | Verification |
|---|---|---|---|---|---|---|
| Storefront | Critical | Netlify, DB | Read-only/degraded behavior where supported | DB → deploy → health | Latest verified DB point | Health + catalog |
| Catalog | Critical | PostgreSQL | Do not publish corrupt state | DB → integrity → app | Latest verified DB point | Product/variant relations |
| Search | High/derived | Catalog + index implementation | Search may degrade | Canonical DB → rebuild | Reconstructable | Index consistency |
| Authentication | Critical | DB, runtime secrets | Fail closed if unavailable | DB → config → app | Latest durable account state | Login/session checks |
| Customer accounts | Critical | DB | Account changes paused if persistence is unavailable | DB → app | Latest verified DB point | Identity/preferences/consent |
| Cart | High | DB, storefront | No irreversible mutation without persistence | DB → app | Latest durable cart state | Cart read/write boundary |
| Checkout | Critical | DB, payment boundary | Stop unsafe writes if persistence unavailable | DB → app → payment reconciliation | No frontend-derived financial recovery | Read-only boundary checks |
| Payment | Critical | DB + payment provider | Preserve ambiguity; no guessed success/refund | DB → provider reconciliation | Provider-dependent | Payment/order reconciliation |
| Orders | Critical | DB + payment | Preserve canonical order state | DB → app → payment reconciliation | Latest verified DB point | Order/item/payment relations |
| Fulfillment | Critical | DB + Qikink | Keep pending/retryable; reconcile ambiguity | DB → provider reconciliation | Latest durable intent | No duplicate operation |
| Shipping | Critical | DB + qualified provider | Preserve reconciliation-required state | DB → provider reconciliation | Latest durable shipment state | Shipment/tracking |
| Tracking | High | Shipment + provider | Do not fabricate events | DB → provider reconciliation | Latest durable events | Event relationships |
| Returns/cancellations | High | DB, payment/order | Preserve request/audit state | DB → application recovery | Latest durable request state | Quantity/state checks |
| Notifications | Medium | DB + provider | Suppress duplicate delivery | DB → idempotency → controlled worker resume | Latest durable delivery state | No duplicate messages |
| Admin | Critical | DB + auth | Privileged operations paused until RBAC verified | DB → auth → app | Latest durable admin state | RBAC/audit |
| Content | High | DB + media | Keep last valid published state | DB → validation → publication resume | Latest canonical editorial state | Versions/approval/schedule |
| Analytics | Low/derived | DB/event pipeline | May be unavailable without blocking commerce | Canonical DB → rebuild/export as applicable | Best effort | Isolation from commerce |
| Privacy operations | Critical | DB + auth + retention jobs | Preserve workflow/audit state | DB → security/privacy validation | Latest durable workflow state | Consent/privacy/audit |

No availability guarantee is implied by this table.

## 4. RTO/RPO

RTO and RPO are **provisional operational targets**, not contractual guarantees.

The repository does not control the production database provider, Netlify account access, DNS, external media storage, payment provider, Qikink, shipping provider, or provider-side backup retention. Therefore exact RTO/RPO values require production evidence.

| System | Provisional recovery objective | Evidence required to finalize |
|---|---|---|
| Primary PostgreSQL | Restore and validate within an operator-measured window | Provider restore measurements across representative incidents |
| Customer/account data | Latest verified database recovery point | Actual backup/PITR cadence and restore point |
| Orders | Restore canonical DB state before accepting irreversible mutations | Restore + reconciliation exercise |
| Payments | Restore DB and reconcile external provider state before mutation | Provider reconciliation capability and test |
| Fulfillment | Restore intent/idempotency state and reconcile Qikink | Non-production provider/reconciliation evidence |
| Shipping | Restore shipment state and reconcile provider state | Qualified provider API/operational evidence |
| Content | Restore canonical editorial state before publication | Restore and version/approval verification |
| Catalog | Restore canonical DB state; rebuild derived indexes | Restore + index rebuild test |
| Audit logs | Restore with canonical DB | Integrity/retention evidence |
| Analytics | Reconstruct where possible; never become commerce dependency | Pipeline/replay evidence |

**RPO warning:** backup frequency is not itself a guaranteed RPO.

**RTO warning:** deployment speed is not itself a guaranteed RTO.

## 5. Data classification

| Category | Recovery treatment |
|---|---|
| Canonical business state | PostgreSQL source of truth; highest restoration priority |
| Financial state | Restore and reconcile; never reconstruct from analytics/browser behavior |
| Customer/account state | Restore with privacy/security controls |
| Operational state | Restore durable job/idempotency/reconciliation state |
| Content state | Preserve drafts, revisions, approvals, schedules and published versions |
| Search/index state | Derived/reconstructable; rebuild from canonical catalog |
| Analytics state | Derived/best effort; isolated from commerce |
| Audit/security state | Preserve as operational evidence; access restricted |
| Ephemeral/cache state | Disposable; rebuild |
| External-provider state | Reconcile against provider state before retrying side effects |

## 6. Backup architecture audit

The application repository does not own the production PostgreSQL backup service. Production backups must therefore be supplied and controlled by the selected managed PostgreSQL provider.

Required production evidence:

- backup owner and operator;
- backup cadence;
- retention;
- encryption;
- storage isolation;
- access principals;
- backup identifiers/timestamps;
- backup completeness;
- restore mechanism;
- last successful restore verification;
- PITR availability and actual recovery window, if supported;
- documented provider limitations.

A successful backup job alone is not evidence that a restore is usable.

### Backup immutability and isolation

The repository cannot claim provider-side immutability without provider evidence. Production operators should separate application credentials from backup/recovery credentials where the provider supports it and should protect backup access from application compromise and administrator mistakes.

No speculative backup infrastructure is introduced by this phase.

## 7. Restore procedure

1. Declare the incident and record the last known healthy state.
2. Contain unsafe irreversible operations.
3. Select an approved backup/PITR point.
4. Establish an isolated recovery environment.
5. Restore PostgreSQL without overwriting production.
6. Validate Prisma migration state and schema.
7. Run read-only recovery validation and integrity audit.
8. Deploy an application version compatible with the restored schema.
9. Validate configuration, authentication and health/readiness.
10. Reconcile payment, fulfillment, shipping and webhook state.
11. Rebuild derived search/cache state where applicable.
12. Resume background work in controlled order.
13. Run post-recovery business verification.
14. Record actual recovery duration, recovery point and unresolved exceptions.

## 8. Restore validation

`npm run recovery:validate` performs read-only checks for:

- database connectivity;
- required critical tables;
- Prisma migration completion;
- indexes;
- primary/unique/foreign-key constraints;
- invalid order/payment/return values;
- domain integrity findings.

The validation service does not mutate restored data to make checks pass.

## 9. Restore integrity

Critical relationships include:

- customers and addresses;
- products and variants;
- catalog relationships;
- orders and order items;
- payments and refunds;
- fulfillment and fulfillment items;
- shipments and tracking events;
- returns/cancellations;
- notifications and communication preferences;
- consent/privacy state;
- admin/audit records;
- content and revisions;
- feature flags.

Confirmed violations must block a readiness declaration.

## 10. Point-in-time recovery

PITR is not claimed by the repository.

If the production provider supplies PITR, operators must record the mechanism, selected timestamp, recoverable boundary, consistency guarantees and actual measured restore process.

If PITR is unavailable, the practical recovery boundary is the latest verified restorable backup. Zero-data-loss recovery must not be claimed.

## 11. Migration failure recovery

Migration recovery follows Phase 15.16 release governance:

- preserve migration failure evidence;
- inspect Prisma migration state;
- determine whether retry is safe;
- prefer reviewed forward repair where appropriate;
- use expand/contract patterns for incompatible schema changes;
- do not assume application rollback reverses database changes;
- do not blindly restore production for every migration failure.

`npm run db:audit-migrations` remains part of CI.

## 12. Application recovery

For deployment/configuration/runtime failures:

1. identify deployment identity;
2. inspect health/readiness and observability;
3. contain the affected release or capability;
4. roll back to a schema-compatible known-good deploy when safe;
5. use feature flags only through existing controlled mechanisms;
6. verify database compatibility;
7. validate domain state;
8. resume background processing only after idempotency/reconciliation state is verified.

Application recovery must not duplicate domain side effects.

## 13. Search recovery

Search is derived state unless repository evidence establishes otherwise.

Recovery sequence:

`canonical catalog → compatible index configuration → rebuild → validate → enable`

Search recovery must never write changes back into canonical catalog state.

## 14. Content recovery

Recovery preserves:

- drafts;
- revisions;
- approvals;
- scheduled content;
- published versions;
- localization state;
- editorial history.

Public rendered output is not treated as the canonical source when durable editorial state exists.

## 15. Feature flag recovery

Recovery must preserve flag lifecycle, environment, rollout configuration, variant assignments and emergency disablement behavior.

If the flag system becomes unavailable, safe defaults must be used. Recovery must not silently enable disabled functionality or expose internal targeting rules.

## 16. Customer account recovery

Recovery preserves identity, lifecycle state, credentials, sessions where appropriate, addresses, communication preferences, consent and privacy workflow state.

Stale credentials must not be restored without security review. Session invalidation, if required, must be an explicit recovery action with documented rationale.

## 17. Payment recovery

Payment state is authoritative in persisted payment records plus provider reconciliation.

Recovery must preserve:

- payment identifiers;
- status;
- provider references;
- payment events;
- idempotency records;
- refunds;
- reconciliation state.

Never infer payment success from browser behavior or analytics. Never automatically issue refunds during recovery without explicit domain authorization.

## 18. Order/fulfillment recovery

Order recovery distinguishes durable order, payment and fulfillment states.

Fulfillment recovery must distinguish pending, submitted, provider-accepted, provider-rejected and ambiguous operations.

External provider state is reconciled before retrying uncertain operations.

## 19. Qikink recovery

Qikink remains fulfillment-only.

The canonical relationship is:

`4HRS+ order → fulfillment record → provider mapping → Qikink operation/reference → provider state`

Known Qikink operations must be preserved and reconciled. Unknown operations must not be blindly retried. No Qikink catalog recovery mechanism is introduced.

## 20. Shipping recovery

Shipment identity, provider references, tracking information, tracking events and reconciliation state are preserved.

Unknown provider state is represented as operational uncertainty. Tracking status is never fabricated and duplicate shipments are not created blindly.

## 21. Webhook recovery

Webhook processing must preserve event IDs, signatures, versions, processing state and idempotency records.

Historical events are not blindly replayed. Where replay is required, it must be controlled and idempotent.

## 22. Background job recovery

Jobs are classified as pending, running, completed, failed, dead-lettered or unknown.

Completed work must remain recognized. Failed work may be retried through existing safe mechanisms. Unknown external operations require reconciliation before retry.

## 23. Notification recovery

Restoration must not regenerate notifications merely because durable records were restored.

Existing idempotency controls prevent duplicate order, payment, shipment, password-reset and privacy notifications.

## 24. Privacy/security controls

Recovery environments must use least privilege, minimize copied PII, preserve retention controls and remain auditable.

Recovery documentation and logs must never contain secrets, tokens, passwords, payment credentials or unnecessary PII.

Synthetic data is preferred for recovery testing.

## 25. Recovery access control

Recovery is privileged.

Required controls:

- authenticated operators;
- existing RBAC;
- least privilege;
- audit logging;
- separation of duties where practical;
- no permanent emergency credentials;
- no undocumented bypass accounts.

## 26. Recovery environment

Recovery exercises must be isolated from production.

The environment must not:

- send real customer notifications;
- initiate real payments;
- create real Qikink fulfillment;
- create real shipments;
- modify production data.

The CI recovery drill uses a dedicated PostgreSQL service, creates a uniquely named temporary database, restores into it, validates it, and drops it during cleanup.

## 27. Disaster scenarios

| Scenario | Detection | Containment | Recovery | Required validation |
|---|---|---|---|---|
| Deployment failure | Release/health telemetry | Stop rollout/rollback | Compatible deploy | Health + CI |
| Database outage | Readiness failure | Stop unsafe writes | Restore/reconnect | DB + domain checks |
| Database corruption | Integrity audit | Freeze risky operations | Restore/reconcile | Relationship checks |
| Failed migration | Migration/CI failure | Stop release | Retry/forward fix | Migration audit |
| Destructive mutation | Integrity/audit evidence | Restrict affected operations | Restore/repair by authorization | Canonical-state checks |
| Configuration loss | Runtime validation | Disable unsafe capability | Restore controlled config | Environment validation |
| Expired credential | Dependency/auth failure | Revoke/rotate | Update config/redeploy | Provider/auth check |
| Provider outage | Provider/dependency signals | Preserve pending/ambiguous state | Reconcile | No duplicate side effect |
| Qikink outage | Fulfillment telemetry | Hold ambiguous work | Reconcile | Provider reference check |
| Shipping outage | Shipment telemetry | Hold creation/reconciliation | Reconcile | Shipment/tracking |
| Payment outage | Callback/payment telemetry | Stop unsafe financial mutation | Reconcile | Financial invariants |
| Webhook outage | Event processing state | Prevent unsafe replay | Controlled replay/reconcile | Idempotency |
| Job outage | Job state/retry telemetry | Pause unsafe worker | Resume controlled | Duplicate-side-effect check |
| Cache outage | Runtime behavior | Treat cache as disposable | Rebuild | Canonical DB |
| Search corruption | Search validation | Disable/degrade search | Rebuild | Catalog consistency |
| Content corruption | Editorial state | Preserve last valid publication | Restore revision | Approval/version check |
| Account corruption | Account/privacy audit | Restrict affected changes | Restore/reconcile | Identity/privacy |
| Notification outage | Delivery state | Preserve durable state | Resume idempotently | Duplicate check |
| Security incident | Security telemetry | Contain/revoke | Restore/rotate/redeploy | Access/audit verification |

## 28. Recovery exercise results

The repository exercise is executed by `npm run recovery:drill` and in CI by the dedicated **Recovery Drill** job.

The exercise performs:

- PostgreSQL custom-format dump;
- SHA-256 checksum of the dump artifact;
- isolated temporary database creation;
- `pg_restore`;
- restored-database validation;
- cleanup of the temporary database.

The script records:

- backup artifact timestamp;
- database-available timestamp;
- validation-complete timestamp;
- measured restore duration;
- measured validation duration;
- measured total recovery duration;
- explicit data-loss boundary.

**Recorded CI result (2026-10-03):** the Phase 15.18 Recovery Drill completed successfully on CI run #491. The drill created a custom-format PostgreSQL backup, restored it into an isolated temporary database, passed all restore validations, and terminated the temporary database session before cleanup. Measured recovery duration was **1.190 seconds**, consisting of **1.091 seconds** to database availability and **0.099 seconds** for validation. No production restore is claimed.

## 29. Measured RTO/RPO

Measured CI recovery duration is evidence for the **CI PostgreSQL exercise only**. It must not be presented as a production RTO. The successful run recorded 47 completed migrations, 178 primary/unique/foreign-key constraints, required critical tables and indexes, and no invalid domain values.

The CI exercise uses an approved test database without production customer data. Therefore its data-loss boundary is:

> schema-only CI exercise; no production data-loss measurement.

Production RPO remains dependent on the actual managed PostgreSQL backup/PITR configuration and must be measured from an approved production-like recovery exercise.

## 30. Recovery observability

Recovery telemetry should capture:

- restore started/completed/failed;
- migration validation;
- integrity validation;
- application startup;
- dependency validation;
- recovery verification.

Telemetry must exclude secrets and unnecessary PII.

The recovery drill prints timing metadata only; it does not print database credentials.

## 31. Business continuity communication

Internal operators need recovery status, affected capability, selected recovery point, deployment/migration identity, reconciliation state and final disposition.

Customer communication must be accurate, minimal and actionable. Internal recovery mechanisms and credentials must not be disclosed.

## 32. Post-recovery verification

Before declaring recovery complete, verify:

- storefront;
- catalog;
- search;
- authentication;
- customer accounts;
- cart;
- checkout boundary;
- payment state;
- orders;
- fulfillment;
- shipping;
- tracking;
- returns/cancellations;
- notifications;
- content;
- analytics isolation;
- feature flags;
- admin;
- audit logs;
- observability.

Critical business state is checked before service is declared recovered.

## 33. Verification commands

Required CI suite:

```text
npm run lint
npm run typecheck
npm test
npm run build
```

Recovery-specific validation:

```text
npx prisma validate
npm run db:audit-migrations
npm run recovery:validate
npm run recovery:drill
```

CI must not be weakened, tests must not be deleted, and failures must be fixed at their root cause.

## 34. CI failure policy

If a check fails:

1. identify the root cause;
2. determine whether it is Phase 15.18-induced or inherited;
3. fix the actual issue;
4. rerun the failed check;
5. rerun the complete CI suite.

Inherited blockers remain documented and prevent a READY declaration.

## 35. Known limitations

- Production backup existence, retention and immutability are provider-side and cannot be proven from repository code alone.
- Production PITR capability and recovery window are not established by this repository.
- CI restore validation uses an ephemeral PostgreSQL service rather than the production database provider.
- The CI exercise does not measure production customer-data loss because it contains no production data.
- External payment/Qikink/shipping provider reconciliation cannot be claimed merely from local database restore.
- Media recovery depends on the external media/storage owner and its backup/versioning controls.
- Exact production RTO/RPO values remain provisional until measured against production-like infrastructure.
- The repository must not claim zero data loss or provider-side immutable backups without evidence.

## 36. Deferred work

- Provider-specific production backup/PITR evidence collection.
- Scheduled production-like restore exercises using approved sanitized/representative data.
- Evidence-backed production RTO/RPO targets.
- External paging/escalation integration if operationally required.
- Provider-specific reconciliation exercises where sandbox capability exists.
- Media/object-storage restore validation where the production media provider supports a safe recovery environment.

## 37. Production readiness decision

**PHASE: 15.18**

**STATUS: NOT READY**

**BUSINESS CONTINUITY**
- Critical service map: documented above
- RTO: provisional; production measurement pending
- RPO: provisional; provider backup/PITR evidence pending
- Backup: repository architecture documented; production provider evidence pending
- Restore: non-production PostgreSQL dump/restore drill implemented
- Restore validation: implemented and read-only
- Migration recovery: documented and integrated with release governance
- Application recovery: documented
- Search recovery: derived-state rebuild documented
- Content recovery: version/approval recovery documented
- Feature flag recovery: safe-default behavior documented
- Customer account recovery: lifecycle/security recovery documented
- Payment recovery: reconciliation-first recovery documented
- Order recovery: canonical-state recovery documented
- Fulfillment recovery: idempotency/reconciliation preserved
- Qikink recovery: provider-only reconciliation documented
- Shipping recovery: reconciliation-first recovery documented
- Webhook recovery: controlled/idempotent replay documented
- Background jobs: state-aware recovery documented
- Notification recovery: idempotent resume documented
- Privacy/security: recovery controls documented
- Recovery access: RBAC/audit/least privilege required
- Recovery environment: CI isolation implemented
- Recovery exercise: implemented; current measured run pending
- Measured recovery time: pending current CI run
- Data-loss boundary: CI exercise explicitly does not represent production data loss

**CI**
- lint: PASS — CI run #491
- typecheck: PASS — CI run #491
- test: PASS — 635 tests, 635 passed, CI run #491
- build: PASS — CI run #491

**BLOCKERS**
- Production backup/PITR recoverability has not been evidenced by an approved production-like restore exercise.
- Production backup/PITR recoverability still requires provider evidence and an approved production-like restore exercise before production recovery readiness can be declared.

**REGRESSIONS**
- None introduced by the Phase 15.18 changes currently known.

**DEFERRED**
- Production-provider recovery evidence and evidence-backed RTO/RPO targets.

**NEXT_PHASE**
- 15.19

Do not start Phase 15.19 until the recovery exercise and complete CI evidence satisfy the readiness gate.

## 38. Hard stop

- Do not replace Netlify.
- Do not introduce speculative multi-region infrastructure.
- Do not overwrite production during recovery testing.
- Do not execute real payment, fulfillment, shipping or notification side effects during recovery exercises.
- Do not claim production backups are recoverable without restoration evidence.
- Do not claim zero data loss without evidence.
- Do not redesign completed business domains.
- Do not weaken CI.
- Do not start Phase 15.19 until Phase 15.18 has been audited, recovery-tested, documented and gated.
