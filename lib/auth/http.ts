import { NextResponse } from "next/server";
import { AuthenticationError, isAuthenticationError } from "@/lib/auth/errors";
import { isTrustedStateChangingRequest } from "@/lib/security/request";

export function authJson<T>(data: T, init: ResponseInit = {}) {
  return NextResponse.json(data, {
    ...init,
    headers: {
      "cache-control": "private, no-store, max-age=0",
      "x-content-type-options": "nosniff",
      ...(init.headers ?? {}),
    },
  });
}

export function authErrorResponse(error: unknown) {
  if (isAuthenticationError(error)) {
    const status =
      error.code === "RATE_LIMITED" ? 429 :
      error.code === "INVALID_INPUT" || error.code === "CSRF_REJECTED" ? 400 :
      error.code === "SESSION_INVALID" || error.code === "SESSION_EXPIRED" ? 401 :
      error.code === "AUTH_DATABASE_ERROR" ? 503 :
      401;
    const publicCode =
      error.code === "ACCOUNT_DISABLED" ||
      error.code === "ACCOUNT_UNAVAILABLE" ||
      error.code === "INVALID_CREDENTIALS"
        ? "INVALID_CREDENTIALS"
        : error.code;

    return authJson(
      { error: { code: publicCode, message: error.publicMessage } },
      {
        status,
        headers: error.code === "RATE_LIMITED" ? { "retry-after": "60" } : undefined,
      },
    );
  }

  return authJson(
    { error: { code: "AUTH_DATABASE_ERROR", message: "Authentication is temporarily unavailable." } },
    { status: 503 },
  );
}

export function assertSameOrigin(request: Request): void {
  if (!isTrustedStateChangingRequest(request)) {
    throw new AuthenticationError("CSRF_REJECTED", "The authentication request is not allowed.");
  }
}

export async function readAuthJson(request: Request): Promise<Record<string, unknown>> {
  const contentLength = request.headers.get("content-length");
  if (contentLength && Number(contentLength) > 16 * 1024) {
    throw new AuthenticationError("INVALID_INPUT", "Authentication request is invalid.");
  }

  let value: unknown;
  try {
    value = await request.json();
  } catch {
    throw new AuthenticationError("INVALID_INPUT", "Authentication request is invalid.");
  }

  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new AuthenticationError("INVALID_INPUT", "Authentication request is invalid.");
  }

  return value as Record<string, unknown>;
}

export function requireCredentials(body: Record<string, unknown>) {
  if (typeof body.email !== "string" || typeof body.password !== "string") {
    throw new AuthenticationError("INVALID_INPUT", "Authentication request is invalid.");
  }
  return { email: body.email, password: body.password };
}
