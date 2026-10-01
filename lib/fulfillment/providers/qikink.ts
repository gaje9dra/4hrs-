import type {
  FulfillmentProviderAdapter,
  FulfillmentProviderErrorCode,
  FulfillmentProviderRequest,
  FulfillmentProviderResponse,
} from "@/lib/fulfillment/provider";

const QIKINK_ID = "qikink";
const QIKINK_CREATE_ORDER_URL = "https://qikink.com/erp2/index.php/api/createOrder";
const QIKINK_ORDER_NUMBER_PREFIX = "4H";
const QIKINK_ORDER_NUMBER_LENGTH = 15;

type FetchLike = typeof fetch;

type QikinkResponse = Readonly<{
  code?: unknown;
  order_id?: unknown;
  msg?: unknown;
  message?: unknown;
}>;

class QikinkProviderError extends Error {
  constructor(
    public readonly category: FulfillmentProviderErrorCode,
    message: string,
    public readonly retryable = false,
  ) {
    super(message);
    this.name = "QikinkProviderError";
  }
}

function getAuthToken(): string {
  return process.env.QIKINK_AUTH_TOKEN?.trim() ?? "";
}

function providerOrderNumber(fulfillmentId: string): string {
  const compact = fulfillmentId.replaceAll("-", "").toUpperCase();
  return `${QIKINK_ORDER_NUMBER_PREFIX}${compact.slice(-QIKINK_ORDER_NUMBER_LENGTH + QIKINK_ORDER_NUMBER_PREFIX.length)}`;
}

function splitName(name: string): { first_name: string; last_name: string } {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return {
    first_name: (parts.shift() ?? "Customer").slice(0, 20),
    last_name: parts.join(" ").slice(0, 20),
  };
}

function assertValidRequest(request: FulfillmentProviderRequest): void {
  if (request.shippingAddress.countryCode !== "IN") {
    throw new QikinkProviderError("PROVIDER_VALIDATION", "Qikink currently requires an Indian shipping country code.");
  }
  if (!request.shippingAddress.email.trim()) {
    throw new QikinkProviderError("PROVIDER_VALIDATION", "Qikink requires a customer email address.");
  }
  if (!request.items.length) {
    throw new QikinkProviderError("PROVIDER_VALIDATION", "Qikink requires at least one line item.");
  }
  for (const item of request.items) {
    if (!item.sku.trim()) {
      throw new QikinkProviderError("PROVIDER_VALIDATION", "Every fulfillment item requires a Qikink SKU.");
    }
    if (!Number.isSafeInteger(item.quantity) || item.quantity < 1) {
      throw new QikinkProviderError("PROVIDER_VALIDATION", "Every fulfillment item requires a positive quantity.");
    }
  }
}

function toPayload(request: FulfillmentProviderRequest, authToken: string): Record<string, unknown> {
  const name = splitName(request.shippingAddress.recipientName);
  return {
    auth_token: authToken,
    order_number: providerOrderNumber(request.fulfillmentId),
    qikink_shipping: 1,
    gateway: "online",
    total_order_value: request.orderTotal,
    line_items: request.items.map((item) => ({
      search_from_my_products: 1,
      price: item.unitPrice,
      quantity: String(item.quantity),
      sku: item.sku,
    })),
    shipping_address: {
      first_name: name.first_name,
      last_name: name.last_name,
      address1: request.shippingAddress.addressLine1.slice(0, 80),
      address2: (request.shippingAddress.addressLine2 ?? "").slice(0, 20),
      phone: request.shippingAddress.phone ?? "",
      email: request.shippingAddress.email.slice(0, 40),
      city: request.shippingAddress.city.slice(0, 40),
      zip: request.shippingAddress.postalCode,
      province: request.shippingAddress.stateOrProvince.slice(0, 40),
      country_code: request.shippingAddress.countryCode,
    },
  };
}

function parseResponse(value: unknown): QikinkResponse {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new QikinkProviderError("PROVIDER_INVALID_RESPONSE", "Qikink returned an invalid response.");
  }
  return value as QikinkResponse;
}

function referenceFromResponse(response: QikinkResponse): string | null {
  if (typeof response.order_id === "string" && response.order_id.trim()) return response.order_id.trim();
  if (typeof response.order_id === "number" && Number.isSafeInteger(response.order_id)) return String(response.order_id);
  return null;
}

function isSuccess(response: QikinkResponse): boolean {
  const code = response.code;
  return code === 1 || code === "1";
}

