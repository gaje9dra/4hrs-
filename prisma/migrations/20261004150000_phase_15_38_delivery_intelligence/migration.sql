ALTER TABLE "DeliveryDecision"
  ADD COLUMN IF NOT EXISTS "decisionStatus" VARCHAR(32),
  ADD COLUMN IF NOT EXISTS "deliveryRunId" UUID,
  ADD COLUMN IF NOT EXISTS "evidenceReferences" JSONB,
  ADD COLUMN IF NOT EXISTS "dependencyState" JSONB,
  ADD COLUMN IF NOT EXISTS "healthState" JSONB,
  ADD COLUMN IF NOT EXISTS "affectedDelivery" JSONB,
  ADD COLUMN IF NOT EXISTS "previousDecisionId" UUID;

CREATE TABLE IF NOT EXISTS "DeliveryIntelligenceSnapshot" (
  "id" UUID NOT NULL,
  "pipelineId" UUID NOT NULL,
  "deliveryRunId" UUID,
  "releaseId" UUID,
  "deploymentId" UUID,
  "environmentId" VARCHAR(120),
  "revisionId" UUID,
  "dependencySnapshotId" VARCHAR(120),
  "graphSnapshotId" VARCHAR(120),
  "healthSnapshotId" VARCHAR(120),
  "incidentSnapshotId" VARCHAR(120),
  "capacitySnapshotId" VARCHAR(120),
  "securitySnapshotId" VARCHAR(120),
  "reconciliationSnapshotId" VARCHAR(120),
  "readinessSnapshotId" VARCHAR(120),
  "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "status" VARCHAR(32) NOT NULL,
  "provenance" JSONB NOT NULL,
  "payload" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DeliveryIntelligenceSnapshot_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "DeliveryIntelligenceSnapshot_pipelineId_fkey" FOREIGN KEY ("pipelineId") REFERENCES "DeliveryPipeline"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "DeliveryIntelligenceSnapshot_pipelineId_createdAt_idx" ON "DeliveryIntelligenceSnapshot"("pipelineId","createdAt");
CREATE INDEX IF NOT EXISTS "DeliveryIntelligenceSnapshot_expiresAt_status_idx" ON "DeliveryIntelligenceSnapshot"("expiresAt","status");

CREATE TABLE IF NOT EXISTS "PromotionAssessment" (
  "id" UUID NOT NULL,
  "pipelineId" UUID NOT NULL,
  "deliveryRunId" UUID,
  "sourceEnvironment" VARCHAR(80) NOT NULL,
  "targetEnvironment" VARCHAR(80) NOT NULL,
  "revisionId" UUID,
  "riskLevel" VARCHAR(32) NOT NULL,
  "decision" VARCHAR(48) NOT NULL,
  "confidence" VARCHAR(32) NOT NULL,
  "evaluatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "policyVersion" VARCHAR(80) NOT NULL,
  "evidenceVersion" VARCHAR(80) NOT NULL,
  "reasonSummary" VARCHAR(2000) NOT NULL,
  "blockingGates" JSONB NOT NULL,
  "warnings" JSONB NOT NULL,
  "requiredApprovals" JSONB NOT NULL,
  "requiredValidations" JSONB NOT NULL,
  "evidenceReferences" JSONB NOT NULL,
  "deterministicInputHash" VARCHAR(128) NOT NULL,
  "invalidatedAt" TIMESTAMP(3),
  "invalidationReason" VARCHAR(1000),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PromotionAssessment_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PromotionAssessment_pipelineId_fkey" FOREIGN KEY ("pipelineId") REFERENCES "DeliveryPipeline"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "PromotionAssessment_pipelineId_evaluatedAt_idx" ON "PromotionAssessment"("pipelineId","evaluatedAt");
CREATE INDEX IF NOT EXISTS "PromotionAssessment_expiresAt_decision_idx" ON "PromotionAssessment"("expiresAt","decision");
CREATE INDEX IF NOT EXISTS "PromotionAssessment_targetEnvironment_decision_idx" ON "PromotionAssessment"("targetEnvironment","decision");

CREATE TABLE IF NOT EXISTS "PromotionGateResult" (
  "id" UUID NOT NULL,
  "assessmentId" UUID NOT NULL,
  "gateType" VARCHAR(80) NOT NULL,
  "status" VARCHAR(32) NOT NULL,
  "observedValue" JSONB,
  "expectedThreshold" JSONB,
  "evidenceReference" VARCHAR(255),
  "evaluatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "policyVersion" VARCHAR(80) NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "blockingSeverity" VARCHAR(32) NOT NULL,
  "explanation" VARCHAR(2000) NOT NULL,
  CONSTRAINT "PromotionGateResult_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PromotionGateResult_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "PromotionAssessment"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "PromotionGateResult_assessmentId_status_idx" ON "PromotionGateResult"("assessmentId","status");

CREATE TABLE IF NOT EXISTS "DependencyHealthAssessment" (
  "id" UUID NOT NULL,
  "pipelineId" UUID NOT NULL,
  "deliveryRunId" UUID,
  "dependencyClass" VARCHAR(80) NOT NULL,
  "dependencyReference" VARCHAR(255) NOT NULL,
  "healthStatus" VARCHAR(32) NOT NULL,
  "severity" VARCHAR(32) NOT NULL,
  "observedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "evidenceReference" VARCHAR(255),
  "explanation" VARCHAR(2000) NOT NULL,
  "sourceVersion" VARCHAR(80) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DependencyHealthAssessment_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "DependencyHealthAssessment_pipelineId_fkey" FOREIGN KEY ("pipelineId") REFERENCES "DeliveryPipeline"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "DependencyHealthAssessment_pipelineId_dependencyClass_healthStatus_idx" ON "DependencyHealthAssessment"("pipelineId","dependencyClass","healthStatus");
CREATE INDEX IF NOT EXISTS "DependencyHealthAssessment_expiresAt_healthStatus_idx" ON "DependencyHealthAssessment"("expiresAt","healthStatus");

CREATE TABLE IF NOT EXISTS "DeliveryRiskAssessment" (
  "id" UUID NOT NULL,
  "pipelineId" UUID NOT NULL,
  "deliveryRunId" UUID,
  "riskLevel" VARCHAR(32) NOT NULL,
  "scoreBasis" JSONB NOT NULL,
  "evaluatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "policyVersion" VARCHAR(80) NOT NULL,
  "deterministicInputHash" VARCHAR(128) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DeliveryRiskAssessment_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "DeliveryRiskAssessment_pipelineId_fkey" FOREIGN KEY ("pipelineId") REFERENCES "DeliveryPipeline"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "DeliveryRiskAssessment_pipelineId_evaluatedAt_idx" ON "DeliveryRiskAssessment"("pipelineId","evaluatedAt");
CREATE INDEX IF NOT EXISTS "DeliveryRiskAssessment_expiresAt_riskLevel_idx" ON "DeliveryRiskAssessment"("expiresAt","riskLevel");

CREATE TABLE IF NOT EXISTS "PromotionWindow" (
  "id" UUID NOT NULL,
  "environment" VARCHAR(80) NOT NULL,
  "startAt" TIMESTAMP(3) NOT NULL,
  "endAt" TIMESTAMP(3) NOT NULL,
  "timezone" VARCHAR(80) NOT NULL,
  "allowedReleaseClasses" JSONB NOT NULL,
  "excludedPeriods" JSONB NOT NULL,
  "incidentFreeze" BOOLEAN NOT NULL DEFAULT false,
  "maintenance" BOOLEAN NOT NULL DEFAULT false,
  "blackout" BOOLEAN NOT NULL DEFAULT false,
  "approvalRequirements" JSONB NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PromotionWindow_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "PromotionWindow_environment_startAt_endAt_idx" ON "PromotionWindow"("environment","startAt","endAt");

CREATE TABLE IF NOT EXISTS "DeliveryPolicy" (
  "id" UUID NOT NULL,
  "policyKey" VARCHAR(120) NOT NULL,
  "version" VARCHAR(80) NOT NULL,
  "status" VARCHAR(32) NOT NULL,
  "definition" JSONB NOT NULL,
  "activatedAt" TIMESTAMP(3),
  "deprecatedAt" TIMESTAMP(3),
  "createdBy" VARCHAR(120) NOT NULL,
  "pipelineId" UUID,
  CONSTRAINT "DeliveryPolicy_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "DeliveryPolicy_pipelineId_fkey" FOREIGN KEY ("pipelineId") REFERENCES "DeliveryPipeline"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "DeliveryPolicy_policyKey_version_key" ON "DeliveryPolicy"("policyKey","version");
CREATE INDEX IF NOT EXISTS "DeliveryPolicy_policyKey_status_idx" ON "DeliveryPolicy"("policyKey","status");

CREATE TABLE IF NOT EXISTS "DeliveryCertification" (
  "id" UUID NOT NULL,
  "pipelineId" UUID NOT NULL,
  "deliveryRunId" UUID,
  "certificationState" VARCHAR(32) NOT NULL,
  "evidenceReferences" JSONB NOT NULL,
  "policyVersion" VARCHAR(80) NOT NULL,
  "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "invalidatedAt" TIMESTAMP(3),
  "invalidationReason" VARCHAR(1000),
  "reason" VARCHAR(2000) NOT NULL,
  CONSTRAINT "DeliveryCertification_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "DeliveryCertification_pipelineId_fkey" FOREIGN KEY ("pipelineId") REFERENCES "DeliveryPipeline"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "DeliveryCertification_pipelineId_certificationState_idx" ON "DeliveryCertification"("pipelineId","certificationState");
CREATE INDEX IF NOT EXISTS "DeliveryCertification_expiresAt_certificationState_idx" ON "DeliveryCertification"("expiresAt","certificationState");
