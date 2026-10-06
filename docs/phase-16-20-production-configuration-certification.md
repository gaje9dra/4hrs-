# Phase 16.20 — Production Configuration Certification

## 1. Phase objective
Certify the actual application, environment, runtime, database, provider, security, observability, build and deployment configuration without creating a second configuration architecture.

## 2. Configuration architecture
The existing source of truth remains environment variables plus the existing configuration modules, Next.js configuration, Prisma schema, Netlify configuration, package metadata and CI workflow. No second configuration, secret, feature-flag, database or provider system was introduced.

## 3. Configuration source inventory
| Source | Actual role | Status |
|---|---|---|
| `.env*` | Local/runtime environment files; ignored except `.env.example` | External/runtime |
| `.env.example` | Safe variable-name/template reference | PASS |
| `lib/config/env.ts` | Server environment validation | PASS after remediation |
| `lib/payments/config.ts` | Payment provider configuration | PASS after remediation |
| `lib/fulfillment/config.ts` | Fulfillment provider configuration | PASS after remediation |
| `next.config.ts` | Next.js headers/noindex configuration | PASS |
| `netlify.toml` | Netlify build/functions/runtime configuration | PASS |
| `prisma/schema.prisma` | PostgreSQL schema source | PASS |
| `package.json` / lockfile | Runtime/build/dependency source | PASS with version drift noted |
| `.github/workflows/ci.yml` | CI source of truth | PASS |

## 4. Environment inventory
Repository-controlled environments are development, test, preview and production. CI uses isolated PostgreSQL service databases. Production and preview account-level values are external Netlify state and cannot be inferred from source.

## 5. Environment-variable inventory
| Variable/category | Consumer | Boundary | Required | Sensitivity | Build/runtime | Failure behavior |
|---|---|---|---|---|---|---|
| `DATABASE_URL` | Prisma/server environment | server | yes | secret | runtime/build | explicit validation failure |
| `DIRECT_URL` | Prisma/runtime where configured | server | optional | secret | runtime | null when absent |
| `NEXT_PUBLIC_SITE_URL` | SEO/runtime/origin checks | public | production yes | public | build/runtime | production requires valid HTTPS origin |
| `APP_VERSION`, `COMMIT_SHA`, `DEPLOY_ID`, `CONTEXT` | release identity | server/public release metadata | optional | low | runtime | safe defaults/null |
| `PAYMENT_PROVIDER_*` | payment configuration | server | when payment provider enabled | sensitive | runtime | explicit configuration rejection |
| `PAYMENT_SANDBOX_*` | controlled payment sandbox | server | test only | secret/test | runtime | provider fails closed |
| `FULFILLMENT_PROVIDER_*` | fulfillment configuration | server | when fulfillment enabled | sensitive | runtime | explicit configuration rejection |
| `QIKINK_*` | Qikink adapter/authentication | server | live fulfillment only | secret | runtime | explicit provider failure |
| `ADMIN_*` | explicit admin provisioning | server | provisioning command only | sensitive | operational | command-specific failure |
| `NOTIFICATION_PROVIDER_*` | notification configuration | server | when notifications enabled | sensitive | runtime | explicit missing-ID failure |
| `NOTIFICATION_UNSUBSCRIBE_SECRET` | unsubscribe token generation | server | before production unsubscribe links | secret | runtime | feature cannot safely issue links |

## 6. Public/server-only classification
Only `NEXT_PUBLIC_SITE_URL` is intentionally public from the certified configuration set. Database, payment, Qikink, admin provisioning, notification credentials and unsubscribe secrets remain server-side. Qikink credentials are loaded only by server fulfillment code.

## 7. Secret-management analysis
`.gitignore` ignores `.env*` while retaining `.env.example`. The example file contains variable names and placeholders only; credential-shaped database placeholders were replaced with non-secret placeholders. No real credential values are documented here. Runtime telemetry redaction covers password, secret, token, authorization, cookie, credential, API-key, private-key, database-URL and card-like fields.

## 8. Required configuration
Production requires a valid PostgreSQL URL and an HTTPS public site URL. Provider configuration is required only when the corresponding provider is enabled. Production fulfillment now fails closed unless enabled fulfillment explicitly uses `live` mode and has its server-side credential.

