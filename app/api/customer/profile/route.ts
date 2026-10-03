import { requireCurrentCustomer } from "@/lib/auth/context";
import { isAuthenticationError } from "@/lib/auth/errors";
import { assertSameOrigin, authJson, readAuthJson } from "@/lib/auth/http";
import { CustomerIdentityError } from "@/lib/customer/errors";
import { createCustomerProfileService } from "@/lib/customer/service";
import { validateDisplayName } from "@/lib/customer/validation";\nimport { apiResponse, noStoreClassification } from "@/lib/api/governance";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const customer = createCustomerProfileService();

function errorResponse(error: unknown, request: Request) {
  if (isAuthenticationError(error)) return apiResponse({ error: { code: error.code, message: error.publicMessage } }, request, { status: 401 }, noStoreClassification());
  if (error instanceof CustomerIdentityError) {
    const status = error.code === "CUSTOMER_DATABASE_ERROR" ? 503 : error.code === "CUSTOMER_NOT_FOUND" ? 404 : 400;
    return apiResponse({ error: { code: error.code, message: error.message } }, request, { status }, noStoreClassification());
  }
  return apiResponse({ error: { code: "CUSTOMER_DATABASE_ERROR", message: "Customer information is temporarily unavailable." } }, request, { status: 503 }, noStoreClassification());
}

export async function GET(request: Request) {
  try {
    const current = await requireCurrentCustomer(request);
    return apiResponse({ customer: await customer.getProfile(current.customer.id) }, request, {}, noStoreClassification());
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
    return apiResponse({ customer: await customer.updateProfile(current.customer.id, { displayName }) }, request, {}, noStoreClassification());
  } catch (error) {
    return errorResponse(error, request);
  }
}
