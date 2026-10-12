import { assertSameOrigin } from "@/lib/auth/http";
import { createCartApplication } from "@/lib/cart/api";
import { cartErrorResponse, cartJson, methodNotAllowed } from "@/lib/cart/http";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const application = createCartApplication();

function withCartTiming(response: Response, startedAt: number): Response {
  const durationMs = Date.now() - startedAt;
  const headers = new Headers(response.headers);
  headers.set("Server-Timing", `cart;dur=${durationMs}`);
  headers.set("X-Cart-Duration-Ms", String(durationMs));
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

export async function GET(request: Request) {
  const startedAt = Date.now();
  try {
    const response = withCartTiming(cartJson(await application.getCurrentCart(request)), startedAt);
    console.info("[cart] request completed", {
      operation: "getCurrentCartHttp",
      durationMs: Date.now() - startedAt,
      status: response.status,
    });
    return response;
  } catch (error) {
    const response = withCartTiming(cartErrorResponse(error, "getCurrentCart"), startedAt);
    console.warn("[cart] request failed", {
      operation: "getCurrentCartHttp",
      durationMs: Date.now() - startedAt,
      status: response.status,
    });
    return response;
  }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    return cartJson(await application.addItem(request));
  } catch (error) {
    return cartErrorResponse(error, "addCartItem");
  }
}

export async function DELETE(request: Request) {
  try {
    assertSameOrigin(request);
    return cartJson(await application.clearCart(request));
  } catch (error) {
    return cartErrorResponse(error, "clearCart");
  }
}

export async function PUT() {
  return methodNotAllowed(["GET", "POST", "DELETE"]);
}

export async function PATCH() {
  return methodNotAllowed(["GET", "POST", "DELETE"]);
}
