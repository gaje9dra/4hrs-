# Phase 15.5 — Production Backup, Disaster Recovery, Data Integrity & Business Continuity

## Recovery objectives
This phase establishes a verified recovery model: DATA → BACKUP → RESTORE → VALIDATION → APPLICATION RECOVERY → DOMAIN RECONCILIATION → OPERATIONAL RESUMPTION.
The repository deliberately does not pretend that application code owns managed PostgreSQL backups, Netlify deploy storage, object storage, or provider systems. Those infrastructure controls remain external operational dependencies and must be configured and periodically verified by authorized operators.

## RPO
RPO is an operational target, not a guaranteed SLA, unless the production database provider explicitly supplies the capability and contract.

| State | Recovery target | Source of truth |
|---|---|---|
| Customer/account | Minimize loss to the latest verified database backup/PITR point | PostgreSQL |
| Catalog | Minimize loss to latest verified database backup/PITR point | PostgreSQL |
| Orders | Prefer zero business reconstruction from frontend state; recover from latest durable DB point and reconcile external state | PostgreSQL + provider reconciliation |
| Payments | No inferred loss tolerance; restore DB then reconcile uncertain provider state before irreversible action | PostgreSQL + payment provider |
| Fulfillment | Restore durable intent/idempotency records, then reconcile ambiguous operations | PostgreSQL + provider |
| Shipping/tracking | Restore durable shipment/tracking records, then reconcile provider state where supported | PostgreSQL + shipping provider |
| Returns/cancellations | Recover durable requests and audit history; do not replay side effects automatically | PostgreSQL |
| Cases/audit | Recover from database backup; preserve audit records as operational evidence | PostgreSQL |

## RTO
RTO is an operational target rather than a guaranteed SLA because the repository does not control database restore infrastructure, Netlify account access, DNS, provider availability, or external backup systems.
Priority order after a disaster: database connectivity/schema → storefront/catalog → authentication/customer access → checkout/order persistence → payment reconciliation → admin/reconciliation → fulfillment/shipping recovery.

## Data inventory
| Category | Source of truth | Backup/restore | Validation | Priority |
|---|---|---|---|---|
| Primary database | PostgreSQL | Managed DB backup/PITR or operator dump | `recovery:validate` + integrity audit | Critical |
| Product/catalog | PostgreSQL | Same database backup | schema + catalog relationship checks | Critical |
| Customer/order/payment | PostgreSQL | Same database backup | relationship + financial invariants | Critical |
| Fulfillment/shipping/tracking | PostgreSQL plus provider state | DB restore then provider reconciliation | idempotency/reconciliation checks | Critical |
| Returns/cancellation/cases | PostgreSQL | Same database backup | ownership/quantity/state checks | High |
| Admin/audit | PostgreSQL | Same database backup | audit relationship/continuity checks | Critical |
| Media | ProductImage URL/storageReference and any external object service actually configured | External provider backup/versioning | reference availability audit | High where used |
| Configuration | Controlled environment/Netlify settings | Reconstruct from controlled configuration sources | required-variable checklist | Critical |
| Secrets | Secret manager/Netlify environment configuration | Rotate/reissue, never back up into Git | secret presence without value exposure | Critical |
| Deployment | Git + Netlify deploy history | Git commit + Netlify rollback | production build | High |
| Telemetry | Runtime/observability backend | Provider retention policy | health/telemetry checks | Medium |
| Derived/cache state | None; disposable | Rebuild | application behavior | Low |

## Backup architecture
Production PostgreSQL backups must be owned by the managed database operator/provider. Configure encrypted automated backups and point-in-time recovery where the selected production plan supports them. The application repository does not implement a customer-facing dump endpoint.
At minimum, production operators must know: backup owner, storage location, encryption status, access principals, backup cadence, retention policy, restore mechanism, and last successful restore verification.

## Backup retention
Retention must be selected from the actual database provider plan, regulatory/business requirements, and recovery window. Do not treat a repository-defined number as an SLA. Keep frequent recovery points for operational failures and longer-lived backups only where justified.

## Backup security
Backups contain customer, financial, credential-related and operational data. Keep them encrypted at rest/in transit, restrict access to recovery operators, separate database/backup credentials from application credentials, audit access, and apply an explicit deletion/retention policy. Never commit dumps or secrets to Git or public assets.

