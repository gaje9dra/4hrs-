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

type QueryLogEvent = { duration: number; target: string };
type ErrorLogEvent = { target: string; message: string };
type PrismaEventClient = {
  $on(event: "query", listener: (event: QueryLogEvent) => void): void;
  $on(event: "error", listener: (event: ErrorLogEvent) => void): void;
};

const events = db as unknown as PrismaEventClient;
events.$on("query", (event) => {
  if (event.duration >= 500) {
    logger.warn("db.query.slow", {
      resourceType: "database",
      outcome: "success",
      durationMs: event.duration,
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
