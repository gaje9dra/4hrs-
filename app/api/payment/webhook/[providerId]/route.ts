import { createPaymentApplication } from "@/lib/payments/application";
import { paymentErrorResponse, paymentJson, paymentMethodNotAllowed } from "@/lib/payments/http";
import { createPaymentProviderResolver } from "@/lib/payments/resolver";
import { getPaymentProviderRegistry } from "@/lib/payments/registry";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const registry = getPaymentProviderRegistry();
const resolver = createPaymentProviderResolver({ registry });
const paymentApplication = createPaymentApplication({ providerResolver: resolver });

const MAX_WEBHOOK_BYTES = 256 * 1024;

export async function POST(
  request: Request,
  context: { params: Promise<{ providerId: string }> },
) {
  try {
    const { providerId } = await context.params;
    if (!/^[a-z0-9][a-z0-9._-]{0,63}$/.test(providerId)) {
      return paymentErrorResponse(new Error("Invalid provider."));
    }

    const body = await request.text();
    if (new TextEncoder().encode(body).byteLength > MAX_WEBHOOK_BYTES) {
      return paymentErrorResponse(new Error("Webhook payload is too large."));
    }

    const adapter = resolver.resolve({
      customerId: "",
      checkoutReference: "",
      currency: "",
      providerId,
    });
    if (!adapter) {
      return paymentErrorResponse(new Error("Payment provider is unavailable."));
    }
    if (!adapter.capabilities.webhookVerification) {
      return paymentErrorResponse(new Error("Webhook verification is unavailable."));
    }

    const verified = await adapter.verifyWebhook({ headers: request.headers, body });
    if (!verified.verified) {
      return paymentErrorResponse(new Error("Webhook verification failed."));
    }

    const result = await paymentApplication.processNormalizedPaymentEvent(verified.event);
    return paymentJson({ received: true, duplicate: result.duplicate });
  } catch {
    return paymentErrorResponse(new Error("Webhook could not be processed."));
  }
}

export async function GET() {
  return paymentMethodNotAllowed(["POST"]);
}
export async function PUT() {
  return paymentMethodNotAllowed(["POST"]);
}
export async function PATCH() {
  return paymentMethodNotAllowed(["POST"]);
}
export async function DELETE() {
  return paymentMethodNotAllowed(["POST"]);
}
