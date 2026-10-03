-- Phase 15.19: production governance, compliance evidence and audit readiness.
CREATE TYPE "GovernanceControlDomain" AS ENUM (
  'SECURITY','PRIVACY','DATA_PROTECTION','ACCESS_CONTROL','AUTHENTICATION','AUTHORIZATION','AUDITABILITY','OBSERVABILITY',
  'RELEASE','DEPLOYMENT','BACKUP','DISASTER_RECOVERY','INCIDENT_RESPONSE','BUSINESS_CONTINUITY','API_GOVERNANCE',
  'PAYMENT_SAFETY','ORDER_INTEGRITY','FULFILLMENT','SHIPPING','CUSTOMER_ACCOUNT','NOTIFICATIONS','ANALYTICS','CONTENT',
  'SEARCH','FEATURE_FLAGS','THIRD_PARTY_INTEGRATIONS','DATA_RETENTION','DATA_LIFECYCLE'
);
CREATE TYPE "GovernanceControlStatus" AS ENUM ('NOT_ASSESSED','IMPLEMENTED','CONFIGURED','VERIFIED','MONITORED','FAILED','BLOCKED','NOT_APPLICABLE','UNKNOWN');
CREATE TYPE "GovernanceControlCriticality" AS ENUM ('CRITICAL','HIGH','MEDIUM','LOW');
CREATE TYPE "GovernanceApplicability" AS ENUM ('REQUIRED','CONDITIONAL','NOT_APPLICABLE');
CREATE TYPE "GovernanceEvidenceType" AS ENUM ('AUTOMATED_TEST','CI_RESULT','DEPLOYMENT_VERIFICATION','CONFIGURATION_VALIDATION','MIGRATION_VALIDATION','BACKUP_VERIFICATION','RESTORE_TEST','SECURITY_SCAN','AUDIT_EVENT','INCIDENT_REVIEW','RUNBOOK_VERIFICATION','MONITORING_VERIFICATION','MANUAL_REVIEW','OPERATIONAL_CHECKLIST','CONTROL_ASSERTION');
CREATE TYPE "GovernanceEvidenceStatus" AS ENUM ('VALID','EXPIRED','SUPERSEDED','REJECTED');
CREATE TYPE "GovernanceVerificationResult" AS ENUM ('PASS','FAIL','BLOCKED','UNKNOWN');
CREATE TYPE "GovernanceControlEventType" AS ENUM ('CREATED','STATUS_CHANGED','VERIFIED','FAILED','BLOCKED','OWNERSHIP_CHANGED','REVIEWED','EXCEPTION_CREATED','EXCEPTION_EXPIRED');
CREATE TYPE "GovernanceExceptionStatus" AS ENUM ('ACTIVE','APPROVED','EXPIRED','REVOKED');

CREATE TABLE "GovernanceControl" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "key" VARCHAR(120) NOT NULL,
  "domain" "GovernanceControlDomain" NOT NULL,
  "title" VARCHAR(200) NOT NULL,
  "description" VARCHAR(2000) NOT NULL,
  "criticality" "GovernanceControlCriticality" NOT NULL,
  "ownerRole" VARCHAR(120) NOT NULL,
  "status" "GovernanceControlStatus" NOT NULL DEFAULT 'NOT_ASSESSED',
  "applicability" "GovernanceApplicability" NOT NULL DEFAULT 'REQUIRED',
  "verificationMethod" VARCHAR(500) NOT NULL,
  "evidenceRequirements" JSONB,
  "lastVerifiedAt" TIMESTAMP(3),
  "nextReviewAt" TIMESTAMP(3),
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GovernanceControl_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "GovernanceControl_key_key" ON "GovernanceControl"("key");
CREATE INDEX "GovernanceControl_domain_status_idx" ON "GovernanceControl"("domain","status");
CREATE INDEX "GovernanceControl_criticality_status_idx" ON "GovernanceControl"("criticality","status");
CREATE INDEX "GovernanceControl_nextReviewAt_idx" ON "GovernanceControl"("nextReviewAt");
CREATE INDEX "GovernanceControl_ownerRole_status_idx" ON "GovernanceControl"("ownerRole","status");

