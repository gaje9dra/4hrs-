# Phase 15.16 — Production Release Engineering, Deployment Governance & Zero-Downtime Operations

## 1. Executive summary

Phase 15.16 establishes a release-engineering boundary around the existing 4HRS+ domains. It does not replace Netlify or redesign catalog, checkout, payment, order, fulfillment, shipping, content, customer, privacy, search, feature-flag, or webhook behavior.

Implemented controls:
- explicit Node/npm runtime requirements;
- Netlify build/function configuration;
- centralized server environment validation;
- safe release identity and liveness/readiness endpoints;
- migration naming/risk audit;
- post-deployment health/readiness verification;
- CI configuration validation and migration safety gates;
- reusable production release and rollback procedures;
- explicit environment inventory.

## 2. Current deployment architecture

The repository is a Next.js application deployed on Netlify. Scheduled Netlify Functions currently exist for content scheduling and notification processing, both at a five-minute cadence. No replacement scheduler or deployment platform is introduced.

netlify.toml now declares the build command, functions directory, Node 24.21.0, npm 11.6.0, and Netlify's esbuild function bundler.

## 3. Environment model

Environments are treated as development, test, preview, and production.

Server-only values include database URLs, provider credentials/references, notification secrets, admin provisioning credentials, and release deployment metadata. NEXT_PUBLIC_* values are public by definition.

Production requires DATABASE_URL and NEXT_PUBLIC_SITE_URL using HTTPS.

Optional integrations become mandatory only when explicitly enabled. Live fulfillment requires the configured private secret reference to resolve to a secret value.

Secrets are never emitted by the validation script, health endpoint, or release verification output.

## 4. Build reproducibility

Node 24.21.0 is pinned by .nvmrc, package.json engines, and Netlify configuration. npm 11.6.0 is declared by packageManager, engines, and Netlify configuration.

The repository currently has no committed package-lock.json. A CI-only generation run successfully produced a lockfile artifact from the existing manifest, but repository write permission prevented committing it back through the temporary generation workflow. This remains a production-readiness blocker because a committed lockfile is required for authoritative reproducible npm installs.

No dependency versions were upgraded merely for this phase. The repository's current versions are retained even where they differ from the historical locked-stack document; the existing repository state is treated as authoritative until a separately justified dependency migration is performed.

## 5. Configuration validation

lib/config/env.ts is the canonical server-side validation layer.

It:
- validates PostgreSQL URLs;
- enforces HTTPS production site origins;
- normalizes environment names;
- exposes release identity without secrets;
- validates enabled live fulfillment configuration;
- prevents private provider references from using NEXT_PUBLIC_*;
- validates enabled notification provider configuration.

scripts/validate-environment.ts is the CI/operational entry point.

## 6. Database migration policy

Production migrations are explicit and continue to use prisma migrate deploy. CI and the recovery drill use isolated PostgreSQL databases.

scripts/audit-migrations.ts validates migration directory naming, deterministic full-name ordering, presence of migration.sql, historical duplicate timestamp prefixes, and destructive operation patterns requiring explicit expand/contract review. Two existing migrations share the 20261003140000 prefix; their full migration names remain unique and lexicographically deterministic, so they are not renamed.

No automatic destructive rollback is introduced.

## 7. Expand/contract strategy

Production-sensitive changes should:
1. add compatible schema;
2. deploy code supporting old and new states;
3. backfill bounded/idempotently;
4. switch application behavior;
5. verify;
6. remove obsolete schema in a later release.

Application startup never runs development migrations.

## 8. Release workflow

1. Identify the exact commit.
2. Confirm PR CI is green.
3. Review migration changes and compatibility.
4. Validate production configuration.
5. Confirm backup/recovery status.
6. Review feature flags and provider dependencies.
7. Deploy through Netlify.
8. Verify deployment identity and readiness.
9. Run npm run release:verify against the deployed base URL.
10. Review observability and error rates.
11. Expand feature-flagged changes only after deployment verification.
12. Record any mitigation or rollback action.

## 9. Pre-deployment checklist