## 9. Configuration validation
`lib/config/env.ts` validates PostgreSQL URL syntax, production HTTPS site URL, private fulfillment references, live fulfillment credentials, notification provider identity and provider configuration. Payment and fulfillment configuration modules now reject malformed boolean, mode, provider-id and timeout values instead of silently falling back.

## 10. Development/test/production separation
CI test/build/recovery jobs use isolated local PostgreSQL service databases and test URLs. Controlled sandbox payment is test-only. Production-enabled Qikink fulfillment must use live mode. Account-level preview/production provider credentials are not represented in the repository and remain an external operational verification item.

## 11. Payment configuration
The repository contains a provider-neutral payment registry with the controlled-sandbox adapter. The adapter is cryptographically signed and replay-protected, but it is explicitly test-only. Production configuration now rejects controlled-sandbox and rejects non-live payment mode when payment is enabled. There is no repository-proven live PayU adapter or other live-money provider adapter.

**Production payment capability remains an external/product readiness blocker:** a real provider contract and configured live adapter are required before a storefront can honestly be certified as production payment-ready. No undocumented PayU API was invented.

## 12. Qikink configuration
Qikink remains fulfillment-only. The existing provider-neutral resolver selects Qikink, credentials remain server-side, and the adapter does not expose credentials to browser code. Qikink is not configured as the catalog source and no automatic catalog synchronization was introduced.

## 13. Database configuration
Prisma uses PostgreSQL and `DATABASE_URL`. Production schema management uses `npx prisma migrate deploy`; `prisma db push` and `prisma migrate reset` are not the production strategy. CI validates/generates Prisma and runs migrations against isolated CI databases.

## 14. Next.js configuration
`next.config.ts` enables React strict mode, security headers, HSTS in production and noindex protection for private/API/development routes. `proxy.ts` supplies nonce-bound production CSP and request IDs. No unsafe experimental feature or internal-service rewrite was introduced.

## 15. Netlify configuration
`netlify.toml` declares `npm run build`, Node `24.21.0`, npm `11.6.0`, `netlify/functions`, esbuild bundling and Next.js development framework integration. No second hosting platform was introduced. Account-level production variables, deploy approvals, deploy history and rollback access cannot be proven from repository source.

## 16. CI configuration
CI uses `contents: read`, pull-request and main-push triggers, concurrency cancellation, Node 24.21.0 and npm 11.6.0 in the test job. Test/build/recovery jobs use isolated PostgreSQL services. The workflow runs Prisma validation/generation, migrations, certification audits, tests, lint, typecheck and build. No production secrets are provided to CI test jobs.

## 17. Deployment configuration
The deployment source is the repository/Netlify build configuration with `npm run build`. Existing release verification uses an explicit `RELEASE_BASE_URL` and health/readiness checks. Production migration is controlled through `prisma migrate deploy`. Live Netlify account execution remains external evidence.

## 18. Authentication configuration
Customer sessions are opaque random tokens stored server-side as hashes. Production cookies are HttpOnly, Secure and SameSite=Lax. Session resolution requires an active customer. Admin authorization derives identity from the authenticated server-side session and database-backed role assignments.

## 19. Admin configuration
Admin access is DB-backed and permission-specific. The former hardcoded privileged-email bypass is removed. Admin mutations remain permission/audit controlled. The process-local admin rate limiter is a documented scaling limitation, not an authorization boundary.

## 20. Security configuration
Security headers include X-Content-Type-Options, Referrer-Policy, X-Frame-Options, Permissions-Policy, COOP and production HSTS. Production CSP is nonce-bound and uses strict-dynamic. State-changing requests use the trusted-origin/fetch-metadata boundary. No permissive wildcard CORS architecture was identified.

## 21. Observability configuration
The existing structured logger includes environment, event, request/correlation/operation identifiers and sanitized data. Debug logging is suppressed in production. Sensitive fields are redacted before serialization. Deployment/release governance provides evidence and correlation fields without exposing credentials.

## 22. Privacy configuration
Customer privacy controls use authenticated identity and private/no-store response boundaries. Provider secrets and credential/session material are excluded from customer-facing privacy data. Existing anonymization/retention behavior from earlier phases is retained.

