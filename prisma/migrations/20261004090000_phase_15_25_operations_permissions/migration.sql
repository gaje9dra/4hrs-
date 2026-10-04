-- Phase 15.25 operational control-plane permissions.
INSERT INTO "AdminPermission" ("id","key","description")
SELECT gen_random_uuid(), v.key, v.description
FROM (VALUES
 ('operations.read','Read production operations control-plane state'),
 ('operations.manage','Perform bounded, audited production operations actions')
) AS v(key,description)
ON CONFLICT ("key") DO NOTHING;

INSERT INTO "AdminRolePermission" ("roleId","permissionId")
SELECT r.id,p.id FROM "AdminRole" r CROSS JOIN "AdminPermission" p
WHERE r.name='SUPER_ADMIN' AND p.key IN ('operations.read','operations.manage')
ON CONFLICT ("roleId","permissionId") DO NOTHING;

INSERT INTO "AdminRolePermission" ("roleId","permissionId")
SELECT r.id,p.id FROM "AdminRole" r CROSS JOIN "AdminPermission" p
WHERE r.name='ADMIN' AND p.key IN ('operations.read','operations.manage')
ON CONFLICT ("roleId","permissionId") DO NOTHING;

INSERT INTO "AdminRolePermission" ("roleId","permissionId")
SELECT r.id,p.id FROM "AdminRole" r CROSS JOIN "AdminPermission" p
WHERE r.name='OPERATIONS' AND p.key IN ('operations.read','operations.manage')
ON CONFLICT ("roleId","permissionId") DO NOTHING;

INSERT INTO "AdminRolePermission" ("roleId","permissionId")
SELECT r.id,p.id FROM "AdminRole" r CROSS JOIN "AdminPermission" p
WHERE r.name='VIEWER' AND p.key='operations.read'
ON CONFLICT ("roleId","permissionId") DO NOTHING;