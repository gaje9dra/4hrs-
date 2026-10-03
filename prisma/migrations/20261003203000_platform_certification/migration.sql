CREATE TYPE "PlatformCertificationReadiness" AS ENUM ('READY_FOR_PRODUCTION','READY_WITH_DOCUMENTED_LIMITATIONS','NOT_READY','BLOCKED');

CREATE TABLE "PlatformCertification" (
  "id" UUID NOT NULL,
  "certificationId" TEXT NOT NULL,
  "releaseVersion" TEXT,
  "commitSha" TEXT,
  "deploymentId" TEXT,
  "environment" TEXT NOT NULL,
  "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "evaluator" TEXT NOT NULL,
  "readiness" "PlatformCertificationReadiness" NOT NULL,
  "testMatrix" JSONB NOT NULL,
  "results" JSONB NOT NULL,
  "blockers" JSONB NOT NULL,
  "limitations" JSONB NOT NULL,
  "evidence" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "PlatformCertification_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PlatformCertification_certificationId_key" ON "PlatformCertification"("certificationId");
CREATE INDEX "PlatformCertification_environment_timestamp_idx" ON "PlatformCertification"("environment","timestamp");
CREATE INDEX "PlatformCertification_readiness_timestamp_idx" ON "PlatformCertification"("readiness","timestamp");
CREATE INDEX "PlatformCertification_commitSha_idx" ON "PlatformCertification"("commitSha");
