import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { requireCurrentCustomer } from "@/lib/auth/context";
import { assertSameOrigin, readAuthJson } from "@/lib/auth/http";
import { createInMemoryAuthenticationRateLimiter } from "@/lib/auth/rate-limit";
import {
  ANALYTICS_CONSENT_COOKIE,
  AnalyticsError,
  getAnalyticsConsent,
  recordAnalyticsEvent,
  setAnalyticsConsent,
} from "@/lib/analytics/events";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const limiter = createInMemoryAuthenticationRateLimiter();

function cookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  };
}

async function currentCustomer(request: Request) {
  try {
    return await requireCurrentCustomer(request);
  } catch {
    return null;
  }
}

function rateLimitKey(request: Request, customerId?: string) {
  const network = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  return `analytics:${customerId ?? network}`;
}

export async function GET(request: Request) {
  const current = await currentCustomer(request);
  const cookieState = (await cookies()).get(ANALYTICS_CONSENT_COOKIE)?.value;
  const state = current
    ? await getAnalyticsConsent(current.customer.id)
    : cookieState === "OPTED_IN" ? "OPTED_IN" : "OPTED_OUT";
  return NextResponse.json({ state });
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const current = await currentCustomer(request);
    limiter.consume(rateLimitKey(request, current?.customer.id), 30, 60 * 60 * 1000);
    const body = await readAuthJson(request);
    if (Object.keys(body).some((key) => key !== "state") || (body.state !== "OPTED_IN" && body.state !== "OPTED_OUT")) {
      return NextResponse.json({ error: { code: "INVALID_REQUEST", message: "Analytics consent state is invalid." } }, { status: 400 });
    }
    if (current) await setAnalyticsConsent({ customerId: current.customer.id, state: body.state });
    const response = NextResponse.json({ state: body.state });
    response.cookies.set(ANALYTICS_CONSENT_COOKIE, body.state, cookieOptions());
    return response;
  } catch (error) {
    return NextResponse.json({ error: { code: "CONSENT_ERROR", message: error instanceof Error ? error.message : "Analytics consent could not be updated safely." } }, { status: 400 });
  }
}

export async function PUT(request: Request) {
  try {
    assertSameOrigin(request);
    const current = await currentCustomer(request);
    if (!current) return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "Authentication is required for authenticated analytics events." } }, { status: 401 });
    const consent = await getAnalyticsConsent(current.customer.id);
    if (consent !== "OPTED_IN") throw new AnalyticsError("CONSENT_REQUIRED", "Analytics consent is not enabled.");

    const body = await readAuthJson(request);
    if (Object.keys(body).some((key) => !["eventId","eventName","eventVersion","occurredAt","properties","anonymousId","sessionId","locale"].includes(key))) {
      throw new AnalyticsError("INVALID_EVENT", "The analytics event request contains unsupported fields.");
    }
    limiter.consume(rateLimitKey(request, current.customer.id), 120, 60 * 60 * 1000);
    const result = await recordAnalyticsEvent({
      eventId: body.eventId,
      eventName: body.eventName,
      eventVersion: body.eventVersion,
      occurredAt: body.occurredAt,
      properties: body.properties,
      source: "CLIENT",
      anonymousId: body.anonymousId,
      sessionId: body.sessionId,
      customerId: current.customer.id,
      locale: current.customer.locale,
      consent: true,
    });
    return NextResponse.json(result, { status: result.created ? 201 : 200 });
  } catch (error) {
    if (error instanceof AnalyticsError) {
      const status = error.code === "CONSENT_REQUIRED" ? 403 : error.code === "PAYLOAD_TOO_LARGE" ? 413 : error.code === "DUPLICATE_EVENT" ? 409 : 400;
      return NextResponse.json({ error: { code: error.code, message: error.message } }, { status });
    }
    return NextResponse.json({ error: { code: "ANALYTICS_ERROR", message: "Analytics event could not be accepted safely." } }, { status: 503 });
  }
}
