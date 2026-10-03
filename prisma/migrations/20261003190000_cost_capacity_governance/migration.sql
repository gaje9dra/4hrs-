CREATE TYPE "CostResourceCategory" AS ENUM ('INFRASTRUCTURE','DATABASE','COMPUTE','STORAGE','BANDWIDTH','CDN','SEARCH','OBSERVABILITY','EMAIL','SMS','ANALYTICS','PAYMENT_PROCESSING','FULFILLMENT','SHIPPING','BUILD_AND_DEPLOYMENT','THIRD_PARTY_API','SUPPORT_OPERATIONS');
CREATE TYPE "CostMeasurementStatus" AS ENUM ('ACTUAL','ESTIMATED','ALLOCATED','PROJECTED','UNKNOWN');
CREATE TYPE "CostEnvironment" AS ENUM ('DEVELOPMENT','TEST','PREVIEW','STAGING','PRODUCTION');
CREATE TYPE "CapacityLimitKind" AS ENUM ('HARD','SOFT');
CREATE TYPE "CostAnomalyStatus" AS ENUM ('OPEN','ACKNOWLEDGED','RESOLVED','DISMISSED');

CREATE TABLE "CostResource" (
  "id" UUID NOT NULL,
  "key" VARCHAR(120) NOT NULL,
  "name" VARCHAR(160) NOT NULL,
  "category" "CostResourceCategory" NOT NULL,
  "purpose" VARCHAR(500) NOT NULL,
  "owner" VARCHAR(120) NOT NULL,
  "environment" "CostEnvironment" NOT NULL,
  "criticality" VARCHAR(32) NOT NULL,
  "provider" VARCHAR(120),
  "measurementStatus" "CostMeasurementStatus" NOT NULL DEFAULT 'UNKNOWN',
  "billingAvailable" BOOLEAN NOT NULL DEFAULT false,
  "rateLimitKnown" BOOLEAN NOT NULL DEFAULT false,
  "capacityLimitKnown" BOOLEAN NOT NULL DEFAULT false,
  "failureBehavior" VARCHAR(1000),
  "fallbackBehavior" VARCHAR(1000),
  "monitoring" VARCHAR(500),
  "alerting" VARCHAR(500),
  "documentation" VARCHAR(1000),
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CostResource_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "CostResource_key_key" ON "CostResource"("key");
CREATE INDEX "CostResource_category_environment_active_idx" ON "CostResource"("category","environment","active");
CREATE INDEX "CostResource_measurementStatus_environment_idx" ON "CostResource"("measurementStatus","environment");

CREATE TABLE "CostResourceMetric" (
  "id" UUID NOT NULL,
  "resourceId" UUID NOT NULL,
  "metricKey" VARCHAR(120) NOT NULL,
  "value" DECIMAL(20,6) NOT NULL,
  "unit" VARCHAR(32) NOT NULL,
  "status" "CostMeasurementStatus" NOT NULL,
  "measuredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "service" VARCHAR(120),
  "correlationId" VARCHAR(128),
  "metadata" JSONB,
  CONSTRAINT "CostResourceMetric_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CostResourceMetric_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "CostResource"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "CostResourceMetric_resourceId_metricKey_measuredAt_idx" ON "CostResourceMetric"("resourceId","metricKey","measuredAt");
CREATE INDEX "CostResourceMetric_metricKey_measuredAt_idx" ON "CostResourceMetric"("metricKey","measuredAt");
CREATE INDEX "CostResourceMetric_status_measuredAt_idx" ON "CostResourceMetric"("status","measuredAt");

CREATE TABLE "CapacityLimit" (
  "id" UUID NOT NULL,
  "resourceId" UUID NOT NULL,
  "metricKey" VARCHAR(120) NOT NULL,
  "kind" "CapacityLimitKind" NOT NULL,
  "threshold" DECIMAL(20,6) NOT NULL,
  "unit" VARCHAR(32) NOT NULL,
  "severity" VARCHAR(32) NOT NULL,
  "owner" VARCHAR(120) NOT NULL,
  "runbook" VARCHAR(1000) NOT NULL,
  "action" VARCHAR(1000) NOT NULL,
  "escalationPath" VARCHAR(500) NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  CONSTRAINT "CapacityLimit_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CapacityLimit_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "CostResource"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "CapacityLimit_resourceId_metricKey_kind_key" ON "CapacityLimit"("resourceId","metricKey","kind");
CREATE INDEX "CapacityLimit_metricKey_enabled_idx" ON "CapacityLimit"("metricKey","enabled");

CREATE TABLE "CostAnomaly" (
  "id" UUID NOT NULL,
  "resourceId" UUID NOT NULL,
  "metricKey" VARCHAR(120) NOT NULL,
  "status" "CostAnomalyStatus" NOT NULL DEFAULT 'OPEN',
  "severity" VARCHAR(32) NOT NULL,
  "observedValue" DECIMAL(20,6) NOT NULL,
  "baselineValue" DECIMAL(20,6) NOT NULL,
  "deviation" DECIMAL(20,6) NOT NULL,
  "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolvedAt" TIMESTAMP(3),
  "evidence" JSONB,
  CONSTRAINT "CostAnomaly_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CostAnomaly_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "CostResource"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "CostAnomaly_resourceId_metricKey_detectedAt_idx" ON "CostAnomaly"("resourceId","metricKey","detectedAt");
CREATE INDEX "CostAnomaly_status_severity_detectedAt_idx" ON "CostAnomaly"("status","severity","detectedAt");

INSERT INTO "GovernanceControl" ("id","key","domain","title","description","criticality","ownerRole","status","applicability","verificationMethod","version")
VALUES
(gen_random_uuid(),'COST-001','OBSERVABILITY','Operational cost telemetry is governed','Resource telemetry is structured, bounded, privacy-safe and separated from customer financial truth.','HIGH','platform','IMPLEMENTED','REQUIRED','Review resource metric classification, sanitization and audit boundaries.',1),
(gen_random_uuid(),'COST-002','THIRD_PARTY_INTEGRATIONS','Provider cost limits are evidence-backed','Provider pricing, quotas and hard limits are never represented as facts without authoritative evidence.','HIGH','operations','IMPLEMENTED','REQUIRED','Verify unknown provider limits remain UNKNOWN until externally evidenced.',1),
(gen_random_uuid(),'COST-003','DATA_LIFECYCLE','Cost telemetry follows retention controls','Operational resource telemetry remains subject to existing privacy and data-lifecycle governance.','MEDIUM','platform','IMPLEMENTED','REQUIRED','Verify retention policy integration and bounded telemetry storage.',1)
ON CONFLICT ("key") DO NOTHING;