CREATE TABLE "GovernanceEvidence" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "controlId" UUID NOT NULL,
  "evidenceType" "GovernanceEvidenceType" NOT NULL,
  "source" VARCHAR(255) NOT NULL,
  "reference" VARCHAR(1000) NOT NULL,
  "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "capturedByAdminId" UUID,
  "status" "GovernanceEvidenceStatus" NOT NULL DEFAULT 'VALID',
  "metadata" JSONB,
  "integrityHash" VARCHAR(128),
  "expiresAt" TIMESTAMP(3),
  "idempotencyKey" VARCHAR(255) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GovernanceEvidence_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "GovernanceEvidence_idempotencyKey_key" ON "GovernanceEvidence"("idempotencyKey");
CREATE INDEX "GovernanceEvidence_controlId_capturedAt_idx" ON "GovernanceEvidence"("controlId","capturedAt");
CREATE INDEX "GovernanceEvidence_status_expiresAt_idx" ON "GovernanceEvidence"("status","expiresAt");
CREATE INDEX "GovernanceEvidence_capturedByAdminId_capturedAt_idx" ON "GovernanceEvidence"("capturedByAdminId","capturedAt");
ALTER TABLE "GovernanceEvidence" ADD CONSTRAINT "GovernanceEvidence_controlId_fkey" FOREIGN KEY ("controlId") REFERENCES "GovernanceControl"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "GovernanceVerification" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "controlId" UUID NOT NULL,
  "result" "GovernanceVerificationResult" NOT NULL,
  "method" VARCHAR(255) NOT NULL,
  "source" VARCHAR(255) NOT NULL,
  "reference" VARCHAR(1000),
  "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "checkedByAdminId" UUID,
  "durationMs" INTEGER,
  "correlationId" VARCHAR(128),
  "releaseId" VARCHAR(128),
  "deploymentId" VARCHAR(128),
  "details" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GovernanceVerification_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "GovernanceVerification_controlId_checkedAt_idx" ON "GovernanceVerification"("controlId","checkedAt");
CREATE INDEX "GovernanceVerification_result_checkedAt_idx" ON "GovernanceVerification"("result","checkedAt");
CREATE INDEX "GovernanceVerification_releaseId_deploymentId_idx" ON "GovernanceVerification"("releaseId","deploymentId");
ALTER TABLE "GovernanceVerification" ADD CONSTRAINT "GovernanceVerification_controlId_fkey" FOREIGN KEY ("controlId") REFERENCES "GovernanceControl"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "GovernanceControlEvent" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "controlId" UUID NOT NULL,
  "type" "GovernanceControlEventType" NOT NULL,
  "actorAdminId" UUID,
  "previousStatus" "GovernanceControlStatus",
  "newStatus" "GovernanceControlStatus",
  "reason" VARCHAR(1000),
  "correlationId" VARCHAR(128),
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GovernanceControlEvent_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "GovernanceControlEvent_controlId_createdAt_idx" ON "GovernanceControlEvent"("controlId","createdAt");
CREATE INDEX "GovernanceControlEvent_type_createdAt_idx" ON "GovernanceControlEvent"("type","createdAt");
ALTER TABLE "GovernanceControlEvent" ADD CONSTRAINT "GovernanceControlEvent_controlId_fkey" FOREIGN KEY ("controlId") REFERENCES "GovernanceControl"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "GovernanceException" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "controlId" UUID NOT NULL,
  "reason" VARCHAR(2000) NOT NULL,
  "scope" VARCHAR(1000) NOT NULL,
  "riskStatement" VARCHAR(2000) NOT NULL,
  "ownerRole" VARCHAR(120) NOT NULL,
  "approvalRole" VARCHAR(120),
  "approvalReason" VARCHAR(1000),
  "remediationReference" VARCHAR(1000),
  "status" "GovernanceExceptionStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "approvedAt" TIMESTAMP(3),
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "revokedAt" TIMESTAMP(3),
  CONSTRAINT "GovernanceException_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "GovernanceException_controlId_status_expiresAt_idx" ON "GovernanceException"("controlId","status","expiresAt");