## 23. Internationalization/currency configuration
Customer defaults in the database include `en-IN` and `Asia/Kolkata`; product currency defaults to INR. Payment and fulfillment contracts use explicit currency fields. No unsupported currency or region was invented.

## 24. Feature flags
Provider enable/mode settings are existing environment configuration rather than a second feature-flag platform. Production provider enablement is now fail-closed for invalid modes and unsupported sandbox payment.

## 25. Cache configuration
Health/readiness responses are no-store. Customer/admin/private responses use private/no-store boundaries where applicable. Private routes receive noindex protection. Netlify account/CDN cache state remains external.

## 26. Rate-limit configuration
Payment uses the durable financial rate-limit control introduced in Phase 16.3. Customer/admin authentication rate limits remain process-local in the current architecture. No second rate-limit system was created. Distributed enforcement remains an operational limitation.

## 27. API configuration
API contracts use existing authentication, RBAC, origin, rate-limit, validation and provider-neutral boundaries. Internal provider credentials are not browser configuration. Health/readiness are explicit operational endpoints.

## 28. Background job configuration
Existing Phase 16.15 notification processing remains the background/event architecture. No second worker/queue system was introduced. Durable state and retry/lease controls remain the source of truth.

## 29. Notification configuration
Notification provider configuration is disabled by default in `.env.example`. When enabled, a provider ID is required. No production provider is fabricated; existing unsubscribe secret configuration remains server-only.

## 30. Storage configuration
The repository does not establish a separate external object-storage provider as a required configuration source. Product media uses stored references/URLs in the existing catalog model. External storage durability and access policy are therefore provider-dependent where external storage is used.

## 31. External provider configuration
Certified external-provider boundaries are payment-provider abstraction and Qikink fulfillment. The repository does not claim undocumented payment, shipping, email or storage providers.

## 32. Timezone configuration
Customer timezone defaults to `Asia/Kolkata`; timestamps are stored as database DateTime values and serialized as ISO timestamps. Scheduled/background behavior retains the existing provider/scheduler architecture. No conflicting application timezone configuration was introduced.

## 33. Build/runtime configuration
Netlify pins Node 24.21.0 and npm 11.6.0. The actual repository uses Next.js 16.3.8, React 19.3.0, ESLint 9.39.5 and Prisma 6.19.3. Next.js 16.3.8 is retained because earlier security hardening upgraded the original 16.3.5 baseline.

## 34. Default-value analysis
Safe defaults remain for optional release identity and disabled provider integrations. Unsafe silent defaults found during this phase were removed: malformed provider booleans, modes, provider IDs and timeout values now fail instead of silently becoming disabled/test/default values.

## 35. Configuration failure handling
Targeted certification exercises missing live Qikink credentials, production test-mode fulfillment, controlled-sandbox production payment, HTTP production site URLs, non-PostgreSQL database URLs, public secret references and malformed provider values. All are required to fail explicitly.

## 36. Configuration drift
Detected drift includes package metadata ranges versus resolved versions: TypeScript resolves to 5.9.3 versus the phase's 6.0.3 target, and `@types/node` resolves to 22.20.5 versus the target 26.6.1. Tailwind resolves to 4.3.3, React to 19.3.0, ESLint to 9.39.5, Node/npm match the deployment pin, and Next.js remains intentionally 16.3.8. These dependency-version differences are documented rather than papered over by an unsafe lockfile edit.

## 37. Security findings
- CRITICAL repository configuration findings after remediation: 0.
- HIGH repository configuration findings after remediation: 0.
- MEDIUM: dependency-version drift and external provider/account evidence limitations.
- INFORMATIONAL: unsupported capabilities that are explicitly documented rather than fabricated.

