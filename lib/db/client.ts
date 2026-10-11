import { createHash } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { logger } from "@/lib/observability/logger";
import { getRuntimeDatasourceUrl } from "@/lib/db/datasource-url";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

const runtimeDatasourceUrl = getRuntimeDatasourceUrl(
  process.env.DATABASE_URL,
  process.env.PRISMA_CONNECTION_LIMIT,
);

export const db = globalForPrisma.prisma ?? new PrismaClient({
  ...(runtimeDatasourceUrl
    ? { datasources: { db: { url: runtimeDatasourceUrl } } }
    : {}),
  log: [
    { emit: "event", level: "query" },
    { emit: "event", level: "error" },
  ],
});

type QueryLogEvent = { duration: number; target: string; query?: string };
type ErrorLogEvent = { target: string; message: string };
type PrismaEventClient = {
  $on(event: "query", listener: (event: QueryLogEvent) => void): void;
  $on(event: "error", listener: (event: ErrorLogEvent) => void): void;
};

/**
 * Fingerprints normalized SQL without emitting SQL text or bound parameters.
 * The digest lets operators group repeated slow statements in logs safely.
 */
function getQueryFingerprint(query: string | undefined): string | undefined {
  if (!query) return undefined;
  const normalized = query.replace(/\s+/g, " ").trim();
  if (!normalized) return undefined;
  return createHash("sha256").update(normalized).digest("hex").slice(0, 16);
}

const events = db as unknown as PrismaEventClient;
events.$on("query", (event) => {
  // Prisma query-event duration measures the database query path; it is not a
  // direct measurement of connection-pool queue time. P2024 errors are tracked
  // separately below so the two signals are not conflated.
  if (event.duration >= 250) {
    logger.warn("db.query.slow", {
      resourceType: "database",
      outcome: "success",
      durationMs: event.duration,
    }, {
      target: event.target,
      queryFingerprint: getQueryFingerprint(event.query),
      thresholdMs: 250,
    });
  }
});

events.$on("error", (event) => {
  const poolWaitTimeout = /\bP2024\b/.test(event.message);
  logger[poolWaitTimeout ? "error" : "error"](
    poolWaitTimeout ? "db.pool.wait_timeout" : "db.query.failed",
    {
      resourceType: "database",
      outcome: poolWaitTimeout ? "timeout" : "failure",
      errorCode: poolWaitTimeout ? "P2024" : "DATABASE_ERROR",
    },
    { target: event.target },
  );
});

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
