import { cookies } from "next/headers";
import { db } from "@/lib/db/client";
import { CUSTOMER_SESSION_COOKIE, hashSessionToken } from "@/lib/auth/session";
import { createPaymentApplication } from "@/lib/payments/application";
import { paymentErrorResponse, paymentJson } from "@/lib/payments/http";
import { PaymentError } from "@/lib/payments/errors";
import { releaseCouponReservation } from "@/lib/coupons/redemptions";

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
    if (!session) throw new PaymentError("UNAUTHENTICATED", "Authentication is required.");
    const storedPayment = await db.payment.findFirst({ where: { id: paymentId, customerId: session.customerId }, select: { checkoutReference: true, status: true } });
    if (!storedPayment) throw new PaymentError("PAYMENT_NOT_FOUND", "Payment could not be found.");
    const reservation = await db.couponRedemption.findUnique({ where: { checkoutReference: storedPayment.checkoutReference } });
    if (reservation) {
      if (reservation.customerId !== session.customerId || reservation.status !== "RESERVED") {
        throw new PaymentError("PAYMENT_ALREADY_TERMINAL", "The coupon reservation is no longer available. Return to checkout to start a new payment.");
      }
      if (reservation.reservationExpiresAt && reservation.reservationExpiresAt <= new Date() && ["FAILED", "CANCELLED", "EXPIRED"].includes(storedPayment.status)) {
        await releaseCouponReservation({ checkoutReference: storedPayment.checkoutReference, customerId: session.customerId });
        throw new PaymentError("PAYMENT_ALREADY_TERMINAL", "The coupon reservation expired. Return to checkout to revalidate the coupon.");
      }
    }
    const payment = await application.startProviderPayment(paymentId, session.customerId);
    return paymentJson(payment);
  } catch (error) {
    return paymentErrorResponse(error);
  }
}
