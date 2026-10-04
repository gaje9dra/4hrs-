-- Phase 15.30 continuous improvement governance
CREATE TYPE "ImprovementConfidence" AS ENUM ('UNKNOWN','LOW','MEDIUM','HIGH','VERIFIED');
CREATE TYPE "ImprovementRiskClass" AS ENUM ('OBSERVE_ONLY','SAFE_AUTOMATION','CONTROLLED_AUTOMATION','APPROVAL_REQUIRED','HIGH_RISK','PROHIBITED');
CREATE TYPE "ImprovementLifecycle" AS ENUM ('DISCOVERED','TRIAGED','ANALYZING','PROPOSED','REVIEW_REQUIRED','APPROVED','IMPLEMENTING','VALIDATING','VERIFIED','CERTIFIED','REJECTED','DEFERRED','ROLLED_BACK','ABANDONED');
CREATE TYPE "ImprovementValidationState" AS ENUM ('NOT_STARTED','RUNNING','PASSED','PASSED_WITH_LIMITATIONS','FAILED','BLOCKED','ROLLED_BACK');
CREATE TYPE "ImprovementOutcome" AS ENUM ('SUCCESS','PARTIAL_SUCCESS','NO_MEASURABLE_EFFECT','REGRESSION','FAILED','ROLLED_BACK');
CREATE TYPE "ImprovementCustomerImpact" AS ENUM ('NO_IMPACT','LOW','MEDIUM','HIGH','CRITICAL');

CREATE TABLE "ImprovementOpportunity" (
"id" UUID NOT NULL DEFAULT gen_random_uuid(),"stableId" VARCHAR(160) NOT NULL,"title" VARCHAR(240) NOT NULL,"problem" VARCHAR(4000) NOT NULL,"sourceType" VARCHAR(80) NOT NULL,"sourceId" VARCHAR(255) NOT NULL,"domain" VARCHAR(120) NOT NULL,"severity" VARCHAR(32) NOT NULL,"confidence" "ImprovementConfidence" NOT NULL,"riskClass" "ImprovementRiskClass" NOT NULL,"customerImpact" "ImprovementCustomerImpact" NOT NULL,"evidence" JSONB NOT NULL,"hypothesis" JSONB NOT NULL,"priority" JSONB NOT NULL,"lifecycle" "ImprovementLifecycle" NOT NULL DEFAULT 'DISCOVERED',"owner" VARCHAR(160) NOT NULL,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"updatedAt" TIMESTAMP(3) NOT NULL,CONSTRAINT "ImprovementOpportunity_pkey" PRIMARY KEY ("id"));
CREATE UNIQUE INDEX "ImprovementOpportunity_stableId_key" ON "ImprovementOpportunity"("stableId");
CREATE INDEX "ImprovementOpportunity_lifecycle_updatedAt_idx" ON "ImprovementOpportunity"("lifecycle","updatedAt");
CREATE INDEX "ImprovementOpportunity_domain_severity_confidence_idx" ON "ImprovementOpportunity"("domain","severity","confidence");
CREATE INDEX "ImprovementOpportunity_riskClass_customerImpact_idx" ON "ImprovementOpportunity"("riskClass","customerImpact");

CREATE TABLE "ImprovementEvidence" ("id" UUID NOT NULL DEFAULT gen_random_uuid(),"opportunityId" UUID,"proposalId" UUID,"sourceType" VARCHAR(80) NOT NULL,"sourceId" VARCHAR(255) NOT NULL,"observedAt" TIMESTAMP(3) NOT NULL,"environment" VARCHAR(40) NOT NULL,"domain" VARCHAR(120) NOT NULL,"severity" VARCHAR(32) NOT NULL,"observedBehavior" VARCHAR(4000) NOT NULL,"expectedBehavior" VARCHAR(4000) NOT NULL,"impact" JSONB NOT NULL,"metrics" JSONB NOT NULL,"references" JSONB NOT NULL,"redactionVersion" VARCHAR(40) NOT NULL,"integrityHash" VARCHAR(128) NOT NULL,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,CONSTRAINT "ImprovementEvidence_pkey" PRIMARY KEY ("id"));
CREATE INDEX "ImprovementEvidence_opportunityId_createdAt_idx" ON "ImprovementEvidence"("opportunityId","createdAt");
CREATE INDEX "ImprovementEvidence_sourceType_sourceId_observedAt_idx" ON "ImprovementEvidence"("sourceType","sourceId","observedAt");

