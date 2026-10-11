INSERT INTO "AdminPermission" ("id","key","description","createdAt","updatedAt")
VALUES
  (gen_random_uuid(),'referrals.read','View platform referral records and reward progress',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  (gen_random_uuid(),'referrals.manage','Manage referral operations using audited workflows',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO NOTHING;

INSERT INTO "AdminRolePermission" ("roleId","permissionId","assignedAt")
SELECT r."id", p."id", CURRENT_TIMESTAMP
FROM "AdminRole" r
CROSS JOIN "AdminPermission" p
WHERE r."name" = 'SUPER_ADMIN' AND p."key" IN ('referrals.read','referrals.manage')
ON CONFLICT ("roleId","permissionId") DO NOTHING;
