import { createHash, randomBytes } from "node:crypto";

export const CUSTOMER_SESSION_COOKIE = "customer_session";
export const CUSTOMER_SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;

export function createSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashSessionToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: CUSTOMER_SESSION_TTL_SECONDS,
  };
}
