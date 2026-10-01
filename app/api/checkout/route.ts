import { createCheckoutApplication } from "@/lib/checkout/api";
import { checkoutErrorResponse, checkoutJson, methodNotAllowed } from "@/lib/checkout/http";

export const dynamic = "force-dynamic";
export const revalidate = 0;
const application = createCheckoutApplication();

export async function POST(request: Request) {
  try {
    const input = await application.readRequest(request);
    return checkoutJson(await application.validate(request, input));
  } catch (error) {
    return checkoutErrorResponse(error, "validate");
  }
}

export async function GET(request: Request) {
  try {
    return checkoutJson(await application.validate(request, {}));
  } catch (error) {
    return checkoutErrorResponse(error, "validate");
  }
}

export async function PUT() { return methodNotAllowed(["GET", "POST"]); }
export async function PATCH() { return methodNotAllowed(["GET", "POST"]); }
export async function DELETE() { return methodNotAllowed(["GET", "POST"]); }
