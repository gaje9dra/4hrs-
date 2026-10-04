import { NextResponse } from "next/server";
import { assertSameOrigin } from "@/lib/auth/http";
import { observeMetric } from "@/lib/observability/metrics";

export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 1024;
const ALLOWED = new Set(["LCP", "INP", "CLS", "FCP", "TTFB"]);

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const length = request.headers.get("content-length");
    if (length && Number(length) > MAX_BODY_BYTES) return NextResponse.json({ ok: false }, { status: 413 });

    const raw = await request.text();
    if (new TextEncoder().encode(raw).byteLength > MAX_BODY_BYTES) return NextResponse.json({ ok: false }, { status: 413 });

    const value = JSON.parse(raw) as Record<string, unknown>;
    const name = typeof value.name === "string" ? value.name : "";
    const metricValue = typeof value.value === "number" ? value.value : Number(value.value);

    if (!ALLOWED.has(name) || !Number.isFinite(metricValue) || metricValue < 0) {
      return NextResponse.json({ ok: false }, { status: 400 });
    }

    observeMetric("web_vitals", metricValue, { metric: name });
    return NextResponse.json({ ok: true }, { headers: { "cache-control": "no-store" } });
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
}

export async function GET() {
  return NextResponse.json({ error: { code: "METHOD_NOT_ALLOWED", message: "Method not allowed." } }, { status: 405 });
}
