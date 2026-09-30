import { cookies } from "next/headers";
import { createAuthenticationService } from "@/lib/auth/service";
import { CUSTOMER_SESSION_COOKIE } from "@/lib/auth/session";
import { AuthenticationError } from "@/lib/auth/errors";

export async function resolveCurrentCustomer(request?: Request) {
  const token = request?.headers.get("cookie")
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(CUSTOMER_SESSION_COOKIE + "="))
    ?.slice(CUSTOMER_SESSION_COOKIE.length + 1)
    ?? (await cookies()).get(CUSTOMER_SESSION_COOKIE)?.value;
  if (!token) return null;

  try {
    return await createAuthenticationService().resolveSession(token);
  } catch (error) {
    if (error instanceof AuthenticationError && (error.code === "SESSION_INVALID" || error.code === "SESSION_EXPIRED")) {
      return null;
    }
    throw error;
  }
}

export async function requireCurrentCustomer(request?: Request) {
  const current = await resolveCurrentCustomer(request);
  if (!current) {
    throw new AuthenticationError("SESSION_INVALID", "Authentication is required.");
  }
  return current;
}
