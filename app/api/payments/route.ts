import { createCheckoutApplication } from "@/lib/checkout/api";
import type { CheckoutRequest } from "@/lib/checkout/contracts";
import { createPaymentApplication } from "@/lib/payments/application";
import { paymentErrorResponse, paymentJson, paymentMethodNotAllowed } from "@/lib/payments/http";
import { PaymentError } from "@/lib/payments/errors";
import { reserveCouponForCheckout, CouponRedemptionError } from "@/lib/coupons/redemptions";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const checkoutApplication = createCheckoutApplication();
const paymentApplication = createPaymentApplication();

function idempotencyKey(request: Request): string {
  const value = request.headers.get("idempotency-key")?.trim() ?? "";
  if (!/^[A-Za-z0-9._~-]{16,128}$/.test(value)) {
    throw new PaymentError("INVALID_PAYMENT_REQUEST", "A valid Idempotency-Key header is required.");
  }
  return value;
}

export async function POST(request: Request) {
  try {
    const key = idempotencyKey(request);
    const checkoutRequest = await checkoutApplication.readRequest(request) as CheckoutRequest;
    const checkout = await checkoutApplication.validate(request, checkoutRequest);

    if (!checkout.payment.ready || !checkout.payment.checkoutReference || !checkout.customer || !checkout.totals.currency) {
      throw new PaymentError("CHECKOUT_NOT_PAYABLE", "Checkout must be valid and have a delivery address before payment can start.");
    }

    if (checkout.coupon && checkoutRequest.couponCode) {
      try {
        await reserveCouponForCheckout({
          customerId: checkout.customer.id,
          checkoutReference: checkout.payment.checkoutReference,
          code: checkout.coupon.code,
          eligibleSubtotal: checkout.totals.merchandiseSubtotal,
          currency: checkout.totals.currency,
        });
      } catch (error) {
        if (error instanceof CouponRedemptionError) throw new PaymentError("CHECKOUT_NOT_PAYABLE", error.message);
        throw error;
      }
    }

    const payment = await paymentApplication.createPaymentFromCheckout({
      checkout: {
        customerId: checkout.customer.id,
        checkoutReference: checkout.payment.checkoutReference,
        amount: { value: checkout.totals.total, currency: checkout.totals.currency },
      },
      idempotencyKey: key,
    });

    if (payment.status === "SUCCEEDED") return paymentJson(payment);

    const started = await paymentApplication.startProviderPayment(payment.id, checkout.customer.id, checkoutRequest.paymentMethod);
    return paymentJson(started);
  } catch (error) {
    return paymentErrorResponse(error);
  }
}

export async function GET() { return paymentMethodNotAllowed(["POST"]); }
export async function PUT() { return paymentMethodNotAllowed(["POST"]); }
export async function PATCH() { return paymentMethodNotAllowed(["POST"]); }
export async function DELETE() { return paymentMethodNotAllowed(["POST"]); }
