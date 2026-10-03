import { assertSameOrigin } from "@/lib/auth/http";
import { createOrderApplication } from "@/lib/orders/application";
import { createFulfillmentApplication } from "@/lib/fulfillment/application";
import { loadFulfillmentProviderConfiguration } from "@/lib/fulfillment/config";
import { OrderDomainError } from "@/lib/orders/errors";
import { orderErrorResponse, orderJson, orderMethodNotAllowed } from "@/lib/orders/http";
import { createShippingApplication } from "@/lib/shipping/application";
import { logShippingObservation } from "@/lib/shipping/observability";
import { ApiContractError, parsePositivePagination } from "@/lib/api/governance";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const application = createOrderApplication();
const fulfillmentApplication = createFulfillmentApplication();
const shippingApplication = createShippingApplication();
const MAX_BODY_BYTES = 16 * 1024;

async function readCreateRequest(request: Request): Promise<{ paymentId: string }> {
  const contentLength = request.headers.get("content-length");
  if (contentLength !== null) {
    const length = Number(contentLength);
    if (!Number.isSafeInteger(length) || length < 0 || length > MAX_BODY_BYTES) {
      throw new OrderDomainError("ORDER_INVALID_REQUEST", "Order request is invalid.");
    }
  }
  const body = await request.text();
  if (new TextEncoder().encode(body).byteLength > MAX_BODY_BYTES) throw new OrderDomainError("ORDER_INVALID_REQUEST", "Order request is too large.");
  let parsed: unknown;
  try { parsed = body.trim() ? JSON.parse(body) : null; } catch { throw new OrderDomainError("ORDER_INVALID_REQUEST", "Order request must contain valid JSON."); }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new OrderDomainError("ORDER_INVALID_REQUEST", "Order request must be a JSON object.");
  const value = parsed as Record<string, unknown>;
  if (Object.keys(value).some((key) => key !== "paymentId")) throw new OrderDomainError("ORDER_INVALID_REQUEST", "Order request contains unsupported fields.");
  const paymentId = typeof value.paymentId === "string" ? value.paymentId.trim() : "";
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(paymentId)) throw new OrderDomainError("ORDER_INVALID_REQUEST", "Payment identifier is invalid.");
  return { paymentId };
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const input = await readCreateRequest(request);
    const result = await application.createOrderFromVerifiedPayment({ paymentId: input.paymentId, request });
    const providerConfiguration = loadFulfillmentProviderConfiguration();
    let fulfillment: { id: string; status: string } | null = null;
    if (providerConfiguration?.enabled) {
      if (result.status === "PENDING") await application.transitionOrderLifecycle({ orderId: result.id, expectedStatus: "PENDING", nextStatus: "CONFIRMED" });
      try {
        const created = await fulfillmentApplication.createFulfillment({ orderId: result.id, idempotencyKey: `order-${result.id}-fulfillment` });
        const submitted = await fulfillmentApplication.submitFulfillment({ fulfillmentId: created.id });
        fulfillment = { id: submitted.id, status: submitted.status };
        try {
          const shipment = await shippingApplication.createShipmentFromFulfillment({ orderId: result.id, fulfillmentId: submitted.id, idempotencyKey: `fulfillment-${submitted.id}-shipment` });
          logShippingObservation({ operation: "handoff", shipmentId: shipment?.id, fulfillmentId: submitted.id, orderId: result.id, providerId: submitted.provider, result: "success" });
        } catch {
          logShippingObservation({ operation: "handoff", fulfillmentId: submitted.id, orderId: result.id, providerId: submitted.provider, result: "reconciliation-required", errorCode: "SHIPMENT_RECONCILIATION_REQUIRED" });
        }
      } catch {}
    } else if (result.status === "PENDING") {
      await application.transitionOrderLifecycle({ orderId: result.id, expectedStatus: "PENDING", nextStatus: "CONFIRMED" });
    }
    return orderJson({ order: { id: result.id, orderNumber: result.orderNumber, status: "CONFIRMED", total: result.total, currency: result.currency, createdAt: result.createdAt }, fulfillment }, 201);
  } catch (error) {
    return orderErrorResponse(error, "create");
  }
}

export async function GET(request: Request) {
  try {
    let page: number | undefined;\n    let pageSize: number | undefined;\n    try { ({ page, pageSize } = parsePositivePagination(request)); } catch (error) {\n      if (error instanceof ApiContractError) throw new OrderDomainError("ORDER_INVALID_REQUEST", error.message);\n      throw error;\n    }
    return orderJson(await application.listCustomerOrders({ request, page, pageSize }));
  } catch (error) {
    return orderErrorResponse(error, "list");
  }
}

export async function PUT() { return orderMethodNotAllowed(["GET", "POST"]); }
export async function PATCH() { return orderMethodNotAllowed(["GET", "POST"]); }
export async function DELETE() { return orderMethodNotAllowed(["GET", "POST"]); }