CREATE INDEX "GovernanceException_status_expiresAt_idx" ON "GovernanceException"("status","expiresAt");
ALTER TABLE "GovernanceException" ADD CONSTRAINT "GovernanceException_controlId_fkey" FOREIGN KEY ("controlId") REFERENCES "GovernanceControl"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO "AdminPermission" ("id","key","description")
SELECT gen_random_uuid(), v.key, v.description
FROM (VALUES
 ('governance.read','Read governance controls and evidence summaries'),
 ('governance.verify','Run provider-neutral control verification'),
 ('governance.manage','Manage governance control metadata'),
 ('governance.evidence.manage','Create governance evidence records'),
 ('governance.exceptions.manage','Manage expiring governance exceptions'),
 ('governance.export','Export a privacy-safe governance audit package')
) AS v(key,description)
WHERE NOT EXISTS (SELECT 1 FROM "AdminPermission" p WHERE p."key"=v.key);

INSERT INTO "AdminRolePermission" ("roleId","permissionId")
SELECT r.id,p.id FROM "AdminRole" r CROSS JOIN "AdminPermission" p
WHERE r.name='SUPER_ADMIN' AND p.key LIKE 'governance.%'
AND NOT EXISTS (SELECT 1 FROM "AdminRolePermission" rp WHERE rp."roleId"=r.id AND rp."permissionId"=p.id);

INSERT INTO "AdminRolePermission" ("roleId","permissionId")
SELECT r.id,p.id FROM "AdminRole" r JOIN "AdminPermission" p ON p.key IN ('governance.read','governance.verify','governance.evidence.manage','governance.exceptions.manage','governance.export')
WHERE r.name='ADMIN'
AND NOT EXISTS (SELECT 1 FROM "AdminRolePermission" rp WHERE rp."roleId"=r.id AND rp."permissionId"=p.id);

INSERT INTO "AdminRolePermission" ("roleId","permissionId")
SELECT r.id,p.id FROM "AdminRole" r JOIN "AdminPermission" p ON p.key IN ('governance.read','governance.verify')
WHERE r.name='OPERATIONS'
AND NOT EXISTS (SELECT 1 FROM "AdminRolePermission" rp WHERE rp."roleId"=r.id AND rp."permissionId"=p.id);

INSERT INTO "AdminRolePermission" ("roleId","permissionId")
SELECT r.id,p.id FROM "AdminRole" r JOIN "AdminPermission" p ON p.key='governance.read'
WHERE r.name='VIEWER'
AND NOT EXISTS (SELECT 1 FROM "AdminRolePermission" rp WHERE rp."roleId"=r.id AND rp."permissionId"=p.id);

