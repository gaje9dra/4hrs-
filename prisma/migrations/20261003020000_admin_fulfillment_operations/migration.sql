-- Phase 14.5: granular fulfillment operations permissions.
INSERT INTO "AdminPermission" ("id","key","description")
SELECT gen_random_uuid(), v.key, v.description
FROM (VALUES
  ('fulfillment.view_sensitive','View permission-gated provider references and operational metadata'),
  ('fulfillment.create','Create a Fulfillment through the canonical Fulfillment service'),
  ('fulfillment.submit','Submit a Fulfillment through the canonical provider adapter'),
  ('fulfillment.retry','Retry an eligible failed Fulfillment through the canonical service'),
  ('fulfillment.reconcile','Reconcile a Fulfillment through the canonical provider adapter'),
  ('fulfillment.cancel','Request supported Fulfillment cancellation operations'),
  ('fulfillment.provider.manage','Manage provider assignment only where the canonical Fulfillment service supports it'),
  ('fulfillment.audit.read','Read fulfillment-specific administrative audit history')
) AS v(key,description)
WHERE NOT EXISTS (SELECT 1 FROM "AdminPermission" p WHERE p.key=v.key);

INSERT INTO "AdminRolePermission" ("roleId","permissionId")
SELECT r.id,p.id FROM "AdminRole" r CROSS JOIN "AdminPermission" p
WHERE r.name='SUPER_ADMIN' AND p.key IN (
  'fulfillment.view_sensitive','fulfillment.create','fulfillment.submit','fulfillment.retry',
  'fulfillment.reconcile','fulfillment.cancel','fulfillment.provider.manage','fulfillment.audit.read'
)
AND NOT EXISTS (SELECT 1 FROM "AdminRolePermission" rp WHERE rp."roleId"=r.id AND rp."permissionId"=p.id);

INSERT INTO "AdminRolePermission" ("roleId","permissionId")
SELECT r.id,p.id FROM "AdminRole" r CROSS JOIN "AdminPermission" p
WHERE r.name='ADMIN' AND p.key IN ('fulfillment.view_sensitive','fulfillment.audit.read')
AND NOT EXISTS (SELECT 1 FROM "AdminRolePermission" rp WHERE rp."roleId"=r.id AND rp."permissionId"=p.id);

INSERT INTO "AdminRolePermission" ("roleId","permissionId")
SELECT r.id,p.id FROM "AdminRole" r CROSS JOIN "AdminPermission" p
WHERE r.name='OPERATIONS' AND p.key IN (
  'fulfillment.submit','fulfillment.retry','fulfillment.reconcile','fulfillment.audit.read'
)
AND NOT EXISTS (SELECT 1 FROM "AdminRolePermission" rp WHERE rp."roleId"=r.id AND rp."permissionId"=p.id);
