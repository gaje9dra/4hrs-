# Phase 16.11 — Performance and Capacity Certification

## Objective
Certify performance, latency, capacity, concurrency and resilience without weakening correctness, security, privacy, financial safety, fulfillment safety or data integrity.

## Architecture
Phase 16.11 reuses the existing Next.js, Prisma/PostgreSQL, Netlify, observability, reliability, synthetic-monitoring, catalog and dependency-policy architecture. No second cache, queue, metrics, rate-limit, database-access or optimization framework is introduced.

## Baseline and measurement policy
Production measurements are never fabricated. Values are classified as measured, simulated, estimated, unavailable, or not applicable.

Existing repository evidence includes:
- bounded catalog page size: 100
- bounded catalog page number: 10,000
- bounded public catalog listing projection
- Next.js Web Vitals telemetry for LCP, INP, CLS, FCP and TTFB
- provisional reliability SLO candidates
- dependency timeout/retry policies
- existing request/database/provider metrics
- existing Phase 15.2 performance regression coverage

Real-user Core Web Vitals, production CDN latency, production database query plans, production CPU/memory limits and provider latency require deployed/staging telemetry and are not claimed here.

## Controlled runtime certification
CI starts the production Next.js build against an isolated PostgreSQL service and exercises only:
- /api/health
- /api/ready
- /api/readiness
- /

Scenarios:
- normal: 20 requests, concurrency 2
- elevated: 60 requests, concurrency 5
- spike: 40 requests, concurrency 10
- short soak: 15 seconds against /api/health

The benchmark records p50/p95/p99, throughput, error rate and server RSS. It never calls payment mutations, Qikink production APIs, shipping providers or other external production dependencies.

Evidence:
- artifacts/phase-16-11-performance-evidence.json
- artifacts/phase-16-11-runtime-benchmark.json

## Frontend
Phase 15.2's bounded catalog projection, pagination, responsive/lazy product imagery and intentional LCP image priority are preserved. No blanket shared cache is introduced.

## API
The complete route surface is inventoried. Controlled runtime evidence is limited to safe health/readiness/storefront requests. Critical mutation paths retain their existing authorization, validation, idempotency and transaction boundaries.

## Database / Prisma
The certification inventories Prisma models/indexes and performs a heuristic review for potentially unbounded findMany usage. PostgreSQL EXPLAIN ANALYZE against representative production-scale data is explicitly unavailable unless an approved staging database is provided. No speculative indexes are added.

## Connections / caching / CDN
Existing database/dependency policies are retained. No blind pool increase is made. No new application-wide cache is introduced. Netlify remains the deployment architecture. Production CDN hit-rate/edge latency is not fabricated.

## Search / catalog
Catalog query bounds remain enforced and invalid query parameters remain rejected by existing contracts. No Qikink dependency is introduced into storefront catalog reads.

## Checkout / payment
No uncontrolled real-money load is performed. Payment verification, idempotency and server-authoritative state remain unchanged.

## Fulfillment / Qikink
Qikink remains server-side and fulfillment-only. No production Qikink load is generated. Provider performance requires a safe provider test environment.

## Shipping / post-order
Provider-neutral architecture is preserved. No carrier/provider capability is fabricated.

## Admin / background jobs
Admin RBAC and pagination remain authoritative. Existing scheduled/synthetic/reliability controls are reused; no second queue architecture is introduced.

## Concurrency / load / stress / soak
Controlled CI concurrency covers application reads at 2, 5 and 10 concurrent requests. A bounded spike and 15-second liveness soak are performed. These are isolated CI measurements, not production capacity claims.

## Failure modes
The phase checks safe runtime errors/timeouts under controlled load. Payment, Qikink, shipping-provider and destructive database failure injection remain outside this CI environment. Existing recovery/resilience/synthetic suites remain mandatory.

## Capacity / SLO
Capacity is separated into measured CI behavior, repository/static limits and production-dependent capacity. Existing SLO candidates remain provisional where no production baseline exists. No production RPS or concurrent-user number is invented.

## Regression coverage
Added:
- scripts/phase-16-11-performance-certification.ts
- scripts/phase-16-11-runtime-benchmark.ts
- tests/phase-16-11-performance.test.ts
- production-certification:phase-16-11
- performance:benchmark:phase-16-11
- required CI gate and benchmark evidence artifacts

## Required validation
- npm run lint
- npm run typecheck
- npm test
- npm run build
- npx prisma validate
- npx prisma generate
- Phase 16.11 certification
- controlled runtime benchmark
- existing certification/recovery/security gates

## Remaining limitations
1. Production field Core Web Vitals require deployed RUM/lab evidence.
2. Production CDN/Netlify edge latency requires deployment telemetry.
3. Representative database query-plan/capacity testing requires realistic staging data.
4. Multi-hour soak testing requires dedicated staging infrastructure.
5. External payment/Qikink/shipping performance requires approved provider test environments.
6. Production CPU/memory/concurrency limits are environment-dependent.

## Final certification matrix
| Domain | Evidence | Status |
|---|---|---|
| Rendering / frontend | Source audit + existing tests | Certified within repository scope |
| Web Vitals | Existing telemetry | Instrumentation certified; field values unavailable |
| Catalog | Bounds + projection audit | Certified |
| API runtime | Controlled CI benchmark | Measured in CI only |
| Database | Prisma/schema/query audit | Source-level certified; production plan unavailable |
| Cache | Existing architecture | Safety boundary preserved |
| Netlify/CDN | Config/source audit | Production edge values unavailable |
| Payment | Existing architecture/tests | No uncontrolled provider load |
| Qikink | Provider boundary audit | No production load |
| Shipping | Provider-neutral audit | Provider values unavailable |
| Concurrency | Controlled CI + existing tests | Certified within tested scope |
| Stress | Bounded CI spike | Limited evidence |
| Soak | 15-second CI soak | Limited evidence |
| Capacity | CI + static limits | Production capacity not claimed |
| Security/correctness | Phase 16.10 + full CI | Must remain green |

## Final gate
The phase may output READY FOR PHASE 16.12 only when required CI is green, the Phase 16.11 certification has no unresolved CRITICAL/HIGH performance blocker, evidence is sufficient for the claimed scope, and all limitations are documented. Otherwise it must output NOT READY FOR PHASE 16.12 or BLOCKED.
