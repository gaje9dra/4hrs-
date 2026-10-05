-- Phase 15.40: governed delivery learning, outcome evaluation and optimization.
CREATE TABLE IF NOT EXISTS "DeliveryLearningOutcome" (
 "id" UUID NOT NULL,"pipelineId" UUID NOT NULL,"releaseId" UUID,"deploymentId" UUID,"changeRequestId" UUID,"deliveryDecisionId" UUID,
 "environment" VARCHAR(80) NOT NULL,"target" VARCHAR(255) NOT NULL,"artifactVersion" VARCHAR(160),"policyVersion" VARCHAR(80),"algorithmVersion" VARCHAR(80),
 "expectedOutcome" JSONB NOT NULL,"actualOutcome" JSONB NOT NULL,"outcomeStatus" VARCHAR(40) NOT NULL,"customerImpact" JSONB NOT NULL,
 "operationalImpact" JSONB NOT NULL,"reliabilityImpact" JSONB NOT NULL,"performanceImpact" JSONB NOT NULL,"securityImpact" JSONB NOT NULL,
 "privacyImpact" JSONB NOT NULL,"costImpact" JSONB NOT NULL,"capacityImpact" JSONB NOT NULL,"rollbackOccurred" BOOLEAN NOT NULL DEFAULT false,
 "recoveryOccurred" BOOLEAN NOT NULL DEFAULT false,"incidentOccurred" BOOLEAN NOT NULL DEFAULT false,"certificationStatus" VARCHAR(40) NOT NULL,
 "evidenceReference" JSONB NOT NULL,"startedAt" TIMESTAMP(3),"completedAt" TIMESTAMP(3),"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updatedAt" TIMESTAMP(3) NOT NULL,"idempotencyKey" VARCHAR(255) NOT NULL,
 CONSTRAINT "DeliveryLearningOutcome_pkey" PRIMARY KEY ("id"),CONSTRAINT "DeliveryLearningOutcome_idempotencyKey_key" UNIQUE ("idempotencyKey"),
 CONSTRAINT "DeliveryLearningOutcome_pipelineId_fkey" FOREIGN KEY ("pipelineId") REFERENCES "DeliveryPipeline"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "DeliveryLearningOutcome_pipelineId_createdAt_idx" ON "DeliveryLearningOutcome"("pipelineId","createdAt");
CREATE INDEX IF NOT EXISTS "DeliveryLearningOutcome_outcomeStatus_createdAt_idx" ON "DeliveryLearningOutcome"("outcomeStatus","createdAt");

CREATE TABLE IF NOT EXISTS "LearningObservation" (
 "id" UUID NOT NULL,"pipelineId" UUID NOT NULL,"outcomeId" UUID,"signal" VARCHAR(120) NOT NULL,"value" JSONB NOT NULL,
 "source" VARCHAR(160) NOT NULL,"sourceVersion" VARCHAR(80) NOT NULL,"observedAt" TIMESTAMP(3) NOT NULL,"freshness" VARCHAR(32) NOT NULL,
 "quality" VARCHAR(32) NOT NULL,"confidence" VARCHAR(32) NOT NULL,"scope" JSONB NOT NULL,"provenance" JSONB NOT NULL,
 "integrityHash" VARCHAR(128) NOT NULL,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "LearningObservation_pkey" PRIMARY KEY ("id"),
 CONSTRAINT "LearningObservation_pipelineId_fkey" FOREIGN KEY ("pipelineId") REFERENCES "DeliveryPipeline"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT "LearningObservation_outcomeId_fkey" FOREIGN KEY ("outcomeId") REFERENCES "DeliveryLearningOutcome"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "LearningObservation_pipelineId_observedAt_idx" ON "LearningObservation"("pipelineId","observedAt");
CREATE INDEX IF NOT EXISTS "LearningObservation_signal_observedAt_idx" ON "LearningObservation"("signal","observedAt");

CREATE TABLE IF NOT EXISTS "PredictionEvaluation" (
 "id" UUID NOT NULL,"pipelineId" UUID NOT NULL,"outcomeId" UUID NOT NULL,"predictionType" VARCHAR(100) NOT NULL,"predictionValue" JSONB NOT NULL,
 "actualValue" JSONB NOT NULL,"error" JSONB NOT NULL,"errorClass" VARCHAR(40) NOT NULL,"confidence" VARCHAR(32) NOT NULL,
 "calibrationStatus" VARCHAR(40) NOT NULL,"predictionVersion" VARCHAR(80) NOT NULL,"evaluatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "evidence" JSONB NOT NULL,"falsePositive" BOOLEAN NOT NULL DEFAULT false,"falseNegative" BOOLEAN NOT NULL DEFAULT false,
 CONSTRAINT "PredictionEvaluation_pkey" PRIMARY KEY ("id"),
 CONSTRAINT "PredictionEvaluation_pipelineId_fkey" FOREIGN KEY ("pipelineId") REFERENCES "DeliveryPipeline"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT "PredictionEvaluation_outcomeId_fkey" FOREIGN KEY ("outcomeId") REFERENCES "DeliveryLearningOutcome"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "PredictionEvaluation_pipelineId_evaluatedAt_idx" ON "PredictionEvaluation"("pipelineId","evaluatedAt");

CREATE TABLE IF NOT EXISTS "DecisionOutcomeEvaluation" (
 "id" UUID NOT NULL,"pipelineId" UUID NOT NULL,"outcomeId" UUID NOT NULL,"deliveryDecisionId" UUID,"recommendation" VARCHAR(80) NOT NULL,
 "expectedOutcome" JSONB NOT NULL,"actualOutcome" JSONB NOT NULL,"decisionQuality" VARCHAR(40) NOT NULL,"confidence" VARCHAR(32) NOT NULL,
 "falsePositive" BOOLEAN NOT NULL DEFAULT false,"falseNegative" BOOLEAN NOT NULL DEFAULT false,"evidence" JSONB NOT NULL,
 "evaluatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,CONSTRAINT "DecisionOutcomeEvaluation_pkey" PRIMARY KEY ("id"),
 CONSTRAINT "DecisionOutcomeEvaluation_pipelineId_fkey" FOREIGN KEY ("pipelineId") REFERENCES "DeliveryPipeline"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT "DecisionOutcomeEvaluation_outcomeId_fkey" FOREIGN KEY ("outcomeId") REFERENCES "DeliveryLearningOutcome"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "DecisionOutcomeEvaluation_pipelineId_evaluatedAt_idx" ON "DecisionOutcomeEvaluation"("pipelineId","evaluatedAt");

CREATE TABLE IF NOT EXISTS "LearningPattern" (
 "id" UUID NOT NULL,"pipelineId" UUID,"patternType" VARCHAR(80) NOT NULL,"scope" JSONB NOT NULL,"conditions" JSONB NOT NULL,
 "evidenceCount" INTEGER NOT NULL,"successRate" JSONB NOT NULL,"failureRate" JSONB NOT NULL,"confidence" VARCHAR(32) NOT NULL,
 "validityWindow" JSONB NOT NULL,"algorithmVersion" VARCHAR(80) NOT NULL,"validationStatus" VARCHAR(40) NOT NULL,"governanceStatus" VARCHAR(40) NOT NULL,
 "associationType" VARCHAR(32) NOT NULL,"supportingEvidence" JSONB NOT NULL,"counterEvidence" JSONB NOT NULL,"provenance" JSONB NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"updatedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "LearningPattern_pkey" PRIMARY KEY ("id"),
 CONSTRAINT "LearningPattern_pipelineId_fkey" FOREIGN KEY ("pipelineId") REFERENCES "DeliveryPipeline"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "LearningPattern_patternType_updatedAt_idx" ON "LearningPattern"("patternType","updatedAt");

CREATE TABLE IF NOT EXISTS "OptimizationProposal" (
 "id" UUID NOT NULL,"pipelineId" UUID,"problem" VARCHAR(4000) NOT NULL,"evidence" JSONB NOT NULL,"currentBehavior" JSONB NOT NULL,
 "proposedBehavior" JSONB NOT NULL,"expectedBenefit" JSONB NOT NULL,"risk" JSONB NOT NULL,"affectedSystems" JSONB NOT NULL,
 "affectedPolicies" JSONB NOT NULL,"affectedCustomers" JSONB NOT NULL,"cost" JSONB NOT NULL,"validationStrategy" JSONB NOT NULL,
 "rollbackStrategy" JSONB NOT NULL,"simulationRequired" BOOLEAN NOT NULL DEFAULT false,"approvalRequired" BOOLEAN NOT NULL DEFAULT false,
 "safetyClass" VARCHAR(32) NOT NULL,"lifecycleState" VARCHAR(40) NOT NULL DEFAULT 'DRAFT',"policyVersion" VARCHAR(80),"algorithmVersion" VARCHAR(80) NOT NULL,
 "reversible" BOOLEAN NOT NULL DEFAULT true,"evidenceConfidence" VARCHAR(32) NOT NULL,"createdBy" VARCHAR(160) NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"updatedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "OptimizationProposal_pkey" PRIMARY KEY ("id"),
 CONSTRAINT "OptimizationProposal_pipelineId_fkey" FOREIGN KEY ("pipelineId") REFERENCES "DeliveryPipeline"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "OptimizationProposal_lifecycleState_updatedAt_idx" ON "OptimizationProposal"("lifecycleState","updatedAt");
CREATE INDEX IF NOT EXISTS "OptimizationProposal_safetyClass_updatedAt_idx" ON "OptimizationProposal"("safetyClass","updatedAt");

CREATE TABLE IF NOT EXISTS "LearningPolicy" (
 "id" UUID NOT NULL,"policyKey" VARCHAR(120) NOT NULL,"policyVersion" VARCHAR(80) NOT NULL,"scope" JSONB NOT NULL,
 "allowedSignals" JSONB NOT NULL,"prohibitedSignals" JSONB NOT NULL,"minimumEvidence" JSONB NOT NULL,"confidenceRequirements" JSONB NOT NULL,
 "validationRequirements" JSONB NOT NULL,"approvalRequirements" JSONB NOT NULL,"privacyConstraints" JSONB NOT NULL,"safetyConstraints" JSONB NOT NULL,
 "effectiveAt" TIMESTAMP(3),"expiresAt" TIMESTAMP(3),"status" VARCHAR(32) NOT NULL,"createdBy" VARCHAR(160) NOT NULL,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "LearningPolicy_pkey" PRIMARY KEY ("id"),CONSTRAINT "LearningPolicy_policyKey_policyVersion_key" UNIQUE ("policyKey","policyVersion")
);
CREATE INDEX IF NOT EXISTS "LearningPolicy_policyKey_status_idx" ON "LearningPolicy"("policyKey","status");

CREATE TABLE IF NOT EXISTS "LearningExperiment" (
 "id" UUID NOT NULL,"pipelineId" UUID,"proposalId" UUID,"experimentKey" VARCHAR(160) NOT NULL,"mode" VARCHAR(32) NOT NULL,
 "hypothesis" VARCHAR(4000) NOT NULL,"baseline" JSONB NOT NULL,"treatment" JSONB NOT NULL,"scope" JSONB NOT NULL,"cohort" JSONB NOT NULL,
 "exposure" JSONB NOT NULL,"metrics" JSONB NOT NULL,"successCriteria" JSONB NOT NULL,"stopConditions" JSONB NOT NULL,"safetyConditions" JSONB NOT NULL,
 "results" JSONB,"lifecycleState" VARCHAR(40) NOT NULL DEFAULT 'DRAFT',"approved" BOOLEAN NOT NULL DEFAULT false,"expiresAt" TIMESTAMP(3) NOT NULL,
 "createdBy" VARCHAR(160) NOT NULL,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"updatedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "LearningExperiment_pkey" PRIMARY KEY ("id"),CONSTRAINT "LearningExperiment_experimentKey_key" UNIQUE ("experimentKey"),
 CONSTRAINT "LearningExperiment_pipelineId_fkey" FOREIGN KEY ("pipelineId") REFERENCES "DeliveryPipeline"("id") ON DELETE SET NULL ON UPDATE CASCADE,
 CONSTRAINT "LearningExperiment_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "OptimizationProposal"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "LearningExperiment_lifecycleState_expiresAt_idx" ON "LearningExperiment"("lifecycleState","expiresAt");

CREATE TABLE IF NOT EXISTS "LearningCertification" (
 "id" UUID NOT NULL,"pipelineId" UUID,"proposalId" UUID,"status" VARCHAR(40) NOT NULL,"implementationStatus" VARCHAR(40) NOT NULL,
 "testStatus" VARCHAR(40) NOT NULL,"securityStatus" VARCHAR(40) NOT NULL,"privacyStatus" VARCHAR(40) NOT NULL,"dataIntegrityStatus" VARCHAR(40) NOT NULL,
 "operationalStatus" VARCHAR(40) NOT NULL,"governanceStatus" VARCHAR(40) NOT NULL,"documentationStatus" VARCHAR(40) NOT NULL,
 "evidence" JSONB NOT NULL,"knownLimitations" JSONB NOT NULL,"unresolvedRisks" JSONB NOT NULL,"rollbackReadiness" JSONB NOT NULL,
 "policyVersion" VARCHAR(80) NOT NULL,"algorithmVersion" VARCHAR(80) NOT NULL,"immutable" BOOLEAN NOT NULL DEFAULT true,"certifiedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "LearningCertification_pkey" PRIMARY KEY ("id"),
 CONSTRAINT "LearningCertification_pipelineId_fkey" FOREIGN KEY ("pipelineId") REFERENCES "DeliveryPipeline"("id") ON DELETE SET NULL ON UPDATE CASCADE,
 CONSTRAINT "LearningCertification_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "OptimizationProposal"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "LearningCertification_status_certifiedAt_idx" ON "LearningCertification"("status","certifiedAt");

CREATE TABLE IF NOT EXISTS "LearningTransition" (
 "id" UUID NOT NULL,"proposalId" UUID,"outcomeId" UUID,"fromState" VARCHAR(40) NOT NULL,"toState" VARCHAR(40) NOT NULL,
 "actor" VARCHAR(160) NOT NULL,"reason" VARCHAR(2000) NOT NULL,"evidence" JSONB NOT NULL,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "LearningTransition_pkey" PRIMARY KEY ("id"),
 CONSTRAINT "LearningTransition_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "OptimizationProposal"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT "LearningTransition_outcomeId_fkey" FOREIGN KEY ("outcomeId") REFERENCES "DeliveryLearningOutcome"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "LearningTransition_proposalId_createdAt_idx" ON "LearningTransition"("proposalId","createdAt");

CREATE TABLE IF NOT EXISTS "SignalQualityEvaluation" (
 "id" UUID NOT NULL,"pipelineId" UUID NOT NULL,"signal" VARCHAR(120) NOT NULL,"freshnessScore" JSONB NOT NULL,"completenessScore" JSONB NOT NULL,
 "consistencyScore" JSONB NOT NULL,"stabilityScore" JSONB NOT NULL,"historicalUsefulness" JSONB NOT NULL,"predictiveUsefulness" JSONB NOT NULL,
 "noise" JSONB NOT NULL,"sourceReliability" JSONB NOT NULL,"provenance" JSONB NOT NULL,"version" VARCHAR(80) NOT NULL,
 "status" VARCHAR(32) NOT NULL,"evidence" JSONB NOT NULL,"evaluatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "SignalQualityEvaluation_pkey" PRIMARY KEY ("id"),
 CONSTRAINT "SignalQualityEvaluation_pipelineId_fkey" FOREIGN KEY ("pipelineId") REFERENCES "DeliveryPipeline"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "SignalQualityEvaluation_signal_evaluatedAt_idx" ON "SignalQualityEvaluation"("signal","evaluatedAt");
