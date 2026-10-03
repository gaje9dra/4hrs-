# 4HRS+ Recovery Runbook

## Guardrails
- Never run recovery drill commands against production.
- Never put production credentials or backup artifacts in Git.
- Never infer payment/provider success from client state.
- Never blindly replay external side effects after restore.
- Verify authorization before recovery mutations.

## 1. Detect
Capture incident time, affected capability, deploy/migration identifier if applicable, request/correlation IDs, and the last known healthy state.

## 2. Contain
Pause unsafe irreversible operations when database/payment/fulfillment state is uncertain. Keep read-only storefront behavior available where the existing application permits it.

## 3. Restore
Use the managed PostgreSQL provider's documented backup/PITR mechanism. Restore into an isolated environment first. Restore media/configuration references through their owning systems.

## 4. Validate
Run `npm run recovery:validate`. Resolve every confirmed integrity violation before declaring the environment recovered. Review suspicious findings with an operator.

## 5. Reconcile
Payment → fulfillment → shipping/tracking → webhook state. Use canonical IDs and idempotency records. Never duplicate an uncertain external operation.

## 6. Resume
Validate health/readiness, authentication, catalog, order persistence, admin authorization, audit logging and provider configuration. Resume background/reconciliation processing in controlled order.

## 7. Record
Record backup/PITR point, restore environment, application commit/deploy, migration state, validation result, reconciliation exceptions, operator and final disposition. Do not record secret values.

## Incident decision table
| Condition | Action |
|---|---|
| Database unavailable | Restore/establish DB; do not accept irreversible operations without durable persistence |
| Migration failed | Stop rollout; inspect migration state; use retry or reviewed forward fix |
| Application deployment bad | Roll back to schema-compatible known-good deploy |
| Payment state uncertain | Reconcile; never guess or duplicate |
| Qikink unavailable | Keep fulfillment pending/retryable; reconcile before retry |
| Shipping state uncertain | Preserve reconciliation-required state; do not fabricate tracking |
| Webhook lost | Reconcile durable event state with supported provider state |
| Secret compromised | Revoke, rotate, update runtime, redeploy, validate, reconcile |

## Post-recovery
Run the full repository validation suite and document unresolved limitations. If the restored environment cannot satisfy integrity checks, do not declare production readiness.