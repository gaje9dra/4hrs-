-- Phase 14.6: granular Admin Shipping Operations permissions.
INSERT INTO "AdminPermission" ("id","key","description")
SELECT gen_random_uuid(), v.key, v.description
FROM (VALUES
  ('shipping.view_sensitive','View sensitive provider and shipment references'),
  ('shipping.create','Create canonical Shipments from eligible Fulfillments'),
  ('shipping.reconcile','Run supported Shipment reconciliation'),
  ('shipping.recovery','Request Shipment operational recovery/reconciliation'),
  ('shipping.tracking.read','View Shipment tracking timelines'),
  ('shipping.audit.read','View Shipment administrative audit history')
) AS v(key,description)
WHERE NOT EXISTS (SELECT 1 FROM "AdminPermission" p WHERE p.key = v.key);

INSERT INTO "AdminRolePermission" ("roleId","permissionId")
SELECT r.id, p.id
FROM "AdminRole" r
CROSS JOIN "AdminPermission" p
WHERE r.name IN ('SUPER_ADMIN','ADMIN')
  AND p.key IN ('shipping.view_sensitive','shipping.create','shipping.reconcile','shipping.recovery','shipping.tracking.read','shipping.audit.read')
  AND NOT EXISTS (
    SELECT 1 FROM "AdminRolePermission" rp WHERE rp."roleId"=r.id AND rp."permissionId"=p.id
  );

INSERT INTO "AdminRolePermission" ("roleId","permissionId")
SELECT r.id, p.id
FROM "AdminRole" r
JOIN "AdminPermission" p ON p.key IN ('shipping.read','shipping.tracking.read')
WHERE r.name IN ('OPERATIONS','VIEWER')
  AND NOT EXISTS (
    SELECT 1 FROM "AdminRolePermission" rp WHERE rp."roleId"=r.id AND rp."permissionId"=p.id
  );

INSERT INTO "AdminRolePermission" ("roleId","permissionId")
SELECT r.id, p.id
FROM "AdminRole" r
JOIN "AdminPermission" p ON p.key IN ('shipping.create','shipping.reconcile','shipping.recovery')
WHERE r.name='OPERATIONS'
  AND NOT EXISTS (
    SELECT 1 FROM "AdminRolePermission" rp WHERE rp."roleId"=r.id AND rp."permissionId"=p.id
  );
