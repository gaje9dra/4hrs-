CREATE TYPE "SyntheticExecutionMode" AS ENUM ('UNIT_LOCAL','CI','PREVIEW_STAGING','PRODUCTION_SAFE','MANUAL_DIAGNOSTIC');
CREATE TYPE "SyntheticCriticality" AS ENUM ('P0','P1','P2','P3');
CREATE TYPE "SyntheticExecutionStatus" AS ENUM ('HEALTHY','DEGRADED','FAILING','BLOCKED','UNAVAILABLE','NOT_CONFIGURED','UNKNOWN');
CREATE TYPE "SyntheticFailureCode" AS ENUM ('STOREFRONT_UNAVAILABLE','CATALOG_UNAVAILABLE','SEARCH_FAILURE','PRODUCT_LOAD_FAILURE','CART_FAILURE','CHECKOUT_FAILURE','PAYMENT_FAILURE','ORDER_CREATION_FAILURE','ORDER_IDEMPOTENCY_FAILURE','FULFILLMENT_FAILURE','PROVIDER_MAPPING_FAILURE','PROVIDER_UNAVAILABLE','SHIPPING_FAILURE','TRACKING_FAILURE','RETURN_FAILURE','CUSTOMER_DATA_FAILURE','NOTIFICATION_FAILURE','ANALYTICS_CONTAMINATION','CONTENT_FAILURE','ADMIN_AUTH_FAILURE','ADMIN_RBAC_FAILURE','DATABASE_FAILURE','QUEUE_FAILURE','TIMEOUT','CONFIGURATION_FAILURE','SAFETY_GUARD_BLOCK','UNSUPPORTED_SYNTHETIC_CAPABILITY');
CREATE TYPE "SyntheticCleanupStatus" AS ENUM ('NOT_REQUIRED','PENDING','SUCCEEDED','FAILED');
CREATE TYPE "SyntheticIdentityKind" AS ENUM ('CUSTOMER','ADMIN_OPERATOR','CATALOG_FIXTURE','ORDER','PAYMENT_CONTEXT','FULFILLMENT_CONTEXT','SHIPMENT_CONTEXT');

CREATE TABLE "SyntheticIdentity" (
  "id" UUID NOT NULL,
  "key" VARCHAR(160) NOT NULL,
  "kind" "SyntheticIdentityKind" NOT NULL,
  "environment" VARCHAR(32) NOT NULL,
  "deterministicKey" VARCHAR(160) NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "correlationId" VARCHAR(128),
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SyntheticIdentity_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "SyntheticIdentity_key_key" ON "SyntheticIdentity"("key");
CREATE UNIQUE INDEX "SyntheticIdentity_kind_environment_deterministicKey_key" ON "SyntheticIdentity"("kind","environment","deterministicKey");
CREATE INDEX "SyntheticIdentity_environment_kind_active_idx" ON "SyntheticIdentity"("environment","kind","active");

CREATE TABLE "SyntheticExecution" (
  "id" UUID NOT NULL,
  "workflowId" VARCHAR(120) NOT NULL,
  "mode" "SyntheticExecutionMode" NOT NULL,
  "environment" VARCHAR(32) NOT NULL,
  "status" "SyntheticExecutionStatus" NOT NULL,
  "failureCode" "SyntheticFailureCode",
  "startedAt" TIMESTAMP(3) NOT NULL,
  "endedAt" TIMESTAMP(3),
  "durationMs" INTEGER,
  "correlationId" VARCHAR(128) NOT NULL,
  "traceId" VARCHAR(128),
  "releaseId" VARCHAR(128),
  "deploymentId" VARCHAR(128),
  "featureFlagState" JSONB,
  "dependencyVersions" JSONB,
  "evidence" JSONB,
  "cleanupStatus" "SyntheticCleanupStatus" NOT NULL DEFAULT 'NOT_REQUIRED',
  "cleanupError" VARCHAR(1000),
  "retryCount" INTEGER NOT NULL DEFAULT 0,
  "syntheticIdentityId" UUID,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SyntheticExecution_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SyntheticExecution_syntheticIdentityId_fkey" FOREIGN KEY ("syntheticIdentityId") REFERENCES "SyntheticIdentity"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX "SyntheticExecution_workflowId_environment_startedAt_idx" ON "SyntheticExecution"("workflowId","environment","startedAt");
CREATE INDEX "SyntheticExecution_status_startedAt_idx" ON "SyntheticExecution"("status","startedAt");
CREATE INDEX "SyntheticExecution_mode_environment_status_idx" ON "SyntheticExecution"("mode","environment","status");
CREATE INDEX "SyntheticExecution_correlationId_idx" ON "SyntheticExecution"("correlationId");
CREATE INDEX "SyntheticExecution_releaseId_deploymentId_idx" ON "SyntheticExecution"("releaseId","deploymentId");

CREATE TABLE "SyntheticStepExecution" (
  "id" UUID NOT NULL,
  "executionId" UUID NOT NULL,
  "stepKey" VARCHAR(120) NOT NULL,
  "stepOrder" INTEGER NOT NULL,
  "status" "SyntheticExecutionStatus" NOT NULL,
  "startedAt" TIMESTAMP(3) NOT NULL,
  "endedAt" TIMESTAMP(3),
  "durationMs" INTEGER,
  "failureCode" "SyntheticFailureCode",
  "diagnostic" JSONB,
  "dependency" VARCHAR(120),
  "retryCount" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "SyntheticStepExecution_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SyntheticStepExecution_executionId_fkey" FOREIGN KEY ("executionId") REFERENCES "SyntheticExecution"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "SyntheticStepExecution_executionId_stepKey_key" ON "SyntheticStepExecution"("executionId","stepKey");
CREATE INDEX "SyntheticStepExecution_executionId_stepOrder_idx" ON "SyntheticStepExecution"("executionId","stepOrder");
CREATE INDEX "SyntheticStepExecution_status_startedAt_idx" ON "SyntheticStepExecution"("status","startedAt");

CREATE TABLE "SyntheticCertification" (
  "id" UUID NOT NULL,
  "environment" VARCHAR(32) NOT NULL,
  "releaseId" VARCHAR(128),
  "deploymentId" VARCHAR(128),
  "evaluatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "evaluator" VARCHAR(160) NOT NULL,
  "readiness" VARCHAR(32) NOT NULL,
  "workflowResults" JSONB NOT NULL,
  "criticalFailures" JSONB NOT NULL,
  "warnings" JSONB NOT NULL,
  "blockedCapabilities" JSONB NOT NULL,
  "unresolvedExceptions" JSONB NOT NULL,
  "governanceEvidence" JSONB,
  "reconciliationStatus" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SyntheticCertification_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "SyntheticCertification_environment_evaluatedAt_idx" ON "SyntheticCertification"("environment","evaluatedAt");
CREATE INDEX "SyntheticCertification_readiness_evaluatedAt_idx" ON "SyntheticCertification"("readiness","evaluatedAt");
CREATE INDEX "SyntheticCertification_releaseId_deploymentId_idx" ON "SyntheticCertification"("releaseId","deploymentId");