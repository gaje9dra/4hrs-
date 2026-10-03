import { randomUUID } from "node:crypto";
import { requireCurrentCustomer } from "@/lib/auth/context";
import { isAuthenticationError } from "@/lib/auth/errors";
import { assertSameOrigin, authErrorResponse, authJson, readAuthJson } from "@/lib/auth/http";
import { createAuthenticationService } from "@/lib/auth/service";
import { createInMemoryAuthenticationRateLimiter } from "@/lib/auth/rate-limit";
import { db } from "@/lib/db/client";
import { enqueueNotificationEvent } from "@/lib/notifications/service";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const authentication = createAuthenticationService();
const rateLimiter = createInMemoryAuthenticationRateLimiter();

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const current = await requireCurrentCustomer(request);
    const decision = rateLimiter.consume(
      `account-password:${current.customer.id}:${request.headers.get("x-forwarded-for") ?? "unknown"}`,
      5,
      60 * 60 * 1000,
    );
    if (!decision.allowed) {
      return authJson({ error: { code: "RATE_LIMITED", message: "Too many password-change attempts. Please try again later." } }, { status: 429, headers: { "retry-after": "60" } });
    }
    const body = await readAuthJson(request);
    if (
      Object.keys(body).some((key) => key !== "currentPassword" && key !== "newPassword") ||
      typeof body.currentPassword !== "string" ||
      typeof body.newPassword !== "string"
    ) {
      return authJson({ error: { code: "INVALID_INPUT", message: "Password change request is invalid." } }, { status: 400 });
    }

    const result = await authentication.changePassword({
      customerId: current.customer.id,
      currentPassword: body.currentPassword,
      newPassword: body.newPassword,
      currentSessionId: current.sessionId,
    });

    try {
      await enqueueNotificationEvent(db, {
        customerId: current.customer.id,
        type: "SECURITY_PASSWORD_CHANGED",
        communicationCategory: "REQUIRED_TRANSACTIONAL",
        payload: {},
        idempotencyKey: `security:password-changed:${current.customer.id}:${randomUUID()}`,
        correlationId: request.headers.get("x-request-id"),
      });
    } catch {
      // Credential mutation is authoritative; notification delivery is independently retried.
    }

    return authJson({ password: { changed: true, sessionsRevoked: result.sessionsRevoked } });
  } catch (error) {
    if (isAuthenticationError(error)) return authErrorResponse(error);
    return authJson({ error: { code: "AUTH_DATABASE_ERROR", message: "Password could not be changed safely." } }, { status: 503 });
  }
}
