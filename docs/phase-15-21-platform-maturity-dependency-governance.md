# Phase 15.21 — Production Platform Maturity, Dependency Governance & Architectural Debt Elimination

## Status
Implementation branch: `phase-15-21-platform-maturity`

This document is the factual architecture/debt register for Phase 15.21. It records repository evidence and remediation decisions; it does not claim external production facts that cannot be established from source control.

## 1. Architecture inventory

The repository is a Next.js App Router application deployed on Netlify.

Primary layers observed:
- `app/`: storefront, admin UI, API routes and route handlers.
- `components/`: presentation and interaction components.
- `lib/`: domain/application services, repositories, adapters, configuration, observability and security.
- `prisma/`: canonical persistence schema and ordered migrations.
- `netlify/functions/`: scheduled/background processing.
- `scripts/`: operational validation, recovery and migration checks.
- `tests/`: domain, API, persistence, provider and phase regression suites.
- `.github/workflows/ci.yml`: CI orchestration.

No separate top-level `services/` or `repositories/` tree exists; repository responsibilities are implemented under domain-specific `lib/*` modules.

## 2. Domain ownership

The repository has distinct ownership boundaries for catalog, cart, checkout, payment, order, fulfillment, shipping, returns/cancellations, customer, notifications, privacy, analytics, search/discovery, content, feature flags, admin and governance.

The audit found no evidence requiring a domain-ownership transfer. Qikink remains confined to fulfillment infrastructure; customer-facing catalog truth remains local.

## 3. Dependency rules

The following boundaries are enforced by the Phase 15.21 audit:
- UI layers must not import Prisma/client database infrastructure directly.
- Customer-facing storefront code must not reference Qikink/provider implementation details.
- Server libraries must not read arbitrary `NEXT_PUBLIC_*` secrets/configuration; the public site origin is the explicit exception.
- The committed package lock must match the direct dependency specifications in `package.json`.
- Node/npm pins must remain consistent across `.nvmrc`, `package.json` and `netlify.toml`.

## 4. Service and API boundaries

API routes are expected to delegate domain behavior into `lib/*` services and authorization boundaries. Existing admin APIs use the canonical admin authorization/RBAC layer.

The Phase 15.21 remediation adds static boundary checks rather than introducing a second service architecture.

## 5. Database access rules

Prisma remains the canonical persistence mechanism. UI components are prohibited from importing database infrastructure directly. Domain/application services and justified operational scripts remain the database access boundary.

The existing migration safety audit remains authoritative for migration naming and destructive-operation review.

## 6. Event architecture

The repository uses domain persistence plus explicit operational/event records for payments, notifications, reliability and governance. Events are not treated as replacements for canonical payment/order/catalog state.

No new event bus or distributed transaction mechanism is introduced by Phase 15.21.

## 7. Configuration architecture

`lib/config/env.ts` is the canonical server environment validation layer. Netlify and CI pin Node 24.21.0 and npm 11.6.0.

The repository now contains a committed `package-lock.json`, and CI uses `npm ci`. This supersedes the stale Phase 15.16 documentation statement that the lockfile was absent.

## 8. Dependency governance

The current repository manifest uses:
- Next.js 16.3.8
- React 19.3.x
- Prisma 6.19.x
- Tailwind CSS 4.1.x
- TypeScript 5.9.x
- ESLint 9.x
- Node 24.21.0
- npm 11.6.0

The Phase 15.21 specification repeats an earlier target stack containing Next.js 16.3.5, Tailwind 4.3.3, Prisma 6.19.3 and TypeScript 6.0.3. Repository history contains an explicit Phase 15.16 decision to retain the then-current dependency versions rather than perform speculative upgrades/downgrades. Therefore this phase does **not** perform a blind dependency migration.

This is recorded as deferred dependency alignment, not silently treated as resolved.

The package lock is structurally authoritative for the current manifest. npm documents that `package-lock.json` records the dependency tree and that `npm ci` requires a matching lockfile for frozen CI installs. citeturn0search0turn0search1

## 9. Supply-chain security

CI runs `npm audit --omit=dev --audit-level=high`, installs from the committed lockfile with `npm ci`, and uses read-only GitHub Actions repository permissions.

No new third-party security tooling is introduced.

## 10. Dead code/configuration review

The phase does not automatically delete ambiguous code. Candidates that may be environment- or rollback-dependent remain documented for targeted follow-up rather than being removed solely because static reachability is difficult to prove.

The current architecture includes several intentionally retained compatibility paths, including provider adapters and operational recovery scripts.

## 11. Error handling

Existing domain-specific error types and API mappers remain in place. No global error suppression is introduced.

A notable observability characteristic remains: the logger intentionally protects application execution from telemetry serialization failures. This is not treated as a business-state failure, but remains technical debt for richer fallback diagnostics.

## 12. Retry/timeout behavior

Provider and notification operations use bounded timeout/retry policies. Payment and fulfillment operations preserve idempotency boundaries and do not blindly retry ambiguous financial mutations.

No global retry wrapper is introduced.

## 13. Caching and frontend/server boundaries

The storefront/admin split is preserved. No database or provider adapter imports are permitted directly in UI layers by the new maturity audit.

No customer-facing redesign is introduced.

## 14. Bundle/delivery

Netlify remains the deployment platform. Server-only persistence/provider modules remain outside the intended UI dependency boundary. A full production bundle-size measurement is not available from repository metadata alone and is therefore recorded as deferred measurement rather than fabricated.

## 15. Test architecture

The repository contains domain, persistence, API, provider, storefront and phase-specific regression suites. Existing tests are retained.

