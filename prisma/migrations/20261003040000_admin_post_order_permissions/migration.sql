-- Phase 14.7: granular Admin post-order operations permissions.
INSERT INTO "AdminPermission" ("id","key","description")
SELECT gen_random_uuid(), v.key, v.description
FROM (VALUES
('cancellation.read','Read cancellation requests and history'),('cancellation.approve','Approve or reject cancellation requests'),('cancellation.execute','Execute a supported cancellation through the canonical domain'),('cancellation.audit.read','Read cancellation administrative audit history'),
('return.read','Read return requests and eligibility'),('return.review','Review return requests'),('return.approve','Approve return requests'),('return.reject','Reject return requests'),('return.inspect','Inspect received returns'),('return.resolve','Resolve returns through the canonical Return domain'),('return.shipment.manage','Manage supported Return Shipment operations'),('return.refund','Invoke Payment refunds as part of a supported return resolution'),('return.audit.read','Read return administrative audit history'),
('case.read','Read operational customer cases'),
('case.create','Create operational customer cases'),('case.update','Update operational case state and priority'),('case.assign','Assign operational cases'),('case.respond','Send authorized customer-visible case communication'),('case.resolve','Resolve or close operational cases'),('case.reopen','Reopen operational cases where supported'),('case.audit.read','Read case audit history')
) AS v(key,description) WHERE NOT EXISTS (SELECT 1 FROM "AdminPermission" p WHERE p.key=v.key);

INSERT INTO "AdminRolePermission" ("roleId","permissionId")
SELECT r.id,p.id FROM "AdminRole" r JOIN "AdminPermission" p ON p.key IN (
'cancellation.read','cancellation.approve','cancellation.execute','cancellation.audit.read','return.read','return.review','return.approve','return.reject','return.inspect','return.resolve','return.shipment.manage','return.refund','return.audit.read','case.read','case.create','case.update','case.assign','case.respond','case.resolve','case.reopen','case.audit.read')
WHERE r.name='SUPER_ADMIN' AND NOT EXISTS (SELECT 1 FROM "AdminRolePermission" rp WHERE rp."roleId"=r.id AND rp."permissionId"=p.id);

INSERT INTO "AdminRolePermission" ("roleId","permissionId")
SELECT r.id,p.id FROM "AdminRole" r JOIN "AdminPermission" p ON p.key IN (
'cancellation.read','cancellation.approve','cancellation.audit.read','return.read','return.review','return.approve','return.reject','return.inspect','return.audit.read','case.create','case.update','case.assign','case.respond','case.resolve','case.audit.read')
WHERE r.name='ADMIN' AND NOT EXISTS (SELECT 1 FROM "AdminRolePermission" rp WHERE rp."roleId"=r.id AND rp."permissionId"=p.id);

INSERT INTO "AdminRolePermission" ("roleId","permissionId")
SELECT r.id,p.id FROM "AdminRole" r JOIN "AdminPermission" p ON p.key IN (
'cancellation.read','cancellation.approve','return.read','return.review','return.approve','return.reject','return.inspect','case.create','case.update','case.assign','case.respond','case.resolve')
WHERE r.name='OPERATIONS' AND NOT EXISTS (SELECT 1 FROM "AdminRolePermission" rp WHERE rp."roleId"=r.id AND rp."permissionId"=p.id);

INSERT INTO "AdminRolePermission" ("roleId","permissionId")
SELECT r.id,p.id FROM "AdminRole" r JOIN "AdminPermission" p ON p.key IN (
'cancellation.read','cancellation.audit.read','return.read','return.audit.read','case.read','case.audit.read')
WHERE r.name='VIEWER' AND NOT EXISTS (SELECT 1 FROM "AdminRolePermission" rp WHERE rp."roleId"=r.id AND rp."permissionId"=p.id);
