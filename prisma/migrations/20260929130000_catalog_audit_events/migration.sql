CREATE TYPE "CatalogAuditEntityType" AS ENUM (
  'PRODUCT','VARIANT','MEDIA','CATEGORY','COLLECTION','TAG','OPTION_TYPE','OPTION_VALUE','PRODUCT_CATEGORY','PRODUCT_COLLECTION','PRODUCT_TAG'
);
CREATE TYPE "CatalogAuditOperation" AS ENUM (
  'CREATE','UPDATE','ARCHIVE','RESTORE','PUBLISH','UNPUBLISH','DELETE','RELATIONSHIP_ADD','RELATIONSHIP_REMOVE','REORDER','IMPORT','BULK_UPDATE'
);
CREATE TYPE "CatalogAuditSource" AS ENUM ('MANUAL','IMPORT','BULK_OPERATION','SYSTEM','PROVIDER_SYNC');
CREATE TYPE "CatalogAuditActorType" AS ENUM ('USER','PROCESS','IMPORT','PROVIDER');

CREATE TABLE "CatalogAuditEvent" (
  "id" UUID NOT NULL,
  "entityType" "CatalogAuditEntityType" NOT NULL,
  "entityId" UUID NOT NULL,
  "operation" "CatalogAuditOperation" NOT NULL,
  "source" "CatalogAuditSource" NOT NULL,
  "actorType" "CatalogAuditActorType",
  "actorId" TEXT,
  "correlationId" TEXT,
  "changedFields" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "beforeState" JSONB,
  "afterState" JSONB,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CatalogAuditEvent_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "CatalogAuditEvent_entityType_entityId_createdAt_idx" ON "CatalogAuditEvent"("entityType","entityId","createdAt");
CREATE INDEX "CatalogAuditEvent_createdAt_idx" ON "CatalogAuditEvent"("createdAt");
CREATE INDEX "CatalogAuditEvent_source_operation_createdAt_idx" ON "CatalogAuditEvent"("source","operation","createdAt");
CREATE INDEX "CatalogAuditEvent_actorId_createdAt_idx" ON "CatalogAuditEvent"("actorId","createdAt");
CREATE INDEX "CatalogAuditEvent_correlationId_createdAt_idx" ON "CatalogAuditEvent"("correlationId","createdAt");