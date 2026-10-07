# 4HRS+ Documentation Index

This directory is the authoritative documentation area for 4HRS+ / 4hrs-fashion.

## Primary references

- [Architecture](./architecture.md)
- [Final Production Documentation](./phase-16-27-final-production-documentation.md)

## Production certification records

- [Phase 16.1 — Production Certification Audit](./phase-16-1-production-certification-audit.md)
- [Phase 16.2 — Commerce Journey Certification](./phase-16-2-complete-commerce-journey-certification.md)
- [Phase 16.3 — Payment / Financial Safety](./phase-16-3-payment-financial-safety-certification.md)
- [Phase 16.4 — Fulfillment / Qikink](./phase-16-4-fulfillment-qikink-certification.md)
- [Phase 16.5 — Shipping / Post-Order](./phase-16-5-shipping-post-order-certification.md)
- [Phase 16.6 — Customer Account / Privacy](./phase-16-6-customer-account-privacy-certification.md)
- [Phase 16.7 — Admin / RBAC](./phase-16-7-admin-rbac-certification.md)
- [Phase 16.8 — Database / Migration](./phase-16-8-database-migration-certification.md)
- [Phase 16.9 — API Contracts](./phase-16-9-api-contract-certification.md)
- [Phase 16.10 — Security](./phase-16-10-security-certification.md)
- [Phase 16.11 — Performance / Capacity](./phase-16-11-performance-capacity-certification.md)
- [Phase 16.12 — Frontend / Accessibility](./phase-16-12-frontend-accessibility-certification.md)
- [Phase 16.13 — SEO](./phase-16-13-seo-certification.md)
- [Phase 16.14 — Observability / Incident](./phase-16-14-observability-incident-certification.md)
- [Phase 16.15 — Background Jobs / Events](./phase-16-15-background-job-event-certification.md)
- [Phase 16.16 — Reconciliation](./phase-16-16-reconciliation-certification.md)
- [Phase 16.17 — Backup / Disaster Recovery](./phase-16-17-backup-disaster-recovery-certification.md)
- [Phase 16.18 — Resilience / Failure Injection](./phase-16-18-resilience-failure-injection-certification.md)
- [Phase 16.19 — Release / Deployment](./phase-16-19-release-deployment-certification.md)
- [Phase 16.20 — Production Configuration](./phase-16-20-production-configuration-certification.md)
- [Phase 16.21 — Dependency / Supply Chain](./phase-16-21-dependency-supply-chain-certification.md)
- [Phase 16.22 — Synthetic Production Smoke](./phase-16-22-synthetic-production-smoke-test.md)
- [Phase 16.23 — Full Test Matrix](./phase-16-23-full-test-matrix.md)

## Final certification evidence

Phase 16.24 and Phase 16.26 candidate records were produced on separate PR branches and passed CI, but were not part of the certified `main` baseline reviewed for this document. Phase 16.25 is not present on current `main`.

The authoritative distinction is documented in [Phase 16.27 Final Production Documentation](./phase-16-27-final-production-documentation.md).

## Operational source locations

- `.github/workflows/ci.yml` — CI source of truth
- `package.json` — scripts and runtime versions
- `netlify.toml` — repository deployment configuration
- `prisma/schema.prisma` — database schema
- `prisma/migrations/` — migration history
- `app/api/` — API route boundary
- `app/admin/` — administrative control plane
- `app/(storefront)/` — customer storefront
- `lib/` — application/domain/infrastructure boundaries
- `netlify/functions/` — scheduled/background functions
- `tests/` — executable test suites
- `scripts/` — validation, certification and operational tooling

## Phase 16 final status

**PHASE 16 COMPLETE**

**GO-LIVE NOT APPROVED** until the documented external/provider production blockers are independently resolved and re-certified.

There is no predefined Phase 17.
