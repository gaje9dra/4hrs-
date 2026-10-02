import { db } from "@/lib/db/client";
import { requireCurrentCustomer } from "@/lib/auth/context";
import { AuthenticationError } from "@/lib/auth/errors";
import { AdminError } from "@/lib/admin/errors";
import type { AdminPermission } from "@/lib/admin/permissions";
import { recordAdminAudit } from "@/lib/admin/audit";
import { consumeAdminRateLimit } from "@/lib/admin/rate-limit";

export type AdminAuthorizationContext = {
  customer: { id: string; email: string; status: string };
  adminUser: {
    id: string; customerId: string; status: "ACTIVE" | "DISABLED"; version: number;
    roles: string[];
  };
  permissions: Set<AdminPermission>;
  roles: Set<string>;
};

function denied(message = "Administrator access is required."): never {
  throw new AdminError("ADMIN_REQUIRED", message);
}

export async function requireAdmin(request?: Request, permission?: AdminPermission): Promise<AdminAuthorizationContext> {
  let current;
  try { current = await requireCurrentCustomer(request); }
  catch (error) {
    if (error instanceof AuthenticationError && (error.code === "SESSION_INVALID" || error.code === "SESSION_EXPIRED")) denied();
    throw error;
  }
  if (request && request.method !== "GET" && request.method !== "HEAD" && request.method !== "OPTIONS") {
    const origin = request.headers.get("origin");
    if (origin && origin !== new URL(request.url).origin) throw new AdminError("FORBIDDEN", "The request origin is not allowed.");
  }
  const admin = await db.adminUser.findUnique({
    where: { customerId: current.customer.id },
    include: { roles: { include: { role: { include: { permissions: { include: { permission: true } } } } } } },
  });
  if (!admin || admin.status !== "ACTIVE" || current.customer.status !== "ACTIVE") denied();
  const roles = new Set(admin.roles.map((entry) => entry.role.name));
  const permissions = new Set(admin.roles.flatMap((entry) => entry.role.permissions.map((rp) => rp.permission.key))) as Set<AdminPermission>;
  if (request) consumeAdminRateLimit(admin.id + ":" + (request.headers.get("x-forwarded-for") ?? "unknown"), 120, 60_000);
  if (permission && !permissions.has(permission)) {
    await recordAdminAudit({ actorAdminId: admin.id, action: "AUTHORIZATION_DENIED", success: false, reason: `Missing permission: ${permission}`, metadata: { permission } });
    throw new AdminError("FORBIDDEN", "You are not authorized to perform this administrative action.");
  }
  if (!admin.lastLoginAt || Date.now() - admin.lastLoginAt.getTime() > 5 * 60 * 1000) {
    await db.adminUser.updateMany({ where: { id: admin.id, version: admin.version }, data: { lastLoginAt: new Date() } });
  }
  return {
    customer: { id: current.customer.id, email: current.customer.email, status: current.customer.status },
    adminUser: { id: admin.id, customerId: admin.customerId, status: admin.status, version: admin.version, roles: [...roles] },
    permissions, roles,
  };
}

export function requirePermission(context: AdminAuthorizationContext, permission: AdminPermission): void {
  if (!context.permissions.has(permission)) throw new AdminError("FORBIDDEN", "You are not authorized to perform this administrative action.");
}

export function requireHighRiskReason(reason: unknown): string {
  if (typeof reason !== "string" || reason.trim().length < 3 || reason.trim().length > 1000) {
    throw new AdminError("INVALID_REQUEST", "A reason is required for this privileged action.");
  }
  return reason.trim();
}

export function assertAuthorizedResource(context: AdminAuthorizationContext, allowed: boolean): void {
  if (!allowed) throw new AdminError("FORBIDDEN", "The requested administrative resource is not available.");
}
