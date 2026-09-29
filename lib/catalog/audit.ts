import { Prisma, type PrismaClient } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { db } from "@/lib/db/client";

export type CatalogAuditContext = {
  source?: "MANUAL" | "IMPORT" | "BULK_OPERATION" | "SYSTEM" | "PROVIDER_SYNC";
  actorType?: "USER" | "PROCESS" | "IMPORT" | "PROVIDER";
  actorId?: string;
  correlationId?: string;
};

export type CatalogAuditEventInput = CatalogAuditContext & {
  entityType:
    | "PRODUCT" | "VARIANT" | "MEDIA" | "CATEGORY" | "COLLECTION" | "TAG"
    | "OPTION_TYPE" | "OPTION_VALUE" | "PRODUCT_CATEGORY" | "PRODUCT_COLLECTION" | "PRODUCT_TAG";
  entityId: string;
  operation:
    | "CREATE" | "UPDATE" | "ARCHIVE" | "RESTORE" | "PUBLISH" | "UNPUBLISH"
    | "DELETE" | "RELATIONSHIP_ADD" | "RELATIONSHIP_REMOVE" | "REORDER" | "IMPORT" | "BULK_UPDATE";
  changedFields?: string[];
  beforeState?: unknown;
  afterState?: unknown;
  metadata?: unknown;
};

export type CatalogAuditQuery = {
  entityType?: CatalogAuditEventInput["entityType"];
  entityId?: string;
  operation?: CatalogAuditEventInput["operation"];
  source?: NonNullable<CatalogAuditContext["source"]>;
  actorId?: string;
  correlationId?: string;
  from?: Date;
  to?: Date;
  limit?: number;
  cursor?: string;
};

export type CatalogAuditPage = {
  items: Array<{
    id: string;
    entityType: string;
    entityId: string;
    operation: string;
    source: string;
    actorType: string | null;
    actorId: string | null;
    correlationId: string | null;
    changedFields: string[];
    beforeState: Prisma.JsonValue | null;
    afterState: Prisma.JsonValue | null;
    metadata: Prisma.JsonValue | null;
    createdAt: Date;
  }>;
  nextCursor: string | null;
};

type AuditClient = PrismaClient | Prisma.TransactionClient;

const MAX_JSON_BYTES = 32768;
const MAX_DEPTH = 6;
const MAX_ARRAY_ITEMS = 100;
const MAX_OBJECT_KEYS = 100;

function sanitize(value: unknown, depth = 0): Prisma.JsonValue | undefined {
  if (value === null) return null;
  if (value === undefined) return undefined;
  if (depth > MAX_DEPTH) return "[TRUNCATED]";
  if (typeof value === "string" || typeof value === "boolean" || typeof value === "number") {
    return typeof value === "number" && !Number.isFinite(value) ? String(value) : value;
  }
  if (value instanceof Date) return value.toISOString();
  if (value instanceof Prisma.Decimal) return value.toString();
  if (Array.isArray(value)) return value.slice(0, MAX_ARRAY_ITEMS).map((item) => sanitize(item, depth + 1) ?? null);
  if (typeof value === "object") {
    const result: Record<string, Prisma.JsonValue> = {};
    for (const [key, item] of Object.entries(value).slice(0, MAX_OBJECT_KEYS)) {
      if (/password|secret|token|apiKey|accessKey|refreshToken|authorization|cookie|credential|env/i.test(key)) continue;
      const safe = sanitize(item, depth + 1);
      if (safe !== undefined) result[key] = safe;
    }
    return result;
  }
  return String(value);
}

function boundedJson(value: unknown): Prisma.InputJsonValue | undefined {
  const safe = sanitize(value);
  if (safe === undefined) return undefined;
  const serialized = JSON.stringify(safe);
  if (serialized.length <= MAX_JSON_BYTES) return safe as Prisma.InputJsonValue;
  return { truncated: true, preview: serialized.slice(0, MAX_JSON_BYTES - 64) };
}

export function changedFields(before: Record<string, unknown> | null | undefined, after: Record<string, unknown> | null | undefined): string[] {
  if (!before || !after) return [];
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  return [...keys].filter((key) => JSON.stringify(sanitize(before[key])) !== JSON.stringify(sanitize(after[key]))).sort();
}

export async function recordCatalogAudit(
  event: CatalogAuditEventInput,
  client: AuditClient = db,
): Promise<void> {
  await client.catalogAuditEvent.create({
    data: {
      id: randomUUID(),
      entityType: event.entityType,
      entityId: event.entityId,
      operation: event.operation,
      source: event.source ?? "MANUAL",
      actorType: event.actorType,
      actorId: event.actorId,
      correlationId: event.correlationId,
      changedFields: [...new Set(event.changedFields ?? [])].sort(),
      beforeState: boundedJson(event.beforeState),
      afterState: boundedJson(event.afterState),
      metadata: boundedJson(event.metadata),
    },
  });
}

export async function listCatalogAudit(query: CatalogAuditQuery = {}): Promise<CatalogAuditPage> {
  const limit = Math.min(Math.max(query.limit ?? 50, 1), 100);
  const rows = await db.catalogAuditEvent.findMany({
    where: {
      entityType: query.entityType,
      entityId: query.entityId,
      operation: query.operation,
      source: query.source,
      actorId: query.actorId,
      correlationId: query.correlationId,
      createdAt: {
        gte: query.from,
        lte: query.to,
      },
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit + 1,
    ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
  });
  const hasMore = rows.length > limit;
  const items = (hasMore ? rows.slice(0, limit) : rows).map((row) => ({
    id: row.id,
    entityType: row.entityType,
    entityId: row.entityId,
    operation: row.operation,
    source: row.source,
    actorType: row.actorType,
    actorId: row.actorId,
    correlationId: row.correlationId,
    changedFields: row.changedFields,
    beforeState: row.beforeState,
    afterState: row.afterState,
    metadata: row.metadata,
    createdAt: row.createdAt,
  }));
  return { items, nextCursor: hasMore ? items.at(-1)?.id ?? null : null };
}
