import { Prisma } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { db } from "@/lib/db/client";
import type { AdminAuthorizationContext } from "@/lib/admin/authorization";

const MAX_METADATA_BYTES = 16384;
function sanitize(value: unknown, depth = 0): Prisma.JsonValue | undefined {
  if (value === undefined) return undefined;
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") return Number.isFinite(value) ? value : String(value);
  if (value instanceof Date) return value.toISOString();
  if (depth > 5) return "[TRUNCATED]";
  if (Array.isArray(value)) return value.slice(0, 50).map((item) => sanitize(item, depth + 1) ?? null);
  if (typeof value === "object") {
    const out: Record<string, Prisma.JsonValue> = {};
    for (const [key, item] of Object.entries(value).slice(0, 50)) {
      if (/password|hash|secret|token|cookie|credential|authorization|apiKey|accessKey|privateKey/i.test(key)) continue;
      const safe = sanitize(item, depth + 1);
      if (safe !== undefined) out[key] = safe;
    }
    return out;
  }
  return String(value);
}
function safeMetadata(value: unknown): Prisma.InputJsonValue | undefined {
  const safe = sanitize(value);
  if (safe === undefined) return undefined;
  const raw = JSON.stringify(safe);
  return raw.length <= MAX_METADATA_BYTES ? safe as Prisma.InputJsonValue : { truncated: true };
}
export async function recordAdminAudit(input: {
  actorAdminId?: string | null;
  action: string;
  resourceType?: string;
  resourceId?: string;
  success: boolean;
  reason?: string | null;
  correlationId?: string | null;
  metadata?: unknown;
}, client: Prisma.TransactionClient | typeof db = db): Promise<void> {
  await client.adminAuditLog.create({
    data: {
      id: randomUUID(),
      actorAdminId: input.actorAdminId ?? null,
      action: input.action.slice(0,120),
      resourceType: input.resourceType?.slice(0,120),
      resourceId: input.resourceId?.slice(0,255),
      success: input.success,
      reason: input.reason?.slice(0,1000),
      correlationId: input.correlationId?.slice(0,128),
      metadata: safeMetadata(input.metadata),
    },
  });
}
export async function auditAdminAction(context: AdminAuthorizationContext, input: Omit<Parameters<typeof recordAdminAudit>[0],"actorAdminId">) {
  return recordAdminAudit({ ...input, actorAdminId: context.adminUser.id });
}
