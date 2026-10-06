import { Prisma } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { db } from "@/lib/db/client";
import { AdminError } from "@/lib/admin/errors";
import { auditAdminAction } from "@/lib/admin/audit";
import { requireHighRiskReason, type AdminAuthorizationContext } from "@/lib/admin/authorization";
import { isAdminRoleName, type AdminRoleName } from "@/lib/admin/permissions";
import type { AdminAuditDto, AdminUserDto } from "@/lib/admin/contracts";

function parseRoles(value: unknown): AdminRoleName[] {
  if (!Array.isArray(value) || value.length > 4 || value.some((role) => !isAdminRoleName(role))) throw new AdminError("INVALID_REQUEST", "Roles are invalid.");
  return [...new Set(value as AdminRoleName[])];
}
function dto(row: AdminUserWithRelations): AdminUserDto {
  return {
    id: row.id, customerId: row.customerId, email: row.customer.email, displayName: row.customer.displayName,
    status: row.status, roles: row.roles.map((x) => x.role.name as AdminRoleName), version: row.version,
    lastLoginAt: row.lastLoginAt?.toISOString() ?? null, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString(),
  };
}
const include = { customer: { select: { id: true, email: true, displayName: true } }, roles: { include: { role: true } } } as const;
type AdminUserWithRelations = Prisma.AdminUserGetPayload<{ include: typeof include }>;

function isSuper(context: AdminAuthorizationContext) { return context.roles.has("SUPER_ADMIN"); }

