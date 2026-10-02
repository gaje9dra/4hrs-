-- Phase 14.4: granular payment operations permissions.
INSERT INTO "AdminPermission" ("id","key","description")
SELECT gen_random_uuid(), v.key, v.description
FROM (VALUES
  ('payments.view_sensitive','View permission-gated payment references and operational metadata'),
  ('payments.verify','Verify a payment against its configured provider'),
  ('payments.capture','Capture an authorized payment when supported by the canonical provider'),
  ('payments.refund','Perform full payment refunds'),
  ('payments.refund_partial','Perform partial payment refunds'),
  ('payments.reconcile','Reconcile payment/provider state'),
  ('payments.retry','Retry failed payment attempts'),
  ('payments.audit.read','Read payment-specific audit history')
) AS v(key,description)
WHERE NOT EXISTS (SELECT 1 FROM "AdminPermission" p WHERE p.key=v.key);

INSERT INTO "AdminRolePermission" ("roleId","permissionId")
SELECT r.id,p.id FROM "AdminRole" r CROSS JOIN "AdminPermission" p
WHERE r.name='SUPER_ADMIN' AND p.key IN ('payments.view_sensitive','payments.verify','payments.capture','payments.refund','payments.refund_partial','payments.reconcile','payments.retry','payments.audit.read')
AND NOT EXISTS (SELECT 1 FROM "AdminRolePermission" rp WHERE rp."roleId"=r.id AND rp."permissionId"=p.id);

INSERT INTO "AdminRolePermission" ("roleId","permissionId")
SELECT r.id,p.id FROM "AdminRole" r CROSS JOIN "AdminPermission" p
WHERE r.name='ADMIN' AND p.key IN ('payments.view_sensitive','payments.audit.read')
AND NOT EXISTS (SELECT 1 FROM "AdminRolePermission" rp WHERE rp."roleId"=r.id AND rp."permissionId"=p.id);

INSERT INTO "AdminRolePermission" ("roleId","permissionId")
SELECT r.id,p.id FROM "AdminRole" r CROSS JOIN "AdminPermission" p
WHERE r.name='OPERATIONS' AND p.key IN ('payments.audit.read')
AND NOT EXISTS (SELECT 1 FROM "AdminRolePermission" rp WHERE rp."roleId"=r.id AND rp."permissionId"=p.id);
