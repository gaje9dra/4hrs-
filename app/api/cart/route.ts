import { createCartApplication } from "@/lib/cart/api";
import { cartErrorResponse, cartJson, methodNotAllowed } from "@/lib/cart/http";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const application = createCartApplication();

export async function GET(request: Request) {
  try {
    return cartJson(await application.getCurrentCart(request));
  } catch (error) {
    return cartErrorResponse(error, "getCurrentCart");
  }
}

export async function POST(request: Request) {
  try {
    return cartJson(await application.addItem(request));
  } catch (error) {
    return cartErrorResponse(error, "addCartItem");
  }
}

export async function DELETE(request: Request) {
  try {
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
