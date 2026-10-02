import { assertSameOrigin, authErrorResponse } from "@/lib/auth/http";
import { requireAdmin } from "@/lib/auth/admin";
import { AuthenticationError } from "@/lib/auth/errors";
import { FulfillmentDomainError } from "@/lib/fulfillment/errors";
import { createFulfillmentApplication } from "@/lib/fulfillment/application";
import { getFulfillmentOperationalDiagnostics } from "@/lib/fulfillment/diagnostics";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const fulfillment = createFulfillmentApplication();

function json(data: unknown, status = 200) {
  return Response.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

function errorResponse(error: unknown) {
  if (error instanceof AuthenticationError) return authErrorResponse(error);
  if (error instanceof FulfillmentDomainError) {
    const status =
      error.code === "FULFILLMENT_INVALID_STATE" || error.code === "FULFILLMENT_ORDER_NOT_FOUND" ? 404 :
      error.code === "FULFILLMENT_PROVIDER_RECONCILIATION_REQUIRED" ? 409 :
      error.code === "FULFILLMENT_PROVIDER_NOT_CONFIGURED" ? 503 :
      400;
    return json({ error: { code: error.code, message: error.message } }, status);
  }
  return json({ error: { code: "FULFILLMENT_DIAGNOSTICS_ERROR", message: "Fulfillment diagnostics operation failed." } }, 500);
}

export async function GET(
  request: Request,
  context: { params: Promise<{ fulfillmentId: string }> },
) {
  try {
    await requireAdmin(request,"fulfillment.read");
    const fulfillmentId = (await context.params).fulfillmentId.trim();
    if (!fulfillmentId) return json({ error: { code: "INVALID_REQUEST", message: "Fulfillment ID is required." } }, 400);
    const diagnostics = await getFulfillmentOperationalDiagnostics(fulfillmentId);
    if (!diagnostics) return json({ error: { code: "NOT_FOUND", message: "Fulfillment was not found." } }, 404);
    return json({ diagnostics });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ fulfillmentId: string }> },
) {
  try {
    await requireAdmin(request,"fulfillment.manage");
    assertSameOrigin(request);
    const fulfillmentId = (await context.params).fulfillmentId.trim();
    if (!fulfillmentId) return json({ error: { code: "INVALID_REQUEST", message: "Fulfillment ID is required." } }, 400);

    const result = await fulfillment.reconcileFulfillment({ fulfillmentId });
    return json({ fulfillment: result });
  } catch (error) {
    return errorResponse(error);
  }
}
