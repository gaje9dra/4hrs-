import type { AdminRoleName } from "@/lib/admin/permissions";
export type AdminUserDto = {
  id: string;
  customerId: string;
  email: string;
  displayName: string | null;
  status: "ACTIVE" | "DISABLED";
  roles: AdminRoleName[];
  version: number;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
};
export type AdminAuditDto = {
  id: string;
  actorAdminId: string | null;
  action: string;
  resourceType: string | null;
  resourceId: string | null;
  success: boolean;
  reason: string | null;
  correlationId: string | null;
  metadata: unknown;
  createdAt: string;
};