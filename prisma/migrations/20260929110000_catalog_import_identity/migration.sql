CREATE TYPE "CatalogImportEntityType" AS ENUM ('PRODUCT', 'VARIANT');

CREATE TABLE "CatalogImportIdentity" (
  "id" UUID NOT NULL,
  "entityType" "CatalogImportEntityType" NOT NULL,
  "namespace" TEXT NOT NULL,
  "externalReference" TEXT NOT NULL,
  "canonicalId" UUID NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "CatalogImportIdentity_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CatalogImportIdentity_entityType_namespace_externalReference_key"
  ON "CatalogImportIdentity"("entityType", "namespace", "externalReference");

CREATE INDEX "CatalogImportIdentity_entityType_canonicalId_idx"
  ON "CatalogImportIdentity"("entityType", "canonicalId");

CREATE INDEX "CatalogImportIdentity_namespace_externalReference_idx"
  ON "CatalogImportIdentity"("namespace", "externalReference");