export async function listAdminUsers(): Promise<AdminUserDto[]> {
  const rows = await db.adminUser.findMany({ include, orderBy: { createdAt: "asc" } });
  return rows.map(dto);
}
export async function getAdminUser(id: string): Promise<AdminUserDto> {
  const row = await db.adminUser.findUnique({ where: { id }, include });
  if (!row) throw new AdminError("NOT_FOUND", "Administrator was not found.");
  return dto(row);
}
export async function createAdminUser(context: AdminAuthorizationContext, input: { email: string; roles?: unknown; reason: unknown }): Promise<AdminUserDto> {
  const reason = requireHighRiskReason(input.reason);
  const email = input.email.trim().toLowerCase();
  if (!email || email.length > 320 || !/^\S+@\S+\.\S+$/.test(email)) throw new AdminError("INVALID_REQUEST", "Administrator email is invalid.");
  const roles = input.roles === undefined ? ["VIEWER"] as AdminRoleName[] : parseRoles(input.roles);
  if (roles.length === 0) throw new AdminError("INVALID_REQUEST", "At least one role is required.");
  if (roles.includes("SUPER_ADMIN") && !isSuper(context)) throw new AdminError("FORBIDDEN", "Only a super administrator can grant super-administrator access.");
  if (roles.length > 0 && input.reason !== undefined && typeof input.reason !== "string") throw new AdminError("INVALID_REQUEST", "Reason is invalid.");
  return db.$transaction(async tx => {
    const customer = await tx.customer.findUnique({ where: { email } });
    if (!customer) throw new AdminError("NOT_FOUND", "The customer account must exist before administrative access can be granted.");
    const existing = await tx.adminUser.findUnique({ where: { customerId: customer.id } });
    if (existing) throw new AdminError("CONFLICT", "This customer already has an administrator account.");
    const roleRows = await tx.adminRole.findMany({ where: { name: { in: roles } } });
    if (roleRows.length !== roles.length) throw new AdminError("INVALID_REQUEST", "One or more roles are unavailable.");
    const admin = await tx.adminUser.create({ data: { id: randomUUID(), customerId: customer.id, roles: { create: roleRows.map((role) => ({ roleId: role.id })) } }, include });
    await auditAdminAction(context, { action: "ADMIN_USER_CREATED", resourceType: "AdminUser", resourceId: admin.id, success: true, reason, metadata: { roles } }, tx);
    return dto(admin);
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}
export async function updateAdminUser(context: AdminAuthorizationContext, input: { id: string; expectedVersion: unknown; status?: unknown; roles?: unknown; reason: unknown }): Promise<AdminUserDto> {
  const reason = requireHighRiskReason(input.reason);
  if (typeof input.expectedVersion !== "number" || !Number.isInteger(input.expectedVersion) || input.expectedVersion < 1) throw new AdminError("INVALID_REQUEST", "Expected administrator version is invalid.");
  const roles = input.roles === undefined ? undefined : parseRoles(input.roles);
  if (input.status !== undefined && input.status !== "ACTIVE" && input.status !== "DISABLED") throw new AdminError("INVALID_REQUEST", "Administrator status is invalid.");
  if (input.id === context.adminUser.id) {
    if (input.status !== undefined || roles !== undefined) throw new AdminError("FORBIDDEN", "Administrators cannot modify their own authorization or status.");
  }
  if (roles?.includes("SUPER_ADMIN") && !isSuper(context)) throw new AdminError("FORBIDDEN", "Only a super administrator can grant super-administrator access.");
  return db.$transaction(async tx => {
    const current = await tx.adminUser.findUnique({ where: { id: input.id }, include: { customer: { select: { email: true } }, roles: { include: { role: true } } } });
    if (!current) throw new AdminError("NOT_FOUND", "Administrator was not found.");
    const currentRoles = new Set(current.roles.map((x) => x.role.name));
    if (currentRoles.has("SUPER_ADMIN") && !isSuper(context)) throw new AdminError("FORBIDDEN", "Super-administrator accounts require super-administrator authorization.");
    if (roles && currentRoles.has("SUPER_ADMIN") && !roles.includes("SUPER_ADMIN")) {
      const activeSuperCount = await tx.adminUser.count({ where: { status: "ACTIVE", roles: { some: { role: { name: "SUPER_ADMIN" } } } } });
      if (activeSuperCount <= 1) throw new AdminError("CONFLICT", "The final active super administrator cannot lose super-administrator access.");
    }
    if (input.status === "DISABLED" && currentRoles.has("SUPER_ADMIN")) {
      const activeSuperCount = await tx.adminUser.count({ where: { status: "ACTIVE", roles: { some: { role: { name: "SUPER_ADMIN" } } } } });
      if (activeSuperCount <= 1) throw new AdminError("CONFLICT", "The final active super administrator cannot be disabled.");
    }
    if (current.version !== input.expectedVersion) throw new AdminError("CONFLICT", "Administrator changed concurrently. Refresh and try again.");
    const nextRoles = roles ?? [...currentRoles] as AdminRoleName[];
    const roleRows = await tx.adminRole.findMany({ where: { name: { in: nextRoles } } });
    if (roleRows.length !== nextRoles.length) throw new AdminError("INVALID_REQUEST", "One or more roles are unavailable.");
    const updateData: Prisma.AdminUserUpdateInput = { version: { increment: 1 } };
    if (input.status !== undefined) updateData.status = input.status as "ACTIVE" | "DISABLED";
    if (roles !== undefined) updateData.roles = { deleteMany: {}, create: roleRows.map((role) => ({ roleId: role.id })) };
    const updated = await tx.adminUser.update({ where: { id: current.id }, data: updateData, include });
    await auditAdminAction(context, {
      action: "ADMIN_USER_UPDATED", resourceType: "AdminUser", resourceId: updated.id, success: true,
      reason,
      metadata: { status: input.status, roles: roles ?? undefined, expectedVersion: input.expectedVersion },
    }, tx);
    return dto(updated);
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}
export async function listAdminAudit(limit = 50, cursor?: string): Promise<{ items: AdminAuditDto[]; nextCursor: string | null }> {
  const take = Math.min(Math.max(limit, 1), 100);
  const rows = await db.adminAuditLog.findMany({ orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: take + 1, ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}) });
  const more = rows.length > take;
  const items = (more ? rows.slice(0, take) : rows).map((row) => ({
    id: row.id, actorAdminId: row.actorAdminId, action: row.action, resourceType: row.resourceType, resourceId: row.resourceId,
    success: row.success, reason: row.reason, correlationId: row.correlationId, metadata: row.metadata, createdAt: row.createdAt.toISOString(),
  }));
  return { items, nextCursor: more ? items.at(-1)?.id ?? null : null };
}