CREATE TABLE "ImprovementPattern" ("id" UUID NOT NULL DEFAULT gen_random_uuid(),"opportunityId" UUID,"stableId" VARCHAR(160) NOT NULL,"statement" VARCHAR(4000) NOT NULL,"confidence" "ImprovementConfidence" NOT NULL,"observationWindow" JSONB NOT NULL,"methodologyVersion" VARCHAR(40) NOT NULL,"supportingEvents" JSONB NOT NULL,"counterEvidence" JSONB NOT NULL,"provenance" JSONB NOT NULL,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"updatedAt" TIMESTAMP(3) NOT NULL,CONSTRAINT "ImprovementPattern_pkey" PRIMARY KEY ("id"));
CREATE UNIQUE INDEX "ImprovementPattern_stableId_key" ON "ImprovementPattern"("stableId");
CREATE INDEX "ImprovementPattern_confidence_updatedAt_idx" ON "ImprovementPattern"("confidence","updatedAt");

CREATE TABLE "ImprovementProposal" ("id" UUID NOT NULL DEFAULT gen_random_uuid(),"opportunityId" UUID NOT NULL,"version" INTEGER NOT NULL,"problem" VARCHAR(4000) NOT NULL,"hypothesis" VARCHAR(4000) NOT NULL,"proposedChange" JSONB NOT NULL,"affectedComponents" JSONB NOT NULL,"affectedDomains" JSONB NOT NULL,"riskClass" "ImprovementRiskClass" NOT NULL,"expectedBenefit" JSONB NOT NULL,"expectedFailureModes" JSONB NOT NULL,"rollbackStrategy" JSONB NOT NULL,"validationPlan" JSONB NOT NULL,"monitoringPlan" JSONB NOT NULL,"acceptanceCriteria" JSONB NOT NULL,"customerImpact" JSONB NOT NULL,"implementationState" "ImprovementLifecycle" NOT NULL DEFAULT 'PROPOSED',"validationState" "ImprovementValidationState" NOT NULL DEFAULT 'NOT_STARTED',"certificationState" VARCHAR(40) NOT NULL,"owner" VARCHAR(160) NOT NULL,"reviewers" JSONB NOT NULL,"dependencyAssessment" JSONB NOT NULL,"databaseAssessment" JSONB NOT NULL,"governanceRefs" JSONB NOT NULL,"featureFlagRefs" JSONB NOT NULL,"digitalTwinRefs" JSONB NOT NULL,"resilienceRefs" JSONB NOT NULL,"releaseRefs" JSONB NOT NULL,"costAssessment" JSONB NOT NULL,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"updatedAt" TIMESTAMP(3) NOT NULL,CONSTRAINT "ImprovementProposal_pkey" PRIMARY KEY ("id"));
CREATE UNIQUE INDEX "ImprovementProposal_opportunityId_version_key" ON "ImprovementProposal"("opportunityId","version");
CREATE INDEX "ImprovementProposal_implementationState_validationState_idx" ON "ImprovementProposal"("implementationState","validationState");

CREATE TABLE "ImprovementApproval" ("id" UUID NOT NULL DEFAULT gen_random_uuid(),"proposalId" UUID NOT NULL,"proposalVersion" INTEGER NOT NULL,"approver" VARCHAR(160) NOT NULL,"role" VARCHAR(80) NOT NULL,"decision" VARCHAR(32) NOT NULL,"rationale" VARCHAR(2000) NOT NULL,"policyVersion" VARCHAR(80) NOT NULL,"evidenceVersion" VARCHAR(80) NOT NULL,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,CONSTRAINT "ImprovementApproval_pkey" PRIMARY KEY ("id"));
CREATE INDEX "ImprovementApproval_proposalId_proposalVersion_idx" ON "ImprovementApproval"("proposalId","proposalVersion");

