CREATE TABLE "DeliveryPipeline" (
  "id" UUID NOT NULL,
  "stableId" VARCHAR(200) NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "ownerId" VARCHAR(120) NOT NULL,
  "environment" VARCHAR(80) NOT NULL,
  "target" JSONB NOT NULL,
  "changeRequestId" UUID NOT NULL,
  "releaseId" UUID NOT NULL,
  "deploymentId" UUID NOT NULL,
  "rolloutStrategy" VARCHAR(64) NOT NULL,
  "validationPolicy" JSONB NOT NULL,
  "approvalPolicy" JSONB NOT NULL,
  "rollbackPolicy" JSONB NOT NULL,
  "recoveryPolicy" JSONB NOT NULL,
  "concurrencyPolicy" JSONB NOT NULL,
  "releaseWindow" JSONB NOT NULL,
  "requiredCertifications" JSONB NOT NULL,
  "policyVersion" VARCHAR(80) NOT NULL,
  "status" VARCHAR(40) NOT NULL DEFAULT 'CREATED',
  "materiallyChanged" BOOLEAN NOT NULL DEFAULT false,
  "correlationId" VARCHAR(120) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DeliveryPipeline_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "DeliveryPipeline_stableId_key" ON "DeliveryPipeline"("stableId");
CREATE INDEX "DeliveryPipeline_changeRequestId_status_idx" ON "DeliveryPipeline"("changeRequestId","status");
CREATE INDEX "DeliveryPipeline_releaseId_status_idx" ON "DeliveryPipeline"("releaseId","status");
CREATE INDEX "DeliveryPipeline_deploymentId_status_idx" ON "DeliveryPipeline"("deploymentId","status");
CREATE INDEX "DeliveryPipeline_environment_status_idx" ON "DeliveryPipeline"("environment","status");

CREATE TABLE "DeliveryRevision" ("id" UUID NOT NULL,"pipelineId" UUID NOT NULL,"version" INTEGER NOT NULL,"definition" JSONB NOT NULL,"definitionHash" VARCHAR(128) NOT NULL,"invalidatesActiveRuns" BOOLEAN NOT NULL DEFAULT false,"createdBy" VARCHAR(120) NOT NULL,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,CONSTRAINT "DeliveryRevision_pkey" PRIMARY KEY ("id"));
CREATE UNIQUE INDEX "DeliveryRevision_pipelineId_version_key" ON "DeliveryRevision"("pipelineId","version");
ALTER TABLE "DeliveryRevision" ADD CONSTRAINT "DeliveryRevision_pipelineId_fkey" FOREIGN KEY ("pipelineId") REFERENCES "DeliveryPipeline"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "DeliveryStage" ("id" UUID NOT NULL,"pipelineId" UUID NOT NULL,"ordinal" INTEGER NOT NULL,"name" VARCHAR(80) NOT NULL,"prerequisites" JSONB NOT NULL,"dependencies" JSONB NOT NULL,"operation" VARCHAR(80) NOT NULL,"timeoutSeconds" INTEGER NOT NULL,"retryPolicy" JSONB NOT NULL,"idempotencyPolicy" JSONB NOT NULL,"healthGates" JSONB NOT NULL,"failureBehavior" JSONB NOT NULL,"recoveryBehavior" JSONB NOT NULL,"evidenceRequirements" JSONB NOT NULL,"allowParallel" BOOLEAN NOT NULL DEFAULT false,"status" VARCHAR(32) NOT NULL DEFAULT 'PENDING',CONSTRAINT "DeliveryStage_pkey" PRIMARY KEY ("id"));
CREATE UNIQUE INDEX "DeliveryStage_pipelineId_ordinal_key" ON "DeliveryStage"("pipelineId","ordinal");
CREATE INDEX "DeliveryStage_pipelineId_status_idx" ON "DeliveryStage"("pipelineId","status");
ALTER TABLE "DeliveryStage" ADD CONSTRAINT "DeliveryStage_pipelineId_fkey" FOREIGN KEY ("pipelineId") REFERENCES "DeliveryPipeline"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "DeliveryRun" ("id" UUID NOT NULL,"pipelineId" UUID NOT NULL,"revision" INTEGER NOT NULL,"idempotencyKey" VARCHAR(200) NOT NULL,"status" VARCHAR(40) NOT NULL DEFAULT 'CREATED',"currentStage" VARCHAR(80),"actorId" VARCHAR(120) NOT NULL,"correlationId" VARCHAR(120) NOT NULL,"startedAt" TIMESTAMP(3),"completedAt" TIMESTAMP(3),"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"blockedReason" VARCHAR(1000),CONSTRAINT "DeliveryRun_pkey" PRIMARY KEY ("id"));
CREATE UNIQUE INDEX "DeliveryRun_idempotencyKey_key" ON "DeliveryRun"("idempotencyKey");
CREATE INDEX "DeliveryRun_pipelineId_status_idx" ON "DeliveryRun"("pipelineId","status");
ALTER TABLE "DeliveryRun" ADD CONSTRAINT "DeliveryRun_pipelineId_fkey" FOREIGN KEY ("pipelineId") REFERENCES "DeliveryPipeline"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "DeliveryStageExecution" ("id" UUID NOT NULL,"stageId" UUID NOT NULL,"runId" UUID NOT NULL,"idempotencyKey" VARCHAR(200) NOT NULL,"status" VARCHAR(32) NOT NULL,"startedAt" TIMESTAMP(3),"completedAt" TIMESTAMP(3),"result" JSONB,"traceId" VARCHAR(120) NOT NULL,CONSTRAINT "DeliveryStageExecution_pkey" PRIMARY KEY ("id"));
CREATE UNIQUE INDEX "DeliveryStageExecution_idempotencyKey_key" ON "DeliveryStageExecution"("idempotencyKey");
CREATE INDEX "DeliveryStageExecution_runId_status_idx" ON "DeliveryStageExecution"("runId","status");
ALTER TABLE "DeliveryStageExecution" ADD CONSTRAINT "DeliveryStageExecution_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "DeliveryStage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DeliveryStageExecution" ADD CONSTRAINT "DeliveryStageExecution_runId_fkey" FOREIGN KEY ("runId") REFERENCES "DeliveryRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "DeliveryDependency" ("id" UUID NOT NULL,"pipelineId" UUID NOT NULL,"fromStage" VARCHAR(80) NOT NULL,"toStage" VARCHAR(80) NOT NULL,"dependencyType" VARCHAR(40) NOT NULL,"source" VARCHAR(120) NOT NULL,"known" BOOLEAN NOT NULL DEFAULT true,"safeParallel" BOOLEAN NOT NULL DEFAULT false,"evidence" JSONB NOT NULL,CONSTRAINT "DeliveryDependency_pkey" PRIMARY KEY ("id"));
CREATE INDEX "DeliveryDependency_pipelineId_fromStage_toStage_idx" ON "DeliveryDependency"("pipelineId","fromStage","toStage");
ALTER TABLE "DeliveryDependency" ADD CONSTRAINT "DeliveryDependency_pipelineId_fkey" FOREIGN KEY ("pipelineId") REFERENCES "DeliveryPipeline"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "DeliveryGate" ("id" UUID NOT NULL,"pipelineId" UUID NOT NULL,"stageName" VARCHAR(80) NOT NULL,"key" VARCHAR(100) NOT NULL,"result" VARCHAR(32) NOT NULL DEFAULT 'UNKNOWN',"blocking" BOOLEAN NOT NULL DEFAULT true,"evidence" JSONB NOT NULL,"evaluatedAt" TIMESTAMP(3),CONSTRAINT "DeliveryGate_pkey" PRIMARY KEY ("id"));
CREATE UNIQUE INDEX "DeliveryGate_pipelineId_stageName_key_key" ON "DeliveryGate"("pipelineId","stageName","key");
ALTER TABLE "DeliveryGate" ADD CONSTRAINT "DeliveryGate_pipelineId_fkey" FOREIGN KEY ("pipelineId") REFERENCES "DeliveryPipeline"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "DeliveryDecision" ("id" UUID NOT NULL,"pipelineId" UUID NOT NULL,"decisionType" VARCHAR(60) NOT NULL,"fromStatus" VARCHAR(40) NOT NULL,"toStatus" VARCHAR(40) NOT NULL,"reason" VARCHAR(1000) NOT NULL,"policyVersion" VARCHAR(80) NOT NULL,"actorId" VARCHAR(120) NOT NULL,"evidenceHash" VARCHAR(128) NOT NULL,"correlationId" VARCHAR(120) NOT NULL,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,CONSTRAINT "DeliveryDecision_pkey" PRIMARY KEY ("id"));
CREATE INDEX "DeliveryDecision_pipelineId_createdAt_idx" ON "DeliveryDecision"("pipelineId","createdAt");
ALTER TABLE "DeliveryDecision" ADD CONSTRAINT "DeliveryDecision_pipelineId_fkey" FOREIGN KEY ("pipelineId") REFERENCES "DeliveryPipeline"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "DeliveryRunDecision" ("id" UUID NOT NULL,"runId" UUID NOT NULL,"decisionType" VARCHAR(60) NOT NULL,"fromStatus" VARCHAR(40) NOT NULL,"toStatus" VARCHAR(40) NOT NULL,"reason" VARCHAR(1000) NOT NULL,"actorId" VARCHAR(120) NOT NULL,"evidence" JSONB NOT NULL,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,CONSTRAINT "DeliveryRunDecision_pkey" PRIMARY KEY ("id"));
CREATE INDEX "DeliveryRunDecision_runId_createdAt_idx" ON "DeliveryRunDecision"("runId","createdAt");
ALTER TABLE "DeliveryRunDecision" ADD CONSTRAINT "DeliveryRunDecision_runId_fkey" FOREIGN KEY ("runId") REFERENCES "DeliveryRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "DeliveryApproval" ("id" UUID NOT NULL,"pipelineId" UUID NOT NULL,"revision" INTEGER NOT NULL,"risk" VARCHAR(32) NOT NULL,"decision" VARCHAR(32) NOT NULL,"policyVersion" VARCHAR(80) NOT NULL,"actorId" VARCHAR(120) NOT NULL,"evidenceHash" VARCHAR(128) NOT NULL,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,CONSTRAINT "DeliveryApproval_pkey" PRIMARY KEY ("id"));
CREATE INDEX "DeliveryApproval_pipelineId_revision_idx" ON "DeliveryApproval"("pipelineId","revision");
ALTER TABLE "DeliveryApproval" ADD CONSTRAINT "DeliveryApproval_pipelineId_fkey" FOREIGN KEY ("pipelineId") REFERENCES "DeliveryPipeline"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "DeliveryEvidence" ("id" UUID NOT NULL,"pipelineId" UUID NOT NULL,"runId" UUID,"stageName" VARCHAR(80),"evidenceType" VARCHAR(80) NOT NULL,"source" VARCHAR(160) NOT NULL,"reference" VARCHAR(255) NOT NULL,"integrityHash" VARCHAR(128) NOT NULL,"payload" JSONB NOT NULL,"immutable" BOOLEAN NOT NULL DEFAULT true,"capturedBy" VARCHAR(120) NOT NULL,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,CONSTRAINT "DeliveryEvidence_pkey" PRIMARY KEY ("id"));
CREATE INDEX "DeliveryEvidence_pipelineId_createdAt_idx" ON "DeliveryEvidence"("pipelineId","createdAt");
ALTER TABLE "DeliveryEvidence" ADD CONSTRAINT "DeliveryEvidence_pipelineId_fkey" FOREIGN KEY ("pipelineId") REFERENCES "DeliveryPipeline"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "DeliveryLock" ("id" UUID NOT NULL,"pipelineId" UUID NOT NULL,"scope" VARCHAR(160) NOT NULL,"ownerId" VARCHAR(120) NOT NULL,"status" VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',"expiresAt" TIMESTAMP(3) NOT NULL,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,CONSTRAINT "DeliveryLock_pkey" PRIMARY KEY ("id"));
CREATE UNIQUE INDEX "DeliveryLock_scope_status_key" ON "DeliveryLock"("scope","status");
ALTER TABLE "DeliveryLock" ADD CONSTRAINT "DeliveryLock_pipelineId_fkey" FOREIGN KEY ("pipelineId") REFERENCES "DeliveryPipeline"("id") ON DELETE CASCADE ON UPDATE CASCADE;
