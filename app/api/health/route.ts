import { NextResponse } from "next/server";
import { logger } from "@/lib/observability/logger";

export const dynamic = "force-dynamic";

export async function GET() {
  logger.info("health.liveness", { outcome: "success" });
  return NextResponse.json({ status: "ok" }, { headers: { "cache-control": "no-store", "x-content-type-options": "nosniff" } });
}
