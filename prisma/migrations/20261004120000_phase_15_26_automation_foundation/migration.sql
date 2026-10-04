CREATE TYPE "AutomationRiskClass" AS ENUM ('OBSERVE_ONLY','SAFE_AUTOMATION','CONTROLLED_AUTOMATION','APPROVAL_REQUIRED','HIGH_RISK','PROHIBITED');
CREATE TYPE "AutomationPolicyStatus" AS ENUM ('DRAFT','PENDING_REVIEW','APPROVED','ACTIVE','PAUSED','DISABLED','EXPIRED','RETIRED');
CREATE TYPE "AutomationExecutionState" AS ENUM ('CREATED','EVALUATING','BLOCKED','PENDING_APPROVAL','APPROVED','RUNNING','SUCCEEDED','FAILED','PARTIALLY_SUCCEEDED','ROLLING_BACK','ROLLED_BACK','ESCALATED','CANCELLED');
CREATE TYPE "AutomationCircuitState" AS ENUM ('CLOSED','OPEN','HALF_OPEN');
CREATE TYPE "AutomationFailureClass" AS ENUM ('VALIDATION','AUTHORIZATION','SAFETY','CONCURRENCY','TIMEOUT','TRANSIENT_DEPENDENCY','PERMANENT_DEPENDENCY','ROLLBACK','UNKNOWN','POLICY_VIOLATION');
CREATE TYPE "AutomationRollbackMode" AS ENUM ('REVERSIBLE','CONDITIONALLY_REVERSIBLE','IRREVERSIBLE');

