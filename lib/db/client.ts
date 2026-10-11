import { PrismaClient } from "@prisma/client";
import { logger } from "@/lib/observability/logger";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

/**
 * Supabase's transaction-mode pooler (port 6543) multiplexes many logical
 * clients over backend PostgreSQL connections. Disable Prisma's named
 * prepared statements for this specific pooler to avoid Postgres 42P05
 * ("prepared statement already exists") when a backend connection is reused.
 *
 * Keep the rest of the connection URL intact, including schema and pool
 * settings. Session-pooler/direct URLs are intentionally left unchanged.
 */
function getRuntimeDatasourceUrl(): string | undefined {
  const configuredUrl = process.env.DATABASE_URL;
  if (!configuredUrl) return undefined;

  try {
    const url = new URL(configuredUrl);
    if (
      url.hostname.endsWith(".pooler.supabase.com") &&
      url.port === "6543"
    ) {
      url.searchParams.set("pgbouncer", "true");
    }
    return url.toString();
  } catch {
    // Leave malformed URLs for Prisma's normal configuration error handling.
    return configuredUrl;
  }
}

const runtimeDatasourceUrl = getRuntimeDatasourceUrl();

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
