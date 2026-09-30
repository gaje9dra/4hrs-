import { cookies } from "next/headers";
import { createAuthenticationService } from "@/lib/auth/service";
import { CUSTOMER_SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth/session";
import { assertSameOrigin, authErrorResponse, authJson } from "@/lib/auth/http";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const authentication = createAuthenticationService();

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const cookieStore = await cookies();
    const token = cookieStore.get(CUSTOMER_SESSION_COOKIE)?.value;
    if (token) await authentication.logout(token);

    const response = authJson({ authenticated: false, customer: null });
    response.cookies.set(CUSTOMER_SESSION_COOKIE, "", { ...sessionCookieOptions(), maxAge: 0 });
    return response;
  } catch (error) {
    return authErrorResponse(error);
  }
}
