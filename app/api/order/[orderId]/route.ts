import { createOrderApplication } from "@/lib/orders/application";
import { orderErrorResponse, orderJson, orderMethodNotAllowed } from "@/lib/orders/http";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const application = createOrderApplication();

export async function GET(request: Request, context: { params: Promise<{ orderId: string }> }) {
  try {
    const { orderId } = await context.params;
    return orderJson({
      order: await application.getCustomerOrder({ request, identifier: orderId }),
    });
  } catch (error) {
    return orderErrorResponse(error, "get");
  }
}

export async function POST() { return orderMethodNotAllowed(["GET"]); }
export async function PUT() { return orderMethodNotAllowed(["GET"]); }
export async function PATCH() { return orderMethodNotAllowed(["GET"]); }
export async function DELETE() { return orderMethodNotAllowed(["GET"]); }