Phase 15.21 adds an architecture-boundary audit that runs in CI and fails on newly introduced direct UI/database coupling, storefront/provider coupling, unsafe server-side public environment access, manifest/lock mismatch, or runtime-pin drift.

## 16. Test data

CI uses isolated PostgreSQL service databases and test configuration. Production credentials are not required by the test suite. Provider adapters use controlled test paths/mocks rather than live fulfillment mutations.

## 17. Migration governance

The repository contains an ordered Prisma migration history and an existing migration safety auditor. Phase 15.20 introduced an additive cost/capacity migration; the Phase 15.21 audit does not rewrite historical migrations.

A previously encountered migration-history mismatch involving governance tables is documented by the Phase 15.20 remediation history; Phase 15.20 removed its unsafe cross-migration seed dependency rather than altering historical migrations.

## 18. Observability consistency

Structured logging, request/correlation context, telemetry redaction and reliability incidents remain under `lib/observability` and `lib/reliability`.

Sensitive keys are redacted before telemetry emission.

## 19. Security consistency

Authentication, admin authorization, request-origin checks, rate limiting, provider credential isolation and webhook verification remain under their existing canonical modules.

One known limitation is process-local rate limiting in serverless execution. It is defense-in-depth rather than the authorization boundary, but it is not equivalent to globally coordinated distributed rate limiting.

## 20. Privacy consistency

Telemetry redaction and customer lifecycle controls remain separate from commerce state. Analytics, search and notification projections do not become sources of customer-account authority.

## 21. Admin architecture

Admin operations continue through the existing RBAC/audit boundary. Phase 15.21 does not create a second administrative authorization system.

## 22. Provider boundaries

Qikink remains fulfillment-only. Provider credentials and provider-specific request construction stay inside the fulfillment adapter/authentication modules.

No catalog synchronization or customer-facing Qikink dependency is introduced.

## 23. Search/content/analytics

Search and analytics remain projections. Content publication remains editorial state. None becomes financial or authorization authority.

## 24. API contracts

Existing API governance remains canonical. Phase 15.21 does not introduce duplicate DTO families or a second error contract.

## 25. Type safety and runtime validation

The current strict TypeScript configuration remains enabled. Runtime validation remains required at API/provider boundaries. The phase does not attempt a mechanical removal of every type assertion or `any`; production-sensitive boundaries are prioritized.

## 26. Technical debt register

| ID | Subsystem | Finding | Impact | Severity | Status | Target |
|---|---|---|---|---|---|---|
| TD-15.21-001 | Dependencies | Historical locked-stack target differs from current manifest | Upgrade/downgrade could cause compatibility risk if done blindly | Medium | Deferred | Dedicated dependency alignment review |
| TD-15.21-002 | Admin security | Rate limiter is process-local | Distributed/serverless requests can bypass a shared limit | Medium | Accepted/deferred | Dedicated distributed rate-limit design |
| TD-15.21-003 | Observability | Logger serialization failure fallback is intentionally minimal | Rare telemetry loss can be harder to diagnose | Low | Deferred | Observability hardening |
| TD-15.21-004 | Performance | Repository does not contain representative production latency/bundle baseline | Architectural changes cannot be benchmarked against production traffic here | Medium | Deferred | Production measurement program |
| TD-15.21-005 | Documentation | Historical phase docs contained stale lockfile/readiness statements | Can mislead future release reviews | Medium | Remediated | This phase |

## 27. Remediations completed

1. Added `scripts/platform-maturity-audit.ts`.
2. Added CI execution of the architecture-boundary audit.
3. Added required Phase 15.21 architecture/debt documentation.
4. Added an ADR describing the remediation decisions.
5. Reconciled the stale Phase 15.16 lockfile statement with the current repository state.
6. Preserved the existing provider/domain architecture and did not introduce a new business domain.
7. Did not downgrade/upgrade dependencies without a compatibility-tested migration.

## 28. Architectural decisions

The ADR records:
- repository authority versus stale historical documentation;
- no blind dependency migration;
- static architectural boundary enforcement;
- provider-neutral domain preservation;
- explicit treatment of remaining distributed-rate-limit and production-baseline debt.

## 29. Operational impact

The new audit is read-only and executes during CI. It does not add runtime requests, database writes, provider calls or customer-facing behavior.

## 30. Known limitations / production blockers

1. **Dependency baseline reconciliation remains outstanding.** The Phase 15.21 specification identifies a historical locked stack that differs from the current manifest. A safe alignment requires a dedicated compatibility-tested dependency migration rather than an architectural cleanup commit.
2. **Production performance evidence remains external.** Repository CI cannot establish representative production latency, traffic, bundle delivery or Netlify runtime measurements.
3. **Distributed rate limiting remains deferred.** Current rate limiting is process-local and therefore not a globally coordinated control in serverless execution.
4. **External Phase 15.19 production-evidence blockers remain external.** Repository changes cannot manufacture provider backup/PITR evidence, deployment topology evidence, contractual provider limits, or external certification.

## 31. CI gate

Required:
- `npm run lint`
- `npm run typecheck`
- `npm test`
- `npm run build`
- `npm run prisma:validate` when available
- Prisma generation
- migration validation
- security/regression tests
- Phase 15.21 architecture audit

No tests are disabled and no assertions are weakened.

## 32. Readiness decision

**NOT READY FOR PHASE 15.22**

This phase must stop here if any required CI check fails or if a critical architectural/security regression is found. Even with green repository CI, the deferred dependency baseline, distributed-rate-limit limitation, missing production performance evidence, and unresolved external Phase 15.19 evidence requirements remain documented blockers to a full production-readiness declaration.

