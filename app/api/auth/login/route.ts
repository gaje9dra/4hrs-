import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createAuthenticationService } from "@/lib/auth/service";
import { createInMemoryAuthenticationRateLimiter } from "@/lib/auth/rate-limit";
import { CUSTOMER_SESSION_COOKIE, sessionCookieOptions, hashSessionToken } from "@/lib/auth/session";
import { assertSameOrigin, authErrorResponse, authJson, readAuthJson, requireCredentials } from "@/lib/auth/http";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const rateLimiter = createInMemoryAuthenticationRateLimiter();
const authentication = createAuthenticationService({ rateLimiter });

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const credentials = requireCredentials(await readAuthJson(request));
    const currentToken = (await cookies()).get(CUSTOMER_SESSION_COOKIE)?.value;
    const result = await authentication.login(
      credentials,
      (request.headers.get("x-forwarded-for") ?? "unknown") + ":" + credentials.email.trim().toLowerCase(),
      currentToken ? hashSessionToken(currentToken) : undefined,
    );

    const response = authJson({ authenticated: true, customer: result.customer });
    response.cookies.set(CUSTOMER_SESSION_COOKIE, result.sessionToken, {
      ...sessionCookieOptions(),
      expires: result.expiresAt,
    });
    return response;
  } catch (error) {
    return authErrorResponse(error);
  }
}

export async function GET() {
  return NextResponse.json({ error: { code: "METHOD_NOT_ALLOWED", message: "Method not allowed." } }, { status: 405 });
}
