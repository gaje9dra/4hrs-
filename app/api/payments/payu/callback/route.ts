import { NextResponse } from "next/server";
import { payuPaymentProvider } from "@/lib/payments/providers/payu";
import { createPaymentApplication } from "@/lib/payments/application";

const application = createPaymentApplication();

export async function POST(request: Request) {
  const body = await request.text();
  try {
    const webhook = await payuPaymentProvider.verifyWebhook({ headers: request.headers, body });
    const result = await application.processNormalizedPaymentEvent(webhook.event);
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
