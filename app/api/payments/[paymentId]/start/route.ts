import { cookies } from "next/headers";
import { db } from "@/lib/db/client";
import { CUSTOMER_SESSION_COOKIE, hashSessionToken } from "@/lib/auth/session";
import { createPaymentApplication } from "@/lib/payments/application";
import { paymentErrorResponse, paymentJson } from "@/lib/payments/http";
import { PaymentError } from "@/lib/payments/errors";

const application = createPaymentApplication();

export async function POST(request: Request, context: { params: Promise<{ paymentId: string }> }) {
  try {
    const { paymentId } = await context.params;
    const token = (await cookies()).get(CUSTOMER_SESSION_COOKIE)?.value;
    if (!token) throw new PaymentError("UNAUTHENTICATED", "Authentication is required.");
    const session = await db.customerSession.findFirst({
      where: { sessionTokenHash: hashSessionToken(token), revokedAt: null, expiresAt: { gt: new Date() } },
      select: { customerId: true },
    });
    if (!session) throw new PaymentError("SESSION_INVALID", "Authentication is required.");
    const payment = await application.startProviderPayment(paymentId, session.customerId);
    return paymentJson(payment);
  } catch (error) {
    return paymentErrorResponse(error);
  }
}
