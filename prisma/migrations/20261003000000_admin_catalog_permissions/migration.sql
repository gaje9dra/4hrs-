-- Phase 14.2: granular catalog administration permissions.
INSERT INTO "AdminPermission" ("id","key","description")
SELECT gen_random_uuid(), v.key, v.description
FROM (VALUES
  ('catalog.category.manage','Manage catalog category resources'),
  ('catalog.collection.manage','Manage catalog collection resources'),
  ('catalog.media.manage','Manage catalog media associations'),
  ('catalog.provider_mapping.manage','Manage provider mappings for catalog variants')
) AS v(key,description)
WHERE NOT EXISTS (
  SELECT 1 FROM "AdminPermission" p WHERE p.key = v.key
);

INSERT INTO "AdminRolePermission" ("roleId","permissionId")
SELECT r.id, p.id
FROM "AdminRole" r
CROSS JOIN "AdminPermission" p
WHERE r.name IN ('SUPER_ADMIN','ADMIN')
  AND p.key IN ('catalog.category.manage','catalog.collection.manage','catalog.media.manage','catalog.provider_mapping.manage')
  AND NOT EXISTS (
    SELECT 1 FROM "AdminRolePermission" rp WHERE rp."roleId" = r.id AND rp."permissionId" = p.id
  );

INSERT INTO "AdminRolePermission" ("roleId","permissionId")
SELECT r.id, p.id
FROM "AdminRole" r
JOIN "AdminPermission" p ON p.key = 'catalog.read'
WHERE r.name IN ('OPERATIONS','VIEWER')
  AND NOT EXISTS (
    SELECT 1 FROM "AdminRolePermission" rp WHERE rp."roleId" = r.id AND rp."permissionId" = p.id
  );
