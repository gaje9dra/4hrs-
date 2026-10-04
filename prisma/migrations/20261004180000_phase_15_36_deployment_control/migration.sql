CREATE TABLE "Deployment" (
"id" UUID NOT NULL DEFAULT gen_random_uuid(),"stableId" VARCHAR(200) NOT NULL,"changeRequestId" UUID NOT NULL,"releaseId" UUID NOT NULL,
"revision" INTEGER NOT NULL DEFAULT 1,"artifactId" UUID NOT NULL,"environment" VARCHAR(80) NOT NULL,"target" JSONB NOT NULL,
"status" VARCHAR(40) NOT NULL,"operationState" VARCHAR(40) NOT NULL,"recoveryClass" VARCHAR(40) NOT NULL,
"policyVersion" VARCHAR(80) NOT NULL,"actorId" VARCHAR(120) NOT NULL,"correlationId" VARCHAR(120) NOT NULL,
"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
CONSTRAINT "Deployment_pkey" PRIMARY KEY ("id"));
CREATE TABLE "DeploymentArtifact" (
"id" UUID NOT NULL DEFAULT gen_random_uuid(),"stableId" VARCHAR(200) NOT NULL,"commitSha" VARCHAR(80),"buildIdentifier" VARCHAR(160) NOT NULL,
"packageIdentifier" VARCHAR(200),"migrationVersion" VARCHAR(160),"configurationVersion" VARCHAR(160),"featureFlagVersion" VARCHAR(160),
"dependencyLockHash" VARCHAR(128),"provenance" JSONB NOT NULL,"integrityHash" VARCHAR(128) NOT NULL,"immutable" BOOLEAN NOT NULL DEFAULT true,
"approved" BOOLEAN NOT NULL DEFAULT false,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
CONSTRAINT "DeploymentArtifact_pkey" PRIMARY KEY ("id"));
CREATE TABLE "DeploymentEnvironment" (
"id" UUID NOT NULL DEFAULT gen_random_uuid(),"name" VARCHAR(80) NOT NULL,"state" VARCHAR(32) NOT NULL,"health" VARCHAR(32) NOT NULL,
"activeIncidents" JSONB NOT NULL,"maintenanceMode" BOOLEAN NOT NULL DEFAULT false,"frozen" BOOLEAN NOT NULL DEFAULT false,
"currentDeploymentId" UUID,"pendingMigrations" JSONB NOT NULL,"capacity" JSONB NOT NULL,"dependencyHealth" JSONB NOT NULL,
"policyVersion" VARCHAR(80) NOT NULL,"updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
CONSTRAINT "DeploymentEnvironment_pkey" PRIMARY KEY ("id"));
CREATE TABLE "DeploymentPlan" (
"id" UUID NOT NULL DEFAULT gen_random_uuid(),"deploymentId" UUID NOT NULL,"revision" INTEGER NOT NULL,"status" VARCHAR(32) NOT NULL,
"planHash" VARCHAR(128) NOT NULL,"steps" JSONB NOT NULL,"generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
"generatedBy" VARCHAR(120) NOT NULL,CONSTRAINT "DeploymentPlan_pkey" PRIMARY KEY ("id"));
CREATE TABLE "DeploymentStep" (
"id" UUID NOT NULL DEFAULT gen_random_uuid(),"deploymentId" UUID NOT NULL,"ordinal" INTEGER NOT NULL,"operationType" VARCHAR(80) NOT NULL,
"prerequisites" JSONB NOT NULL,"timeoutSeconds" INTEGER NOT NULL,"retryPolicy" JSONB NOT NULL,"idempotencyKey" VARCHAR(200) NOT NULL,
"expectedOutcome" JSONB NOT NULL,"failureHandling" JSONB NOT NULL,"recoveryBehavior" JSONB NOT NULL,"evidenceRequirement" JSONB NOT NULL,
"status" VARCHAR(32) NOT NULL,"result" JSONB,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
CONSTRAINT "DeploymentStep_pkey" PRIMARY KEY ("id"));
CREATE TABLE "DeploymentGate" (
"id" UUID NOT NULL DEFAULT gen_random_uuid(),"deploymentId" UUID NOT NULL,"key" VARCHAR(100) NOT NULL,"category" VARCHAR(80) NOT NULL,
"severity" VARCHAR(32) NOT NULL,"evidence" JSONB NOT NULL,"blocking" BOOLEAN NOT NULL DEFAULT true,"result" VARCHAR(32) NOT NULL,
"evaluatedAt" TIMESTAMP(3),CONSTRAINT "DeploymentGate_pkey" PRIMARY KEY ("id"));
CREATE TABLE "DeploymentHealthSnapshot" (
"id" UUID NOT NULL DEFAULT gen_random_uuid(),"deploymentId" UUID NOT NULL,"stage" VARCHAR(80) NOT NULL,"metrics" JSONB NOT NULL,
"source" VARCHAR(160) NOT NULL,"capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"correlationId" VARCHAR(120) NOT NULL,
CONSTRAINT "DeploymentHealthSnapshot_pkey" PRIMARY KEY ("id"));
CREATE TABLE "DeploymentDecision" (
"id" UUID NOT NULL DEFAULT gen_random_uuid(),"deploymentId" UUID NOT NULL,"decisionType" VARCHAR(40) NOT NULL,"fromStatus" VARCHAR(40) NOT NULL,
"toStatus" VARCHAR(40) NOT NULL,"reason" VARCHAR(1000) NOT NULL,"policyVersion" VARCHAR(80) NOT NULL,"actorId" VARCHAR(120) NOT NULL,
"evidenceHash" VARCHAR(128) NOT NULL,"correlationId" VARCHAR(120) NOT NULL,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
CONSTRAINT "DeploymentDecision_pkey" PRIMARY KEY ("id"));
CREATE TABLE "DeploymentPause" (
"id" UUID NOT NULL DEFAULT gen_random_uuid(),"deploymentId" UUID NOT NULL,"reason" VARCHAR(80) NOT NULL,"details" JSONB NOT NULL,
"stage" VARCHAR(80) NOT NULL,"actorId" VARCHAR(120) NOT NULL,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"resumedAt" TIMESTAMP(3),
CONSTRAINT "DeploymentPause_pkey" PRIMARY KEY ("id"));
CREATE TABLE "DeploymentAbort" (
"id" UUID NOT NULL DEFAULT gen_random_uuid(),"deploymentId" UUID NOT NULL,"reason" VARCHAR(500) NOT NULL,"actorId" VARCHAR(120) NOT NULL,
"evidence" JSONB NOT NULL,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,CONSTRAINT "DeploymentAbort_pkey" PRIMARY KEY ("id"));
CREATE TABLE "DeploymentRollback" (
"id" UUID NOT NULL DEFAULT gen_random_uuid(),"deploymentId" UUID NOT NULL,"stage" VARCHAR(80) NOT NULL,"classification" VARCHAR(40) NOT NULL,
"trigger" VARCHAR(120) NOT NULL,"expectedArtifactId" UUID,"result" VARCHAR(40) NOT NULL,"validated" BOOLEAN NOT NULL DEFAULT false,
"evidence" JSONB NOT NULL,"actorId" VARCHAR(120) NOT NULL,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
CONSTRAINT "DeploymentRollback_pkey" PRIMARY KEY ("id"));
CREATE TABLE "DeploymentRecovery" (
"id" UUID NOT NULL DEFAULT gen_random_uuid(),"deploymentId" UUID NOT NULL,"classification" VARCHAR(40) NOT NULL,"plan" JSONB NOT NULL,
"approval" JSONB NOT NULL,"validation" JSONB NOT NULL,"reconciliation" JSONB NOT NULL,"certification" JSONB NOT NULL,
"status" VARCHAR(40) NOT NULL,"actorId" VARCHAR(120) NOT NULL,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
CONSTRAINT "DeploymentRecovery_pkey" PRIMARY KEY ("id"));
CREATE TABLE "DeploymentValidation" (
"id" UUID NOT NULL DEFAULT gen_random_uuid(),"deploymentId" UUID NOT NULL,"validationType" VARCHAR(80) NOT NULL,"result" VARCHAR(32) NOT NULL,
"checks" JSONB NOT NULL,"evidence" JSONB NOT NULL,"actorId" VARCHAR(120) NOT NULL,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
CONSTRAINT "DeploymentValidation_pkey" PRIMARY KEY ("id"));
CREATE TABLE "DeploymentEvidence" (
"id" UUID NOT NULL DEFAULT gen_random_uuid(),"deploymentId" UUID NOT NULL,"evidenceType" VARCHAR(80) NOT NULL,"source" VARCHAR(160) NOT NULL,
"reference" VARCHAR(255) NOT NULL,"integrityHash" VARCHAR(128) NOT NULL,"payload" JSONB NOT NULL,"immutable" BOOLEAN NOT NULL DEFAULT true,
"capturedBy" VARCHAR(120) NOT NULL,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,CONSTRAINT "DeploymentEvidence_pkey" PRIMARY KEY ("id"));
CREATE TABLE "DeploymentCertification" (
"id" UUID NOT NULL DEFAULT gen_random_uuid(),"deploymentId" UUID NOT NULL,"status" VARCHAR(32) NOT NULL,"artifactHash" VARCHAR(128) NOT NULL,
"policyVersion" VARCHAR(80) NOT NULL,"validationEvidence" JSONB NOT NULL,"recoveryEvidence" JSONB NOT NULL,"reconciliationEvidence" JSONB NOT NULL,
"validUntil" TIMESTAMP(3) NOT NULL,"certifiedBy" VARCHAR(120) NOT NULL,"certifiedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
CONSTRAINT "DeploymentCertification_pkey" PRIMARY KEY ("id"));
CREATE TABLE "DeploymentPolicy" (
"id" UUID NOT NULL DEFAULT gen_random_uuid(),"stableId" VARCHAR(120) NOT NULL,"version" VARCHAR(80) NOT NULL,"rules" JSONB NOT NULL,
"active" BOOLEAN NOT NULL DEFAULT true,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
CONSTRAINT "DeploymentPolicy_pkey" PRIMARY KEY ("id"));
CREATE TABLE "DeploymentLock" (
"id" UUID NOT NULL DEFAULT gen_random_uuid(),"deploymentId" UUID NOT NULL,"scope" VARCHAR(160) NOT NULL,"ownerId" VARCHAR(120) NOT NULL,
"expiresAt" TIMESTAMP(3) NOT NULL,"heartbeatAt" TIMESTAMP(3),"status" VARCHAR(32) NOT NULL,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
CONSTRAINT "DeploymentLock_pkey" PRIMARY KEY ("id"));
CREATE TABLE "DeploymentConflict" (
"id" UUID NOT NULL DEFAULT gen_random_uuid(),"deploymentId" UUID NOT NULL,"scope" VARCHAR(160) NOT NULL,"conflictingDeploymentId" UUID,
"severity" VARCHAR(32) NOT NULL,"reason" VARCHAR(500) NOT NULL,"resolved" BOOLEAN NOT NULL DEFAULT false,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
CONSTRAINT "DeploymentConflict_pkey" PRIMARY KEY ("id"));
CREATE TABLE "DeploymentIncident" (
"id" UUID NOT NULL DEFAULT gen_random_uuid(),"deploymentId" UUID NOT NULL,"incidentReference" VARCHAR(160) NOT NULL,"severity" VARCHAR(32) NOT NULL,
"affectedDomains" JSONB NOT NULL,"affectedDependencies" JSONB NOT NULL,"affectedJourneys" JSONB NOT NULL,"causalityConfidence" VARCHAR(32) NOT NULL,
"decision" VARCHAR(40) NOT NULL,"evidence" JSONB NOT NULL,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
CONSTRAINT "DeploymentIncident_pkey" PRIMARY KEY ("id"));
CREATE TABLE "DeploymentBaseline" (
"id" UUID NOT NULL DEFAULT gen_random_uuid(),"deploymentId" UUID NOT NULL,"baselineType" VARCHAR(80) NOT NULL,"snapshot" JSONB NOT NULL,
"capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,CONSTRAINT "DeploymentBaseline_pkey" PRIMARY KEY ("id"));
CREATE TABLE "DeploymentObservation" (
"id" UUID NOT NULL DEFAULT gen_random_uuid(),"deploymentId" UUID NOT NULL,"operation" VARCHAR(80) NOT NULL,"actorId" VARCHAR(120) NOT NULL,
"durationMs" INTEGER NOT NULL,"result" VARCHAR(40) NOT NULL,"retryCount" INTEGER NOT NULL DEFAULT 0,"failureReason" TEXT,"traceId" TEXT,
"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,CONSTRAINT "DeploymentObservation_pkey" PRIMARY KEY ("id"));
CREATE TABLE "DeploymentFreeze" (
"id" UUID NOT NULL DEFAULT gen_random_uuid(),"scope" VARCHAR(80) NOT NULL,"scopeReference" VARCHAR(160) NOT NULL,"reason" VARCHAR(500) NOT NULL,
"ownerId" VARCHAR(120) NOT NULL,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"expiresAt" TIMESTAMP(3) NOT NULL,
"active" BOOLEAN NOT NULL DEFAULT true,"emergencyOverride" BOOLEAN NOT NULL DEFAULT false,"auditEvidence" JSONB NOT NULL,
CONSTRAINT "DeploymentFreeze_pkey" PRIMARY KEY ("id"));
CREATE UNIQUE INDEX "Deployment_stableId_key" ON "Deployment"("stableId");
CREATE INDEX "Deployment_releaseId_status_idx" ON "Deployment"("releaseId","status");
CREATE INDEX "Deployment_environment_status_idx" ON "Deployment"("environment","status");
CREATE INDEX "Deployment_changeRequestId_createdAt_idx" ON "Deployment"("changeRequestId","createdAt");
CREATE UNIQUE INDEX "DeploymentArtifact_stableId_key" ON "DeploymentArtifact"("stableId");
CREATE INDEX "DeploymentArtifact_approved_immutable_idx" ON "DeploymentArtifact"("approved","immutable");
CREATE UNIQUE INDEX "DeploymentEnvironment_name_key" ON "DeploymentEnvironment"("name");
CREATE UNIQUE INDEX "DeploymentPlan_deploymentId_revision_key" ON "DeploymentPlan"("deploymentId","revision");
CREATE UNIQUE INDEX "DeploymentStep_idempotencyKey_key" ON "DeploymentStep"("idempotencyKey");
CREATE UNIQUE INDEX "DeploymentStep_deploymentId_ordinal_key" ON "DeploymentStep"("deploymentId","ordinal");
CREATE UNIQUE INDEX "DeploymentGate_deploymentId_key_key" ON "DeploymentGate"("deploymentId","key");
CREATE INDEX "DeploymentHealthSnapshot_deploymentId_capturedAt_idx" ON "DeploymentHealthSnapshot"("deploymentId","capturedAt");
CREATE INDEX "DeploymentDecision_deploymentId_createdAt_idx" ON "DeploymentDecision"("deploymentId","createdAt");
CREATE INDEX "DeploymentValidation_deploymentId_createdAt_idx" ON "DeploymentValidation"("deploymentId","createdAt");
CREATE INDEX "DeploymentEvidence_deploymentId_createdAt_idx" ON "DeploymentEvidence"("deploymentId","createdAt");
CREATE UNIQUE INDEX "DeploymentPolicy_stableId_key" ON "DeploymentPolicy"("stableId");
CREATE UNIQUE INDEX "DeploymentLock_scope_status_key" ON "DeploymentLock"("scope","status");
CREATE INDEX "DeploymentConflict_scope_resolved_idx" ON "DeploymentConflict"("scope","resolved");
CREATE INDEX "DeploymentIncident_deploymentId_createdAt_idx" ON "DeploymentIncident"("deploymentId","createdAt");
CREATE INDEX "DeploymentObservation_deploymentId_createdAt_idx" ON "DeploymentObservation"("deploymentId","createdAt");
CREATE INDEX "DeploymentFreeze_scope_scopeReference_active_idx" ON "DeploymentFreeze"("scope","scopeReference","active");
ALTER TABLE "DeploymentPlan" ADD CONSTRAINT "DeploymentPlan_deploymentId_fkey" FOREIGN KEY ("deploymentId") REFERENCES "Deployment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DeploymentStep" ADD CONSTRAINT "DeploymentStep_deploymentId_fkey" FOREIGN KEY ("deploymentId") REFERENCES "Deployment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DeploymentGate" ADD CONSTRAINT "DeploymentGate_deploymentId_fkey" FOREIGN KEY ("deploymentId") REFERENCES "Deployment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DeploymentHealthSnapshot" ADD CONSTRAINT "DeploymentHealthSnapshot_deploymentId_fkey" FOREIGN KEY ("deploymentId") REFERENCES "Deployment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DeploymentDecision" ADD CONSTRAINT "DeploymentDecision_deploymentId_fkey" FOREIGN KEY ("deploymentId") REFERENCES "Deployment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DeploymentPause" ADD CONSTRAINT "DeploymentPause_deploymentId_fkey" FOREIGN KEY ("deploymentId") REFERENCES "Deployment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DeploymentAbort" ADD CONSTRAINT "DeploymentAbort_deploymentId_fkey" FOREIGN KEY ("deploymentId") REFERENCES "Deployment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DeploymentRollback" ADD CONSTRAINT "DeploymentRollback_deploymentId_fkey" FOREIGN KEY ("deploymentId") REFERENCES "Deployment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DeploymentRecovery" ADD CONSTRAINT "DeploymentRecovery_deploymentId_fkey" FOREIGN KEY ("deploymentId") REFERENCES "Deployment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DeploymentValidation" ADD CONSTRAINT "DeploymentValidation_deploymentId_fkey" FOREIGN KEY ("deploymentId") REFERENCES "Deployment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DeploymentEvidence" ADD CONSTRAINT "DeploymentEvidence_deploymentId_fkey" FOREIGN KEY ("deploymentId") REFERENCES "Deployment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DeploymentCertification" ADD CONSTRAINT "DeploymentCertification_deploymentId_fkey" FOREIGN KEY ("deploymentId") REFERENCES "Deployment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DeploymentLock" ADD CONSTRAINT "DeploymentLock_deploymentId_fkey" FOREIGN KEY ("deploymentId") REFERENCES "Deployment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DeploymentConflict" ADD CONSTRAINT "DeploymentConflict_deploymentId_fkey" FOREIGN KEY ("deploymentId") REFERENCES "Deployment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DeploymentIncident" ADD CONSTRAINT "DeploymentIncident_deploymentId_fkey" FOREIGN KEY ("deploymentId") REFERENCES "Deployment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DeploymentBaseline" ADD CONSTRAINT "DeploymentBaseline_deploymentId_fkey" FOREIGN KEY ("deploymentId") REFERENCES "Deployment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DeploymentObservation" ADD CONSTRAINT "DeploymentObservation_deploymentId_fkey" FOREIGN KEY ("deploymentId") REFERENCES "Deployment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
