import { requireCurrentCustomer } from "@/lib/auth/context";
import { isAuthenticationError } from "@/lib/auth/errors";
import { assertSameOrigin, authJson, readAuthJson } from "@/lib/auth/http";
import { CustomerIdentityError } from "@/lib/customer/errors";
import { createCustomerProfileService } from "@/lib/customer/service";
import { validateDisplayName } from "@/lib/customer/validation";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const customer = createCustomerProfileService();

function errorResponse(error: unknown, request: Request) {
  if (isAuthenticationError(error)) return authJson({ error: { code: error.code, message: error.publicMessage } }, { status: 401, headers: { "x-request-id": request.headers.get("x-request-id") ?? undefined } });
  if (error instanceof CustomerIdentityError) {
    const status = error.code === "CUSTOMER_DATABASE_ERROR" ? 503 : error.code === "CUSTOMER_NOT_FOUND" ? 404 : 400;
    return authJson({ error: { code: error.code, message: error.message } }, { status, headers: { "x-request-id": request.headers.get("x-request-id") ?? undefined } });
  }
  return authJson({ error: { code: "CUSTOMER_DATABASE_ERROR", message: "Customer information is temporarily unavailable." } }, { status: 503, headers: { "x-request-id": request.headers.get("x-request-id") ?? undefined } });
}

export async function GET(request: Request) {
  try {
    const current = await requireCurrentCustomer(request);
    return authJson({ customer: await customer.getProfile(current.customer.id) }, { headers: { "x-request-id": request.headers.get("x-request-id") ?? undefined } });
  } catch (error) {
    return errorResponse(error, request);
  }
}

export async function PATCH(request: Request) {
  try {
    assertSameOrigin(request);
    const current = await requireCurrentCustomer(request);
    const body = await readAuthJson(request);
    if (Object.keys(body).some((key) => key !== "displayName")) throw new CustomerIdentityError("CUSTOMER_INVALID_EMAIL", "Profile update contains an unsupported field.");
    const displayName = validateDisplayName(body.displayName);
    return authJson({ customer: await customer.updateProfile(current.customer.id, { displayName }) }, { headers: { "x-request-id": request.headers.get("x-request-id") ?? undefined } });
  } catch (error) {
    return errorResponse(error, request);
  }
}
