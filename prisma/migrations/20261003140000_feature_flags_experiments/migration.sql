CREATE TYPE "FeatureFlagType" AS ENUM ('BOOLEAN', 'MULTIVARIANT');
CREATE TYPE "FeatureFlagLifecycle" AS ENUM ('DRAFT', 'ACTIVE', 'PAUSED', 'DEPRECATED', 'RETIRED');
CREATE TYPE "FeatureFlagEnvironment" AS ENUM ('DEVELOPMENT', 'TEST', 'STAGING', 'PRODUCTION');
CREATE TYPE "ExperimentStatus" AS ENUM ('DRAFT', 'ACTIVE', 'PAUSED', 'COMPLETED', 'RETIRED');
CREATE TYPE "ExperimentSubjectType" AS ENUM ('ANONYMOUS', 'CUSTOMER');

CREATE TABLE "FeatureFlag" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "key" VARCHAR(100) NOT NULL,
  "name" VARCHAR(160) NOT NULL,
  "description" VARCHAR(1000),
  "type" "FeatureFlagType" NOT NULL,
  "lifecycle" "FeatureFlagLifecycle" NOT NULL DEFAULT 'DRAFT',
  "environment" "FeatureFlagEnvironment" NOT NULL,
  "defaultEnabled" BOOLEAN NOT NULL DEFAULT false,
  "defaultVariantKey" VARCHAR(64),
  "rolloutPercentage" INTEGER NOT NULL DEFAULT 0,
  "version" INTEGER NOT NULL DEFAULT 1,
  "expiresAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "FeatureFlag_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "FeatureFlag_key_environment_key" ON "FeatureFlag"("key", "environment");
CREATE INDEX "FeatureFlag_environment_lifecycle_idx" ON "FeatureFlag"("environment", "lifecycle");
CREATE INDEX "FeatureFlag_expiresAt_idx" ON "FeatureFlag"("expiresAt");

CREATE TABLE "FeatureFlagVariant" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "flagId" UUID NOT NULL,
  "key" VARCHAR(64) NOT NULL,
  "weightBasisPoints" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "FeatureFlagVariant_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "FeatureFlagVariant_flagId_key_key" ON "FeatureFlagVariant"("flagId", "key");
CREATE INDEX "FeatureFlagVariant_flagId_weightBasisPoints_idx" ON "FeatureFlagVariant"("flagId", "weightBasisPoints");

CREATE TABLE "Experiment" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "key" VARCHAR(100) NOT NULL,
  "name" VARCHAR(160) NOT NULL,
  "description" VARCHAR(1000),
  "status" "ExperimentStatus" NOT NULL DEFAULT 'DRAFT',
  "environment" "FeatureFlagEnvironment" NOT NULL,
  "startAt" TIMESTAMP(3),
  "endAt" TIMESTAMP(3),
  "version" INTEGER NOT NULL DEFAULT 1,
  "primaryMetricEvent" VARCHAR(64),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Experiment_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Experiment_key_key" ON "Experiment"("key");
CREATE INDEX "Experiment_environment_status_idx" ON "Experiment"("environment", "status");
CREATE INDEX "Experiment_startAt_endAt_idx" ON "Experiment"("startAt", "endAt");

CREATE TABLE "ExperimentVariant" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "experimentId" UUID NOT NULL,
  "key" VARCHAR(64) NOT NULL,
  "weightBasisPoints" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ExperimentVariant_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ExperimentVariant_experimentId_key_key" ON "ExperimentVariant"("experimentId", "key");
CREATE INDEX "ExperimentVariant_experimentId_weightBasisPoints_idx" ON "ExperimentVariant"("experimentId", "weightBasisPoints");

CREATE TABLE "ExperimentAssignment" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "experimentId" UUID NOT NULL,
  "subjectHash" VARCHAR(64) NOT NULL,
  "subjectType" "ExperimentSubjectType" NOT NULL,
  "customerId" UUID,
  "variantKey" VARCHAR(64) NOT NULL,
  "experimentVersion" INTEGER NOT NULL,
  "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3),
  CONSTRAINT "ExperimentAssignment_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ExperimentAssignment_experimentId_subjectHash_key" ON "ExperimentAssignment"("experimentId", "subjectHash");
