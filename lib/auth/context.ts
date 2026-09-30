import { cookies } from "next/headers";
import { createAuthenticationService } from "@/lib/auth/service";
import { CUSTOMER_SESSION_COOKIE } from "@/lib/auth/session";
import { AuthenticationError } from "@/lib/auth/errors";

export async function resolveCurrentCustomer() {
  const cookieStore = await cookies();
  const token = cookieStore.get(CUSTOMER_SESSION_COOKIE)?.value;
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

export async function requireCurrentCustomer() {
  const current = await resolveCurrentCustomer();
  if (!current) {
    throw new AuthenticationError("SESSION_INVALID", "Authentication is required.");
  }
  return current;
}