## 38. Configuration matrix
| Configuration | Environment | Source | Required? | Sensitive? | Build/Runtime | Validation | Consumer | Status |
|---|---|---|---|---|---|---|---|---|
| DATABASE_URL | all DB environments | env/CI | yes | yes | both/runtime | PostgreSQL URL | Prisma | PASS |
| NEXT_PUBLIC_SITE_URL | production/public | env | yes in prod | no | build/runtime | HTTPS origin | SEO/origin | PASS |
| PAYMENT_PROVIDER_* | payment-enabled env | env | conditional | yes | runtime | strict parser + production gate | payment config | PASS / live provider external |
| FULFILLMENT_PROVIDER_* | fulfillment-enabled env | env | conditional | yes | runtime | strict parser + production live gate | fulfillment config | PASS |
| QIKINK_* | live fulfillment | env | yes | yes | runtime | credential check | Qikink auth | PASS / external credential |
| NOTIFICATION_PROVIDER_* | notification-enabled env | env | conditional | yes | runtime | provider ID check | notification system | PASS |
| APP_VERSION/COMMIT_SHA/DEPLOY_ID/CONTEXT | deploy | env/Netlify | optional | low | runtime | normalization | release identity | PASS |

## 39. Failure matrix
| Scenario | Expected | Actual | Customer impact | Detection | Recovery | Severity | Status |
|---|---|---|---|---|---|---|---|
| Missing DATABASE_URL | fail | explicit error | no startup/readiness | validation | configure DB | HIGH | PASS |
| Invalid DATABASE_URL | fail | explicit PostgreSQL validation | no startup/readiness | validation | correct URL | HIGH | PASS |
| Missing live Qikink secret | fail | explicit error | fulfillment unavailable | startup/config | configure secret | HIGH | PASS |
| Production Qikink test mode | fail | explicit error after remediation | prevents test-provider mutation | startup/config | set live mode | HIGH | PASS |
| Controlled sandbox payment in production | fail | explicit error after remediation | prevents sandbox payment operation | startup/config | configure verified live provider | CRITICAL | PASS / external live provider gap |
| Malformed provider boolean/mode/timeout | fail | explicit parser error after remediation | prevents unsafe fallback | startup/config | correct value | HIGH | PASS |
| HTTP production site URL | fail | explicit error | incorrect security/canonical origin | startup | configure HTTPS | HIGH | PASS |
| Public secret reference | fail | explicit error | secret exposure risk | startup/config | use server-only reference | CRITICAL | PASS |
| Accidental test environment in production | fail where provider enabled | provider-mode gate | prevents sandbox provider use | startup/config | correct environment | HIGH | PASS |

## 40. Remediations performed
1. Production-enabled fulfillment now requires live mode and the expected server-side Qikink credential.
2. Production payment configuration rejects non-live mode and the controlled sandbox adapter.
3. Payment/fulfillment provider IDs, booleans, modes and timeout values now reject malformed input instead of silently defaulting.
4. `.env.example` now documents the existing payment configuration variables without real secret values.
5. Credential-shaped database example material was replaced with placeholders.
6. A deterministic Phase 16.20 configuration certification script was added.
7. CI is extended with the Phase 16.20 certification gate.

## 41. Remaining gaps
1. The repository has no verified live PayU/payment adapter or other live-money payment provider adapter. The controlled sandbox cannot be used for production.
2. Netlify account-level production variables, deployment approvals, deploy history and rollback access are external account evidence.
3. Managed PostgreSQL backup/PITR configuration is provider-dependent.
4. Distributed rate limiting is not evidenced for all horizontally scaled authentication/admin paths.
5. Resolved TypeScript/@types-node versions differ from the phase's locked target versions; changing the lockfile without a reproducible install would be unsafe.

## 42. CI results
The required Phase 16.20 CI gate is `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, `npx prisma validate`, `npx prisma generate`, plus all existing repository certification/audit checks. The Phase 16.20 validator also exercises malformed and unsafe configuration cases without contacting production providers.

## 43. Final certification decision
**NOT READY FOR PHASE 16.21**

The repository-controlled configuration blockers have been remediated. The remaining production-readiness blocker is external to this repository: there is no verified live-money payment provider adapter, and account-level production infrastructure evidence cannot be certified from source alone. Phase 16.21 must not begin until these remaining requirements are resolved and complete CI is green.

## 44. Hard stop
Do not begin Phase 16.21 from this phase. Do not fabricate a PayU/live provider contract, Netlify account evidence, managed-database backup evidence or external provider outage evidence.