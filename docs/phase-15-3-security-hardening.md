# Phase 15.3 — Security Hardening & Production Security Baseline

## Scope

Phase 15.3 hardens the existing 4HRS+ security boundaries without changing the domain architecture or provider-neutral fulfillment/payment contracts.

## Findings and actions

### Dependency security

The repository was on Next.js 16.3.5. The official September 30, 2026 Next.js security release identifies 16.3.8 as the patched 16.3 Active LTS release, addressing one High, five Medium, and one Low severity vulnerabilities. The project is therefore pinned to Next.js 16.3.8 and eslint-config-next 16.3.8 for this security patch only.

CI also exposed GHSA-ggr8-5vv4-36mx (CVE-2026-40345) through Prisma's transitive deepmerge-ts dependency. The patched deepmerge-ts release is 8.0.0 or later; the repository uses an npm override at ^8.0.2 rather than forcing a Prisma downgrade. The override is intentionally isolated and should be removed once the Prisma config dependency itself moves to the patched major.

No unrelated major/minor dependency upgrades were introduced.

### CSP and browser security headers

The previous CSP only declared frame-ancestors, object-src, and base-uri, which did not provide a complete script/style execution policy.

Phase 15.3 adds a request-scoped nonce CSP through the Next.js 16 proxy.ts convention. The policy:
- disallows unsafe-inline and unsafe-eval;
- uses a per-request script/style nonce;
- restricts scripts, styles, connections, frames, workers, objects, and forms;
- blocks framing with frame-ancestors 'none';
- upgrades insecure requests in production.

The existing JSON-LD inline script is explicitly bound to the same nonce.

Baseline response headers now include nosniff, strict referrer policy, DENY framing, a restrictive Permissions Policy, COOP, DNS prefetch disabled, and HSTS in production.

### CSRF and origin trust

State-changing authentication and administrative requests now use a shared trust function that:
- validates Origin against the configured canonical site origin when available;
- rejects browser fetch metadata indicating cross-site or same-site;
- preserves non-browser/API compatibility when these browser-only headers are absent.

The same helper is also applied to customer state-changing API routes that previously relied only on SameSite cookies.

### Provider boundary

Qikink API endpoints are fixed to the documented live/sandbox hosts. The arbitrary QIKINK_API_BASE_URL override was removed so provider destinations cannot be redirected through configuration to an unrelated host.

Provider rejection messages are generic rather than reflecting arbitrary upstream response fields.

### Secret handling

Repository configuration continues to contain only empty credential placeholders. No provider credential is exposed through NEXT_PUBLIC_*, and provider credentials remain server-side.

### Logging and audit

Existing authentication and admin audit logging already excludes passwords, hashes, tokens, cookies, credentials, and authorization values. Phase 15.3 preserves that boundary and adds regression checks.

## Regression coverage

tests/phase-15-3-security-hardening.test.ts verifies:
- the patched Next.js version;
- strict nonce CSP invariants;
- nonce binding for JSON-LD;
- shared origin/fetch-metadata enforcement;
- provider endpoint and secret boundaries;
- non-disclosure of arbitrary provider response messages;
- empty secret placeholders in .env.example.

## Explicit limitations

- The repository currently has no committed npm lockfile. This phase does not fabricate a lockfile without the repository's package-manager resolution artifact.
- Authentication/admin rate limiting remains in-memory. That is not a reliable distributed rate limiter on serverless instances; the existing limits remain defense-in-depth. A durable shared rate-limit store should be a separate infrastructure phase rather than silently introducing a new persistence model here.
- No claim is made that a production DAST/Lighthouse scan was performed. CI validation and static security regression tests are the verified checks for this phase.
