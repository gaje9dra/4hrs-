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

type QueryLogEvent = { duration: number; target: string; query: string };
type ErrorLogEvent = { target: string; message: string };
type PrismaEventClient = {
  $on(event: "query", listener: (event: QueryLogEvent) => void): void;
  $on(event: "error", listener: (event: ErrorLogEvent) => void): void;
};

const events = db as unknown as PrismaEventClient;
function describeQuery(query: string): { statement: string; tables: string[] } {
  const statement = /^\\s*(select|insert|update|delete|with|begin|commit|rollback|show|set)\\b/i.exec(query)?.[1]?.toLowerCase() ?? "other";
  // Log table identifiers only, never raw SQL or bound parameter values.
  const tables = [...new Set([...query.matchAll(/\\b(?:FROM|JOIN|INTO|UPDATE)\\s+["']?([a-zA-Z_][\\w.]*)/gi)].map((match) => match[1].replace(/"/g, "")))].slice(0, 8);
  return { statement, tables };
}

events.$on("query", (event) => {
  if (event.duration >= 500) {
    logger.warn("db.query.slow", {
      resourceType: "database",
      outcome: "success",
      durationMs: event.duration,
      ...describeQuery(event.query),
    }, { target: event.target });
  }
});

events.$on("error", (event) => {
  logger.error("db.query.failed", {
    resourceType: "database",
    outcome: "failure",
    errorCode: "DATABASE_ERROR",
  }, { target: event.target, message: event.message });
});

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
