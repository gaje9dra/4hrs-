import { NextResponse } from "next/server";
import {
  parsePayUChargebackPayload,
  processPayUChargebackEvent,
  PayUChargebackConflictError,
  PayUChargebackInputError,
  PayUChargebackNotFoundError,
  verifyPayUChargebackSignature,
} from "@/lib/payments/payu-chargebacks";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(contentLength) && contentLength > 64 * 1024) {
    return NextResponse.json({ error: { code: "PAYLOAD_TOO_LARGE", message: "Chargeback webhook payload is too large." } }, { status: 413 });
  }
  const body = await request.text();
  if (body.length > 64 * 1024) {
    return NextResponse.json({ error: { code: "PAYLOAD_TOO_LARGE", message: "Chargeback webhook payload is too large." } }, { status: 413 });
  }

  const merchantKey = process.env.PAYU_MERCHANT_KEY?.trim() ?? "";
  const merchantSalt = process.env.PAYU_MERCHANT_SALT?.trim() ?? "";
  const merchantId = process.env.PAYU_MERCHANT_ID?.trim() ?? "";
  if (!merchantKey || !merchantSalt || !merchantId) {
    return NextResponse.json({ error: { code: "WEBHOOK_NOT_CONFIGURED", message: "Signed PayU chargeback webhook configuration is incomplete." } }, { status: 503 });
  }

  let payload;
  try {
    payload = parsePayUChargebackPayload(JSON.parse(body) as unknown);
  } catch {
    return NextResponse.json({ error: { code: "INVALID_WEBHOOK", message: "PayU chargeback payload is invalid." } }, { status: 400 });
  }

  if (payload.mid !== merchantId) {
    return NextResponse.json({ error: { code: "WEBHOOK_VERIFICATION_FAILED", message: "PayU merchant identity could not be verified." } }, { status: 401 });
  }
  const algorithm = request.headers.get("x-payu-dispute-webhook-signature-algorithm")?.trim().toUpperCase();
  const signature = request.headers.get("x-payu-dispute-webhook-signature-v2");
  if (algorithm !== "SHA512" || !verifyPayUChargebackSignature(payload, signature, merchantKey, merchantSalt)) {
    return NextResponse.json({ error: { code: "WEBHOOK_VERIFICATION_FAILED", message: "PayU chargeback signature could not be verified." } }, { status: 401 });
  }

  try {
    const result = await processPayUChargebackEvent(payload);
    return NextResponse.json({ received: true, duplicate: result.duplicate, disputeId: result.disputeId, status: result.status }, { status: 200 });
  } catch (error) {
    if (error instanceof PayUChargebackInputError) {
      return NextResponse.json({ error: { code: "INVALID_WEBHOOK", message: error.message } }, { status: 422 });
    }
    if (error instanceof PayUChargebackNotFoundError) {
      return NextResponse.json({ error: { code: "PAYMENT_NOT_FOUND", message: "PayU chargeback references an unknown payment." } }, { status: 404 });
    }
    if (error instanceof PayUChargebackConflictError) {
      return NextResponse.json({ error: { code: "DISPUTE_CONFLICT", message: "PayU chargeback identity conflicts with a previously recorded dispute." } }, { status: 409 });
    }
    // Transient database failures must remain non-2xx so PayU retries delivery.
    return NextResponse.json({ error: { code: "WEBHOOK_PROCESSING_FAILED", message: "PayU chargeback could not be processed; retry delivery." } }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ error: { code: "METHOD_NOT_ALLOWED", message: "PayU chargeback webhook must use POST." } }, { status: 405 });
}
