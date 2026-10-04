CREATE TYPE "ArchitectureLifecycle" AS ENUM ('IDENTIFIED','ASSESSED','PROPOSED','ARCHITECTURE_REVIEW','APPROVED','REHEARSAL','MIGRATING','VALIDATING','CERTIFIED','REJECTED','DEFERRED','ROLLED_BACK','ABANDONED');
CREATE TYPE "ArchitectureProblemCategory" AS ENUM ('DOMAIN_BOUNDARY','API_BOUNDARY','DATA_MODEL','DATABASE','PERFORMANCE','SCALABILITY','RELIABILITY','SECURITY','PRIVACY','OBSERVABILITY','DEPENDENCY','INFRASTRUCTURE','DEPLOYMENT','TESTING','DEVELOPER_EXPERIENCE','OPERATIONAL_TOIL','COST','TECHNICAL_DEBT','DOCUMENTATION');

CREATE TABLE "ArchitectureEvolution" ("id" UUID NOT NULL DEFAULT gen_random_uuid(),"stableId" VARCHAR(160) NOT NULL,"title" VARCHAR(240) NOT NULL,"description" VARCHAR(4000) NOT NULL,"originatingProblem" VARCHAR(4000) NOT NULL,"category" VARCHAR(80) NOT NULL,"owner" VARCHAR(160) NOT NULL,"affectedDomains" JSONB NOT NULL,"affectedComponents" JSONB NOT NULL,"risk" VARCHAR(40) NOT NULL,"blastRadius" VARCHAR(20) NOT NULL,"expectedBenefit" JSONB NOT NULL,"expectedCost" JSONB NOT NULL,"migrationStrategy" VARCHAR(40) NOT NULL,"rollbackStrategy" JSONB NOT NULL,"validationPlan" JSONB NOT NULL,"successCriteria" JSONB NOT NULL,"evidence" JSONB NOT NULL,"lifecycle" "ArchitectureLifecycle" NOT NULL DEFAULT 'IDENTIFIED',"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"updatedAt" TIMESTAMP(3) NOT NULL,CONSTRAINT "ArchitectureEvolution_pkey" PRIMARY KEY ("id"));
CREATE UNIQUE INDEX "ArchitectureEvolution_stableId_key" ON "ArchitectureEvolution"("stableId");
CREATE INDEX "ArchitectureEvolution_lifecycle_updatedAt_idx" ON "ArchitectureEvolution"("lifecycle","updatedAt");
CREATE INDEX "ArchitectureEvolution_category_risk_blastRadius_idx" ON "ArchitectureEvolution"("category","risk","blastRadius");

CREATE TABLE "ArchitectureAssessment" ("id" UUID NOT NULL DEFAULT gen_random_uuid(),"evolutionId" UUID NOT NULL,"assessor" VARCHAR(160) NOT NULL,"result" VARCHAR(40) NOT NULL,"assessment" JSONB NOT NULL,"methodologyVersion" VARCHAR(40) NOT NULL,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,CONSTRAINT "ArchitectureAssessment_pkey" PRIMARY KEY ("id"));
CREATE INDEX "ArchitectureAssessment_evolutionId_createdAt_idx" ON "ArchitectureAssessment"("evolutionId","createdAt");

CREATE TABLE "ArchitectureProposal" ("id" UUID NOT NULL DEFAULT gen_random_uuid(),"evolutionId" UUID NOT NULL,"version" INTEGER NOT NULL,"options" JSONB NOT NULL,"decisionCriteria" JSONB NOT NULL,"selectedOption" VARCHAR(255),"proposal" JSONB NOT NULL,"owner" VARCHAR(160) NOT NULL,"status" VARCHAR(40) NOT NULL,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"updatedAt" TIMESTAMP(3) NOT NULL,CONSTRAINT "ArchitectureProposal_pkey" PRIMARY KEY ("id"));
CREATE UNIQUE INDEX "ArchitectureProposal_evolutionId_version_key" ON "ArchitectureProposal"("evolutionId","version");

CREATE TABLE "ArchitectureDecision" ("id" UUID NOT NULL DEFAULT gen_random_uuid(),"evolutionId" UUID NOT NULL,"proposalId" UUID NOT NULL,"decision" VARCHAR(32) NOT NULL,"rationale" VARCHAR(4000) NOT NULL,"approver" VARCHAR(160) NOT NULL,"decisionVersion" INTEGER NOT NULL,"risks" JSONB NOT NULL,"tradeoffs" JSONB NOT NULL,"rejectedAlternatives" JSONB NOT NULL,"approval" BOOLEAN NOT NULL,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,CONSTRAINT "ArchitectureDecision_pkey" PRIMARY KEY ("id"));
CREATE INDEX "ArchitectureDecision_evolutionId_decisionVersion_idx" ON "ArchitectureDecision"("evolutionId","decisionVersion");

CREATE TABLE "ArchitectureMigration" ("id" UUID NOT NULL DEFAULT gen_random_uuid(),"evolutionId" UUID NOT NULL,"strategy" VARCHAR(40) NOT NULL,"owner" VARCHAR(160) NOT NULL,"plan" JSONB NOT NULL,"rollback" JSONB NOT NULL,"forwardRecovery" JSONB NOT NULL,"compatibility" JSONB NOT NULL,"status" VARCHAR(40) NOT NULL,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"updatedAt" TIMESTAMP(3) NOT NULL,CONSTRAINT "ArchitectureMigration_pkey" PRIMARY KEY ("id"));
CREATE INDEX "ArchitectureMigration_evolutionId_createdAt_idx" ON "ArchitectureMigration"("evolutionId","createdAt");

CREATE TABLE "ArchitectureValidation" ("id" UUID NOT NULL DEFAULT gen_random_uuid(),"evolutionId" UUID NOT NULL,"migrationId" UUID,"status" VARCHAR(40) NOT NULL,"tests" JSONB NOT NULL,"evidence" JSONB NOT NULL,"rollbackVerified" BOOLEAN NOT NULL,"observabilityVerified" BOOLEAN NOT NULL,"securityVerified" BOOLEAN NOT NULL,"privacyVerified" BOOLEAN NOT NULL,"reconciliationVerified" BOOLEAN NOT NULL,"digitalTwinVerified" BOOLEAN NOT NULL,"resilienceVerified" BOOLEAN NOT NULL,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,CONSTRAINT "ArchitectureValidation_pkey" PRIMARY KEY ("id"));
CREATE INDEX "ArchitectureValidation_evolutionId_createdAt_idx" ON "ArchitectureValidation"("evolutionId","createdAt");

CREATE TABLE "ArchitectureCertification" ("id" UUID NOT NULL DEFAULT gen_random_uuid(),"evolutionId" UUID NOT NULL,"status" VARCHAR(40) NOT NULL,"ciStatus" VARCHAR(32) NOT NULL,"testStatus" VARCHAR(32) NOT NULL,"securityStatus" VARCHAR(32) NOT NULL,"privacyStatus" VARCHAR(32) NOT NULL,"dataIntegrityStatus" VARCHAR(32) NOT NULL,"observabilityStatus" VARCHAR(32) NOT NULL,"rollbackReady" BOOLEAN NOT NULL,"documentationComplete" BOOLEAN NOT NULL,"digitalTwinVerified" BOOLEAN NOT NULL,"resilienceVerified" BOOLEAN NOT NULL,"reconciliationVerified" BOOLEAN NOT NULL,"knownLimitations" JSONB NOT NULL,"owner" VARCHAR(160) NOT NULL,"certifiedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,CONSTRAINT "ArchitectureCertification_pkey" PRIMARY KEY ("id"));
CREATE INDEX "ArchitectureCertification_evolutionId_certifiedAt_idx" ON "ArchitectureCertification"("evolutionId","certifiedAt");

CREATE TABLE "ArchitectureDependency" ("id" UUID NOT NULL DEFAULT gen_random_uuid(),"evolutionId" UUID NOT NULL,"name" VARCHAR(200) NOT NULL,"currentVersion" VARCHAR(120) NOT NULL,"targetVersion" VARCHAR(120),"reason" VARCHAR(2000) NOT NULL,"compatibility" VARCHAR(80) NOT NULL,"securityStatus" VARCHAR(80) NOT NULL,"runtimeImpact" JSONB NOT NULL,"rollback" JSONB NOT NULL,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,CONSTRAINT "ArchitectureDependency_pkey" PRIMARY KEY ("id"));
CREATE INDEX "ArchitectureDependency_evolutionId_createdAt_idx" ON "ArchitectureDependency"("evolutionId","createdAt");

CREATE TABLE "ArchitectureRisk" ("id" UUID NOT NULL DEFAULT gen_random_uuid(),"evolutionId" UUID NOT NULL,"riskClass" VARCHAR(40) NOT NULL,"description" VARCHAR(2000) NOT NULL,"likelihood" VARCHAR(32) NOT NULL,"impact" VARCHAR(32) NOT NULL,"mitigation" JSONB NOT NULL,"owner" VARCHAR(160) NOT NULL,"status" VARCHAR(32) NOT NULL,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,CONSTRAINT "ArchitectureRisk_pkey" PRIMARY KEY ("id"));
CREATE INDEX "ArchitectureRisk_evolutionId_status_idx" ON "ArchitectureRisk"("evolutionId","status");

CREATE TABLE "ArchitectureEvidence" ("id" UUID NOT NULL DEFAULT gen_random_uuid(),"evolutionId" UUID NOT NULL,"sourceType" VARCHAR(80) NOT NULL,"sourceId" VARCHAR(255) NOT NULL,"environment" VARCHAR(40) NOT NULL,"observedAt" TIMESTAMP(3) NOT NULL,"summary" VARCHAR(4000) NOT NULL,"references" JSONB NOT NULL,"metrics" JSONB NOT NULL,"integrityHash" VARCHAR(128) NOT NULL,"redactionVersion" VARCHAR(40) NOT NULL,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,CONSTRAINT "ArchitectureEvidence_pkey" PRIMARY KEY ("id"));
CREATE INDEX "ArchitectureEvidence_evolutionId_createdAt_idx" ON "ArchitectureEvidence"("evolutionId","createdAt");
CREATE INDEX "ArchitectureEvidence_sourceType_sourceId_observedAt_idx" ON "ArchitectureEvidence"("sourceType","sourceId","observedAt");

CREATE TABLE "ArchitectureTransition" ("id" UUID NOT NULL DEFAULT gen_random_uuid(),"evolutionId" UUID NOT NULL,"fromState" VARCHAR(40) NOT NULL,"toState" VARCHAR(40) NOT NULL,"actor" VARCHAR(160) NOT NULL,"reason" VARCHAR(2000) NOT NULL,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,CONSTRAINT "ArchitectureTransition_pkey" PRIMARY KEY ("id"));
CREATE INDEX "ArchitectureTransition_evolutionId_createdAt_idx" ON "ArchitectureTransition"("evolutionId","createdAt");

CREATE TABLE "ArchitectureDriftFinding" ("id" UUID NOT NULL DEFAULT gen_random_uuid(),"evolutionId" UUID,"kind" VARCHAR(80) NOT NULL,"scope" VARCHAR(200) NOT NULL,"classification" VARCHAR(80) NOT NULL,"evidence" JSONB NOT NULL,"integrityHash" VARCHAR(128) NOT NULL,"methodologyVersion" VARCHAR(40) NOT NULL,"owner" VARCHAR(160) NOT NULL,"status" VARCHAR(32) NOT NULL,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,CONSTRAINT "ArchitectureDriftFinding_pkey" PRIMARY KEY ("id"));
CREATE INDEX "ArchitectureDriftFinding_status_createdAt_idx" ON "ArchitectureDriftFinding"("status","createdAt");
CREATE INDEX "ArchitectureDriftFinding_kind_scope_idx" ON "ArchitectureDriftFinding"("kind","scope");

CREATE TABLE "ArchitectureRoadmapItem" ("id" UUID NOT NULL DEFAULT gen_random_uuid(),"stableId" VARCHAR(160) NOT NULL,"evolutionId" UUID,"problem" VARCHAR(4000) NOT NULL,"priority" VARCHAR(32) NOT NULL,"evidence" JSONB NOT NULL,"dependency" JSONB NOT NULL,"owner" VARCHAR(160) NOT NULL,"risk" VARCHAR(40) NOT NULL,"expectedBenefit" JSONB NOT NULL,"estimatedEffort" JSONB NOT NULL,"status" VARCHAR(40) NOT NULL,"targetMilestone" VARCHAR(255),"blockers" JSONB NOT NULL,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"updatedAt" TIMESTAMP(3) NOT NULL,CONSTRAINT "ArchitectureRoadmapItem_pkey" PRIMARY KEY ("id"));
CREATE UNIQUE INDEX "ArchitectureRoadmapItem_stableId_key" ON "ArchitectureRoadmapItem"("stableId");
CREATE INDEX "ArchitectureRoadmapItem_status_updatedAt_idx" ON "ArchitectureRoadmapItem"("status","updatedAt");

ALTER TABLE "ArchitectureAssessment" ADD CONSTRAINT "ArchitectureAssessment_evolutionId_fkey" FOREIGN KEY ("evolutionId") REFERENCES "ArchitectureEvolution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ArchitectureProposal" ADD CONSTRAINT "ArchitectureProposal_evolutionId_fkey" FOREIGN KEY ("evolutionId") REFERENCES "ArchitectureEvolution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ArchitectureDecision" ADD CONSTRAINT "ArchitectureDecision_evolutionId_fkey" FOREIGN KEY ("evolutionId") REFERENCES "ArchitectureEvolution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ArchitectureDecision" ADD CONSTRAINT "ArchitectureDecision_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "ArchitectureProposal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ArchitectureMigration" ADD CONSTRAINT "ArchitectureMigration_evolutionId_fkey" FOREIGN KEY ("evolutionId") REFERENCES "ArchitectureEvolution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ArchitectureValidation" ADD CONSTRAINT "ArchitectureValidation_evolutionId_fkey" FOREIGN KEY ("evolutionId") REFERENCES "ArchitectureEvolution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ArchitectureValidation" ADD CONSTRAINT "ArchitectureValidation_migrationId_fkey" FOREIGN KEY ("migrationId") REFERENCES "ArchitectureMigration"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ArchitectureCertification" ADD CONSTRAINT "ArchitectureCertification_evolutionId_fkey" FOREIGN KEY ("evolutionId") REFERENCES "ArchitectureEvolution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ArchitectureDependency" ADD CONSTRAINT "ArchitectureDependency_evolutionId_fkey" FOREIGN KEY ("evolutionId") REFERENCES "ArchitectureEvolution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ArchitectureRisk" ADD CONSTRAINT "ArchitectureRisk_evolutionId_fkey" FOREIGN KEY ("evolutionId") REFERENCES "ArchitectureEvolution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ArchitectureEvidence" ADD CONSTRAINT "ArchitectureEvidence_evolutionId_fkey" FOREIGN KEY ("evolutionId") REFERENCES "ArchitectureEvolution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ArchitectureTransition" ADD CONSTRAINT "ArchitectureTransition_evolutionId_fkey" FOREIGN KEY ("evolutionId") REFERENCES "ArchitectureEvolution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ArchitectureDriftFinding" ADD CONSTRAINT "ArchitectureDriftFinding_evolutionId_fkey" FOREIGN KEY ("evolutionId") REFERENCES "ArchitectureEvolution"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ArchitectureRoadmapItem" ADD CONSTRAINT "ArchitectureRoadmapItem_evolutionId_fkey" FOREIGN KEY ("evolutionId") REFERENCES "ArchitectureEvolution"("id") ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO "AdminPermission" ("id","key","description","createdAt","updatedAt") VALUES
(gen_random_uuid(),'architecture.read','Read architecture inventory and evolution governance',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
(gen_random_uuid(),'architecture.create','Create architecture evolution records',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
(gen_random_uuid(),'architecture.evidence.write','Record architecture evidence',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
(gen_random_uuid(),'architecture.assess','Assess architecture evolution proposals',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
(gen_random_uuid(),'architecture.propose','Create versioned architecture proposals',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
(gen_random_uuid(),'architecture.approve','Approve architecture decisions',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
(gen_random_uuid(),'architecture.migrate','Record governed migration plans',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
(gen_random_uuid(),'architecture.validate','Record architecture validation evidence',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
(gen_random_uuid(),'architecture.drift.write','Record architecture drift findings',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
(gen_random_uuid(),'architecture.transition','Advance architecture lifecycle',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
(gen_random_uuid(),'architecture.certify','Record architecture certification',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO NOTHING;
INSERT INTO "AdminRolePermission" ("roleId","permissionId","assignedAt") SELECT r."id",p."id",CURRENT_TIMESTAMP FROM "AdminRole" r CROSS JOIN "AdminPermission" p WHERE r."name"='SUPER_ADMIN' AND p."key" LIKE 'architecture.%' ON CONFLICT ("roleId","permissionId") DO NOTHING;
INSERT INTO "AdminRolePermission" ("roleId","permissionId","assignedAt") SELECT r."id",p."id",CURRENT_TIMESTAMP FROM "AdminRole" r CROSS JOIN "AdminPermission" p WHERE r."name"='OPERATIONS' AND p."key" IN ('architecture.read','architecture.create','architecture.evidence.write','architecture.assess','architecture.propose','architecture.validate','architecture.drift.write') ON CONFLICT ("roleId","permissionId") DO NOTHING;
