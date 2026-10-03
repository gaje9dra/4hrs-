import { requireCurrentCustomer } from "@/lib/auth/context";
import { assertSameOrigin, authJson, readAuthJson } from "@/lib/auth/http";
import { consumeCommunicationRateLimit } from "@/lib/communications/rate-limit";
import { CommunicationPreferenceError, getCustomerCommunicationPreferences, updateCustomerCommunicationPreference } from "@/lib/communications/preferences";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function errorResponse(error: unknown) {
  if (error instanceof CommunicationPreferenceError) {
    const status = error.code === "CUSTOMER_NOT_FOUND" ? 404 : error.code === "RATE_LIMITED" ? 429 : error.code === "PREFERENCE_CONFLICT" || error.code === "IDEMPOTENCY_CONFLICT" ? 409 : 400;
    return authJson({ error: { code: error.code, message: error.message } }, { status, headers: status === 429 ? { "retry-after": "60" } : undefined });
  }
  return authJson({ error: { code: "PREFERENCE_DATABASE_ERROR", message: "Communication preferences could not be processed safely." } }, { status: 503 });
}

export async function GET(request: Request) {
  try {
    const current = await requireCurrentCustomer(request);
    consumeCommunicationRateLimit(current.customer.id, request, 60, 60 * 60 * 1000);
    const preferences = await getCustomerCommunicationPreferences(current.customer.id);
    return authJson({ preferences });
  } catch (error) { return errorResponse(error); }
}

export async function PUT(request: Request) {
  try {
    assertSameOrigin(request);
    const current = await requireCurrentCustomer(request);
    consumeCommunicationRateLimit(current.customer.id, request);
    const body = await readAuthJson(request);
    if (Object.keys(body).some((key) => !["category","channel","state","expectedVersion","idempotencyKey"].includes(key))) {
      throw new CommunicationPreferenceError("PREFERENCE_DATABASE_ERROR", "The communication preference request is invalid.");
    }
    const preference = await updateCustomerCommunicationPreference({
      customerId: current.customer.id,
      category: body.category,
      channel: body.channel,
      state: body.state,
      expectedVersion: body.expectedVersion,
      idempotencyKey: body.idempotencyKey,
      correlationId: request.headers.get("x-request-id"),
    });
    return authJson({ preference });
  } catch (error) { return errorResponse(error); }
}
