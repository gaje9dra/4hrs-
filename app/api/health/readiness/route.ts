import { NextResponse } from "next/server";
import { checkDatabaseHealth } from "@/lib/observability/health";
import { publicReleaseIdentity, readServerEnvironment } from "@/lib/config/env";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const database = await checkDatabaseHealth();
  const environment = readServerEnvironment();
  const ready = database.ok;

  return NextResponse.json({
    status: ready ? "ready" : "not_ready",
    release: publicReleaseIdentity(environment),
    dependencies: {
      database: {
        status: database.ok ? "ready" : "unavailable",
        latencyMs: database.latencyMs,
      },
    },
  }, {
    status: ready ? 200 : 503,
    headers: {
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    },
  });
}
