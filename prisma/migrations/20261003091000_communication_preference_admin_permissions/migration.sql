-- Phase 15.8: granular communication preference administration permissions
INSERT INTO "AdminPermission" ("id","key","description")
SELECT gen_random_uuid(), v.key, v.description
FROM (VALUES
 ('communication.preference.read','Read customer communication preferences'),
 ('communication.preference.manage','Manage customer communication preferences'),
 ('communication.preference.audit.read','Read customer communication preference audit history')
) AS v(key,description)
WHERE NOT EXISTS (SELECT 1 FROM "AdminPermission" p WHERE p."key"=v.key);

INSERT INTO "AdminRolePermission" ("roleId","permissionId")
SELECT r.id,p.id FROM "AdminRole" r CROSS JOIN "AdminPermission" p
WHERE r.name IN ('SUPER_ADMIN','ADMIN')
AND p.key IN ('communication.preference.read','communication.preference.manage','communication.preference.audit.read')
AND NOT EXISTS (SELECT 1 FROM "AdminRolePermission" rp WHERE rp."roleId"=r.id AND rp."permissionId"=p.id);

INSERT INTO "AdminRolePermission" ("roleId","permissionId")
SELECT r.id,p.id FROM "AdminRole" r CROSS JOIN "AdminPermission" p
WHERE r.name='OPERATIONS'
AND p.key='communication.preference.read'
AND NOT EXISTS (SELECT 1 FROM "AdminRolePermission" rp WHERE rp."roleId"=r.id AND rp."permissionId"=p.id);

INSERT INTO "AdminRolePermission" ("roleId","permissionId")
SELECT r.id,p.id FROM "AdminRole" r CROSS JOIN "AdminPermission" p
WHERE r.name='VIEWER'
AND p.key='communication.preference.read'
AND NOT EXISTS (SELECT 1 FROM "AdminRolePermission" rp WHERE rp."roleId"=r.id AND rp."permissionId"=p.id);
