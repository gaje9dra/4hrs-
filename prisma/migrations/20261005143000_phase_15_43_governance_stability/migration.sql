CREATE TABLE "GovernanceStabilityAssessment" (
  "id" UUID NOT NULL,
  "stableId" VARCHAR(240) NOT NULL,
  "policyVersion" VARCHAR(80) NOT NULL,
  "environment" VARCHAR(40) NOT NULL,
  "classification" VARCHAR(40) NOT NULL,
  "dimensions" JSONB NOT NULL,
  "risk" JSONB NOT NULL,
  "evidence" JSONB NOT NULL,
  "provenance" JSONB NOT NULL,
  "correlationId" VARCHAR(160) NOT NULL,
  "actor" VARCHAR(160) NOT NULL,
  "algorithmVersion" VARCHAR(80) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GovernanceStabilityAssessment_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "GovernanceStabilityAssessment_stableId_key" ON "GovernanceStabilityAssessment"("stableId");
CREATE INDEX "GovernanceStabilityAssessment_classification_createdAt_idx" ON "GovernanceStabilityAssessment"("classification","createdAt");
CREATE INDEX "GovernanceStabilityAssessment_policyVersion_createdAt_idx" ON "GovernanceStabilityAssessment"("policyVersion","createdAt");

CREATE TABLE "GovernanceStabilitySignal" (
  "id" UUID NOT NULL,
  "assessmentId" UUID,
  "signalType" VARCHAR(80) NOT NULL,
  "state" VARCHAR(40) NOT NULL,
  "value" JSONB NOT NULL,
  "confidence" VARCHAR(32) NOT NULL,
  "provenance" JSONB NOT NULL,
  "observedAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GovernanceStabilitySignal_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "GovernanceStabilitySignal_assessmentId_createdAt_idx" ON "GovernanceStabilitySignal"("assessmentId","createdAt");
CREATE INDEX "GovernanceStabilitySignal_signalType_observedAt_idx" ON "GovernanceStabilitySignal"("signalType","observedAt");

CREATE TABLE "GovernanceStabilityConflict" (
  "id" UUID NOT NULL,
  "stableId" VARCHAR(240) NOT NULL,
  "controlIds" JSONB NOT NULL,
  "policyVersions" JSONB NOT NULL,
  "affectedWorkflow" VARCHAR(240),
  "conflictType" VARCHAR(48) NOT NULL,
  "severity" VARCHAR(32) NOT NULL,
  "impact" JSONB NOT NULL,
  "evidence" JSONB NOT NULL,
  "resolutionState" VARCHAR(40) NOT NULL DEFAULT 'OPEN',
  "provenance" JSONB NOT NULL,
  "correlationId" VARCHAR(160) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "GovernanceStabilityConflict_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "GovernanceStabilityConflict_stableId_key" ON "GovernanceStabilityConflict"("stableId");
CREATE INDEX "GovernanceStabilityConflict_severity_resolutionState_idx" ON "GovernanceStabilityConflict"("severity","resolutionState");
CREATE INDEX "GovernanceStabilityConflict_createdAt_idx" ON "GovernanceStabilityConflict"("createdAt");

CREATE TABLE "GovernanceStabilityDeadlockAssessment" (
  "id" UUID NOT NULL,
  "stableId" VARCHAR(240) NOT NULL,
  "nodes" JSONB NOT NULL,
  "cycle" JSONB NOT NULL,
  "severity" VARCHAR(32) NOT NULL,
  "blockedAction" VARCHAR(240),
  "evidence" JSONB NOT NULL,
  "provenance" JSONB NOT NULL,
  "correlationId" VARCHAR(160) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GovernanceStabilityDeadlockAssessment_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "GovernanceStabilityDeadlockAssessment_stableId_key" ON "GovernanceStabilityDeadlockAssessment"("stableId");
CREATE INDEX "GovernanceStabilityDeadlockAssessment_severity_createdAt_idx" ON "GovernanceStabilityDeadlockAssessment"("severity","createdAt");

CREATE TABLE "GovernanceOscillationAssessment" (
  "id" UUID NOT NULL,
  "stableId" VARCHAR(240) NOT NULL,
  "policyId" VARCHAR(160) NOT NULL,
  "sequence" JSONB NOT NULL,
  "frequency" DOUBLE PRECISION NOT NULL,
  "durationSeconds" INTEGER NOT NULL,
  "classification" VARCHAR(48) NOT NULL,
  "evidence" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GovernanceOscillationAssessment_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "GovernanceOscillationAssessment_stableId_key" ON "GovernanceOscillationAssessment"("stableId");
CREATE INDEX "GovernanceOscillationAssessment_policyId_createdAt_idx" ON "GovernanceOscillationAssessment"("policyId","createdAt");
CREATE INDEX "GovernanceOscillationAssessment_classification_createdAt_idx" ON "GovernanceOscillationAssessment"("classification","createdAt");

CREATE TABLE "GovernanceChurnAssessment" (
  "id" UUID NOT NULL,
  "stableId" VARCHAR(240) NOT NULL,
  "windowStart" TIMESTAMP(3) NOT NULL,
  "windowEnd" TIMESTAMP(3) NOT NULL,
  "metrics" JSONB NOT NULL,
  "classification" VARCHAR(48) NOT NULL,
  "evidence" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GovernanceChurnAssessment_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "GovernanceChurnAssessment_stableId_key" ON "GovernanceChurnAssessment"("stableId");
CREATE INDEX "GovernanceChurnAssessment_windowStart_windowEnd_idx" ON "GovernanceChurnAssessment"("windowStart","windowEnd");

CREATE TABLE "GovernanceCascadeAssessment" (
  "id" UUID NOT NULL,
  "stableId" VARCHAR(240) NOT NULL,
  "chain" JSONB NOT NULL,
  "causalClassification" VARCHAR(40) NOT NULL,
  "confidence" VARCHAR(32) NOT NULL,
  "evidence" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GovernanceCascadeAssessment_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "GovernanceCascadeAssessment_stableId_key" ON "GovernanceCascadeAssessment"("stableId");
CREATE INDEX "GovernanceCascadeAssessment_causalClassification_createdAt_idx" ON "GovernanceCascadeAssessment"("causalClassification","createdAt");

CREATE TABLE "GovernanceResilienceAssessment" (
  "id" UUID NOT NULL,
  "stableId" VARCHAR(240) NOT NULL,
  "mode" VARCHAR(40) NOT NULL,
  "scenario" JSONB NOT NULL,
  "result" JSONB NOT NULL,
  "risk" JSONB NOT NULL,
  "evidence" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GovernanceResilienceAssessment_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "GovernanceResilienceAssessment_stableId_key" ON "GovernanceResilienceAssessment"("stableId");
CREATE INDEX "GovernanceResilienceAssessment_mode_createdAt_idx" ON "GovernanceResilienceAssessment"("mode","createdAt");

CREATE TABLE "GovernanceControlInvariant" (
  "id" UUID NOT NULL,
  "stableId" VARCHAR(240) NOT NULL,
  "name" VARCHAR(240) NOT NULL,
  "expression" VARCHAR(2000) NOT NULL,
  "severity" VARCHAR(32) NOT NULL,
  "protectedDomain" VARCHAR(80) NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "provenance" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "GovernanceControlInvariant_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "GovernanceControlInvariant_stableId_key" ON "GovernanceControlInvariant"("stableId");
CREATE INDEX "GovernanceControlInvariant_active_protectedDomain_idx" ON "GovernanceControlInvariant"("active","protectedDomain");

CREATE TABLE "GovernanceStabilitySnapshot" (
  "id" UUID NOT NULL,
  "stableId" VARCHAR(240) NOT NULL,
  "environment" VARCHAR(40) NOT NULL,
  "policyVersions" JSONB NOT NULL,
  "activeControls" JSONB NOT NULL,
  "relationships" JSONB NOT NULL,
  "dependencies" JSONB NOT NULL,
  "certifications" JSONB NOT NULL,
  "freezes" JSONB NOT NULL,
  "exceptions" JSONB NOT NULL,
  "configurationReferences" JSONB NOT NULL,
  "integrityHash" VARCHAR(128) NOT NULL,
  "immutable" BOOLEAN NOT NULL DEFAULT true,
  "provenance" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GovernanceStabilitySnapshot_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "GovernanceStabilitySnapshot_stableId_key" ON "GovernanceStabilitySnapshot"("stableId");
CREATE INDEX "GovernanceStabilitySnapshot_environment_createdAt_idx" ON "GovernanceStabilitySnapshot"("environment","createdAt");

CREATE TABLE "GovernanceStabilityCertification" (
  "id" UUID NOT NULL,
  "stableId" VARCHAR(240) NOT NULL,
  "assessmentId" UUID NOT NULL,
  "classification" VARCHAR(40) NOT NULL,
  "scope" JSONB NOT NULL,
  "evidence" JSONB NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "status" VARCHAR(40) NOT NULL,
  "certifiedBy" VARCHAR(160) NOT NULL,
  "integrityHash" VARCHAR(128) NOT NULL,
  "immutable" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GovernanceStabilityCertification_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "GovernanceStabilityCertification_stableId_key" ON "GovernanceStabilityCertification"("stableId");
CREATE INDEX "GovernanceStabilityCertification_status_expiresAt_idx" ON "GovernanceStabilityCertification"("status","expiresAt");
CREATE INDEX "GovernanceStabilityCertification_assessmentId_createdAt_idx" ON "GovernanceStabilityCertification"("assessmentId","createdAt");
