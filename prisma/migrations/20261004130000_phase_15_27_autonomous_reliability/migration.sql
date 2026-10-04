CREATE TYPE "ReliabilityConfidenceLevel" AS ENUM ('UNKNOWN','LOW','MEDIUM','HIGH','VERIFIED');
CREATE TYPE "ReliabilityAssessmentState" AS ENUM ('CREATED','CORRELATING','ASSESSED','AWAITING_VALIDATION','ACTIONABLE','REMEDIATING','VERIFYING','RESOLVED','REGRESSED','ESCALATED','CLOSED');
CREATE TYPE "ReliabilityOutcomeStatus" AS ENUM ('SUCCESS','PARTIAL_SUCCESS','FAILED','UNKNOWN','REGRESSION','REQUIRES_HUMAN_REVIEW');
CREATE TYPE "ReliabilityStrategyStatus" AS ENUM ('DRAFT','REVIEW','APPROVED','ACTIVE','PAUSED','DISABLED','RETIRED');
CREATE TYPE "ReliabilityCircuitState" AS ENUM ('CLOSED','OPEN','HALF_OPEN');

CREATE TABLE "ReliabilitySignal" (
"id" UUID NOT NULL DEFAULT gen_random_uuid(),
"fingerprint" VARCHAR(128) NOT NULL,
"kind" VARCHAR(80) NOT NULL,
"service" VARCHAR(120) NOT NULL,
"dependency" VARCHAR(120),
"severity" VARCHAR(32) NOT NULL,
"observedAt" TIMESTAMP(3) NOT NULL,
"environment" VARCHAR(32) NOT NULL,
"value" JSONB NOT NULL,
"evidence" JSONB,
"correlationId" VARCHAR(128),
"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
CONSTRAINT "ReliabilitySignal_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ReliabilitySignal_fingerprint_key" ON "ReliabilitySignal"("fingerprint");
CREATE INDEX "ReliabilitySignal_service_observedAt_idx" ON "ReliabilitySignal"("service","observedAt");
CREATE INDEX "ReliabilitySignal_dependency_observedAt_idx" ON "ReliabilitySignal"("dependency","observedAt");
CREATE INDEX "ReliabilitySignal_severity_observedAt_idx" ON "ReliabilitySignal"("severity","observedAt");

CREATE TABLE "ReliabilityObservation" (
"id" UUID NOT NULL DEFAULT gen_random_uuid(),
"signalId" UUID NOT NULL,
"metricKey" VARCHAR(120) NOT NULL,
"numericValue" DECIMAL(20,6),
"status" VARCHAR(32) NOT NULL,
"observedAt" TIMESTAMP(3) NOT NULL,
"baselineReference" TEXT,
"evidence" JSONB,
CONSTRAINT "ReliabilityObservation_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ReliabilityObservation_signalId_observedAt_idx" ON "ReliabilityObservation"("signalId","observedAt");
CREATE INDEX "ReliabilityObservation_metricKey_observedAt_idx" ON "ReliabilityObservation"("metricKey","observedAt");
ALTER TABLE "ReliabilityObservation" ADD CONSTRAINT "ReliabilityObservation_signalId_fkey" FOREIGN KEY ("signalId") REFERENCES "ReliabilitySignal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "ReliabilityCorrelation" (
"id" UUID NOT NULL DEFAULT gen_random_uuid(),
"fingerprint" VARCHAR(128) NOT NULL,
"windowStart" TIMESTAMP(3) NOT NULL,
"windowEnd" TIMESTAMP(3) NOT NULL,
"correlationType" VARCHAR(80) NOT NULL,
"signalIds" TEXT[] NOT NULL,
"explanation" VARCHAR(2000) NOT NULL,
"evidence" JSONB NOT NULL,
"correlationConfidence" DOUBLE PRECISION NOT NULL,
"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
CONSTRAINT "ReliabilityCorrelation_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ReliabilityCorrelation_fingerprint_key" ON "ReliabilityCorrelation"("fingerprint");
CREATE INDEX "ReliabilityCorrelation_windowStart_windowEnd_idx" ON "ReliabilityCorrelation"("windowStart","windowEnd");

CREATE TABLE "ReliabilityHypothesis" (
"id" UUID NOT NULL DEFAULT gen_random_uuid(),
"correlationId" UUID,
"statement" VARCHAR(2000) NOT NULL,
"domain" VARCHAR(80) NOT NULL,
"resources" TEXT[] NOT NULL,
"evidence" JSONB NOT NULL,
"competingHypotheses" JSONB,
"confidence" "ReliabilityConfidenceLevel" NOT NULL,
"validationMethod" VARCHAR(1000) NOT NULL,
"expiresAt" TIMESTAMP(3) NOT NULL,
"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
CONSTRAINT "ReliabilityHypothesis_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ReliabilityHypothesis_confidence_expiresAt_idx" ON "ReliabilityHypothesis"("confidence","expiresAt");

CREATE TABLE "ReliabilityAssessment" (
"id" UUID NOT NULL DEFAULT gen_random_uuid(),
"correlationId" UUID,
"hypothesisId" UUID,
"state" "ReliabilityAssessmentState" NOT NULL DEFAULT 'CREATED',
"confidence" "ReliabilityConfidenceLevel" NOT NULL,
"signals" JSONB NOT NULL,
"evidence" JSONB NOT NULL,
"contradictions" JSONB,
"remediationConsidered" JSONB NOT NULL,
"selectionRationale" VARCHAR(2000) NOT NULL,
"incidentId" UUID,
"correlationFingerprint" VARCHAR(128) NOT NULL,
"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
"updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
CONSTRAINT "ReliabilityAssessment_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ReliabilityAssessment_state_updatedAt_idx" ON "ReliabilityAssessment"("state","updatedAt");
CREATE INDEX "ReliabilityAssessment_confidence_updatedAt_idx" ON "ReliabilityAssessment"("confidence","updatedAt");
CREATE INDEX "ReliabilityAssessment_incidentId_idx" ON "ReliabilityAssessment"("incidentId");

CREATE TABLE "ReliabilityDecision" (
"id" UUID NOT NULL DEFAULT gen_random_uuid(),
"assessmentId" UUID NOT NULL,
"strategyId" TEXT,
"decision" VARCHAR(64) NOT NULL,
"reason" VARCHAR(2000) NOT NULL,
"risk" VARCHAR(32) NOT NULL,
"requiresApproval" BOOLEAN NOT NULL,
"blockedConditions" JSONB,
"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
CONSTRAINT "ReliabilityDecision_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ReliabilityDecision_assessmentId_createdAt_idx" ON "ReliabilityDecision"("assessmentId","createdAt");

CREATE TABLE "ReliabilityStrategy" (
"id" UUID NOT NULL DEFAULT gen_random_uuid(),
"stableId" VARCHAR(120) NOT NULL,
"version" INTEGER NOT NULL DEFAULT 1,
"name" VARCHAR(160) NOT NULL,
"status" "ReliabilityStrategyStatus" NOT NULL DEFAULT 'DRAFT',
"symptom" VARCHAR(1000) NOT NULL,
"evidenceRequirements" JSONB NOT NULL,
"hypothesisRequirements" JSONB NOT NULL,
"risk" VARCHAR(32) NOT NULL,
"actions" JSONB NOT NULL,
"preconditions" JSONB NOT NULL,
"postconditions" JSONB NOT NULL,
"timeoutSeconds" INTEGER NOT NULL,
"retryLimit" INTEGER NOT NULL,
"cooldownSeconds" INTEGER NOT NULL,
"maxSteps" INTEGER NOT NULL,
"maxMutations" INTEGER NOT NULL,
"maxChainDurationSeconds" INTEGER NOT NULL,
"blastRadius" JSONB NOT NULL,
"rollback" JSONB NOT NULL,
"verification" JSONB NOT NULL,
"escalation" JSONB NOT NULL,
"owner" VARCHAR(160) NOT NULL,
"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
"updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
CONSTRAINT "ReliabilityStrategy_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ReliabilityStrategy_stableId_key" ON "ReliabilityStrategy"("stableId");
CREATE INDEX "ReliabilityStrategy_status_risk_idx" ON "ReliabilityStrategy"("status","risk");

CREATE TABLE "ReliabilityEvaluation" (
"id" UUID NOT NULL DEFAULT gen_random_uuid(),
"assessmentId" UUID NOT NULL,
"strategyId" TEXT,
"phase" VARCHAR(40) NOT NULL,
"passed" BOOLEAN NOT NULL,
"checks" JSONB NOT NULL,
"observedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
CONSTRAINT "ReliabilityEvaluation_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ReliabilityEvaluation_assessmentId_observedAt_idx" ON "ReliabilityEvaluation"("assessmentId","observedAt");

CREATE TABLE "ReliabilityBaseline" (
"id" UUID NOT NULL DEFAULT gen_random_uuid(),
"key" VARCHAR(160) NOT NULL,
"environment" VARCHAR(32) NOT NULL,
"metricKey" VARCHAR(120) NOT NULL,
"sampleCount" INTEGER NOT NULL,
"center" DECIMAL(20,6) NOT NULL,
"spread" DECIMAL(20,6) NOT NULL,
"method" VARCHAR(120) NOT NULL,
"frozen" BOOLEAN NOT NULL DEFAULT false,
"freezeReason" TEXT,
"windowStart" TIMESTAMP(3) NOT NULL,
"windowEnd" TIMESTAMP(3) NOT NULL,
"version" INTEGER NOT NULL DEFAULT 1,
"evidence" JSONB,
"updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
CONSTRAINT "ReliabilityBaseline_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ReliabilityBaseline_key_environment_metricKey_version_key" ON "ReliabilityBaseline"("key","environment","metricKey","version");
CREATE INDEX "ReliabilityBaseline_metricKey_environment_updatedAt_idx" ON "ReliabilityBaseline"("metricKey","environment","updatedAt");

CREATE TABLE "ReliabilityAnomaly" (
"id" UUID NOT NULL DEFAULT gen_random_uuid(),
"baselineId" UUID,
"metricKey" VARCHAR(120) NOT NULL,
"environment" VARCHAR(32) NOT NULL,
"observedValue" DECIMAL(20,6) NOT NULL,
"expectedValue" DECIMAL(20,6) NOT NULL,
"deviation" DECIMAL(20,6) NOT NULL,
"method" VARCHAR(120) NOT NULL,
"sustained" BOOLEAN NOT NULL,
"explanation" VARCHAR(1000) NOT NULL,
"detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
"status" VARCHAR(32) NOT NULL DEFAULT 'OPEN',
CONSTRAINT "ReliabilityAnomaly_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ReliabilityAnomaly_metricKey_environment_detectedAt_idx" ON "ReliabilityAnomaly"("metricKey","environment","detectedAt");
CREATE INDEX "ReliabilityAnomaly_status_detectedAt_idx" ON "ReliabilityAnomaly"("status","detectedAt");

CREATE TABLE "ReliabilityOutcome" (
"id" UUID NOT NULL DEFAULT gen_random_uuid(),
"assessmentId" UUID NOT NULL,
"strategyId" TEXT,
"executionId" TEXT,
"status" "ReliabilityOutcomeStatus" NOT NULL,
"preconditions" JSONB NOT NULL,
"actionEvidence" JSONB NOT NULL,
"postconditions" JSONB NOT NULL,
"regressionDetected" BOOLEAN NOT NULL DEFAULT false,
"observationWindowSeconds" INTEGER NOT NULL,
"verifiedAt" TIMESTAMP(3),
"explanation" VARCHAR(2000) NOT NULL,
"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
CONSTRAINT "ReliabilityOutcome_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ReliabilityOutcome_assessmentId_createdAt_idx" ON "ReliabilityOutcome"("assessmentId","createdAt");
CREATE INDEX "ReliabilityOutcome_status_createdAt_idx" ON "ReliabilityOutcome"("status","createdAt");

CREATE TABLE "ReliabilityRegression" (
"id" UUID NOT NULL DEFAULT gen_random_uuid(),
"assessmentId" UUID NOT NULL,
"executionId" TEXT,
"metricKey" VARCHAR(120) NOT NULL,
"beforeValue" DECIMAL(20,6) NOT NULL,
"afterValue" DECIMAL(20,6) NOT NULL,
"threshold" DECIMAL(20,6) NOT NULL,
"explanation" VARCHAR(2000) NOT NULL,
"circuitOpened" BOOLEAN NOT NULL DEFAULT false,
"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
CONSTRAINT "ReliabilityRegression_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ReliabilityRegression_assessmentId_createdAt_idx" ON "ReliabilityRegression"("assessmentId","createdAt");

CREATE TABLE "ReliabilityCausality" (
"id" UUID NOT NULL DEFAULT gen_random_uuid(),
"assessmentId" UUID NOT NULL,
"eventType" VARCHAR(80) NOT NULL,
"eventReference" VARCHAR(160) NOT NULL,
"affectedSystem" VARCHAR(120) NOT NULL,
"eventAt" TIMESTAMP(3) NOT NULL,
"timeDistanceSeconds" INTEGER NOT NULL,
"relationship" VARCHAR(32) NOT NULL,
"confidence" DOUBLE PRECISION NOT NULL,
"evidence" JSONB NOT NULL,
"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
CONSTRAINT "ReliabilityCausality_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ReliabilityCausality_assessmentId_eventAt_idx" ON "ReliabilityCausality"("assessmentId","eventAt");

CREATE TABLE "ReliabilitySuppression" (
"id" UUID NOT NULL DEFAULT gen_random_uuid(),
"fingerprint" VARCHAR(128) NOT NULL,
"reason" VARCHAR(1000) NOT NULL,
"expiresAt" TIMESTAMP(3) NOT NULL,
"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
CONSTRAINT "ReliabilitySuppression_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ReliabilitySuppression_fingerprint_key" ON "ReliabilitySuppression"("fingerprint");
CREATE INDEX "ReliabilitySuppression_expiresAt_idx" ON "ReliabilitySuppression"("expiresAt");

CREATE TABLE "ReliabilityIncidentLink" (
"id" UUID NOT NULL DEFAULT gen_random_uuid(),
"assessmentId" UUID NOT NULL,
"incidentId" UUID NOT NULL,
"relation" VARCHAR(64) NOT NULL,
"evidence" JSONB NOT NULL,
"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
CONSTRAINT "ReliabilityIncidentLink_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ReliabilityIncidentLink_assessmentId_incidentId_relation_key" ON "ReliabilityIncidentLink"("assessmentId","incidentId","relation");
CREATE INDEX "ReliabilityIncidentLink_incidentId_createdAt_idx" ON "ReliabilityIncidentLink"("incidentId","createdAt");

CREATE TABLE "ReliabilityCircuit" (
"id" UUID NOT NULL DEFAULT gen_random_uuid(),
"strategyId" TEXT NOT NULL,
"state" "ReliabilityCircuitState" NOT NULL DEFAULT 'CLOSED',
"consecutiveFailures" INTEGER NOT NULL DEFAULT 0,
"totalFailures" INTEGER NOT NULL DEFAULT 0,
"openedAt" TIMESTAMP(3),
"reason" TEXT,
"updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
CONSTRAINT "ReliabilityCircuit_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ReliabilityCircuit_strategyId_key" ON "ReliabilityCircuit"("strategyId");
CREATE INDEX "ReliabilityCircuit_state_updatedAt_idx" ON "ReliabilityCircuit"("state","updatedAt");
INSERT INTO "AdminPermission" ("id","key","description","createdAt","updatedAt") VALUES (gen_random_uuid(),'reliability.read','Phase 15.27 reliability control permission',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP) ON CONFLICT ("key") DO NOTHING;
INSERT INTO "AdminPermission" ("id","key","description","createdAt","updatedAt") VALUES (gen_random_uuid(),'reliability.simulate','Phase 15.27 reliability control permission',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP) ON CONFLICT ("key") DO NOTHING;
INSERT INTO "AdminPermission" ("id","key","description","createdAt","updatedAt") VALUES (gen_random_uuid(),'reliability.approve','Phase 15.27 reliability control permission',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP) ON CONFLICT ("key") DO NOTHING;
INSERT INTO "AdminPermission" ("id","key","description","createdAt","updatedAt") VALUES (gen_random_uuid(),'reliability.execute','Phase 15.27 reliability control permission',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP) ON CONFLICT ("key") DO NOTHING;
INSERT INTO "AdminPermission" ("id","key","description","createdAt","updatedAt") VALUES (gen_random_uuid(),'reliability.manage','Phase 15.27 reliability control permission',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP) ON CONFLICT ("key") DO NOTHING;
INSERT INTO "AdminPermission" ("id","key","description","createdAt","updatedAt") VALUES (gen_random_uuid(),'reliability.disable','Phase 15.27 reliability control permission',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP) ON CONFLICT ("key") DO NOTHING;
INSERT INTO "AdminPermission" ("id","key","description","createdAt","updatedAt") VALUES (gen_random_uuid(),'reliability.override','Phase 15.27 reliability control permission',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP) ON CONFLICT ("key") DO NOTHING;
INSERT INTO "AdminPermission" ("id","key","description","createdAt","updatedAt") VALUES (gen_random_uuid(),'reliability.evidence.read','Phase 15.27 reliability control permission',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP) ON CONFLICT ("key") DO NOTHING;
INSERT INTO "AdminRolePermission" ("roleId","permissionId","assignedAt") SELECT r."id",p."id",CURRENT_TIMESTAMP FROM "AdminRole" r CROSS JOIN "AdminPermission" p WHERE r."name"='SUPER_ADMIN' AND p."key"='reliability.read' ON CONFLICT ("roleId","permissionId") DO NOTHING;
INSERT INTO "AdminRolePermission" ("roleId","permissionId","assignedAt") SELECT r."id",p."id",CURRENT_TIMESTAMP FROM "AdminRole" r CROSS JOIN "AdminPermission" p WHERE r."name"='SUPER_ADMIN' AND p."key"='reliability.simulate' ON CONFLICT ("roleId","permissionId") DO NOTHING;
INSERT INTO "AdminRolePermission" ("roleId","permissionId","assignedAt") SELECT r."id",p."id",CURRENT_TIMESTAMP FROM "AdminRole" r CROSS JOIN "AdminPermission" p WHERE r."name"='SUPER_ADMIN' AND p."key"='reliability.approve' ON CONFLICT ("roleId","permissionId") DO NOTHING;
INSERT INTO "AdminRolePermission" ("roleId","permissionId","assignedAt") SELECT r."id",p."id",CURRENT_TIMESTAMP FROM "AdminRole" r CROSS JOIN "AdminPermission" p WHERE r."name"='SUPER_ADMIN' AND p."key"='reliability.execute' ON CONFLICT ("roleId","permissionId") DO NOTHING;
INSERT INTO "AdminRolePermission" ("roleId","permissionId","assignedAt") SELECT r."id",p."id",CURRENT_TIMESTAMP FROM "AdminRole" r CROSS JOIN "AdminPermission" p WHERE r."name"='SUPER_ADMIN' AND p."key"='reliability.manage' ON CONFLICT ("roleId","permissionId") DO NOTHING;
INSERT INTO "AdminRolePermission" ("roleId","permissionId","assignedAt") SELECT r."id",p."id",CURRENT_TIMESTAMP FROM "AdminRole" r CROSS JOIN "AdminPermission" p WHERE r."name"='SUPER_ADMIN' AND p."key"='reliability.disable' ON CONFLICT ("roleId","permissionId") DO NOTHING;
INSERT INTO "AdminRolePermission" ("roleId","permissionId","assignedAt") SELECT r."id",p."id",CURRENT_TIMESTAMP FROM "AdminRole" r CROSS JOIN "AdminPermission" p WHERE r."name"='SUPER_ADMIN' AND p."key"='reliability.override' ON CONFLICT ("roleId","permissionId") DO NOTHING;
INSERT INTO "AdminRolePermission" ("roleId","permissionId","assignedAt") SELECT r."id",p."id",CURRENT_TIMESTAMP FROM "AdminRole" r CROSS JOIN "AdminPermission" p WHERE r."name"='SUPER_ADMIN' AND p."key"='reliability.evidence.read' ON CONFLICT ("roleId","permissionId") DO NOTHING;
