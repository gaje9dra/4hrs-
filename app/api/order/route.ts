import { assertSameOrigin } from "@/lib/auth/http";
import { createOrderApplication } from "@/lib/orders/application";
import { createFulfillmentApplication } from "@/lib/fulfillment/application";
import { loadFulfillmentProviderConfiguration } from "@/lib/fulfillment/config";
import { OrderDomainError } from "@/lib/orders/errors";
import { orderErrorResponse, orderJson, orderMethodNotAllowed } from "@/lib/orders/http";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const application = createOrderApplication();
const fulfillmentApplication = createFulfillmentApplication();
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
  if (new TextEncoder().encode(body).byteLength > MAX_BODY_BYTES) {
    throw new OrderDomainError("ORDER_INVALID_REQUEST", "Order request is too large.");
  }

  let parsed: unknown;
  try {
    parsed = body.trim() ? JSON.parse(body) : null;
  } catch {
    throw new OrderDomainError("ORDER_INVALID_REQUEST", "Order request must contain valid JSON.");
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new OrderDomainError("ORDER_INVALID_REQUEST", "Order request must be a JSON object.");
  }

  const value = parsed as Record<string, unknown>;
  if (Object.keys(value).some((key) => key !== "paymentId")) {
    throw new OrderDomainError("ORDER_INVALID_REQUEST", "Order request contains unsupported fields.");
  }
  const paymentId = typeof value.paymentId === "string" ? value.paymentId.trim() : "";
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(paymentId)) {
    throw new OrderDomainError("ORDER_INVALID_REQUEST", "Payment identifier is invalid.");
  }
  return { paymentId };
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const input = await readCreateRequest(request);
    const result = await application.createOrderFromVerifiedPayment({ paymentId: input.paymentId, request });

    // Payment success creates the Order first. Once the Order is confirmed,
    // fulfillment is a separate provider-neutral step. It is deliberately
    // best-effort here: a provider failure must not roll back a paid Order.
    const providerConfiguration = loadFulfillmentProviderConfiguration();
    let fulfillment: { id: string; status: string } | null = null;
    if (providerConfiguration?.enabled) {
      try {
        await application.transitionOrderLifecycle({
          orderId: result.id,
          expectedStatus: "PENDING",
          nextStatus: "CONFIRMED",
        });
      } catch (error) {
        if (!(error instanceof Error) || !/current state|terminal|concurrently/i.test(error.message)) throw error;
      }

      try {
        const created = await fulfillmentApplication.createFulfillment({
          orderId: result.id,
          idempotencyKey: `order-${result.id}-fulfillment`,
        });
        const submitted = await fulfillmentApplication.submitFulfillment({ fulfillmentId: created.id });
        fulfillment = { id: submitted.id, status: submitted.status };
      } catch (error) {
        // The Order remains authoritative. The fulfillment service persists
        // retryable/ambiguous provider failures independently of payment/order state.
        console.error("Order fulfillment submission failed.", {
          orderId: result.id,
          error: error instanceof Error ? error.message : "unknown_error",
        });
      }
    } else if (result.status === "PENDING") {
      try {
        await application.transitionOrderLifecycle({
          orderId: result.id,
          expectedStatus: "PENDING",
          nextStatus: "CONFIRMED",
        });
      } catch (error) {
        if (!(error instanceof Error) || !/current state|terminal|concurrently/i.test(error.message)) throw error;
      }
    }

    return orderJson({
      order: {
        id: result.id,
        orderNumber: result.orderNumber,
        status: "CONFIRMED",
        total: result.total,
        currency: result.currency,
        createdAt: result.createdAt,
      },
      fulfillment,
    }, 201);
  } catch (error) {
    return orderErrorResponse(error, "create");
  }
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const pageRaw = url.searchParams.get("page");
    const pageSizeRaw = url.searchParams.get("pageSize");
    const allowed = new Set(["page", "pageSize"]);
    for (const key of url.searchParams.keys()) {
      if (!allowed.has(key)) throw new OrderDomainError("ORDER_INVALID_REQUEST", "Unsupported Order list parameter.");
    }
    const page = pageRaw === null ? undefined : Number(pageRaw);
    const pageSize = pageSizeRaw === null ? undefined : Number(pageSizeRaw);
    if ((pageRaw !== null && !/^\d+$/.test(pageRaw)) || (pageSizeRaw !== null && !/^\d+$/.test(pageSizeRaw))) {
      throw new OrderDomainError("ORDER_INVALID_REQUEST", "Order pagination parameters are invalid.");
    }
    return orderJson(await application.listCustomerOrders({ request, page, pageSize }));
  } catch (error) {
    return orderErrorResponse(error, "list");
  }
}

export async function PUT() { return orderMethodNotAllowed(["GET", "POST"]); }
export async function PATCH() { return orderMethodNotAllowed(["GET", "POST"]); }
export async function DELETE() { return orderMethodNotAllowed(["GET", "POST"]); }
