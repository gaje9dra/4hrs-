import { createAuthenticationService } from "@/lib/auth/service";
import { CUSTOMER_SESSION_COOKIE } from "@/lib/auth/session";
import { authErrorResponse, authJson } from "@/lib/auth/http";
import { AuthenticationError } from "@/lib/auth/errors";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const authentication = createAuthenticationService();

export async function GET() {
  try {
    const token = (await cookies()).get(CUSTOMER_SESSION_COOKIE)?.value;
    if (!token) return authJson({ authenticated: false, customer: null });

    const result = await authentication.resolveSession(token);
    return authJson({ authenticated: true, customer: result.customer });
  } catch (error) {
    if (error instanceof AuthenticationError && (error.code === "SESSION_INVALID" || error.code === "SESSION_EXPIRED")) {
      const response = authJson({ authenticated: false, customer: null });
      response.cookies.delete(CUSTOMER_SESSION_COOKIE);
      return response;
    }
    return authErrorResponse(error);
  }
}
