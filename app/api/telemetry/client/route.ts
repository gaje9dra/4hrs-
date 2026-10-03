import { NextResponse } from "next/server";
import { assertSameOrigin } from "@/lib/auth/http";
import { incrementMetric } from "@/lib/observability/metrics";
import { logger } from "@/lib/observability/logger";

export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 4096;
const ALLOWED = new Set(["runtime", "unhandledrejection"]);

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const length = request.headers.get("content-length");
    if (length && Number(length) > MAX_BODY_BYTES) return NextResponse.json({ ok: false }, { status: 413 });
    const raw = await request.text();
    if (new TextEncoder().encode(raw).byteLength > MAX_BODY_BYTES) return NextResponse.json({ ok: false }, { status: 413 });
    const value = JSON.parse(raw) as Record<string, unknown>;
    const kind = typeof value.kind === "string" ? value.kind : "";
    const message = typeof value.message === "string" ? value.message.trim().slice(0, 500) : "";
    if (!ALLOWED.has(kind) || !message) return NextResponse.json({ ok: false }, { status: 400 });
    incrementMetric("frontend_errors_total", { operation: kind });
    logger.warn("frontend.error", { requestId: request.headers.get("x-request-id"), outcome: "failure", errorCode: "CLIENT_ERROR" }, { kind, message });
    return NextResponse.json({ ok: true }, { headers: { "cache-control": "no-store" } });
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
}