CREATE INDEX "ExperimentAssignment_customerId_assignedAt_idx" ON "ExperimentAssignment"("customerId", "assignedAt");
CREATE INDEX "ExperimentAssignment_expiresAt_idx" ON "ExperimentAssignment"("expiresAt");
CREATE INDEX "ExperimentAssignment_experimentId_variantKey_idx" ON "ExperimentAssignment"("experimentId", "variantKey");

CREATE TABLE "FeatureFlagAssignment" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "flagId" UUID NOT NULL,
  "subjectHash" VARCHAR(64) NOT NULL,
  "subjectType" "ExperimentSubjectType" NOT NULL,
  "customerId" UUID,
  "variantKey" VARCHAR(64),
  "assignedEnabled" BOOLEAN NOT NULL,
  "flagVersion" INTEGER NOT NULL,
  "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FeatureFlagAssignment_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "FeatureFlagAssignment_flagId_subjectHash_key" ON "FeatureFlagAssignment"("flagId", "subjectHash");
CREATE INDEX "FeatureFlagAssignment_customerId_assignedAt_idx" ON "FeatureFlagAssignment"("customerId", "assignedAt");
CREATE INDEX "FeatureFlagAssignment_flagId_assignedAt_idx" ON "FeatureFlagAssignment"("flagId", "assignedAt");

ALTER TABLE "FeatureFlagVariant" ADD CONSTRAINT "FeatureFlagVariant_flagId_fkey" FOREIGN KEY ("flagId") REFERENCES "FeatureFlag"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ExperimentVariant" ADD CONSTRAINT "ExperimentVariant_experimentId_fkey" FOREIGN KEY ("experimentId") REFERENCES "Experiment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ExperimentAssignment" ADD CONSTRAINT "ExperimentAssignment_experimentId_fkey" FOREIGN KEY ("experimentId") REFERENCES "Experiment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ExperimentAssignment" ADD CONSTRAINT "ExperimentAssignment_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FeatureFlagAssignment" ADD CONSTRAINT "FeatureFlagAssignment_flagId_fkey" FOREIGN KEY ("flagId") REFERENCES "FeatureFlag"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FeatureFlagAssignment" ADD CONSTRAINT "FeatureFlagAssignment_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "AdminPermission" ("id","key","description","createdAt","updatedAt")
VALUES
  (gen_random_uuid(),'feature_flags.read','Read feature flag configuration','now()','now()'),
  (gen_random_uuid(),'feature_flags.manage','Create and modify feature flags','now()','now()'),
  (gen_random_uuid(),'experiments.read','Read experiment configuration','now()','now()'),
  (gen_random_uuid(),'experiments.manage','Create and modify experiments','now()','now()')
ON CONFLICT ("key") DO NOTHING;

INSERT INTO "AdminRolePermission" ("roleId","permissionId")
SELECT r.id, p.id FROM "AdminRole" r CROSS JOIN "AdminPermission" p
WHERE r.name = 'SUPER_ADMIN' AND p.key IN ('feature_flags.read','feature_flags.manage','experiments.read','experiments.manage')
ON CONFLICT DO NOTHING;

INSERT INTO "AdminRolePermission" ("roleId","permissionId")
SELECT r.id, p.id FROM "AdminRole" r CROSS JOIN "AdminPermission" p
WHERE r.name = 'ADMIN' AND p.key IN ('feature_flags.read','feature_flags.manage','experiments.read','experiments.manage')
ON CONFLICT DO NOTHING;

INSERT INTO "AdminRolePermission" ("roleId","permissionId")
SELECT r.id, p.id FROM "AdminRole" r CROSS JOIN "AdminPermission" p
WHERE r.name = 'OPERATIONS' AND p.key IN ('feature_flags.read','experiments.read')
ON CONFLICT DO NOTHING;

INSERT INTO "AdminRolePermission" ("roleId","permissionId")
SELECT r.id, p.id FROM "AdminRole" r CROSS JOIN "AdminPermission" p
WHERE r.name = 'VIEWER' AND p.key IN ('feature_flags.read','experiments.read')
ON CONFLICT DO NOTHING;
