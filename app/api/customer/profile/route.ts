import { requireCurrentCustomer } from "@/lib/auth/context";
import { AuthenticationError, isAuthenticationError } from "@/lib/auth/errors";
import { authJson } from "@/lib/auth/http";
import { CustomerIdentityError } from "@/lib/customer/errors";
import { createCustomerProfileService } from "@/lib/customer/service";
import { validateDisplayName } from "@/lib/customer/validation";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const customer = createCustomerProfileService();

function errorResponse(error: unknown) {
  if (isAuthenticationError(error)) {
    return authJson({ error: { code: error.code, message: error.publicMessage } }, { status: 401 });
  }
  if (error instanceof CustomerIdentityError) {
    const status = error.code === "CUSTOMER_DATABASE_ERROR" ? 503 : error.code === "CUSTOMER_NOT_FOUND" ? 404 : 400;
    return authJson({ error: { code: error.code, message: error.message } }, { status });
  }
  return authJson({ error: { code: "CUSTOMER_DATABASE_ERROR", message: "Customer information is temporarily unavailable." } }, { status: 503 });
}

export async function GET() {
  try {
    const current = await requireCurrentCustomer();
    return authJson({ customer: await customer.getProfile(current.customer.id) });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const current = await requireCurrentCustomer();
    const body = await request.json().catch(() => null) as Record<string, unknown> | null;
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      throw new CustomerIdentityError("CUSTOMER_INVALID_EMAIL", "Profile update is invalid.");
    }
    const keys = Object.keys(body);
    if (keys.some((key) => key !== "displayName")) {
      throw new CustomerIdentityError("CUSTOMER_INVALID_EMAIL", "Profile update contains an unsupported field.");
    }
    const displayName = validateDisplayName(body.displayName);
    return authJson({ customer: await customer.updateProfile(current.customer.id, { displayName }) });
  } catch (error) {
    return errorResponse(error);
  }
}
