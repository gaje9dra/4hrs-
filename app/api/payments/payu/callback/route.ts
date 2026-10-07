import { NextResponse } from "next/server";
import { payuPaymentProvider } from "@/lib/payments/providers/payu";
import { createPaymentApplication } from "@/lib/payments/application";
import { createOrderApplication } from "@/lib/orders/application";
import { createPaymentRepository } from "@/lib/payments/repository";
import { PaymentError } from "@/lib/payments/errors";

const application = createPaymentApplication();
const orderApplication = createOrderApplication();
const paymentRepository = createPaymentRepository();

export async function POST(request: Request) {
  const body = await request.text();
  try {
    const webhook = await payuPaymentProvider.verifyWebhook({ headers: request.headers, body });
    let event = webhook.event;

    if (event.status === "SUCCEEDED") {
      const verified = await payuPaymentProvider.verifyPayment({
        providerPaymentReference: event.providerPaymentReference ?? event.internalPaymentReference ?? "",
        paymentReference: event.internalPaymentReference ?? event.providerPaymentReference ?? "",
      });
      if (verified.status !== "SUCCEEDED") throw new PaymentError("WEBHOOK_VERIFICATION_FAILED", "PayU did not confirm the successful payment.");
      if (verified.safeMetadata?.amount && verified.safeMetadata.amount !== event.amount.value) {
        throw new PaymentError("WEBHOOK_VERIFICATION_FAILED", "PayU verification amount does not match the callback.");
      }
      event = { ...event, providerPaymentReference: verified.providerPaymentReference ?? event.providerPaymentReference, status: verified.status, normalizedEventType: "PAYMENT_SUCCEEDED" };
    }

    const result = await application.processNormalizedPaymentEvent(event);

    if (result.payment?.status === "SUCCEEDED") {
      const payment = await paymentRepository.getPaymentByInternalReference(event.internalPaymentReference ?? "");
      if (!payment) throw new PaymentError("PAYMENT_NOT_FOUND", "Payment could not be resolved after verification.");
      await orderApplication.createOrderFromVerifiedPayment({ paymentId: payment.id, customerId: payment.customerId });
    }

    const target = new URL("/checkout", request.url);
    target.searchParams.set("payment", result.payment?.status === "SUCCEEDED" ? "success" : result.payment?.status === "FAILED" ? "failed" : "processing");
    return NextResponse.redirect(target, 303);
  } catch {
    return NextResponse.json({ error: { code: "WEBHOOK_VERIFICATION_FAILED", message: "Payment callback could not be verified." } }, { status: 400 });
  }
}

export async function GET() {
  return NextResponse.json({ error: { code: "METHOD_NOT_ALLOWED", message: "PayU callback must use POST." } }, { status: 405 });
}
