import { requireCurrentCustomer } from "@/lib/auth/context";
import { createInMemoryAuthenticationRateLimiter } from "@/lib/auth/rate-limit";
import { createShippingApplication } from "@/lib/shipping/application";
import { trackingErrorResponse, trackingJson, trackingMethodNotAllowed } from "@/lib/shipping/tracking-http";
import { logCustomerTrackingRequest } from "@/lib/shipping/customer-tracking-observability";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const application = createShippingApplication();
const limiter = createInMemoryAuthenticationRateLimiter();

export async function GET(
  request: Request,
  context: { params: Promise<{ shipmentReference: string }> },
) {
  const startedAt = Date.now();

  try {
    const customer = await requireCurrentCustomer(request);
    const decision = limiter.consume(`shipping-tracking:${customer.customer.id}`, 60, 60_000);
    if (!decision.allowed) {
      logCustomerTrackingRequest({ result: "failure", durationMs: Date.now() - startedAt });
      return trackingJson(
        { error: { code: "RATE_LIMITED", message: "Too many tracking requests. Please try again later." } },
        { status: 429, headers: { "retry-after": String(decision.retryAfterSeconds) } },
      );
    }

    const { shipmentReference } = await context.params;
    const data = await application.getCustomerShipmentByReference({
      shipmentReference,
      customerId: customer.customer.id,
    });

    if (!data) {
      logCustomerTrackingRequest({ result: "not-found", durationMs: Date.now() - startedAt });
      return trackingJson(
        { error: { code: "TRACKING_NOT_FOUND", message: "Tracking information could not be found." } },
        { status: 404 },
      );
    }

    logCustomerTrackingRequest({ result: "success", durationMs: Date.now() - startedAt });
    return trackingJson({ shipment: data });
  } catch (error) {
    logCustomerTrackingRequest({
      result: error instanceof Error && "code" in error ? "unauthorized" : "failure",
      durationMs: Date.now() - startedAt,
    });
    return trackingErrorResponse(error);
  }
}

export async function POST() { return trackingMethodNotAllowed(); }
export async function PUT() { return trackingMethodNotAllowed(); }
export async function PATCH() { return trackingMethodNotAllowed(); }
export async function DELETE() { return trackingMethodNotAllowed(); }