## Restore procedure
1. Declare the incident and freeze unsafe irreversible operations if necessary.
2. Establish an isolated non-production recovery environment first.
3. Restore the selected PostgreSQL backup/PITR point.
4. Run Prisma schema validation and `npm run recovery:validate`.
5. Verify migration state and required indexes/constraints.
6. Restore required external media/configuration references without exposing private assets.
7. Deploy the application version compatible with the restored schema.
8. Run domain integrity checks.
9. Reconcile payment, fulfillment, shipping and webhook state before replaying irreversible operations.
10. Verify health/readiness, authentication, catalog, checkout persistence, admin access and reconciliation tooling.
11. Resume background/reconciliation work in controlled order.
12. Record the recovery outcome and unresolved exceptions.

## Restore validation
`npm run recovery:validate` checks database connectivity, required core tables, migration completion, indexes, primary/unique/foreign-key constraints and critical invalid-value conditions, then runs the domain integrity audit. It is read-only.

## Integrity checks
The integrity audit detects, among other conditions: orders without items, order subtotal/total mismatches, invalid item quantities, line-total mismatches, payment/order amount mismatches requiring reconciliation, refunds exceeding payment amounts, fulfillment quantities exceeding ordered quantities, invalid return quantities, orphan relationships, and duplicate business identifiers. It reports findings; it does not silently repair records.
Findings are classified as confirmed violation, suspicious condition, or expected historical condition. Current automated checks only emit confirmed/suspicious findings where the repository can establish the condition from durable state.

## Safe repair boundary
Recovery repair is intentionally narrow. The existing implementation only supports an explicit shipment-reconciliation request, requires a target, operator identity, reason and idempotency key, supports dry-run, requires the `shipping.recovery` admin permission for mutation, executes in a transaction, and writes an AdminAuditLog entry. There is no generic SQL repair endpoint and no arbitrary field-update interface.

## Migration recovery
Prisma migration history is authoritative for application schema state. A failed migration must be treated as an incident: preserve the failure evidence, inspect the database/migration state, determine whether the migration is safe to retry or requires a controlled forward fix, and only then continue deployment. Do not assume Prisma migrations are automatically reversible.
Application rollback does not imply database rollback. Prefer expand/contract migrations and deploy application code compatible with both the old and new schema during transitions where Netlify deployment sequencing requires it.

## Deployment rollback
For a bad application deployment, use the controlled Netlify deploy rollback/previous known-good deploy mechanism. If a migration already changed the database, do not blindly revert Git and expect the schema to revert. Use a compatible application version or a reviewed forward-fix migration.

## Netlify recovery
Netlify remains the deployment platform. Production operators must preserve access to deploy history, rollback capability, environment variables, build settings, functions, redirects and headers. The repository currently has no committed `netlify.toml`; therefore those account-level/site-level settings must be documented and controlled in Netlify rather than assumed to exist in Git.
Recovery must not depend on a developer workstation, uncommitted files, local `.env` files or a local database.

## Secret rotation
For compromised or rotated credentials: revoke old credentials → issue new credentials → update controlled runtime configuration → redeploy → verify authenticated provider/webhook behavior → reconcile operations that were uncertain during the incident. Never place secret values in documentation or recovery logs.
Evaluate database credentials, authentication secrets, payment credentials, Qikink credentials, webhook secrets and other third-party API credentials.

## Provider outage recovery
Payment provider outages must not create false paid orders. Qikink outages leave fulfillment pending/retryable according to the existing provider-neutral state machine. Shipping outages leave shipment state explicitly pending/blocked and must not fabricate tracking. Provider systems are reconciliation sources, not substitutes for 4HRS+ canonical records.

## Webhook recovery
Webhook loss handling must use existing idempotency/reconciliation boundaries. Detect delayed/failed events, safely retry supported processing, reconcile durable event records with provider state where the existing adapter supports it, and use manual operator review where automated reconciliation is unavailable. Never invent undocumented provider endpoints.

## Payment recovery
Payment recovery uses persisted payment identifiers, attempts, events, idempotency and refund state. Never infer financial truth from browser redirects, frontend success pages or logs alone. If restored database state conflicts with external payment state, mark the operation for reconciliation rather than guessing or issuing a duplicate payment/refund.

## Fulfillment recovery
Restore `Fulfillment`, `FulfillmentItem` and operation-idempotency records together. Distinguish pending, submitted, failed and ambiguous states according to the existing domain. Never blindly resubmit every pending row; reconcile ambiguous provider operations first. Qikink remains provider-only.

## Shipping recovery
Restore Shipment and TrackingEvent records together with reconciliation flags and provider references. Never fabricate tracking events. If provider state cannot be verified, preserve the explicit unresolved/reconciliation-required state.

