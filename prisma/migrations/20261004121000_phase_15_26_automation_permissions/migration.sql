INSERT INTO "AdminPermission" ("id","key","description")
SELECT gen_random_uuid(),v.key,v.description FROM (VALUES
('automation.read','Read automation policies, executions, circuits and evidence'),
('automation.evaluate','Evaluate automation policies and safety conditions'),
('automation.simulate','Run non-mutating automation simulations and dry runs'),
('automation.approve','Approve or reject approval-required remediation'),
('automation.execute','Execute approved controlled remediation'),
('automation.disable','Emergency-disable automation policies and circuits'),
('automation.manage','Manage automation policies and versions'),
('automation.override','Use explicitly elevated automation safety overrides'),
('automation.evidence.read','Read automation evidence')
) AS v(key,description) ON CONFLICT ("key") DO NOTHING;

INSERT INTO "AdminRolePermission" ("roleId","permissionId")
SELECT r.id,p.id FROM "AdminRole" r CROSS JOIN "AdminPermission" p
WHERE r.name IN ('SUPER_ADMIN','ADMIN','OPERATIONS') AND p.key IN ('automation.read','automation.evaluate','automation.simulate','automation.approve','automation.execute','automation.disable','automation.manage','automation.evidence.read')
ON CONFLICT ("roleId","permissionId") DO NOTHING;

INSERT INTO "AdminRolePermission" ("roleId","permissionId")
SELECT r.id,p.id FROM "AdminRole" r CROSS JOIN "AdminPermission" p
WHERE r.name='SUPER_ADMIN' AND p.key='automation.override'
ON CONFLICT ("roleId","permissionId") DO NOTHING;

INSERT INTO "AdminRolePermission" ("roleId","permissionId")
SELECT r.id,p.id FROM "AdminRole" r CROSS JOIN "AdminPermission" p
WHERE r.name='VIEWER' AND p.key IN ('automation.read','automation.evidence.read')
ON CONFLICT ("roleId","permissionId") DO NOTHING;
