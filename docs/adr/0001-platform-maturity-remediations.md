# ADR 0001 — Phase 15.21 Platform Maturity Remediation Strategy

## Context

Phase 15.21 requires architectural debt elimination without rewriting stable application architecture. The repository also contains historical release documentation whose dependency/readiness statements no longer exactly describe current `main`.

## Decision

1. Treat current committed source, manifest and lockfile as the implementation evidence.
2. Do not blindly downgrade or upgrade the dependency stack solely to match a historical target. Any dependency alignment must be separately compatibility-tested.
3. Enforce architectural boundaries with a deterministic CI audit:
   - UI cannot import database infrastructure directly.
   - storefront code cannot couple to Qikink implementation.
   - server libraries cannot read arbitrary public environment variables.
   - manifest and lockfile direct dependency specifications must agree.
   - Node/npm runtime pins must agree across repository configuration.
4. Preserve existing domain ownership and provider-neutral boundaries.
5. Record serverless process-local rate limiting and lack of production performance baselines as explicit technical debt rather than pretending they are globally solved.

## Consequences

- CI catches several classes of architectural drift before merge.
- No customer-facing behavior is changed by the audit.
- Dependency baseline alignment remains a separate, controlled migration.
- Production evidence that cannot be generated from source control remains explicitly external.

## Alternatives considered

### Blind dependency alignment
Rejected because changing core framework/compiler versions without a compatibility-tested migration could create avoidable production risk.

### Full architecture rewrite
Rejected because Phase 15.21 explicitly requires minimal, evidence-backed remediation.

### New centralized infrastructure layer
Rejected because it would introduce unnecessary framework/infrastructure churn and duplicate existing domain ownership.

## Migration strategy

If dependency alignment is later approved:
1. create a dedicated dependency migration branch;
2. update manifest and lockfile together;
3. run install, Prisma generation, lint, typecheck, tests and build;
4. run security/regression suites;
5. compare production-like performance/bundle measurements;
6. merge only after compatibility evidence is recorded.
