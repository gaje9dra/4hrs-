import { NextResponse } from "next/server";
import { checkDatabaseHealth } from "@/lib/observability/health";
import { logger } from "@/lib/observability/logger";

export const dynamic = "force-dynamic";

export async function GET() {
  const database = await checkDatabaseHealth();
  if (!database.ok) {
    logger.error("health.readiness.failed", { outcome: "failure", errorCode: "DATABASE_UNAVAILABLE" }, { dependency: "database" });
    return NextResponse.json({ status: "not_ready" }, { status: 503, headers: { "cache-control": "no-store", "x-content-type-options": "nosniff" } });
  }
  logger.info("health.readiness", { outcome: "success", durationMs: database.latencyMs });
  return NextResponse.json({ status: "ready" }, { headers: { "cache-control": "no-store", "x-content-type-options": "nosniff" } });
}
