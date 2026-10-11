import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createAuthenticationService } from "@/lib/auth/service";
import { createInMemoryAuthenticationRateLimiter } from "@/lib/auth/rate-limit";
import { CUSTOMER_SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth/session";
import { assertSameOrigin, authErrorResponse, authJson, readAuthJson, requireCredentials } from "@/lib/auth/http";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const rateLimiter = createInMemoryAuthenticationRateLimiter();
const authentication = createAuthenticationService({ rateLimiter });

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const credentials = requireCredentials(await readAuthJson(request));
    const rateKey = (request.headers.get("x-forwarded-for") ?? "unknown") + ":" + credentials.email.trim().toLowerCase();
    const referralCode = (await cookies()).get("4hrs_referral_code")?.value ?? null;
    const result = await authentication.register({ ...credentials, referralCode }, rateKey);
    const response = authJson({ authenticated: true, customer: result.customer });
    response.cookies.set("4hrs_referral_code", "", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 0 });
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
