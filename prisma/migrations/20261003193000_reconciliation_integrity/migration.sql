CREATE TYPE "ReconciliationDomain" AS ENUM ('CATALOG','CART','CHECKOUT','PAYMENT','ORDER','FULFILLMENT','SHIPPING','RETURNS','CANCELLATIONS','CUSTOMER','PRIVACY','CONTENT','SEARCH','ANALYTICS','NOTIFICATIONS','FEATURE_FLAGS','GOVERNANCE','BACKGROUND_JOBS','WEBHOOKS','PROVIDERS');
CREATE TYPE "ReconciliationDiscrepancyType" AS ENUM ('MISSING_DEPENDENCY','ORPHAN_RECORD','STATE_MISMATCH','DUPLICATE_RECORD','INVALID_REFERENCE','STALE_PROJECTION','DUPLICATE_EVENT','MISSING_EVENT','INVALID_TRANSITION','FINANCIAL_MISMATCH','OWNERSHIP_MISMATCH','PROVIDER_MISMATCH','TIMING_MISMATCH','UNKNOWN');
CREATE TYPE "ReconciliationSeverity" AS ENUM ('CRITICAL','HIGH','MEDIUM','LOW');
CREATE TYPE "ReconciliationStatus" AS ENUM ('DETECTED','INVESTIGATING','AUTO_RESOLVABLE','AWAITING_REVIEW','RECONCILING','RESOLVED','FAILED','ESCALATED','IGNORED','NOT_REPRODUCIBLE');
CREATE TYPE "ReconciliationActionType" AS ENUM ('DETECT','PLAN','APPLY_SAFE_REPAIR','MANUAL_RESOLUTION','RETRY','ESCALATE');

CREATE TABLE "ReconciliationCase" (
 "id" UUID NOT NULL, "type" "ReconciliationDiscrepancyType" NOT NULL, "domain" "ReconciliationDomain" NOT NULL,
 "severity" "ReconciliationSeverity" NOT NULL, "status" "ReconciliationStatus" NOT NULL DEFAULT 'DETECTED',
 "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "detectedBy" VARCHAR(120) NOT NULL, "source" VARCHAR(120) NOT NULL,
 "correlationId" VARCHAR(128), "authoritativeDomain" VARCHAR(80) NOT NULL, "affectedEntityType" VARCHAR(120) NOT NULL,
 "affectedEntityId" VARCHAR(255) NOT NULL, "description" VARCHAR(2000) NOT NULL, "evidence" JSONB, "resolution" JSONB,
 "resolvedAt" TIMESTAMP(3), "resolvedBy" VARCHAR(120), "retryCount" INTEGER NOT NULL DEFAULT 0, "version" INTEGER NOT NULL DEFAULT 1,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "ReconciliationCase_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ReconciliationCase_status_severity_detectedAt_idx" ON "ReconciliationCase"("status","severity","detectedAt");
CREATE INDEX "ReconciliationCase_domain_type_status_idx" ON "ReconciliationCase"("domain","type","status");
CREATE INDEX "ReconciliationCase_affected_entity_idx" ON "ReconciliationCase"("affectedEntityType","affectedEntityId");
CREATE INDEX "ReconciliationCase_authority_status_idx" ON "ReconciliationCase"("authoritativeDomain","status");
CREATE INDEX "ReconciliationCase_correlationId_idx" ON "ReconciliationCase"("correlationId");

CREATE TABLE "ReconciliationAction" (
 "id" UUID NOT NULL, "reconciliationId" UUID NOT NULL, "actionType" "ReconciliationActionType" NOT NULL,
 "idempotencyKey" VARCHAR(255) NOT NULL, "actorAdminId" UUID, "beforeState" JSONB, "afterState" JSONB,
 "reason" VARCHAR(1000), "success" BOOLEAN NOT NULL DEFAULT false, "errorCode" VARCHAR(120), "correlationId" VARCHAR(128),
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "ReconciliationAction_pkey" PRIMARY KEY ("id"),
 CONSTRAINT "ReconciliationAction_reconciliationId_fkey" FOREIGN KEY ("reconciliationId") REFERENCES "ReconciliationCase"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "ReconciliationAction_idempotencyKey_key" ON "ReconciliationAction"("idempotencyKey");
CREATE INDEX "ReconciliationAction_case_createdAt_idx" ON "ReconciliationAction"("reconciliationId","createdAt");
CREATE INDEX "ReconciliationAction_type_createdAt_idx" ON "ReconciliationAction"("actionType","createdAt");
CREATE INDEX "ReconciliationAction_actor_createdAt_idx" ON "ReconciliationAction"("actorAdminId","createdAt");