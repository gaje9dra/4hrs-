import { NextResponse } from "next/server";
import { readServerEnvironment, publicReleaseIdentity } from "@/lib/config/env";
import { logger } from "@/lib/observability/logger";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const environment = readServerEnvironment();
  logger.info("health.liveness", { outcome: "success" });
  return NextResponse.json({
    status: "ok",
    release: publicReleaseIdentity(environment),
  }, {
    headers: {
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    },
  });
}
