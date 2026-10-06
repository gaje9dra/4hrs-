# Phase 16.8 — Database and Migration Certification

## 1. Executive Summary
This certification audits the existing 4HRS+ PostgreSQL/Prisma architecture without introducing a second persistence system. The certification covers Prisma schema structure, migration history, destructive-operation safety, database constraints, idempotency, critical transaction boundaries, raw SQL safety, migration state, critical orphan detection, security boundaries, and operational recovery limits.

Live database evidence is produced by `production-certification:phase-16-8` against the isolated CI PostgreSQL database. Infrastructure-level backup/restore evidence is explicitly bounded to what the repository can verify.

## 2. Certification Scope
- Canonical Prisma schema and generated client.
- Prisma migration history through Phase 16.3 financial remediation and subsequent existing migrations.
- Critical customer, catalog, commerce, fulfillment, shipping, returns, admin, audit, privacy, and operational persistence.
- Database-level constraints and referential integrity.
- Transaction and concurrency-sensitive application boundaries.
- Idempotency persistence.
- Migration deployment and recovery safety.
- Environment/test database isolation.
- Raw SQL and credential exposure boundaries.

## 3. Database Architecture Inventory
4HRS+ uses PostgreSQL as the application database and Prisma as the schema/client layer. The database remains authoritative for application state; no duplicate persistence system is introduced by this phase.

The canonical model inventory is generated from `prisma/schema.prisma`. The certification gate requires the critical models to remain present, including Customer, Product, ProductVariant, Payment, PaymentRefund, Order, OrderItem, Fulfillment, Shipment, ReturnRequest, AdminUser, and AdminAuditLog.

## 4. Prisma Schema Audit
The certification scanner verifies that Prisma models have explicit primary keys and that critical models exist. It also checks critical idempotency models for database uniqueness and checks the schema for obvious committed credential material.

`npx prisma validate` and `npx prisma generate` are mandatory CI gates.

## 5. Relationship and Constraint Matrix
| Area | Certification |
|---|---|
| Customer → addresses/sessions/orders | Prisma relations plus foreign keys |
| Product → variants/catalog relations | Prisma relations plus foreign keys |
| Order → items/payment/fulfillment/shipping | Prisma relations plus foreign keys |
| Payment → refunds/idempotency | Database uniqueness and foreign keys |
| Fulfillment → provider mappings/items | Database uniqueness and foreign keys |
| Admin → roles/permissions/audit | Prisma relations plus authorization-layer controls |
| Audit → actor/resource context | Persistence is retained by the canonical audit model |

The live certification queries PostgreSQL foreign-key metadata and performs critical orphan checks.

## 6. Data Integrity Certification
Money is stored using PostgreSQL decimal types in the canonical schema. Historical order data uses snapshots so mutable catalog records are not the sole source of historical truth.

Critical integrity invariants are enforced through a combination of database constraints, application validation, and transactions; this phase does not duplicate business-rule engines.

## 7. Transaction and Concurrency Certification
Critical state-changing workflows are reviewed for transaction boundaries and idempotency. The certification scanner flags transaction-sensitive source files for manual review rather than treating a static heuristic as proof of correctness.

Existing payment, fulfillment, refund, return, cancellation, and admin controls remain authoritative.

## 8. Idempotency Certification
The canonical schema includes PaymentIdempotency and FulfillmentOperationIdempotency. The certification requires database uniqueness on these persistence models so concurrent duplicate requests cannot rely only on application memory.

## 9. Migration History Audit
Migration directories are validated for deterministic naming and lexical deployment ordering. Historical migrations are not rewritten or deleted.

Duplicate timestamps are recorded as an informational condition where the complete migration directory names remain deterministically ordered.

## 10. Destructive Migration Analysis
The certification scans every migration for DROP TABLE, DROP COLUMN, TRUNCATE, and relevant rename patterns. A detected destructive operation is a certification blocker until an explicit forward migration/expand-contract plan is documented.

No production reset or `prisma db push` shortcut is permitted.

## 11. Expansion/Backfill/Contraction Analysis
Schema changes that require application compatibility must follow an expand → backfill → application migration → validation → contract approach. Historical migrations remain immutable deployment history.

## 12. Environment Drift Analysis
The repository migration history is compared with the validation database migration table. The certification fails if repository migrations are unapplied or failed in the validation database.

Schema validation and client generation run independently of production credentials.

## 13. Test Database and Seed Certification
CI uses an isolated PostgreSQL service for tests and build/recovery validation. Production database URLs are not used by CI. Tests apply repository migrations rather than replacing them with `db push` or destructive reset operations.