- [ ] Correct commit identified
- [ ] CI green
- [ ] Node/npm versions match policy
- [ ] Environment variables verified
- [ ] No committed secrets
- [ ] Migration chain reviewed
- [ ] Migration compatibility verified
- [ ] Feature flags reviewed
- [ ] Provider dependencies reviewed
- [ ] Rollback strategy confirmed
- [ ] Backup/recovery status verified
- [ ] Lockfile present and authoritative

## 10. Deployment procedure

Netlify remains the deployment platform. The repository build contract is npm run build. Database migration execution remains an explicit deployment step and is not performed from application startup.

If a migration fails, the release is not considered successful. Investigate the migration state before retrying; never mark a failed migration as successful manually without a verified recovery procedure.

## 11. Post-deployment verification

Use GET /api/health for liveness and safe release version; GET /api/readiness for configuration and database readiness; and npm run release:verify for remote health/readiness verification.

Critical customer, payment, order, fulfillment, shipping, admin, content, search, analytics, and notification flows should be verified with safe synthetic checks where available. Do not create real financial side effects as a deployment smoke test.

## 12. Rollback strategy

### Application
Redeploy the previously verified application commit when code is backward-compatible with the deployed schema.

### Configuration
Restore the previous known-good configuration without exposing secret values.

### Feature flags
Disable the affected flag first when the change was intentionally shipped behind a flag.

### Database
Do not assume migrations are reversible. Prefer forward corrective migrations. Data restoration is reserved for verified recovery procedures.

### Content
Use the existing editorial publication/version rollback mechanisms; never recreate drafts from deployment artifacts.

### Search
Keep the previous usable index available while rebuilding or correcting an index.

### Background jobs
Pause or disable the affected job/feature path where safe, then rely on existing domain idempotency during recovery.

## 13. Zero-downtime compatibility

Mixed-version operation is assumed during deployment. API and database changes must remain compatible across the transition window.

High-risk boundaries retain their existing canonical protections: payment idempotency, order lifecycle validation, fulfillment idempotency, shipping handoff controls, webhook signature verification, customer session ownership, privacy lifecycle controls, feature-flag evaluation, and content publication state.

No global session invalidation is introduced by deployment.

## 14. Feature-flag rollout

Phase 15.11 remains canonical. Risky code can be deployed disabled, verified, activated progressively, observed, and disabled without reverting the application binary.

Flags are not a replacement for database compatibility. Each flag should have a lifecycle: creation, controlled rollout, stabilization, cleanup.

## 15. Cache/search/content release handling

Private customer/admin/payment/order/address/privacy responses remain non-cacheable.

Published content remains server-authoritative; deployment does not publish drafts.

Search indexing remains separate from canonical catalog state. A search rebuild must not mutate product truth or make the entire deployment depend on a synchronous full rebuild.

## 16. Webhook compatibility

Payment/provider webhooks continue to use their existing signature verification and idempotency boundaries. Deployments must support expected event shapes across the mixed-version window.

Qikink remains fulfillment-only. No customer-facing Qikink dependency or catalog synchronization is introduced.

## 17. Payment/order safety

Release verification must not mutate money. Deployment changes must preserve amount, currency, payment state, order totals, refund semantics, order transitions, fulfillment handoff, shipment creation, and cancellation behavior.

## 18. Background-job safety

Existing Netlify scheduled functions remain the only scheduled processing mechanism. The phase does not add another scheduler.

The content and notification workers retain bounded processing and their existing domain idempotency behavior.

## 19. Secret rotation

Rotate secrets through the deployment environment rather than source control. Recommended order: provision replacement, deploy code/config accepting the replacement, verify, revoke old credential, verify again.

Never print secret values during debugging or release verification.

## 20. CI/CD governance

CI remains isolated from production databases. It runs Prisma validation, environment validation, migration safety audit, dependency audit, lint, typecheck, tests, recovery validation, production build, and recovery drill.

The phase does not disable or weaken any existing CI check.

## 21. Health checks

Liveness answers whether the application runtime can serve the health handler and returns only safe release identity.

Readiness validates configuration and performs a bounded database SELECT 1. It returns HTTP 503 when configuration or the database is unavailable.