CREATE TABLE "AutomationPolicy" (
"id" UUID NOT NULL DEFAULT gen_random_uuid(),
"stableId" VARCHAR(120) NOT NULL,
"name" VARCHAR(200) NOT NULL,
"description" VARCHAR(2000) NOT NULL,
"domain" VARCHAR(80) NOT NULL,
"trigger" JSONB NOT NULL,
"conditions" JSONB NOT NULL,
"actions" JSONB NOT NULL,
"risk" "AutomationRiskClass" NOT NULL,
"authorization" JSONB NOT NULL,
"requiredPermissions" JSONB NOT NULL,
"allowedEnvironments" TEXT[] NOT NULL,
"enabled" BOOLEAN NOT NULL DEFAULT false,
"dryRun" BOOLEAN NOT NULL DEFAULT true,
"cooldownSeconds" INTEGER NOT NULL DEFAULT 300,
"maxExecutionsPerWindow" INTEGER NOT NULL DEFAULT 1,
"timeoutSeconds" INTEGER NOT NULL DEFAULT 300,
"retryLimit" INTEGER NOT NULL DEFAULT 0,
"concurrencyPolicy" JSONB NOT NULL,
"idempotencyPolicy" JSONB NOT NULL,
"rollbackPolicy" JSONB NOT NULL,
"escalationPolicy" JSONB NOT NULL,
"observabilityRequirements" JSONB NOT NULL,
"auditRequirements" JSONB NOT NULL,
"owner" VARCHAR(160) NOT NULL,
"reviewer" VARCHAR(160),
"version" INTEGER NOT NULL DEFAULT 1,
"status" "AutomationPolicyStatus" NOT NULL DEFAULT 'DRAFT',
"reviewedAt" TIMESTAMP(3),
"expiresAt" TIMESTAMP(3),
"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
"updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
CONSTRAINT "AutomationPolicy_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AutomationPolicy_stableId_key" ON "AutomationPolicy"("stableId");
CREATE INDEX "AutomationPolicy_status_enabled_idx" ON "AutomationPolicy"("status","enabled");
CREATE INDEX "AutomationPolicy_risk_status_idx" ON "AutomationPolicy"("risk","status");
CREATE INDEX "AutomationPolicy_domain_status_idx" ON "AutomationPolicy"("domain","status");
CREATE INDEX "AutomationPolicy_expiresAt_idx" ON "AutomationPolicy"("expiresAt");

CREATE TABLE "AutomationPolicyVersion" (
"id" UUID NOT NULL DEFAULT gen_random_uuid(),
"policyId" UUID NOT NULL,
"version" INTEGER NOT NULL,
"snapshot" JSONB NOT NULL,
"createdBy" UUID,
"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
CONSTRAINT "AutomationPolicyVersion_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AutomationPolicyVersion_policyId_version_key" ON "AutomationPolicyVersion"("policyId","version");
CREATE INDEX "AutomationPolicyVersion_policyId_createdAt_idx" ON "AutomationPolicyVersion"("policyId","createdAt");

CREATE TABLE "AutomationTrigger" (
"id" UUID NOT NULL DEFAULT gen_random_uuid(),"policyId" UUID NOT NULL,"kind" VARCHAR(120) NOT NULL,"fingerprint" VARCHAR(255) NOT NULL,"observedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"environment" VARCHAR(32) NOT NULL,"severity" VARCHAR(32),"confidence" DOUBLE PRECISION,"evidence" JSONB,"dependencyState" JSONB,"maintenanceActive" BOOLEAN NOT NULL DEFAULT false,"incidentId" UUID,"accepted" BOOLEAN NOT NULL DEFAULT false,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
CONSTRAINT "AutomationTrigger_pkey" PRIMARY KEY ("id"));
CREATE INDEX "AutomationTrigger_policyId_observedAt_idx" ON "AutomationTrigger"("policyId","observedAt");
CREATE INDEX "AutomationTrigger_fingerprint_observedAt_idx" ON "AutomationTrigger"("fingerprint","observedAt");
CREATE INDEX "AutomationTrigger_environment_observedAt_idx" ON "AutomationTrigger"("environment","observedAt");

CREATE TABLE "AutomationCondition" (
"id" UUID NOT NULL DEFAULT gen_random_uuid(),"policyId" UUID NOT NULL,"key" VARCHAR(160) NOT NULL,"operator" VARCHAR(32) NOT NULL,"value" JSONB NOT NULL,"logicalGroup" VARCHAR(80),"negated" BOOLEAN NOT NULL DEFAULT false,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
CONSTRAINT "AutomationCondition_pkey" PRIMARY KEY ("id"));
CREATE INDEX "AutomationCondition_policyId_key_idx" ON "AutomationCondition"("policyId","key");

CREATE TABLE "AutomationAction" (
"id" UUID NOT NULL DEFAULT gen_random_uuid(),"policyId" UUID NOT NULL,"actionKey" VARCHAR(160) NOT NULL,"risk" "AutomationRiskClass" NOT NULL,"scope" JSONB NOT NULL,"timeoutSeconds" INTEGER NOT NULL,"retryLimit" INTEGER NOT NULL DEFAULT 0,"rollbackMode" "AutomationRollbackMode" NOT NULL,"parameters" JSONB,"enabled" BOOLEAN NOT NULL DEFAULT true,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
CONSTRAINT "AutomationAction_pkey" PRIMARY KEY ("id"));
CREATE INDEX "AutomationAction_policyId_actionKey_idx" ON "AutomationAction"("policyId","actionKey");
CREATE INDEX "AutomationAction_risk_enabled_idx" ON "AutomationAction"("risk","enabled");

CREATE TABLE "AutomationExecution" (
"id" UUID NOT NULL DEFAULT gen_random_uuid(),"policyId" UUID NOT NULL,"policyVersionId" UUID,"triggerId" UUID,"triggerFingerprint" VARCHAR(255) NOT NULL,"idempotencyKey" VARCHAR(255) NOT NULL,"targetResource" VARCHAR(255) NOT NULL,"targetScope" JSONB NOT NULL,"risk" "AutomationRiskClass" NOT NULL,"state" "AutomationExecutionState" NOT NULL DEFAULT 'CREATED',"environment" VARCHAR(32) NOT NULL,"correlationId" VARCHAR(128) NOT NULL,"reason" VARCHAR(1000),"requestedBy" UUID,"approvedBy" UUID,"approvalId" UUID,"result" JSONB,"errorClass" "AutomationFailureClass","errorMetadata" JSONB,"retryCount" INTEGER NOT NULL DEFAULT 0,"rollbackStatus" VARCHAR(64),"escalationState" VARCHAR(64),"startedAt" TIMESTAMP(3),"finishedAt" TIMESTAMP(3),"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
CONSTRAINT "AutomationExecution_pkey" PRIMARY KEY ("id"));
CREATE UNIQUE INDEX "AutomationExecution_idempotencyKey_key" ON "AutomationExecution"("idempotencyKey");
CREATE INDEX "AutomationExecution_policyId_createdAt_idx" ON "AutomationExecution"("policyId","createdAt");
CREATE INDEX "AutomationExecution_state_createdAt_idx" ON "AutomationExecution"("state","createdAt");
CREATE INDEX "AutomationExecution_risk_state_idx" ON "AutomationExecution"("risk","state");
CREATE INDEX "AutomationExecution_targetResource_createdAt_idx" ON "AutomationExecution"("targetResource","createdAt");
CREATE INDEX "AutomationExecution_correlationId_idx" ON "AutomationExecution"("correlationId");

CREATE TABLE "AutomationExecutionStep" (
"id" UUID NOT NULL DEFAULT gen_random_uuid(),"executionId" UUID NOT NULL,"stepOrder" INTEGER NOT NULL,"actionKey" VARCHAR(160) NOT NULL,"state" "AutomationExecutionState" NOT NULL,"startedAt" TIMESTAMP(3),"finishedAt" TIMESTAMP(3),"attempt" INTEGER NOT NULL DEFAULT 1,"result" JSONB,"errorClass" "AutomationFailureClass","errorMetadata" JSONB,"rollbackMode" "AutomationRollbackMode" NOT NULL,
CONSTRAINT "AutomationExecutionStep_pkey" PRIMARY KEY ("id"));
CREATE UNIQUE INDEX "AutomationExecutionStep_executionId_stepOrder_key" ON "AutomationExecutionStep"("executionId","stepOrder");
CREATE INDEX "AutomationExecutionStep_executionId_state_idx" ON "AutomationExecutionStep"("executionId","state");

CREATE TABLE "AutomationApproval" (
"id" UUID NOT NULL DEFAULT gen_random_uuid(),"executionId" UUID NOT NULL,"policyId" UUID NOT NULL,"policyVersionId" UUID,"requesterId" UUID,"approverId" UUID,"target" VARCHAR(255) NOT NULL,"action" VARCHAR(160) NOT NULL,"reason" VARCHAR(1000) NOT NULL,"risk" "AutomationRiskClass" NOT NULL,"evidence" JSONB,"expiresAt" TIMESTAMP(3) NOT NULL,"approvedAt" TIMESTAMP(3),"rejectedAt" TIMESTAMP(3),"executionResult" JSONB,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
CONSTRAINT "AutomationApproval_pkey" PRIMARY KEY ("id"));
CREATE INDEX "AutomationApproval_executionId_idx" ON "AutomationApproval"("executionId");
CREATE INDEX "AutomationApproval_approverId_createdAt_idx" ON "AutomationApproval"("approverId","createdAt");
CREATE INDEX "AutomationApproval_expiresAt_idx" ON "AutomationApproval"("expiresAt");

CREATE TABLE "AutomationLock" (
"id" UUID NOT NULL DEFAULT gen_random_uuid(),"lockKey" VARCHAR(255) NOT NULL,"ownerId" VARCHAR(160) NOT NULL,"acquiredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"expiresAt" TIMESTAMP(3) NOT NULL,"heartbeatAt" TIMESTAMP(3),"releasedAt" TIMESTAMP(3),
CONSTRAINT "AutomationLock_pkey" PRIMARY KEY ("id"));
CREATE UNIQUE INDEX "AutomationLock_lockKey_key" ON "AutomationLock"("lockKey");
CREATE INDEX "AutomationLock_expiresAt_idx" ON "AutomationLock"("expiresAt");

CREATE TABLE "AutomationCooldown" (
"id" UUID NOT NULL DEFAULT gen_random_uuid(),"policyId" UUID NOT NULL,"targetResource" VARCHAR(255) NOT NULL,"startsAt" TIMESTAMP(3) NOT NULL,"endsAt" TIMESTAMP(3) NOT NULL,"executionCount" INTEGER NOT NULL DEFAULT 1,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
CONSTRAINT "AutomationCooldown_pkey" PRIMARY KEY ("id"));
CREATE INDEX "AutomationCooldown_policyId_targetResource_endsAt_idx" ON "AutomationCooldown"("policyId","targetResource","endsAt");

CREATE TABLE "AutomationFailure" (
"id" UUID NOT NULL DEFAULT gen_random_uuid(),"executionId" UUID NOT NULL,"stepId" UUID,"class" "AutomationFailureClass" NOT NULL,"message" VARCHAR(2000) NOT NULL,"metadata" JSONB,"retryCount" INTEGER NOT NULL DEFAULT 0,"rollbackStatus" VARCHAR(64),"escalated" BOOLEAN NOT NULL DEFAULT false,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
CONSTRAINT "AutomationFailure_pkey" PRIMARY KEY ("id"));
CREATE INDEX "AutomationFailure_executionId_createdAt_idx" ON "AutomationFailure"("executionId","createdAt");
CREATE INDEX "AutomationFailure_class_createdAt_idx" ON "AutomationFailure"("class","createdAt");

CREATE TABLE "AutomationEscalation" (
"id" UUID NOT NULL DEFAULT gen_random_uuid(),"executionId" UUID NOT NULL,"reason" VARCHAR(2000) NOT NULL,"severity" VARCHAR(32) NOT NULL,"incidentId" UUID,"status" VARCHAR(32) NOT NULL,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"resolvedAt" TIMESTAMP(3),
CONSTRAINT "AutomationEscalation_pkey" PRIMARY KEY ("id"));
CREATE INDEX "AutomationEscalation_executionId_createdAt_idx" ON "AutomationEscalation"("executionId","createdAt");
CREATE INDEX "AutomationEscalation_status_createdAt_idx" ON "AutomationEscalation"("status","createdAt");

CREATE TABLE "AutomationRollback" (
"id" UUID NOT NULL DEFAULT gen_random_uuid(),"executionId" UUID NOT NULL,"rollbackMode" "AutomationRollbackMode" NOT NULL,"deterministic" BOOLEAN NOT NULL,"eligible" BOOLEAN NOT NULL,"target" VARCHAR(255) NOT NULL,"actionKey" VARCHAR(160) NOT NULL,"result" JSONB,"status" VARCHAR(32) NOT NULL,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"completedAt" TIMESTAMP(3),
CONSTRAINT "AutomationRollback_pkey" PRIMARY KEY ("id"));
CREATE INDEX "AutomationRollback_executionId_createdAt_idx" ON "AutomationRollback"("executionId","createdAt");

CREATE TABLE "AutomationEvidence" (
"id" UUID NOT NULL DEFAULT gen_random_uuid(),"executionId" UUID,"policyId" UUID,"type" VARCHAR(80) NOT NULL,"reference" VARCHAR(1000) NOT NULL,"integrityHash" VARCHAR(128),"metadata" JSONB,"capturedBy" UUID,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
CONSTRAINT "AutomationEvidence_pkey" PRIMARY KEY ("id"));
CREATE INDEX "AutomationEvidence_executionId_createdAt_idx" ON "AutomationEvidence"("executionId","createdAt");
CREATE INDEX "AutomationEvidence_policyId_createdAt_idx" ON "AutomationEvidence"("policyId","createdAt");

CREATE TABLE "AutomationDryRun" (
"id" UUID NOT NULL DEFAULT gen_random_uuid(),"policyId" UUID NOT NULL,"policyVersionId" UUID,"trigger" JSONB NOT NULL,"conditions" JSONB NOT NULL,"target" JSONB NOT NULL,"proposedAction" JSONB NOT NULL,"risk" "AutomationRiskClass" NOT NULL,"authorization" JSONB NOT NULL,"expectedImpact" VARCHAR(2000) NOT NULL,"rollbackCapability" VARCHAR(500) NOT NULL,"blastRadius" JSONB NOT NULL,"decisionReason" VARCHAR(2000) NOT NULL,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
CONSTRAINT "AutomationDryRun_pkey" PRIMARY KEY ("id"));
CREATE INDEX "AutomationDryRun_policyId_createdAt_idx" ON "AutomationDryRun"("policyId","createdAt");

CREATE TABLE "AutomationSimulation" (
"id" UUID NOT NULL DEFAULT gen_random_uuid(),"policyId" UUID NOT NULL,"policyVersionId" UUID,"input" JSONB NOT NULL,"output" JSONB NOT NULL,"synthetic" BOOLEAN NOT NULL DEFAULT true,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
CONSTRAINT "AutomationSimulation_pkey" PRIMARY KEY ("id"));
CREATE INDEX "AutomationSimulation_policyId_createdAt_idx" ON "AutomationSimulation"("policyId","createdAt");

CREATE TABLE "AutomationSuppression" (
"id" UUID NOT NULL DEFAULT gen_random_uuid(),"policyId" UUID NOT NULL,"reason" VARCHAR(1000) NOT NULL,"targetScope" JSONB NOT NULL,"startsAt" TIMESTAMP(3) NOT NULL,"endsAt" TIMESTAMP(3) NOT NULL,"actorAdminId" UUID,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
CONSTRAINT "AutomationSuppression_pkey" PRIMARY KEY ("id"));
CREATE INDEX "AutomationSuppression_policyId_startsAt_endsAt_idx" ON "AutomationSuppression"("policyId","startsAt","endsAt");

CREATE TABLE "AutomationSafetyEvaluation" (
"id" UUID NOT NULL DEFAULT gen_random_uuid(),"policyId" UUID NOT NULL,"executionId" UUID,"allowed" BOOLEAN NOT NULL,"risk" "AutomationRiskClass" NOT NULL,"reason" VARCHAR(2000) NOT NULL,"environment" VARCHAR(32) NOT NULL,"details" JSONB,"evaluatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
CONSTRAINT "AutomationSafetyEvaluation_pkey" PRIMARY KEY ("id"));
CREATE INDEX "AutomationSafetyEvaluation_policyId_evaluatedAt_idx" ON "AutomationSafetyEvaluation"("policyId","evaluatedAt");
CREATE INDEX "AutomationSafetyEvaluation_allowed_evaluatedAt_idx" ON "AutomationSafetyEvaluation"("allowed","evaluatedAt");

CREATE TABLE "AutomationCircuit" (
"id" UUID NOT NULL DEFAULT gen_random_uuid(),"policyId" UUID NOT NULL,"state" "AutomationCircuitState" NOT NULL DEFAULT 'CLOSED',"consecutiveFailures" INTEGER NOT NULL DEFAULT 0,"totalFailures" INTEGER NOT NULL DEFAULT 0,"openedAt" TIMESTAMP(3),"lastFailureAt" TIMESTAMP(3),"halfOpenAt" TIMESTAMP(3),"reason" VARCHAR(1000),"updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
CONSTRAINT "AutomationCircuit_pkey" PRIMARY KEY ("id"));
CREATE UNIQUE INDEX "AutomationCircuit_policyId_key" ON "AutomationCircuit"("policyId");
CREATE INDEX "AutomationCircuit_state_updatedAt_idx" ON "AutomationCircuit"("state","updatedAt");
