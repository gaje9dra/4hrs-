import { PrismaClient } from "@prisma/client";
import { logger } from "@/lib/observability/logger";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };
const basePrisma = globalForPrisma.prisma ?? new PrismaClient();

export const db = basePrisma.$extends({
  query: {
    $allOperations: async ({ model, operation, args, query }) => {
      const started = performance.now();
      try {
        const result = await query(args);
        const durationMs = Math.round(performance.now() - started);
        if (durationMs >= 500) logger.warn("db.query.slow", { resourceType: model ?? "raw", outcome: "success", durationMs }, { operation });
        return result;
      } catch (error) {
        logger.error("db.query.failed", { resourceType: model ?? "raw", outcome: "failure", errorCode: "DATABASE_ERROR", durationMs: Math.round(performance.now() - started) }, { operation, error });
        throw error;
      }
    },
  },
});

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db as unknown as PrismaClient;