## 14. Index and Query Analysis
The Prisma schema and migration history remain the authoritative index definitions. The certification records PostgreSQL index inventory during live validation. Query/index optimization remains evidence-driven; this phase does not add speculative indexes.

## 15. Connection/Resource Analysis
Prisma remains the canonical database client. Connection configuration is environment-driven through server-side DATABASE_URL. No client-side database access is introduced.

## 16. Backup/Restore Boundary
Repository certification cannot independently prove infrastructure-provider backup retention or production restore objectives. Those controls remain an infrastructure/hosting responsibility. The phase therefore documents the boundary rather than fabricating operational evidence.

## 17. Orphan Detection Results
The live certification checks:
- OrderItem without Order
- Payment without Customer
- PaymentRefund without Payment
- Fulfillment without Order
- Shipment without Order
- CustomerAddress without Customer
- FulfillmentProviderMapping without ProductVariant
- AdminAuditLog without AdminUser

A non-zero result is a HIGH blocker and requires audited remediation.

## 18. Reconciliation Compatibility
The existing reconciliation architecture remains the source for application/provider state comparison. No second reconciliation engine or database ledger is introduced.

## 19. Audit and Privacy Data Analysis
Admin audit persistence remains database-backed. Customer personal data remains in the canonical Customer and related persistence models. Account deletion/anonymization must continue to preserve legally and operationally required historical commerce records.

## 20. Security Analysis
The certification scans for unsafe Prisma raw-SQL APIs and obvious committed credential material. DATABASE_URL remains server-side. CI and deployment configuration must not use destructive Prisma shortcuts.

## 21. Failure and Recovery Analysis
Migration interruption, connection loss, partial backfill, constraint failure, and application-version mismatch require forward recovery procedures. Prisma migration metadata must not be manually edited except under a repository-specific documented recovery procedure.

## 22. Test Coverage
Phase-specific regression tests cover:
- certification artifact existence
- canonical persistence model presence
- migration shortcut prohibition
- database idempotency constraints
- safe Prisma SQL API usage

The full repository test suite remains mandatory.

## 23. CI Results
Final values are recorded only after the clean-state CI run. Required gates:
- `npm run lint`
- `npm run typecheck`
- `npm test`
- `npm run build`
- `npx prisma validate`
- `npx prisma generate`
- `npm run production-certification:phase-16-8`

No result is considered certified until the complete CI workflow is green.

## 24. Findings
Findings are emitted by `scripts/phase-16-8-database-migration-certification.ts` with ID, severity, area, description, evidence, remediation, and status.

The final certification decision must be one of:
- READY FOR PHASE 16.9
- NOT READY FOR PHASE 16.9
- BLOCKED

### Final database certification matrix
| Area | Status | Evidence | Risk | Required Action |
|---|---|---|---|---|
| Prisma Schema | Pending final CI | Prisma validate + certification audit | — | Final clean-state validation |
| Relations | Pending final CI | Schema + PostgreSQL FK inventory | — | Final clean-state validation |
| Constraints | Pending final CI | Prisma schema + PostgreSQL metadata | — | Final clean-state validation |
| Transactions | Pending final CI | Service audit + tests | — | Final clean-state validation |
| Concurrency | Pending final CI | Idempotency/transaction review | — | Final clean-state validation |
| Idempotency | Pending final CI | Unique constraints + tests | — | Final clean-state validation |
| Migrations | Pending final CI | Migration history audit | — | Final clean-state validation |
| Backfills | Pending final CI | Migration/source review | — | Final clean-state validation |
| Environment Drift | Pending final CI | Applied migration state | — | Final clean-state validation |
| Indexes | Pending final CI | Schema + PostgreSQL inventory | — | Final clean-state validation |
| Query Safety | Pending final CI | Raw SQL scanner | — | Final clean-state validation |
| Connection Management | Pending final CI | Prisma configuration | — | Final clean-state validation |
| Backup/Restore | Boundary documented | Repository cannot certify provider infrastructure | Operational | Infrastructure evidence outside repository |
| Orphan Detection | Pending final CI | 8 critical orphan queries | — | Final clean-state validation |
| Reconciliation | Pending final CI | Existing reconciliation architecture | — | Final clean-state validation |
| Audit Data | Pending final CI | Admin audit schema and tests | — | Final clean-state validation |
| Privacy | Pending final CI | Customer/account persistence | — | Final clean-state validation |
| Security | Pending final CI | Source/migration scans | — | Final clean-state validation |
| Testing | Pending final CI | Full npm test suite | — | Final clean-state validation |
| CI | Pending final CI | GitHub Actions | — | Final clean-state validation |
