import { randomUUID } from "node:crypto";
import { requireCurrentCustomer } from "@/lib/auth/context";
import { isAuthenticationError } from "@/lib/auth/errors";
import { assertSameOrigin, authErrorResponse, authJson } from "@/lib/auth/http";
import { createAuthenticationService } from "@/lib/auth/service";
import { createInMemoryAuthenticationRateLimiter } from "@/lib/auth/rate-limit";
import { db } from "@/lib/db/client";
import { enqueueNotificationEvent } from "@/lib/notifications/service";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const authentication = createAuthenticationService();
const rateLimiter = createInMemoryAuthenticationRateLimiter();

function consume(customerId: string, request: Request, limit: number, windowMs: number) {
  const key = `account-session:${customerId}:${request.headers.get("x-forwarded-for") ?? "unknown"}`;
  const decision = rateLimiter.consume(key, limit, windowMs);
  if (!decision.allowed) throw new Error("RATE_LIMITED");
}

function errorResponse(error: unknown) {
  if (error instanceof Error && error.message === "RATE_LIMITED") {
    return authJson({ error: { code: "RATE_LIMITED", message: "Too many account security requests. Please try again later." } }, { status: 429, headers: { "retry-after": "60" } });
  }
  if (isAuthenticationError(error)) return authErrorResponse(error);
  return authJson({ error: { code: "AUTH_DATABASE_ERROR", message: "Account security information is temporarily unavailable." } }, { status: 503 });
}

export async function GET(request: Request) {
  try {
    const current = await requireCurrentCustomer(request);
    consume(current.customer.id, request, 60, 60 * 60 * 1000);
    const sessions = await authentication.listActiveSessions(current.customer.id, current.sessionId);
    return authJson({ sessions });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const current = await requireCurrentCustomer(request);
    consume(current.customer.id, request, 5, 60 * 60 * 1000);
    const revoked = await authentication.logoutAllSessions(current.customer.id);
    if (revoked > 0) {
      try {
        await enqueueNotificationEvent(db, {
          customerId: current.customer.id,
          type: "SECURITY_SESSIONS_REVOKED",
          communicationCategory: "REQUIRED_TRANSACTIONAL",
          payload: {},
          idempotencyKey: `security:sessions-revoked:${current.customer.id}:${randomUUID()}`,
          correlationId: request.headers.get("x-request-id"),
        });
      } catch {
        // Revocation is authoritative; notification delivery is independently retried.
      }
    }
    const response = authJson({ sessions: { revoked } });
    response.cookies.set("customer_session", "", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 0 });
    return response;
  } catch (error) {
    return errorResponse(error);
  }
}
