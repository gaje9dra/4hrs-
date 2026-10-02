-- Phase 14.9: granular customer-management permissions.
INSERT INTO "AdminPermission" ("id","key","description")
SELECT gen_random_uuid(), v.key, v.description
FROM (VALUES
 ('customers.read','Read basic customer identity and account information'),
 ('customers.search','Search and filter customers'),
 ('customers.update','Update supported customer profile fields'),
 ('customers.status.manage','Manage supported customer account status transitions'),
 ('customers.address.read','Read customer addresses'),
 ('customers.financial.read','Read customer financial summaries'),
 ('customers.case.read','Read customer cases from the Customer module'),
 ('customers.case.create','Create customer cases through the canonical Case service'),
 ('customers.audit.read','Read customer-specific administrative audit information')
) AS v(key,description)
WHERE NOT EXISTS (SELECT 1 FROM "AdminPermission" p WHERE p."key"=v.key);

INSERT INTO "AdminRolePermission" ("roleId","permissionId")
SELECT r.id,p.id FROM "AdminRole" r CROSS JOIN "AdminPermission" p
WHERE r.name IN ('SUPER_ADMIN','ADMIN')
AND p.key IN ('customers.read','customers.search','customers.update','customers.status.manage','customers.address.read','customers.financial.read','customers.case.read','customers.case.create','customers.audit.read')
AND NOT EXISTS (SELECT 1 FROM "AdminRolePermission" rp WHERE rp."roleId"=r.id AND rp."permissionId"=p.id);

INSERT INTO "AdminRolePermission" ("roleId","permissionId")
SELECT r.id,p.id FROM "AdminRole" r CROSS JOIN "AdminPermission" p
WHERE r.name='OPERATIONS'
AND p.key IN ('customers.read','customers.search','customers.case.read','customers.case.create')
AND NOT EXISTS (SELECT 1 FROM "AdminRolePermission" rp WHERE rp."roleId"=r.id AND rp."permissionId"=p.id);

INSERT INTO "AdminRolePermission" ("roleId","permissionId")
SELECT r.id,p.id FROM "AdminRole" r CROSS JOIN "AdminPermission" p
WHERE r.name='VIEWER'
AND p.key IN ('customers.read','customers.search')
AND NOT EXISTS (SELECT 1 FROM "AdminRolePermission" rp WHERE rp."roleId"=r.id AND rp."permissionId"=p.id);
