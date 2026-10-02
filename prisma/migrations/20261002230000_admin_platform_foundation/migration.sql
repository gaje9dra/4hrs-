-- Phase 14.1: administrative identity, RBAC and immutable audit foundation.
CREATE TYPE "AdminAccountStatus" AS ENUM ('ACTIVE', 'DISABLED');

CREATE TABLE "AdminUser" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "customerId" UUID NOT NULL,
  "status" "AdminAccountStatus" NOT NULL DEFAULT 'ACTIVE',
  "version" INTEGER NOT NULL DEFAULT 1,
  "lastLoginAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AdminUser_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AdminRole" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "name" VARCHAR(64) NOT NULL,
  "description" VARCHAR(255),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AdminRole_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AdminPermission" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "key" VARCHAR(120) NOT NULL,
  "description" VARCHAR(255),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AdminPermission_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AdminUserRole" (
  "adminUserId" UUID NOT NULL,
  "roleId" UUID NOT NULL,
  "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AdminUserRole_pkey" PRIMARY KEY ("adminUserId", "roleId")
);

CREATE TABLE "AdminRolePermission" (
  "roleId" UUID NOT NULL,
  "permissionId" UUID NOT NULL,
  "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AdminRolePermission_pkey" PRIMARY KEY ("roleId", "permissionId")
);

CREATE TABLE "AdminAuditLog" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "actorAdminId" UUID,
  "action" VARCHAR(120) NOT NULL,
  "resourceType" VARCHAR(120),
  "resourceId" VARCHAR(255),
  "success" BOOLEAN NOT NULL,
  "reason" VARCHAR(1000),
  "correlationId" VARCHAR(128),
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AdminAuditLog_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AdminUser_customerId_key" ON "AdminUser"("customerId");
CREATE INDEX "AdminUser_status_idx" ON "AdminUser"("status");
CREATE INDEX "AdminUser_updatedAt_idx" ON "AdminUser"("updatedAt");
CREATE UNIQUE INDEX "AdminRole_name_key" ON "AdminRole"("name");
CREATE UNIQUE INDEX "AdminPermission_key_key" ON "AdminPermission"("key");
CREATE INDEX "AdminPermission_key_idx" ON "AdminPermission"("key");
CREATE INDEX "AdminUserRole_roleId_idx" ON "AdminUserRole"("roleId");
CREATE INDEX "AdminRolePermission_permissionId_idx" ON "AdminRolePermission"("permissionId");
CREATE INDEX "AdminAuditLog_actorAdminId_createdAt_idx" ON "AdminAuditLog"("actorAdminId", "createdAt");
CREATE INDEX "AdminAuditLog_resourceType_resourceId_createdAt_idx" ON "AdminAuditLog"("resourceType", "resourceId", "createdAt");
CREATE INDEX "AdminAuditLog_action_createdAt_idx" ON "AdminAuditLog"("action", "createdAt");
CREATE INDEX "AdminAuditLog_createdAt_idx" ON "AdminAuditLog"("createdAt");

ALTER TABLE "AdminUser" ADD CONSTRAINT "AdminUser_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AdminUserRole" ADD CONSTRAINT "AdminUserRole_adminUserId_fkey" FOREIGN KEY ("adminUserId") REFERENCES "AdminUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AdminUserRole" ADD CONSTRAINT "AdminUserRole_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "AdminRole"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AdminRolePermission" ADD CONSTRAINT "AdminRolePermission_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "AdminRole"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AdminRolePermission" ADD CONSTRAINT "AdminRolePermission_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "AdminPermission"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AdminAuditLog" ADD CONSTRAINT "AdminAuditLog_actorAdminId_fkey" FOREIGN KEY ("actorAdminId") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO "AdminRole" ("id","name","description") VALUES
  (gen_random_uuid(),'SUPER_ADMIN','Full administrative authority including administration and security configuration.'),
  (gen_random_uuid(),'ADMIN','Broad operational administration without super-admin controls.'),
  (gen_random_uuid(),'OPERATIONS','Operational access across commerce domains without administration controls.'),
  (gen_random_uuid(),'VIEWER','Read-only administrative access.');

INSERT INTO "AdminPermission" ("id","key","description")
SELECT gen_random_uuid(), v.key, v.description
FROM (VALUES
 ('catalog.read','Read catalog data'),
 ('catalog.create','Create catalog resources'),
 ('catalog.update','Update catalog resources'),
 ('catalog.publish','Publish or unpublish catalog resources'),
 ('catalog.archive','Archive catalog resources'),
 ('orders.read','Read orders'),
 ('orders.update','Update orders'),
 ('orders.cancel','Cancel orders'),
 ('payments.read','Read payment data'),
 ('payments.refund','Perform refund operations'),
 ('fulfillment.read','Read fulfillment data'),
 ('fulfillment.manage','Manage fulfillment operations'),
 ('shipping.read','Read shipping data'),
 ('shipping.manage','Manage shipping operations'),
 ('returns.read','Read returns and cancellations'),
 ('returns.manage','Manage returns and cancellations'),
 ('customers.read','Read customer data'),
 ('customers.manage','Manage customer data'),
 ('cases.read','Read support cases'),
 ('cases.manage','Manage support cases'),
 ('analytics.read','Read analytics'),
 ('admin.users.read','Read administrator accounts'),
 ('admin.users.manage','Manage administrator accounts and roles'),
 ('admin.audit.read','Read administrative audit records'),
 ('system.settings.read','Read system settings'),
 ('system.settings.manage','Manage system settings')
) AS v(key,description);

-- Super admin receives the complete permission taxonomy.
INSERT INTO "AdminRolePermission" ("roleId","permissionId")
SELECT r.id, p.id FROM "AdminRole" r CROSS JOIN "AdminPermission" p WHERE r.name='SUPER_ADMIN';

-- Admin receives broad operational access but not high-risk administration/security controls.
INSERT INTO "AdminRolePermission" ("roleId","permissionId")
SELECT r.id, p.id FROM "AdminRole" r JOIN "AdminPermission" p ON p.key IN (
 'catalog.read','catalog.create','catalog.update','catalog.publish','catalog.archive',
 'orders.read','orders.update','orders.cancel','payments.read',
 'fulfillment.read','fulfillment.manage','shipping.read','shipping.manage',
 'returns.read','returns.manage','customers.read','customers.manage',
 'cases.read','cases.manage','analytics.read','admin.users.read','admin.audit.read','system.settings.read'
) WHERE r.name='ADMIN';

INSERT INTO "AdminRolePermission" ("roleId","permissionId")
SELECT r.id, p.id FROM "AdminRole" r JOIN "AdminPermission" p ON p.key IN (
 'catalog.read','orders.read','payments.read','fulfillment.read','fulfillment.manage',
 'shipping.read','shipping.manage','returns.read','returns.manage',
 'customers.read','cases.read','cases.manage'
) WHERE r.name='OPERATIONS';

INSERT INTO "AdminRolePermission" ("roleId","permissionId")
SELECT r.id, p.id FROM "AdminRole" r JOIN "AdminPermission" p ON p.key IN (
 'catalog.read','orders.read','payments.read','fulfillment.read','shipping.read',
 'returns.read','customers.read','cases.read','analytics.read'
) WHERE r.name='VIEWER';
