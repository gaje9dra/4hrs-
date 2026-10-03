-- Phase 15.17 reliability incident persistence
CREATE TYPE "ReliabilityIncidentSeverity" AS ENUM ('CRITICAL','MAJOR','OPERATIONAL','LOCALIZED','INFO');
CREATE TYPE "ReliabilityIncidentStatus" AS ENUM ('OPEN','ACKNOWLEDGED','RESOLVED');
CREATE TYPE "ReliabilityIncidentCategory" AS ENUM ('AVAILABILITY','FINANCIAL','DATA_PRIVACY','PROVIDER','OPERATIONS','SECURITY','PERFORMANCE','DEPENDENCY','DATA_INTEGRITY');
CREATE TYPE "ReliabilityIncidentEventType" AS ENUM ('DETECTED','UPDATED','ACKNOWLEDGED','RESOLVED','MITIGATION');

CREATE TABLE "ReliabilityIncident" (
  "id" UUID NOT NULL,
  "fingerprint" VARCHAR(64) NOT NULL,
  "severity" "ReliabilityIncidentSeverity" NOT NULL,
  "category" "ReliabilityIncidentCategory" NOT NULL,
  "capability" VARCHAR(64) NOT NULL,
  "title" VARCHAR(200) NOT NULL,
  "summary" VARCHAR(2000) NOT NULL,
  "dependency" VARCHAR(64),
  "status" "ReliabilityIncidentStatus" NOT NULL DEFAULT 'OPEN',
  "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastAlertedAt" TIMESTAMP(3),
  "resolvedAt" TIMESTAMP(3),
  "occurrenceCount" INTEGER NOT NULL DEFAULT 1,
  "correlationId" VARCHAR(128),
  "deploymentId" VARCHAR(128),
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ReliabilityIncident_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ReliabilityIncident_fingerprint_key" ON "ReliabilityIncident"("fingerprint");
CREATE INDEX "ReliabilityIncident_status_severity_lastSeenAt_idx" ON "ReliabilityIncident"("status","severity","lastSeenAt");
CREATE INDEX "ReliabilityIncident_capability_lastSeenAt_idx" ON "ReliabilityIncident"("capability","lastSeenAt");

CREATE TABLE "ReliabilityIncidentEvent" (
  "id" UUID NOT NULL,
  "incidentId" UUID NOT NULL,
  "type" "ReliabilityIncidentEventType" NOT NULL,
  "actorAdminId" VARCHAR(64),
  "reason" VARCHAR(1000),
  "correlationId" VARCHAR(128),
  "metadata" JSONB,
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ReliabilityIncidentEvent_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ReliabilityIncidentEvent_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "ReliabilityIncident"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "ReliabilityIncidentEvent_incidentId_occurredAt_idx" ON "ReliabilityIncidentEvent"("incidentId","occurredAt");
CREATE INDEX "ReliabilityIncidentEvent_type_occurredAt_idx" ON "ReliabilityIncidentEvent"("type","occurredAt");