## Return/cancellation recovery
Restore request state, item quantities, return shipments, inspections, resolutions, cancellation records and cases. Do not automatically replay financial, fulfillment or shipment side effects after restore.

## Audit recovery
AdminAuditLog and domain audit records are part of the PostgreSQL recovery surface. They must be restored with the database and validated for relationship continuity. Recovery must not silently delete or rewrite historical audit evidence.

## Media recovery
Product media stores URL/storageReference metadata in PostgreSQL. The repository does not contain a standalone object-storage backup service. If production media is backed by an external object provider, its bucket/container backup/versioning and access policy are a separate recovery dependency. Restored records pointing to missing objects must be detected before declaring full recovery.

## Recovery drill
The repository includes `npm run recovery:drill`. In a non-production PostgreSQL environment it creates a custom-format `pg_dump`, computes an integrity hash of the backup artifact, creates an isolated temporary database, restores the dump with `pg_restore`, runs restore validation, and drops the temporary database. It refuses to run when `NODE_ENV=production`.
CI should run this drill against the ephemeral PostgreSQL service so backup/restore behavior is exercised without touching production.
Application rollback, migration failure, provider outage and webhook-loss scenarios are covered as controlled regression scenarios: they validate that recovery remains state-preserving and does not invoke irreversible provider actions automatically.

## Reconciliation procedures
After restoration: first reconcile payment state, then fulfillment submission state, then shipment/tracking state, and finally webhook/retry queues. Use canonical idempotency records and explicit reconciliation flags. Do not duplicate payments, refunds, fulfillment submissions or shipments.

## Business continuity modes
| Failure | Safe mode | Prohibited behavior |
|---|---|---|
| Payment unavailable | Storefront may remain available; payment operations fail safely | Marking an order paid without durable verified payment state |
| Qikink unavailable | Catalog remains available; fulfillment can remain pending/retryable | Fake provider success or blind resubmission |
| Shipping unavailable | Shipment remains pending/blocked; tracking remains unchanged | Fabricated tracking |
| Database unavailable | Read/write operations fail safely according to existing application behavior | Accepting irreversible operations without durable persistence |

## Customer recovery safety
Unique customer email, order number, checkout reference, payment references, idempotency keys and relationship constraints must remain effective after restore. Recovery must not create duplicate accounts/orders/payments/addresses/cases or break customer ownership.

## Admin recovery safety
Production recovery must not invoke development admin provisioning. Admin roles/permissions must be restored from the database and validated. Recovery operations are restricted to authorized operators and audit their mutations.

## Recovery access control
Database restore, backup access and destructive recovery operations remain infrastructure-level privileged actions. Repository repair mutation requires `shipping.recovery` and an authorized AdminAuthorizationContext. No public recovery endpoint is exposed.

## Known limitations
- Managed database backup/PITR availability depends on the actual production database plan.
- Netlify account/site configuration is external to this repository; the repository cannot prove a particular production setting exists.
- External media/object storage backup is not implemented by the repository and must be verified at the storage-provider layer.
- No production recovery test is permitted or claimed.
- No fixed RPO/RTO guarantee is claimed without infrastructure evidence.
- Process-local telemetry from Phase 15.4 is not a disaster-recovery store.
- Provider reconciliation capabilities are limited to documented existing adapters; no undocumented API is assumed.

## Operator runbook
### Database loss
Freeze irreversible operations → identify last verified backup/PITR point → restore into isolated environment → run `npm run recovery:validate` → deploy compatible application → reconcile external state → validate health/auth/catalog/payment/fulfillment/shipping/admin → resume operations.
### Bad deployment
Stop rollout → select known-good Netlify deploy → verify schema compatibility → roll back application only when schema remains compatible → otherwise forward-fix the application/schema pair → run full validation.
### Failed migration
Stop deployment → preserve migration error → inspect `_prisma_migrations` and database state → determine retry/forward-fix path → do not assume Git rollback reverses schema → validate before resuming.
### Credential compromise
Revoke → rotate → update controlled secret store/Netlify environment → redeploy → verify provider/webhook authentication → reconcile affected operations.
### Provider uncertainty
Do not infer success from a timeout. Preserve canonical pending/ambiguous state and use the existing reconciliation boundary.

## Verification commands
`npm install`
`npx prisma validate`
`npx prisma generate`
`npx prisma migrate status`
`npm run recovery:validate`
`npm run recovery:drill` (non-production only)
`npm test`
`npm run lint`
`npm run typecheck`
`npm run build`
`npm audit --omit=dev --audit-level=high`
