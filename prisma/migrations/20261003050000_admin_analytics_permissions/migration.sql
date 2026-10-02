-- Phase 14.8: granular read-only Admin analytics permissions.
INSERT INTO "AdminPermission" ("id","key","description")
SELECT gen_random_uuid(), v.key, v.description
FROM (VALUES
  ('analytics.read','Read the administrative analytics dashboard'),
  ('analytics.financial.read','Read restricted financial analytics and revenue metrics'),
  ('analytics.operations.read','Read operational fulfillment, shipping, returns, cancellation and case metrics'),
  ('analytics.customer.read','Read aggregated customer analytics')
) AS v(key,description)
WHERE NOT EXISTS (SELECT 1 FROM "AdminPermission" p WHERE p.key=v.key);

-- Super admins receive the complete analytics read surface.
INSERT INTO "AdminRolePermission" ("roleId","permissionId")
SELECT r.id,p.id
FROM "AdminRole" r CROSS JOIN "AdminPermission" p
WHERE r.name='SUPER_ADMIN' AND p.key IN ('analytics.read','analytics.financial.read','analytics.operations.read','analytics.customer.read')
AND NOT EXISTS (SELECT 1 FROM "AdminRolePermission" rp WHERE rp."roleId"=r.id AND rp."permissionId"=p.id);

-- Administrators receive all dashboard views except no export capability exists in this phase.
INSERT INTO "AdminRolePermission" ("roleId","permissionId")
SELECT r.id,p.id
FROM "AdminRole" r CROSS JOIN "AdminPermission" p
WHERE r.name='ADMIN' AND p.key IN ('analytics.read','analytics.financial.read','analytics.operations.read','analytics.customer.read')
AND NOT EXISTS (SELECT 1 FROM "AdminRolePermission" rp WHERE rp."roleId"=r.id AND rp."permissionId"=p.id);

-- Operations receive operational analytics without restricted financial/customer analytics.
INSERT INTO "AdminRolePermission" ("roleId","permissionId")
SELECT r.id,p.id
FROM "AdminRole" r CROSS JOIN "AdminPermission" p
WHERE r.name='OPERATIONS' AND p.key IN ('analytics.read','analytics.operations.read')
AND NOT EXISTS (SELECT 1 FROM "AdminRolePermission" rp WHERE rp."roleId"=r.id AND rp."permissionId"=p.id);

-- Viewers receive the base analytics surface only; restricted sections stay hidden.
INSERT INTO "AdminRolePermission" ("roleId","permissionId")
SELECT r.id,p.id
FROM "AdminRole" r CROSS JOIN "AdminPermission" p
WHERE r.name='VIEWER' AND p.key IN ('analytics.read')
AND NOT EXISTS (SELECT 1 FROM "AdminRolePermission" rp WHERE rp."roleId"=r.id AND rp."permissionId"=p.id);