CREATE TEMP TABLE "_governance_seed" (
  key VARCHAR(120), domain "GovernanceControlDomain", title VARCHAR(200), description VARCHAR(2000),
  criticality "GovernanceControlCriticality", ownerRole VARCHAR(120), verificationMethod VARCHAR(500), evidenceRequirements JSONB
);
INSERT INTO "_governance_seed" VALUES
('SEC-AUTH-001','AUTHENTICATION','Authentication enforcement','Administrative and customer authentication boundaries remain enforced by the existing authentication service.', 'CRITICAL','Security','Runtime authentication and authorization tests','["AUTOMATED_TEST","SECURITY_SCAN"]'),
('SEC-AUTHZ-001','AUTHORIZATION','Authorization and RBAC enforcement','Privileged operations require existing Admin RBAC permissions and trusted state-changing requests.', 'CRITICAL','Security','Admin authorization integration tests','["AUTOMATED_TEST","AUDIT_EVENT"]'),
('SEC-AUDIT-001','AUDITABILITY','Privileged operation auditability','Governance and administrative privileged actions are attributable and recorded through the existing audit boundary.', 'CRITICAL','Security','Audit write-path and admin operation tests','["AUTOMATED_TEST","AUDIT_EVENT"]'),
('SEC-SECRET-001','SECURITY','Secret isolation','Provider credentials, session secrets and sensitive authentication material remain server-side and redacted from telemetry/evidence.', 'CRITICAL','Security','Configuration validation and redaction tests','["CONFIGURATION_VALIDATION","SECURITY_SCAN"]'),
('SEC-WEB-001','SECURITY','Web security controls','Security headers, CSP, cookies, CORS, CSRF protections and rate limits remain enforced where applicable.', 'HIGH','Security','Runtime configuration and security tests','["AUTOMATED_TEST","CONFIGURATION_VALIDATION"]'),
('PRIV-DATA-001','PRIVACY','Privacy-safe governance evidence','Governance evidence references existing records without copying unnecessary customer PII.', 'CRITICAL','Privacy Operations','Evidence validation and metadata redaction tests','["AUTOMATED_TEST","MANUAL_REVIEW"]'),
('PRIV-LIFE-001','DATA_LIFECYCLE','Customer lifecycle controls','Deletion, anonymization, export, consent and retention controls remain owned by the customer privacy domain.', 'CRITICAL','Privacy Operations','Privacy lifecycle integration tests','["AUTOMATED_TEST","MANUAL_REVIEW"]'),
('OBS-AUD-001','OBSERVABILITY','Governance observability','Verification, evidence, exception and privileged governance operations emit structured operational telemetry.', 'HIGH','SRE','Telemetry integration tests','["AUTOMATED_TEST","MONITORING_VERIFICATION"]'),
('REL-CI-001','RELEASE','Production CI gate','Production-critical lint, typecheck, test and build checks remain part of repository CI.', 'CRITICAL','Platform','CI workflow verification','["CI_RESULT","CONTROL_ASSERTION"]'),
('REL-ENV-001','DEPLOYMENT','Environment isolation','Environment validation prevents unsafe defaults and isolates production configuration from development/test credentials.', 'CRITICAL','Platform','Runtime environment validation','["CONFIGURATION_VALIDATION","CI_RESULT"]'),
('REL-MIG-001','RELEASE','Migration safety','Prisma schema and migration ordering remain validated without destructive production resets.', 'CRITICAL','Platform','Prisma validation and migration audit','["MIGRATION_VALIDATION","CI_RESULT"]'),
('REC-BACKUP-001','BACKUP','Backup and restore evidence','Backup/recovery capability is evidenced by the existing recovery validation and drill architecture rather than backup existence alone.', 'CRITICAL','SRE','Recovery validation and drill evidence','["RESTORE_TEST","RUNBOOK_VERIFICATION"]'),
('REC-DR-001','DISASTER_RECOVERY','Disaster recovery exercise tracking','Recovery exercises and their measured results can be referenced from governance records.', 'CRITICAL','SRE','Recovery exercise evidence review','["RESTORE_TEST","MANUAL_REVIEW"]'),
('INC-001','INCIDENT_RESPONSE','Incident integration','Control failures can be correlated with the existing Phase 15.17 reliability incident system.', 'CRITICAL','SRE','Incident integration verification','["AUTOMATED_TEST","INCIDENT_REVIEW"]'),
('API-001','API_GOVERNANCE','API contract hardening','Governed APIs retain authentication, validation, idempotency, rate limiting and provider-boundary controls.', 'HIGH','Platform','API contract and integration tests','["AUTOMATED_TEST","CI_RESULT"]'),
('PAY-001','PAYMENT_SAFETY','Payment integrity','Governance is observational and cannot mutate payment state; payment success and webhook verification remain authoritative.', 'CRITICAL','Payments','Payment domain integration tests','["AUTOMATED_TEST","MANUAL_REVIEW"]'),
('ORD-001','ORDER_INTEGRITY','Order integrity','Governance does not duplicate order creation or financial state transitions and can surface order integrity failures.', 'CRITICAL','Commerce Operations','Order integrity tests','["AUTOMATED_TEST","AUDIT_EVENT"]'),
('FUL-001','FULFILLMENT','Fulfillment boundary','Fulfillment remains a canonical domain and Qikink remains an external fulfillment provider.', 'CRITICAL','Fulfillment Operations','Provider-boundary and fulfillment tests','["AUTOMATED_TEST","MANUAL_REVIEW"]'),
('SHP-001','SHIPPING','Shipping integrity','Shipping lifecycle and reconciliation remain owned by the provider-neutral Shipping domain.', 'HIGH','Shipping Operations','Shipping integration and reconciliation tests','["AUTOMATED_TEST","MANUAL_REVIEW"]'),
('CUS-001','CUSTOMER_ACCOUNT','Customer account safety','Authentication, session invalidation, privacy and customer-account lifecycle remain protected from governance data leakage.', 'CRITICAL','Customer Operations','Customer security/privacy regression tests','["AUTOMATED_TEST","SECURITY_SCAN"]'),
('NOT-001','NOTIFICATIONS','Notification resilience','Notification failures remain isolated from commerce state and communication preferences remain authoritative.', 'HIGH','Communications Operations','Notification integration tests','["AUTOMATED_TEST","MONITORING_VERIFICATION"]'),
('ANA-001','ANALYTICS','Analytics boundary','Analytics remains non-authoritative for commerce and respects consent and PII minimization.', 'HIGH','Analytics Operations','Analytics consent and regression tests','["AUTOMATED_TEST","MANUAL_REVIEW"]'),
('CON-001','CONTENT','Content governance','Content publication, approval, scheduling and rollback remain auditable through the existing content domain.', 'HIGH','Content Operations','Content governance regression tests','["AUTOMATED_TEST","AUDIT_EVENT"]'),
('SEA-001','SEARCH','Search integrity','Search/index failures are observable without becoming a source of catalog truth or mutating catalog state.', 'HIGH','Platform','Search regression and diagnostics tests','["AUTOMATED_TEST","MONITORING_VERIFICATION"]'),
('FF-001','FEATURE_FLAGS','Feature flag governance','Critical flag changes remain attributable and emergency controls remain protected by existing admin RBAC.', 'HIGH','Platform','Feature flag audit and authorization tests','["AUTOMATED_TEST","AUDIT_EVENT"]'),
('TP-001','THIRD_PARTY_INTEGRATIONS','Third-party boundary governance','External providers have explicit purpose, credential ownership, failure behavior and monitoring boundaries.', 'HIGH','Platform','Provider integration contract review','["MANUAL_REVIEW","CONTROL_ASSERTION"]'),
('RET-001','DATA_RETENTION','Retention enforcement','Governance records respect evidence expiration and existing privacy retention boundaries.', 'HIGH','Privacy Operations','Retention and expiration checks','["AUTOMATED_TEST","MANUAL_REVIEW"]'),
('LIFE-001','DATA_LIFECYCLE','Governance data lifecycle','Evidence, verification and exception records have bounded metadata and do not become shadow customer records.', 'HIGH','Privacy Operations','Governance persistence and redaction tests','["AUTOMATED_TEST","MANUAL_REVIEW"]'),
('BC-001','BUSINESS_CONTINUITY','Business continuity control isolation','Governance failures do not become dependencies of checkout, payment, order, fulfillment or storefront critical paths.', 'CRITICAL','SRE','Failure-isolation architecture tests','["AUTOMATED_TEST","CONTROL_ASSERTION"]'),
('DEP-001','DEPLOYMENT','Release traceability','Verification records can associate available release/deployment identifiers without inventing provider metadata.', 'HIGH','Platform','Deployment metadata integration review','["CONFIGURATION_VALIDATION","MANUAL_REVIEW"]'),
('ACC-001','ACCESS_CONTROL','Governance access review','Governance visibility and mutations use the existing Admin RBAC taxonomy without a parallel permission system.', 'CRITICAL','Security','Admin RBAC integration tests','["AUTOMATED_TEST","AUDIT_EVENT"]'),
('EXC-001','AUDITABILITY','Expiring governance exceptions','Control exceptions are scoped, attributable, auditable and expire; they cannot permanently suppress mandatory controls.', 'HIGH','Security','Exception lifecycle tests','["AUTOMATED_TEST","AUDIT_EVENT"]'),
('EVD-001','AUDITABILITY','Evidence provenance and integrity','Evidence records contain source, reference, capture time, actor where applicable, idempotency and optional integrity hashes.', 'HIGH','Security','Evidence validation tests','["AUTOMATED_TEST","MANUAL_REVIEW"]'),
('VER-001','AUDITABILITY','Deterministic verification','Control verification is idempotent, permission-aware, bounded and non-destructive.', 'CRITICAL','Platform','Verification service tests','["AUTOMATED_TEST","CI_RESULT"]');

INSERT INTO "GovernanceControl" ("id","key","domain","title","description","criticality","ownerRole","verificationMethod","evidenceRequirements")
SELECT gen_random_uuid(), key, domain, title, description, criticality, ownerRole, verificationMethod, evidenceRequirements
FROM "_governance_seed" s
WHERE NOT EXISTS (SELECT 1 FROM "GovernanceControl" c WHERE c.key=s.key);
DROP TABLE "_governance_seed";
