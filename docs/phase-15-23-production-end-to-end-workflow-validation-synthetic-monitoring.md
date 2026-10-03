# Phase 15.23 — Production End-to-End Workflow Validation, Synthetic Monitoring & Continuous Readiness Certification

## Architecture
The synthetic layer is a provider-neutral validation plane over existing application contracts. It stores execution and step evidence but does not duplicate commerce, fulfillment, payment, notification, analytics, feature-flag, governance, or reconciliation business logic.

## Registry and criticality
The registry models the critical customer and operational journeys named by Phase 15.23. P0/P1/P2/P3 determine alerting/readiness priority without becoming a quality score. The registry contains read-only production-safe storefront/catalog checks plus explicit blocked definitions for mutation-heavy journeys whose production-safe contract does not exist.

## Safety
Production-safe execution fails closed unless SYNTHETIC_MONITORING_ENABLED=true, NODE_ENV=production, an HTTPS SYNTHETIC_ALLOWED_BASE_URL exists, payment is explicitly boundary-only, notifications are suppressed or sent to a controlled sink, and live fulfillment mode is rejected. Provider/order/payment/refund/cancellation mutations are never triggered by synthetic browser or monitoring code.

## Synthetic identities
A deterministic catalog-fixture identity is persisted per workflow/environment. It contains no real PII and is not a Customer record. Mutation workflows require a future dedicated synthetic identity contract rather than reusing real accounts.

## Execution and evidence
Each execution records workflow, mode, environment, timing, status, failure classification, correlation/trace IDs, release/deployment identifiers, feature-flag context, dependency version context, evidence, cleanup state, and step-level status. Sensitive payloads are not persisted.

## Production-safe workflows
Storefront availability, homepage rendering, category discovery, search/discovery, active product detail, variant availability, pricing visibility, SEO rendering, canonical behavior, and basic navigation are read-only and bounded.

## Intentionally blocked/unsupported
Cart mutation, customer authentication/account mutation, checkout mutation, real payment success/failure execution, order creation/idempotency mutation, fulfillment creation, Qikink production order creation, shipment creation, live tracking fabrication, cancellation, returns/refunds, customer communication delivery, customer data mutation, admin mutation, content publishing, feature-flag mutation, and search-index repair are explicitly blocked until a safe contract exists.

## Payment/provider status
Payment production monitoring is boundary-only. Qikink remains behind the server-side fulfillment adapter; live provider execution is not a synthetic capability. If an approved sandbox/mock/dry-run contract is later provided, the registry can integrate with that adapter without changing provider ownership.

## Notifications and analytics
Synthetic notifications require suppression or a controlled sink. Synthetic analytics must be explicitly identifiable and excluded from business metrics; the current production-safe registry avoids mutation/emission workflows until that exclusion contract is configured.

## Observability and incidents
Failures persist with correlation and release/deployment context and are sent to the existing reliability incident service with fingerprint deduplication. No parallel telemetry or incident system is created.

## Reconciliation and governance
Cross-domain discrepancies are handed to the existing Phase 15.22 reconciliation architecture rather than repaired silently. Execution and certification evidence is persisted for Phase 15.19 governance review; governance controls are not mutated by synthetic runs.

## Dashboard and manual execution
The admin route is /admin/synthetic and requires synthetic.read, synthetic.execute, or synthetic.certify. Manual execution requires a reason and trusted admin authorization. No arbitrary URL or code execution is exposed.

## Scheduling
The repository audit found no existing scheduler. CI-safe validation is integrated into CI. Production execution is opt-in through the synthetic monitor command/API and is intended to be scheduled by the deployment/operations scheduler when provisioned; no undocumented application cron was invented.

## Readiness and certification
The readiness engine evaluates the latest execution for every production-safe P0 workflow. Missing or non-healthy P0 evidence makes readiness NOT_READY; explicitly blocked capabilities are reported rather than passed. Certification records are historical evidence and certification is RBAC protected.

## CI/CD
CI runs Prisma validation, migration safety, architecture audits, reconciliation audit, synthetic registry audit, synthetic CI safety checks, lint, typecheck, tests, recovery validation, and build. Production-only checks remain separate from CI.

## Retention, privacy and cost
Execution evidence is bounded and redacted. The architecture avoids real PII, payment payloads, credentials, provider responses, and uncontrolled retries. Execution frequency and workflow selection are external/configurable to prevent synthetic monitoring from becoming a load or cost generator.

## Known limitations
There is no safe production contract in the current repository for real payment success/failure, order creation, Qikink production fulfillment, shipment creation, refund, customer account mutation, controlled notification delivery, or a production scheduler. Those capabilities are represented as blocked/unsupported, not false passes. A dedicated synthetic customer/admin identity contract is also an external prerequisite for deeper mutation journeys.

## Runbook
1. Configure production safety variables.
2. Run read-only production-safe workflows only.
3. Inspect /admin/synthetic.
4. Investigate FAILING or DEGRADED executions through existing reliability/observability tooling.
5. Do not bypass safety gates to make a workflow pass.
6. Add a safe adapter or fixture contract before unblocking a mutation workflow.
