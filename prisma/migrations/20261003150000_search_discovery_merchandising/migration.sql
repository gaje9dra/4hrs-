CREATE TYPE "MerchandisingRuleAction" AS ENUM ('PIN','BOOST','PROMOTE','DEMOTE','BURY');
CREATE TYPE "MerchandisingRuleScope" AS ENUM ('GLOBAL','CATEGORY','COLLECTION','QUERY','PRODUCT','LOCALE');

CREATE TABLE "MerchandisingRule" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "name" VARCHAR(160) NOT NULL,
  "description" VARCHAR(1000),
  "environment" "FeatureFlagEnvironment" NOT NULL,
  "action" "MerchandisingRuleAction" NOT NULL,
  "scope" "MerchandisingRuleScope" NOT NULL,
  "scopeValue" VARCHAR(255),
  "productId" UUID,
  "locale" VARCHAR(16),
  "priority" INTEGER NOT NULL DEFAULT 0,
  "active" BOOLEAN NOT NULL DEFAULT false,
  "startAt" TIMESTAMP(3),
  "endAt" TIMESTAMP(3),
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MerchandisingRule_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "MerchandisingRule_environment_active_startAt_endAt_idx" ON "MerchandisingRule"("environment","active","startAt","endAt");
CREATE INDEX "MerchandisingRule_scope_scopeValue_priority_idx" ON "MerchandisingRule"("scope","scopeValue","priority");
CREATE INDEX "MerchandisingRule_productId_priority_idx" ON "MerchandisingRule"("productId","priority");
CREATE INDEX "MerchandisingRule_locale_priority_idx" ON "MerchandisingRule"("locale","priority");

INSERT INTO "AdminPermission" ("id","key","description","createdAt","updatedAt")
VALUES
  (gen_random_uuid(),'merchandising.read','Read merchandising rules and discovery diagnostics',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  (gen_random_uuid(),'merchandising.manage','Create and modify merchandising rules',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  (gen_random_uuid(),'discovery.read','Read aggregated discovery intelligence',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO NOTHING;

INSERT INTO "AdminRolePermission" ("roleId","permissionId")
SELECT r.id,p.id FROM "AdminRole" r CROSS JOIN "AdminPermission" p
WHERE r.name IN ('SUPER_ADMIN','ADMIN') AND p.key IN ('merchandising.read','merchandising.manage','discovery.read')
ON CONFLICT DO NOTHING;

INSERT INTO "AdminRolePermission" ("roleId","permissionId")
SELECT r.id,p.id FROM "AdminRole" r CROSS JOIN "AdminPermission" p
WHERE r.name IN ('OPERATIONS','VIEWER') AND p.key IN ('merchandising.read','discovery.read')
ON CONFLICT DO NOTHING;
