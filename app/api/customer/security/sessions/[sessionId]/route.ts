import { requireCurrentCustomer } from "@/lib/auth/context";
import { isAuthenticationError } from "@/lib/auth/errors";
import { assertSameOrigin, authErrorResponse, authJson } from "@/lib/auth/http";
import { createAuthenticationService } from "@/lib/auth/service";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const authentication = createAuthenticationService();

export async function DELETE(
  request: Request,
  context: { params: Promise<{ sessionId: string }> },
) {
  try {
    assertSameOrigin(request);
    const current = await requireCurrentCustomer(request);
    const { sessionId } = await context.params;
    const result = await authentication.revokeCustomerSession(current.customer.id, sessionId, current.sessionId);
    const response = authJson({ session: { revoked: true, current: result.revokedCurrent } });
    if (result.revokedCurrent) {
      response.cookies.set("customer_session", "", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 0 });
    }
    return response;
  } catch (error) {
    if (isAuthenticationError(error)) return authErrorResponse(error);
    return authJson({ error: { code: "AUTH_DATABASE_ERROR", message: "The session could not be revoked safely." } }, { status: 503 });
  }
}
