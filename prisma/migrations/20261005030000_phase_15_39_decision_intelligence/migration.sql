ALTER TABLE "DeliveryRiskAssessment"
  ADD COLUMN IF NOT EXISTS "dimensions" JSONB,
  ADD COLUMN IF NOT EXISTS "confidence" VARCHAR(32),
  ADD COLUMN IF NOT EXISTS "evidence" JSONB,
  ADD COLUMN IF NOT EXISTS "algorithmVersion" VARCHAR(80);

-- Phase 15.39: production continuous-delivery decision intelligence.
-- Additive, provider-neutral, and independent from deployment/release execution.

CREATE TABLE IF NOT EXISTS "DeliveryDecisionProfile" (
  "id" UUID NOT NULL,
  "pipelineId" UUID NOT NULL,
  "changeRequestId" UUID,
  "releaseId" UUID,
  "deploymentId" UUID,
  "deliveryRunId" UUID,
  "environment" VARCHAR(80) NOT NULL,
  "target" VARCHAR(255) NOT NULL,
  "artifactVersion" VARCHAR(160),
  "dependencySnapshotId" VARCHAR(120),
  "graphSnapshotId" VARCHAR(120),
  "healthSnapshotId" VARCHAR(120),
  "featureFlagSnapshotId" VARCHAR(120),
  "policyVersion" VARCHAR(80) NOT NULL,
  "algorithmVersion" VARCHAR(80) NOT NULL,
  "status" VARCHAR(40) NOT NULL DEFAULT 'CREATED',
  "context" JSONB NOT NULL,
  "missingContext" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DeliveryDecisionProfile_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "DeliveryDecisionProfile_pipelineId_fkey" FOREIGN KEY ("pipelineId") REFERENCES "DeliveryPipeline"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "DeliveryDecisionProfile_pipelineId_createdAt_idx" ON "DeliveryDecisionProfile"("pipelineId","createdAt");
CREATE INDEX IF NOT EXISTS "DeliveryDecisionProfile_status_createdAt_idx" ON "DeliveryDecisionProfile"("status","createdAt");

CREATE TABLE IF NOT EXISTS "DeliverySignal" (
  "id" UUID NOT NULL,
  "profileId" UUID NOT NULL,
  "pipelineId" UUID NOT NULL,
  "signalType" VARCHAR(100) NOT NULL,
  "value" JSONB NOT NULL,
  "source" VARCHAR(160) NOT NULL,
  "sourceVersion" VARCHAR(80) NOT NULL,
  "observedAt" TIMESTAMP(3) NOT NULL,
  "freshnessSeconds" INTEGER,
  "quality" VARCHAR(32) NOT NULL,
  "confidence" VARCHAR(32) NOT NULL,
  "scope" JSONB NOT NULL,
  "provenance" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DeliverySignal_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "DeliverySignal_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "DeliveryDecisionProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "DeliverySignal_pipelineId_fkey" FOREIGN KEY ("pipelineId") REFERENCES "DeliveryPipeline"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "DeliverySignal_profileId_signalType_idx" ON "DeliverySignal"("profileId","signalType");
CREATE INDEX IF NOT EXISTS "DeliverySignal_pipelineId_observedAt_idx" ON "DeliverySignal"("pipelineId","observedAt");

CREATE TABLE IF NOT EXISTS "HistoricalDeliveryOutcome" (
  "id" UUID NOT NULL,
  "pipelineId" UUID,
  "releaseId" UUID,
  "deploymentId" UUID,
  "environment" VARCHAR(80) NOT NULL,
  "strategy" VARCHAR(80) NOT NULL,
  "changeType" VARCHAR(120) NOT NULL,
  "service" VARCHAR(160),
  "dependencyFingerprint" VARCHAR(128),
  "migrationPresent" BOOLEAN NOT NULL DEFAULT false,
  "traffic" JSONB NOT NULL,
  "customerSegment" JSONB NOT NULL,
  "risk" JSONB NOT NULL,
  "outcome" VARCHAR(80) NOT NULL,
  "incidents" JSONB NOT NULL,
  "customerImpact" JSONB NOT NULL,
  "rollback" JSONB NOT NULL,
  "recovery" JSONB NOT NULL,
  "performance" JSONB NOT NULL,
  "cost" JSONB NOT NULL,
  "confidence" VARCHAR(32) NOT NULL,
  "evidence" JSONB NOT NULL,
  "occurredAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "HistoricalDeliveryOutcome_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "HistoricalDeliveryOutcome_pipelineId_fkey" FOREIGN KEY ("pipelineId") REFERENCES "DeliveryPipeline"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "HistoricalDeliveryOutcome_environment_occurredAt_idx" ON "HistoricalDeliveryOutcome"("environment","occurredAt");
CREATE INDEX IF NOT EXISTS "HistoricalDeliveryOutcome_changeType_environment_idx" ON "HistoricalDeliveryOutcome"("changeType","environment");
CREATE INDEX IF NOT EXISTS "HistoricalDeliveryOutcome_strategy_occurredAt_idx" ON "HistoricalDeliveryOutcome"("strategy","occurredAt");

CREATE TABLE IF NOT EXISTS "DeliverySimilarityAssessment" (
  "id" UUID NOT NULL,
  "profileId" UUID NOT NULL,
  "pipelineId" UUID NOT NULL,
  "similarityDimensions" JSONB NOT NULL,
  "matchedDimensions" JSONB NOT NULL,
  "mismatchedDimensions" JSONB NOT NULL,
  "similarityConfidence" VARCHAR(32) NOT NULL,
  "evidence" JSONB NOT NULL,
  "limitations" JSONB NOT NULL,
  "comparedOutcomeIds" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DeliverySimilarityAssessment_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "DeliverySimilarityAssessment_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "DeliveryDecisionProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "DeliverySimilarityAssessment_pipelineId_fkey" FOREIGN KEY ("pipelineId") REFERENCES "DeliveryPipeline"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "DeliverySimilarityAssessment_profileId_createdAt_idx" ON "DeliverySimilarityAssessment"("profileId","createdAt");

CREATE TABLE IF NOT EXISTS "DeliveryRecommendation" (
  "id" UUID NOT NULL,
  "profileId" UUID NOT NULL,
  "pipelineId" UUID NOT NULL,
  "recommendation" VARCHAR(64) NOT NULL,
  "rationale" JSONB NOT NULL,
  "evidence" JSONB NOT NULL,
  "conflictingSignals" JSONB NOT NULL,
  "risk" JSONB NOT NULL,
  "affectedScope" JSONB NOT NULL,
  "confidence" VARCHAR(32) NOT NULL,
  "policyVersion" VARCHAR(80) NOT NULL,
  "algorithmVersion" VARCHAR(80) NOT NULL,
  "limitations" JSONB NOT NULL,
  "nextRequiredAction" VARCHAR(1000) NOT NULL,
  "status" VARCHAR(40) NOT NULL DEFAULT 'GENERATED',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DeliveryRecommendation_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "DeliveryRecommendation_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "DeliveryDecisionProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "DeliveryRecommendation_pipelineId_fkey" FOREIGN KEY ("pipelineId") REFERENCES "DeliveryPipeline"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "DeliveryRecommendation_profileId_createdAt_idx" ON "DeliveryRecommendation"("profileId","createdAt");
CREATE INDEX IF NOT EXISTS "DeliveryRecommendation_pipelineId_recommendation_idx" ON "DeliveryRecommendation"("pipelineId","recommendation");
CREATE INDEX IF NOT EXISTS "DeliveryRecommendation_expiresAt_status_idx" ON "DeliveryRecommendation"("expiresAt","status");

CREATE TABLE IF NOT EXISTS "DeliveryDecisionExperiment" (
  "id" UUID NOT NULL,
  "pipelineId" UUID,
  "experimentKey" VARCHAR(120) NOT NULL,
  "hypothesis" VARCHAR(2000) NOT NULL,
  "baseline" JSONB NOT NULL,
  "treatment" JSONB NOT NULL,
  "scope" JSONB NOT NULL,
  "cohort" JSONB NOT NULL,
  "metrics" JSONB NOT NULL,
  "successCriteria" JSONB NOT NULL,
  "stopConditions" JSONB NOT NULL,
  "safetyConditions" JSONB NOT NULL,
  "durationSeconds" INTEGER NOT NULL,
  "status" VARCHAR(32) NOT NULL DEFAULT 'DRAFT',
  "policyVersion" VARCHAR(80) NOT NULL,
  "createdBy" VARCHAR(120) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DeliveryDecisionExperiment_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "DeliveryDecisionExperiment_pipelineId_fkey" FOREIGN KEY ("pipelineId") REFERENCES "DeliveryPipeline"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "DeliveryDecisionExperiment_experimentKey_status_idx" ON "DeliveryDecisionExperiment"("experimentKey","status");

CREATE TABLE IF NOT EXISTS "DecisionIntelligencePolicy" (
  "id" UUID NOT NULL,
  "pipelineId" UUID,
  "policyKey" VARCHAR(120) NOT NULL,
  "version" VARCHAR(80) NOT NULL,
  "scope" JSONB NOT NULL,
  "status" VARCHAR(32) NOT NULL,
  "riskRules" JSONB NOT NULL,
  "signalRequirements" JSONB NOT NULL,
  "approvalRequirements" JSONB NOT NULL,
  "simulationRequirements" JSONB NOT NULL,
  "rehearsalRequirements" JSONB NOT NULL,
  "prohibitedActions" JSONB NOT NULL,
  "effectiveAt" TIMESTAMP(3),
  "expiresAt" TIMESTAMP(3),
  "createdBy" VARCHAR(120) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DecisionIntelligencePolicy_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "DecisionIntelligencePolicy_pipelineId_fkey" FOREIGN KEY ("pipelineId") REFERENCES "DeliveryPipeline"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "DecisionIntelligencePolicy_policyKey_version_key" ON "DecisionIntelligencePolicy"("policyKey","version");
CREATE INDEX IF NOT EXISTS "DecisionIntelligencePolicy_policyKey_status_idx" ON "DecisionIntelligencePolicy"("policyKey","status");

CREATE TABLE IF NOT EXISTS "DeliveryDecisionTransition" (
  "id" UUID NOT NULL,
  "profileId" UUID NOT NULL,
  "pipelineId" UUID NOT NULL,
  "previousState" VARCHAR(40) NOT NULL,
  "newState" VARCHAR(40) NOT NULL,
  "actorType" VARCHAR(32) NOT NULL,
  "actorId" VARCHAR(120) NOT NULL,
  "reason" VARCHAR(2000) NOT NULL,
  "evidence" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DeliveryDecisionTransition_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "DeliveryDecisionTransition_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "DeliveryDecisionProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "DeliveryDecisionTransition_pipelineId_fkey" FOREIGN KEY ("pipelineId") REFERENCES "DeliveryPipeline"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "DeliveryDecisionTransition_profileId_createdAt_idx" ON "DeliveryDecisionTransition"("profileId","createdAt");
CREATE INDEX IF NOT EXISTS "DeliveryDecisionTransition_pipelineId_createdAt_idx" ON "DeliveryDecisionTransition"("pipelineId","createdAt");

CREATE TABLE IF NOT EXISTS "DeliveryRecommendationOutcome" (
  "id" UUID NOT NULL,
  "profileId" UUID NOT NULL,
  "pipelineId" UUID NOT NULL,
  "recommendationId" UUID,
  "actualOutcome" VARCHAR(80) NOT NULL,
  "incidentOutcome" JSONB NOT NULL,
  "customerImpact" JSONB NOT NULL,
  "performance" JSONB NOT NULL,
  "reliability" JSONB NOT NULL,
  "rollback" JSONB NOT NULL,
  "recovery" JSONB NOT NULL,
  "cost" JSONB NOT NULL,
  "capacity" JSONB NOT NULL,
  "recommendationAccuracy" VARCHAR(32) NOT NULL,
  "riskAccuracy" VARCHAR(32) NOT NULL,
  "confidenceCalibration" VARCHAR(32) NOT NULL,
  "falsePositive" BOOLEAN NOT NULL,
  "falseNegative" BOOLEAN NOT NULL,
  "evidence" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DeliveryRecommendationOutcome_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "DeliveryRecommendationOutcome_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "DeliveryDecisionProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "DeliveryRecommendationOutcome_pipelineId_fkey" FOREIGN KEY ("pipelineId") REFERENCES "DeliveryPipeline"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "DeliveryRecommendationOutcome_profileId_createdAt_idx" ON "DeliveryRecommendationOutcome"("profileId","createdAt");
CREATE INDEX IF NOT EXISTS "DeliveryRecommendationOutcome_pipelineId_createdAt_idx" ON "DeliveryRecommendationOutcome"("pipelineId","createdAt");
