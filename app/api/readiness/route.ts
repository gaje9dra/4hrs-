import { NextResponse } from "next/server";
import { validateServerEnvironment } from "@/lib/config/env";
import { checkDatabaseHealth } from "@/lib/observability/health";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const startedAt = performance.now();

  try {
    const environment = validateServerEnvironment();
    const database = await checkDatabaseHealth();
    const ready = database.ok;

    return NextResponse.json({
      status: ready ? "ready" : "not_ready",
      version: environment.appVersion,
      checks: {
        configuration: "ok",
        database: database.ok ? "ok" : "unavailable",
      },
      latencyMs: Math.round(performance.now() - startedAt),
    }, {
      status: ready ? 200 : 503,
      headers: {
        "cache-control": "no-store",
        "x-content-type-options": "nosniff",
      },
    });
  } catch {
    return NextResponse.json({
      status: "not_ready",
      checks: { configuration: "invalid" },
    }, {
      status: 503,
      headers: {
        "cache-control": "no-store",
        "x-content-type-options": "nosniff",
      },
    });
  }
}
