import { assertSameOrigin } from "@/lib/auth/http";
import { createCartApplication } from "@/lib/cart/api";
import { cartErrorResponse, cartJson, methodNotAllowed } from "@/lib/cart/http";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const application = createCartApplication();

type RouteContext = {
  params: Promise<{ cartItemId: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  try {
    assertSameOrigin(request);
    const { cartItemId } = await context.params;
    return cartJson(await application.updateItem(request, cartItemId));
  } catch (error) {
    return cartErrorResponse(error, "updateCartItemQuantity");
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  try {
    assertSameOrigin(request);
    const { cartItemId } = await context.params;
    return cartJson(await application.removeItem(request, cartItemId));
  } catch (error) {
    return cartErrorResponse(error, "removeCartItem");
  }
}

export async function GET() {
  return methodNotAllowed(["PATCH", "DELETE"]);
}

export async function POST() {
  return methodNotAllowed(["PATCH", "DELETE"]);
}
