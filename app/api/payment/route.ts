import { resolveCurrentCustomer } from "@/lib/auth/context";
import { AuthenticationError } from "@/lib/auth/errors";
import { createCheckoutApplication } from "@/lib/checkout/api";
import type { CheckoutRequest, CheckoutRevision } from "@/lib/checkout/contracts";
import { createCheckoutPaymentReference } from "@/lib/payments/checkout";
import { createPaymentApplication } from "@/lib/payments/application";
import { PaymentError } from "@/lib/payments/errors";
import { paymentErrorResponse, paymentJson, paymentMethodNotAllowed } from "@/lib/payments/http";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const MAX_BODY_BYTES = 16 * 1024;
const checkoutApplication = createCheckoutApplication();
const paymentApplication = createPaymentApplication();

function parseRevision(value: unknown): CheckoutRevision | undefined {
  if (value === undefined) return undefined;
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new PaymentError("INVALID_PAYMENT_REQUEST", "Checkout revision is invalid.");
  }
  const revision = value as Record<string, unknown>;
  if (
    Object.keys(revision).length !== 3 ||
    !["cart", "pricing", "availability"].every((key) =>
      typeof revision[key] === "string" && /^[0-9a-f]{64}$/i.test(revision[key] as string),
    )
  ) {
    throw new PaymentError("INVALID_PAYMENT_REQUEST", "Checkout revision is invalid.");
  }
  return {
    cart: revision.cart as string,
    pricing: revision.pricing as string,
    availability: revision.availability as string,
  };
}

function parseAddress(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (
    typeof value !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
  ) {
    throw new PaymentError("INVALID_PAYMENT_REQUEST", "Selected address is invalid.");
  }
  return value;
}

async function readCreateRequest(request: Request): Promise<{
  checkoutReference: string;
  checkout: CheckoutRequest;
  idempotencyKey: string;
}> {
  const idempotencyKey = request.headers.get("Idempotency-Key")?.trim() ?? "";
  if (!/^[A-Za-z0-9._~-]{16,128}$/.test(idempotencyKey)) {
    throw new PaymentError("INVALID_PAYMENT_REQUEST", "A valid Idempotency-Key header is required.");
  }

  const contentLength = request.headers.get("content-length");
  if (contentLength !== null) {
    const length = Number(contentLength);
    if (!Number.isSafeInteger(length) || length < 0 || length > MAX_BODY_BYTES) {
      throw new PaymentError("INVALID_PAYMENT_REQUEST", "Payment request is invalid.");
    }
  }
  const body = await request.text();
  if (new TextEncoder().encode(body).byteLength > MAX_BODY_BYTES) {
    throw new PaymentError("INVALID_PAYMENT_REQUEST", "Payment request is too large.");
  }

  let parsed: unknown;
  try {
    parsed = body.trim() ? JSON.parse(body) : null;
  } catch {
    throw new PaymentError("INVALID_PAYMENT_REQUEST", "Payment request must contain valid JSON.");
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new PaymentError("INVALID_PAYMENT_REQUEST", "Payment request must be a JSON object.");
  }

  const value = parsed as Record<string, unknown>;
  const allowed = new Set(["checkoutReference", "selectedAddressId", "expectedRevision"]);
  const unexpected = Object.keys(value).filter((key) => !allowed.has(key));
  if (unexpected.length) {
    throw new PaymentError("INVALID_PAYMENT_REQUEST", "Payment request contains unsupported fields.");
  }

  const checkoutReference = typeof value.checkoutReference === "string" ? value.checkoutReference.trim() : "";
  if (!/^[0-9a-f]{64}$/i.test(checkoutReference)) {
    throw new PaymentError("INVALID_PAYMENT_REQUEST", "Checkout reference is invalid.");
  }

  return {
    checkoutReference,
    checkout: {
      selectedAddressId: parseAddress(value.selectedAddressId),
      expectedRevision: parseRevision(value.expectedRevision),
    },
    idempotencyKey,
  };
}

export async function POST(request: Request) {
  try {
    const customerContext = await resolveCurrentCustomer(request);
    if (!customerContext?.customer) throw new AuthenticationError("SESSION_INVALID", "Authentication is required.");

    const input = await readCreateRequest(request);
    const checkout = await checkoutApplication.validate(request, input.checkout);

    if (!checkout.customer || checkout.customer.id !== customerContext.customer.id) {
      throw new PaymentError("UNAUTHORIZED_CHECKOUT", "Checkout is not owned by the authenticated customer.");
    }

    const expectedReference = createCheckoutPaymentReference(customerContext.customer.id, checkout);
    if (expectedReference !== input.checkoutReference) {
      throw new PaymentError("STALE_CHECKOUT", "Checkout changed; refresh Checkout before continuing.");
    }

    if (!checkout.payment.ready || checkout.payment.checkoutReference !== input.checkoutReference) {
      throw new PaymentError("CHECKOUT_NOT_PAYABLE", "Checkout is not ready for payment.");
    }

    const payment = await paymentApplication.createPaymentFromCheckout({
      checkout: {
        customerId: customerContext.customer.id,
        checkoutReference: input.checkoutReference,
        amount: {
          value: checkout.totals.total,
          currency: checkout.totals.currency ?? "",
        },
      },
      idempotencyKey: input.idempotencyKey,
    });
    return paymentJson({ payment });
  } catch (error) {
    return paymentErrorResponse(error);
  }
}

export async function GET(request: Request) {
  try {
    const customerContext = await resolveCurrentCustomer(request);
    if (!customerContext?.customer) throw new AuthenticationError("SESSION_INVALID", "Authentication is required.");

    const paymentId = new URL(request.url).searchParams.get("paymentId")?.trim() ?? "";
    if (!paymentId) throw new PaymentError("INVALID_PAYMENT_REQUEST", "Payment ID is required.");

    const payment = await paymentApplication.getPayment(paymentId, customerContext.customer.id);
    return paymentJson({ payment });
  } catch (error) {
    return paymentErrorResponse(error);
  }
}

export async function PUT() { return paymentMethodNotAllowed(["GET", "POST"]); }
export async function PATCH() { return paymentMethodNotAllowed(["GET", "POST"]); }
export async function DELETE() { return paymentMethodNotAllowed(["GET", "POST"]); }