CREATE TABLE "ImprovementValidation" ("id" UUID NOT NULL DEFAULT gen_random_uuid(),"proposalId" UUID NOT NULL,"validationVersion" INTEGER NOT NULL,"state" "ImprovementValidationState" NOT NULL,"requiredTests" JSONB NOT NULL,"evidence" JSONB NOT NULL,"blockers" JSONB NOT NULL,"rollbackVerified" BOOLEAN NOT NULL DEFAULT false,"observabilityAvailable" BOOLEAN NOT NULL DEFAULT false,"customerImpact" JSONB NOT NULL,"governanceSatisfied" BOOLEAN NOT NULL DEFAULT false,"digitalTwinVerified" BOOLEAN NOT NULL DEFAULT false,"resilienceVerified" BOOLEAN NOT NULL DEFAULT false,"startedAt" TIMESTAMP(3),"completedAt" TIMESTAMP(3),"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,CONSTRAINT "ImprovementValidation_pkey" PRIMARY KEY ("id"));
CREATE INDEX "ImprovementValidation_proposalId_createdAt_idx" ON "ImprovementValidation"("proposalId","createdAt");

CREATE TABLE "ImprovementOutcomeRecord" ("id" UUID NOT NULL DEFAULT gen_random_uuid(),"proposalId" UUID NOT NULL,"outcome" "ImprovementOutcome" NOT NULL,"expectedBenefit" JSONB NOT NULL,"actualBenefit" JSONB NOT NULL,"regression" JSONB NOT NULL,"operationalImpact" JSONB NOT NULL,"customerImpact" JSONB NOT NULL,"costImpact" JSONB NOT NULL,"reliabilityImpact" JSONB NOT NULL,"sloImpact" JSONB NOT NULL,"errorBudgetImpact" JSONB NOT NULL,"evidence" JSONB NOT NULL,"measuredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,CONSTRAINT "ImprovementOutcomeRecord_pkey" PRIMARY KEY ("id"));
CREATE INDEX "ImprovementOutcomeRecord_proposalId_measuredAt_idx" ON "ImprovementOutcomeRecord"("proposalId","measuredAt");

CREATE TABLE "ImprovementTransition" ("id" UUID NOT NULL DEFAULT gen_random_uuid(),"opportunityId" UUID NOT NULL,"proposalId" UUID,"fromState" VARCHAR(40) NOT NULL,"toState" VARCHAR(40) NOT NULL,"actor" VARCHAR(160) NOT NULL,"reason" VARCHAR(2000) NOT NULL,"proposalVersion" INTEGER,"metadata" JSONB NOT NULL,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,CONSTRAINT "ImprovementTransition_pkey" PRIMARY KEY ("id"));
CREATE INDEX "ImprovementTransition_opportunityId_createdAt_idx" ON "ImprovementTransition"("opportunityId","createdAt");
CREATE INDEX "ImprovementTransition_proposalId_createdAt_idx" ON "ImprovementTransition"("proposalId","createdAt");

CREATE TABLE "ImprovementCertification" ("id" UUID NOT NULL DEFAULT gen_random_uuid(),"proposalId" UUID NOT NULL,"status" VARCHAR(40) NOT NULL,"implementationStatus" VARCHAR(40) NOT NULL,"testStatus" VARCHAR(40) NOT NULL,"ciStatus" VARCHAR(40) NOT NULL,"securityStatus" VARCHAR(40) NOT NULL,"dataIntegrityStatus" VARCHAR(40) NOT NULL,"operationalStatus" VARCHAR(40) NOT NULL,"governanceStatus" VARCHAR(40) NOT NULL,"documentationStatus" VARCHAR(40) NOT NULL,"knownLimitations" JSONB NOT NULL,"unresolvedRisks" JSONB NOT NULL,"rollbackReadiness" JSONB NOT NULL,"owner" VARCHAR(160) NOT NULL,"certifiedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,CONSTRAINT "ImprovementCertification_pkey" PRIMARY KEY ("id"));
CREATE INDEX "ImprovementCertification_proposalId_certifiedAt_idx" ON "ImprovementCertification"("proposalId","certifiedAt");

CREATE TABLE "ImprovementAutomationGuard" ("id" UUID NOT NULL DEFAULT gen_random_uuid(),"stableId" VARCHAR(160) NOT NULL,"riskClass" "ImprovementRiskClass" NOT NULL,"maxExecutions" INTEGER NOT NULL,"windowSeconds" INTEGER NOT NULL,"cooldownSeconds" INTEGER NOT NULL,"circuitBreakerThreshold" INTEGER NOT NULL,"blastRadius" JSONB NOT NULL,"preconditions" JSONB NOT NULL,"postconditions" JSONB NOT NULL,"rollbackConditions" JSONB NOT NULL,"loopKey" VARCHAR(255) NOT NULL,"enabled" BOOLEAN NOT NULL DEFAULT true,"updatedAt" TIMESTAMP(3) NOT NULL,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,CONSTRAINT "ImprovementAutomationGuard_pkey" PRIMARY KEY ("id"));
CREATE UNIQUE INDEX "ImprovementAutomationGuard_stableId_key" ON "ImprovementAutomationGuard"("stableId");

CREATE TABLE "ImprovementAutomationExecution" ("id" UUID NOT NULL DEFAULT gen_random_uuid(),"guardId" UUID NOT NULL,"proposalId" UUID NOT NULL,"idempotencyKey" VARCHAR(255) NOT NULL,"state" VARCHAR(32) NOT NULL,"attempt" INTEGER NOT NULL DEFAULT 1,"startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"endedAt" TIMESTAMP(3),"result" JSONB NOT NULL,CONSTRAINT "ImprovementAutomationExecution_pkey" PRIMARY KEY ("id"));
CREATE UNIQUE INDEX "ImprovementAutomationExecution_idempotencyKey_key" ON "ImprovementAutomationExecution"("idempotencyKey");
CREATE INDEX "ImprovementAutomationExecution_guardId_startedAt_idx" ON "ImprovementAutomationExecution"("guardId","startedAt");
CREATE INDEX "ImprovementAutomationExecution_proposalId_startedAt_idx" ON "ImprovementAutomationExecution"("proposalId","startedAt");

CREATE TABLE "ImprovementCertificationEvidence" ("id" UUID NOT NULL DEFAULT gen_random_uuid(),"certificationId" UUID NOT NULL,"evidenceType" VARCHAR(80) NOT NULL,"reference" VARCHAR(1000) NOT NULL,"integrityHash" VARCHAR(128) NOT NULL,"payload" JSONB NOT NULL,"immutable" BOOLEAN NOT NULL DEFAULT true,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,CONSTRAINT "ImprovementCertificationEvidence_pkey" PRIMARY KEY ("id"));

ALTER TABLE "ImprovementProposal" ADD CONSTRAINT "ImprovementProposal_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "ImprovementOpportunity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ImprovementApproval" ADD CONSTRAINT "ImprovementApproval_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "ImprovementProposal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ImprovementValidation" ADD CONSTRAINT "ImprovementValidation_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "ImprovementProposal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ImprovementOutcomeRecord" ADD CONSTRAINT "ImprovementOutcomeRecord_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "ImprovementProposal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ImprovementTransition" ADD CONSTRAINT "ImprovementTransition_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "ImprovementOpportunity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ImprovementTransition" ADD CONSTRAINT "ImprovementTransition_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "ImprovementProposal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ImprovementCertificationEvidence" ADD CONSTRAINT "ImprovementCertificationEvidence_certificationId_fkey" FOREIGN KEY ("certificationId") REFERENCES "ImprovementCertification"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO "AdminPermission" ("id","key","description","createdAt","updatedAt") VALUES
(gen_random_uuid(),'improvement.read','Read continuous improvement opportunities, evidence and outcomes',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
(gen_random_uuid(),'improvement.create','Create improvement opportunities',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
(gen_random_uuid(),'improvement.evidence.write','Attach governed evidence references',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
(gen_random_uuid(),'improvement.propose','Create versioned change proposals',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
(gen_random_uuid(),'improvement.transition','Advance governed improvement lifecycle',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
(gen_random_uuid(),'improvement.approve','Approve or reject governed proposals',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
(gen_random_uuid(),'improvement.validate','Record validation evidence and readiness',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
(gen_random_uuid(),'improvement.outcome','Record measured improvement outcomes',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
(gen_random_uuid(),'improvement.certify','Issue final improvement certification',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO NOTHING;

INSERT INTO "AdminRolePermission" ("roleId","permissionId","assignedAt")
SELECT r."id",p."id",CURRENT_TIMESTAMP FROM "AdminRole" r CROSS JOIN "AdminPermission" p WHERE r."name"='SUPER_ADMIN' AND p."key" LIKE 'improvement.%' ON CONFLICT ("roleId","permissionId") DO NOTHING;
INSERT INTO "AdminRolePermission" ("roleId","permissionId","assignedAt")
SELECT r."id",p."id",CURRENT_TIMESTAMP FROM "AdminRole" r CROSS JOIN "AdminPermission" p WHERE r."name"='OPERATIONS' AND p."key" IN ('improvement.read','improvement.create','improvement.evidence.write','improvement.propose','improvement.transition','improvement.validate','improvement.outcome') ON CONFLICT ("roleId","permissionId") DO NOTHING;

INSERT INTO "ImprovementAutomationGuard" ("id","stableId","riskClass","maxExecutions","windowSeconds","cooldownSeconds","circuitBreakerThreshold","blastRadius","preconditions","postconditions","rollbackConditions","loopKey","enabled","updatedAt","createdAt")
VALUES (gen_random_uuid(),'ci-safe-observe','OBSERVE_ONLY',1,3600,300,1,'{"customers":0,"financialMinor":0,"providers":0}','{"evidence":true,"authorization":true}','{"evidenceRecorded":true}','{"unexpectedMutation":true}','phase-15-30-ci',true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
ON CONFLICT ("stableId") DO NOTHING;
