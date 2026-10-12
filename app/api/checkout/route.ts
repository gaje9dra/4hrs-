import { createCheckoutApplication } from "@/lib/checkout/api";
import { checkoutErrorResponse, checkoutJson, methodNotAllowed } from "@/lib/checkout/http";

export const dynamic = "force-dynamic";
export const revalidate = 0;
const application = createCheckoutApplication();

function withCheckoutTiming(response: Response, startedAt: number, method: "GET" | "POST"): Response {
  const durationMs = Date.now() - startedAt;
  const headers = new Headers(response.headers);
  headers.set("Server-Timing", `checkout;dur=${durationMs}`);
  headers.set("X-Checkout-Duration-Ms", String(durationMs));
  if (process.env.NODE_ENV !== "test") {
    const event = { scope: "checkout", operation: method.toLowerCase(), durationMs, status: response.status };
    if (durationMs >= 1000) console.warn("[checkout.request.slow]", event);
    else console.info("[checkout.request]", event);
  }
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

export async function POST(request: Request) {
  const startedAt = Date.now();
  try {
    const input = await application.readRequest(request);
    return withCheckoutTiming(checkoutJson(await application.validate(request, input)), startedAt, "POST");
  } catch (error) {
    return withCheckoutTiming(checkoutErrorResponse(error, "validate"), startedAt, "POST");
  }
}

export async function GET(request: Request) {
  const startedAt = Date.now();
  try {
    return withCheckoutTiming(checkoutJson(await application.validate(request, {})), startedAt, "GET");
  } catch (error) {
    return withCheckoutTiming(checkoutErrorResponse(error, "validate"), startedAt, "GET");
  }
}

export async function PUT() { return methodNotAllowed(["GET", "POST"]); }
export async function PATCH() { return methodNotAllowed(["GET", "POST"]); }
export async function DELETE() { return methodNotAllowed(["GET", "POST"]); }