function safeProviderMessage(response: QikinkResponse): string {
  return typeof response.msg === "string" && response.msg.trim()
    ? response.msg.trim().slice(0, 200)
    : typeof response.message === "string" && response.message.trim()
      ? response.message.trim().slice(0, 200)
      : "Qikink rejected the fulfillment request.";
}

function classifyHttpStatus(status: number): FulfillmentProviderErrorCode {
  if (status === 401) return "PROVIDER_AUTHENTICATION";
  if (status === 403) return "PROVIDER_AUTHORIZATION";
  if (status === 404) return "PROVIDER_NOT_FOUND";
  if (status === 429) return "PROVIDER_RATE_LIMITED";
  if (status >= 400 && status < 500) return "PROVIDER_VALIDATION";
  if (status >= 500) return "PROVIDER_NETWORK_ERROR";
  return "PROVIDER_UNKNOWN_ERROR";
}

function classifyError(error: unknown): FulfillmentProviderErrorCode {
  if (error instanceof QikinkProviderError) return error.category;
  if (error instanceof DOMException && error.name === "AbortError") return "PROVIDER_TIMEOUT";
  if (error instanceof TypeError) return "PROVIDER_NETWORK_ERROR";
  return "PROVIDER_UNKNOWN_ERROR";
}

export function createQikinkFulfillmentProvider(options: {
  authToken?: string;
  timeoutMs?: number;
  fetchImpl?: FetchLike;
} = {}): FulfillmentProviderAdapter {
  const fetchImpl = options.fetchImpl ?? fetch;
  const timeoutMs = options.timeoutMs ?? Number(process.env.FULFILLMENT_PROVIDER_TIMEOUT_MS ?? 10000);
  const token = options.authToken ?? getAuthToken();

  return {
    id: QIKINK_ID,
    capabilities: {
      createFulfillment: true,
      statusLookup: false,
    },

    validateConfiguration() {
      if (!token) throw new Error("QIKINK_AUTH_TOKEN is not configured.");
      if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1000 || timeoutMs > 120000) {
        throw new Error("Qikink timeout configuration is invalid.");
      }
    },

    async createFulfillment(request) {
      this.validateConfiguration();
      assertValidRequest(request);

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const response = await fetchImpl(QIKINK_CREATE_ORDER_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(toPayload(request, token)),
          signal: controller.signal,
        });

        let body: unknown;
        try {
          body = await response.json();
        } catch {
          throw new QikinkProviderError("PROVIDER_INVALID_RESPONSE", "Qikink returned a malformed response.");
        }

        const parsed = parseResponse(body);
        if (!response.ok) {
          throw new QikinkProviderError(classifyHttpStatus(response.status), "Qikink rejected the fulfillment request.", response.status >= 500 || response.status === 429);
        }
        if (!isSuccess(parsed)) {
          throw new QikinkProviderError("PROVIDER_REJECTED", safeProviderMessage(parsed));
        }

        const providerReference = referenceFromResponse(parsed);
        if (!providerReference) {
          throw new QikinkProviderError("PROVIDER_INVALID_RESPONSE", "Qikink accepted the request without returning an order reference.");
        }

        return {
          providerId: QIKINK_ID,
          providerFulfillmentReference: providerReference,
          status: "SUBMITTED",
        } satisfies FulfillmentProviderResponse;
      } catch (error) {
        if (error instanceof QikinkProviderError) throw error;
        const code = classifyError(error);
        throw new QikinkProviderError(code, code === "PROVIDER_TIMEOUT"
          ? "Qikink request timed out and the outcome is ambiguous."
          : "Qikink request could not be completed.");
      } finally {
        clearTimeout(timer);
      }
    },

    async retrieveFulfillmentStatus() {
      throw new QikinkProviderError(
        "PROVIDER_UNSUPPORTED",
        "Qikink status lookup is not enabled because the documented API contract used by this adapter does not expose a verified status endpoint.",
      );
    },

    normalizeStatus(input) {
      if (typeof input !== "string") return "PENDING";
      const status = input.trim().toLowerCase();
      if (status === "delivered") return "COMPLETED";
      if ([
        "on hold",
        "live oos",
        "live",
        "to be printed",
        "partially picklisted",
        "printed",
        "manifested",
        "in-transit",
        "in transit",
        "exception",
        "action required",
      ].includes(status)) return "SUBMITTED";
      if (["rto initiated", "returned", "cancelled", "canceled"].includes(status)) return "FAILED";
      return "PENDING";
    },

    normalizeError(error) {
      return classifyError(error);
    },
  };
}

export const qikinkFulfillmentProvider = createQikinkFulfillmentProvider();
export { providerOrderNumber };
