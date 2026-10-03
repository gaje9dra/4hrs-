CREATE TYPE "ContentType" AS ENUM ('HOMEPAGE_SECTION','LANDING_PAGE','COLLECTION_PAGE','CATEGORY_EDITORIAL','PRODUCT_EDITORIAL','PROMOTIONAL_BANNER','CONTENT_BLOCK');
CREATE TYPE "ContentStatus" AS ENUM ('DRAFT','IN_REVIEW','APPROVED','SCHEDULED','PUBLISHED','UNPUBLISHED','ARCHIVED');
CREATE TYPE "ContentTranslationStatus" AS ENUM ('ORIGINAL','IN_PROGRESS','CURRENT','STALE');

CREATE TABLE "ContentItem" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "type" "ContentType" NOT NULL,
  "internalName" VARCHAR(160) NOT NULL,
  "slug" VARCHAR(200),
  "status" "ContentStatus" NOT NULL DEFAULT 'DRAFT',
  "locale" VARCHAR(16) NOT NULL,
  "title" VARCHAR(200) NOT NULL,
  "summary" VARCHAR(500),
  "body" JSONB NOT NULL,
  "seoTitle" VARCHAR(200),
  "seoDescription" VARCHAR(500),
  "canonicalUrl" VARCHAR(2048),
  "robots" VARCHAR(64),
  "openGraphTitle" VARCHAR(200),
  "openGraphDescription" VARCHAR(500),
  "mediaReferences" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "linkedReferences" JSONB NOT NULL DEFAULT '[]'::JSONB,
  "publicationStartAt" TIMESTAMP(3),
  "publicationEndAt" TIMESTAMP(3),
  "publishedAt" TIMESTAMP(3),
  "publishedVersion" INTEGER,
  "version" INTEGER NOT NULL DEFAULT 1,
  "translationStatus" "ContentTranslationStatus" NOT NULL DEFAULT 'ORIGINAL',
  "sourceContentId" UUID,
  "sourceVersion" INTEGER,
  "position" INTEGER NOT NULL DEFAULT 0,
  "createdByAdminId" UUID NOT NULL,
  "updatedByAdminId" UUID NOT NULL,
  "publishedByAdminId" UUID,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ContentItem_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ContentItem_createdByAdminId_fkey" FOREIGN KEY ("createdByAdminId") REFERENCES "AdminUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ContentItem_updatedByAdminId_fkey" FOREIGN KEY ("updatedByAdminId") REFERENCES "AdminUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ContentItem_publishedByAdminId_fkey" FOREIGN KEY ("publishedByAdminId") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "ContentItem_sourceContentId_fkey" FOREIGN KEY ("sourceContentId") REFERENCES "ContentItem"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "ContentItem_type_locale_slug_key" ON "ContentItem"("type","locale","slug");
CREATE INDEX "ContentItem_status_locale_type_idx" ON "ContentItem"("status","locale","type");
CREATE INDEX "ContentItem_type_locale_status_position_idx" ON "ContentItem"("type","locale","status","position");
CREATE INDEX "ContentItem_publicationStartAt_publicationEndAt_idx" ON "ContentItem"("publicationStartAt","publicationEndAt");
CREATE INDEX "ContentItem_sourceContentId_translationStatus_idx" ON "ContentItem"("sourceContentId","translationStatus");
CREATE INDEX "ContentItem_updatedAt_idx" ON "ContentItem"("updatedAt");

CREATE TABLE "ContentRevision" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "contentId" UUID NOT NULL,
  "version" INTEGER NOT NULL,
  "snapshot" JSONB NOT NULL,
  "changeSummary" VARCHAR(1000),
  "createdByAdminId" UUID NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ContentRevision_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ContentRevision_contentId_fkey" FOREIGN KEY ("contentId") REFERENCES "ContentItem"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ContentRevision_createdByAdminId_fkey" FOREIGN KEY ("createdByAdminId") REFERENCES "AdminUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "ContentRevision_contentId_version_key" ON "ContentRevision"("contentId","version");
CREATE INDEX "ContentRevision_contentId_createdAt_idx" ON "ContentRevision"("contentId","createdAt");

INSERT INTO "AdminPermission" ("id","key","description","createdAt","updatedAt")
VALUES
  (gen_random_uuid(),'content.read','Read editorial content and revisions',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  (gen_random_uuid(),'content.create','Create editorial content',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  (gen_random_uuid(),'content.update','Edit editorial content',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  (gen_random_uuid(),'content.review','Submit and review editorial content',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  (gen_random_uuid(),'content.approve','Approve editorial content',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  (gen_random_uuid(),'content.publish','Publish and unpublish editorial content',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  (gen_random_uuid(),'content.schedule','Schedule editorial publication and expiration',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  (gen_random_uuid(),'content.rollback','Rollback editorial content to a known revision',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  (gen_random_uuid(),'content.archive','Archive editorial content',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  (gen_random_uuid(),'content.preview','Preview unpublished editorial content',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO NOTHING;

INSERT INTO "AdminRolePermission" ("roleId","permissionId")
SELECT r.id,p.id FROM "AdminRole" r CROSS JOIN "AdminPermission" p
WHERE r.name IN ('SUPER_ADMIN','ADMIN')
  AND p.key IN ('content.read','content.create','content.update','content.review','content.approve','content.publish','content.schedule','content.rollback','content.archive','content.preview')
ON CONFLICT DO NOTHING;

INSERT INTO "AdminRolePermission" ("roleId","permissionId")
SELECT r.id,p.id FROM "AdminRole" r CROSS JOIN "AdminPermission" p
WHERE r.name IN ('OPERATIONS','VIEWER') AND p.key IN ('content.read')
ON CONFLICT DO NOTHING;