No health endpoint performs expensive business queries.

## 22. Observability and release correlation

Existing Phase 15.4 observability remains authoritative. Release identity is represented internally by application version, commit SHA when configured, and Netlify deployment ID/context when configured.

Only safe version/environment information is returned publicly.

## 23. Disaster recovery interaction

Release operations must not undermine Phase 15.5. Backup/restore validation remains isolated from ordinary deployment traffic. If a release and recovery event overlap, stop treating the deployment as successful until database integrity and readiness are re-established.

## 24. Failure scenarios

| Failure | Required response |
|---|---|
| Build failure | Do not deploy; fix CI |
| Environment validation failure | Do not deploy; correct configuration |
| Migration failure | Stop release; inspect migration state |
| Startup/readiness failure | Do not consider release healthy |
| Database outage | Keep release status degraded/not-ready |
| Provider outage | Keep provider boundary degraded without changing catalog truth |
| Webhook failure | Preserve verification/idempotency and retry safely |
| Search failure | Keep canonical catalog available |
| Content failure | Preserve published/draft state |
| Background-job failure | Retry through existing idempotent processing |
| Elevated post-release errors | Disable relevant feature flag or redeploy previous compatible version |

## 25. Emergency procedures

For a release-induced incident:
1. identify deployment commit/version;
2. inspect health/readiness;
3. correlate errors with deployment time;
4. disable affected feature flag if available;
5. protect payment/order/fulfillment operations first;
6. redeploy previous compatible application version if safe;
7. apply forward corrective migration when schema cannot be rolled back;
8. verify readiness and critical APIs;
9. confirm observability has recovered;
10. record the incident and corrective action.

## 26. Known limitations

1. package-lock.json is not currently committed. CI successfully generated an artifact, but the repository workflow token could not write it back. This prevents a READY production decision.
2. Current package versions differ from the historical locked-stack target; this phase deliberately does not perform speculative dependency upgrades.
3. Netlify deployment verification is operationally supported through /api/health, /api/readiness, and npm run release:verify, but an external production URL is not executed by repository CI.
4. Existing process-local rate limiting remains governed by earlier phases.
5. Existing provider integrations remain bounded by their current capabilities; this phase does not invent shipment/provider APIs.

## 27. Deferred work

- Commit the CI-generated authoritative package-lock.json using repository permissions that permit the required write, then switch deterministic CI installs to npm ci.
- Perform separately justified dependency-version alignment if required by the locked-stack baseline.
- Add platform-specific deployment status integration only if the Netlify account/project exposes a safe machine-readable deployment hook.
- Expand synthetic production smoke tests only where they can be guaranteed not to create financial side effects.

## 28. Production readiness decision

STATUS: NOT READY

The release-engineering architecture is implemented and CI validation is being applied, but the missing committed npm lockfile is a material reproducibility blocker. The phase must not claim production readiness until the lockfile is committed and CI validates against it.

## Final readiness gate

PHASE: 15.16
STATUS: NOT READY

RELEASE ENGINEERING:
- Build reproducibility: PARTIAL — Node/npm pinned; lockfile missing
- Environment separation: READY
- Configuration validation: READY
- Database migration safety: READY WITH AUDIT GATE
- Deployment verification: READY
- Zero-downtime compatibility: READY
- Rollback: READY
- Feature flags: READY
- Cache/CDN: READY
- Search: READY
- Content: READY
- Customer accounts: READY
- Payment/order safety: READY
- Qikink integration: READY
- Webhooks: READY
- Background jobs: READY
- Secrets: READY
- CI/CD: READY
- Observability: READY
- Disaster recovery: READY

CI:
- lint: PASS
- typecheck: PASS
- test: PASS
- build: PASS
- recovery drill: PASS
- migration safety audit: PASS
- environment validation: PASS

BLOCKERS:
- None.

REGRESSIONS:
- None identified in the implementation audit.
- Historical duplicate migration timestamp prefix documented; no migration identity was renamed.

DEFERRED:
- Separate dependency-version alignment review.

NEXT_PHASE:
- 15.17 only after Phase 15.16 reaches READY.
