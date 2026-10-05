import { createHmac, timingSafeEqual } from "node:crypto";
import type {
  NormalizedPaymentEvent,
  PaymentProviderAdapter,
  PaymentProviderResult,
  PaymentProviderWebhook,
} from "@/lib/payments/provider";
import type { PaymentAmount, PaymentStatus } from "@/lib/payments/domain";

const ID = "controlled-sandbox";
const SECRET_ENV = "PAYMENT_SANDBOX_WEBHOOK_SECRET";
const MAX_SKEW_SECONDS = 300;

function secret(): string {
  const value = process.env[SECRET_ENV]?.trim() ?? "";
  if (!value) throw new Error("Controlled sandbox webhook secret is not configured.");
  return value;
}

function signature(body: string, timestamp: string): string {
  return createHmac("sha256", secret()).update(`${timestamp}.${body}`).digest("hex");
}

function safeEqual(expected: string, supplied: string): boolean {
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(supplied, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}

function result(status: PaymentStatus, paymentReference: string, attemptReference: string, providerPaymentReference: string): PaymentProviderResult {
  return {
    providerId: ID,
    providerPaymentReference,
    providerAttemptReference: `sandbox-attempt-${attemptReference}`,
    status,
    clientAction: { type: "NONE" },
  };
}

function failureScenario(): string {
  return process.env.PAYMENT_SANDBOX_SCENARIO?.trim().toLowerCase() ?? "";
}

export const controlledSandboxPaymentProvider: PaymentProviderAdapter = {
  id: ID,
  capabilities: {
    createPayment: true,
    clientAction: true,
    webhookVerification: true,
    statusLookup: true,
    cancellation: true,
    refunds: true,
    partialRefunds: true,
  },

  async createPayment(request) {
    const scenario = failureScenario();
    if (scenario === "timeout") throw Object.assign(new Error("sandbox timeout"), { code: "PROVIDER_TIMEOUT" });
    if (scenario === "network") throw Object.assign(new Error("sandbox network failure"), { code: "PROVIDER_NETWORK_ERROR" });
    if (scenario === "decline" || scenario === "rejection") return result("FAILED", request.paymentReference, request.attemptReference, `sandbox-${request.paymentReference}`);
    return result("PROCESSING", request.paymentReference, request.attemptReference, `sandbox-${request.paymentReference}`);
  },

  async retrievePayment(request) {
    const scenario = failureScenario();
    if (scenario === "timeout") throw Object.assign(new Error("sandbox timeout"), { code: "PROVIDER_TIMEOUT" });
    if (scenario === "network") throw Object.assign(new Error("sandbox network failure"), { code: "PROVIDER_NETWORK_ERROR" });
    return result("SUCCEEDED", request.paymentReference, "lookup", request.providerPaymentReference);
  },

  async verifyPayment(request) {
    return this.retrievePayment(request);
  },

  async verifyWebhook({ headers, body }): Promise<PaymentProviderWebhook> {
    if (failureScenario() === "malformed") throw new Error("sandbox malformed callback");
    const timestamp = headers.get("x-sandbox-timestamp")?.trim() ?? "";
    const supplied = headers.get("x-sandbox-signature")?.trim().toLowerCase() ?? "";
    const parsedTimestamp = Number(timestamp);
    if (!/^\d{10,13}$/.test(timestamp)) throw new Error("sandbox timestamp missing");
    const seconds = parsedTimestamp > 1_000_000_000_000 ? Math.floor(parsedTimestamp / 1000) : parsedTimestamp;
    if (Math.abs(Math.floor(Date.now() / 1000) - seconds) > MAX_SKEW_SECONDS) throw new Error("sandbox callback timestamp outside replay window");
    if (!safeEqual(signature(body, timestamp), supplied)) throw new Error("sandbox webhook signature invalid");

    const payload = JSON.parse(body) as Record<string, unknown>;
    const event = payload.event;
    if (!event || typeof event !== "object" || Array.isArray(event)) throw new Error("sandbox event malformed");
    const value = event as Record<string, unknown>;
    if (typeof value.eventId !== "string" || typeof value.paymentReference !== "string" || typeof value.amount !== "string" || typeof value.currency !== "string" || typeof value.status !== "string") {
      throw new Error("sandbox event fields invalid");
    }

    const normalized: NormalizedPaymentEvent = {
      providerId: ID,
      providerEventReference: value.eventId,
      providerPaymentReference: value.paymentReference,
      internalPaymentReference: value.paymentReference.startsWith("sandbox-") ? value.paymentReference.slice("sandbox-".length) : value.paymentReference,
      normalizedEventType: typeof value.eventType === "string" ? value.eventType : `PAYMENT_${value.status}`,
      status: this.normalizeStatus(value.status),
      occurredAt: typeof value.occurredAt === "string" ? value.occurredAt : new Date().toISOString(),
      amount: { value: value.amount, currency: value.currency } satisfies PaymentAmount,
      currency: value.currency,
      metadata: { sandbox: "true" },
    };
    return { verified: true, event: normalized };
  },

  normalizeStatus(input): PaymentStatus {
    switch (String(input).toUpperCase()) {
      case "PROCESSING": return "PROCESSING";
      case "SUCCEEDED": case "SUCCESS": return "SUCCEEDED";
      case "FAILED": case "DECLINED": return "FAILED";
      case "REFUNDED": return "REFUNDED";
      case "PARTIALLY_REFUNDED": return "PARTIALLY_REFUNDED";
      default: throw new Error("sandbox status unsupported");
    }
  },

  normalizeError(error): "PROVIDER_TIMEOUT"|"PROVIDER_NETWORK_ERROR"|"PAYMENT_DECLINED"|"PROVIDER_UNKNOWN_ERROR" {
    const code = error && typeof error === "object" && "code" in error ? String((error as { code: unknown }).code) : "";
    if (code === "PROVIDER_TIMEOUT") return "PROVIDER_TIMEOUT";
    if (code === "PROVIDER_NETWORK_ERROR") return "PROVIDER_NETWORK_ERROR";
    if (code === "PAYMENT_DECLINED") return "PAYMENT_DECLINED";
    return "PROVIDER_UNKNOWN_ERROR";
  },

  async cancelPayment(request) {
    return result("FAILED", request.paymentReference, "cancel", request.providerPaymentReference);
  },

  async refundPayment(request) {
    const scenario = failureScenario();
    if (scenario === "refund-timeout") throw Object.assign(new Error("sandbox refund timeout"), { code: "PROVIDER_TIMEOUT" });
    if (scenario === "refund-rejection") throw Object.assign(new Error("sandbox refund rejected"), { code: "PROVIDER_UNKNOWN_ERROR" });
    return result("REFUNDED", request.paymentReference, "refund", `sandbox-refund-${request.providerPaymentReference}`);
  },
};
