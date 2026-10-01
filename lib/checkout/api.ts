import { AuthenticationError } from "@/lib/auth/errors";
import { resolveCurrentCustomer } from "@/lib/auth/context";
import { createCartApplication } from "@/lib/cart/api";
import { createCustomerAddressService } from "@/lib/customer/address-service";
import { CheckoutError } from "@/lib/checkout/errors";
import type { CheckoutApplicationDependencies, CheckoutRequest } from "@/lib/checkout/contracts";
import { createCheckoutService } from "@/lib/checkout/service";

export const CHECKOUT_API_MAX_BODY_BYTES = 16 * 1024;
const cartApplication = createCartApplication();
const addressService = createCustomerAddressService();

function parseSelectedAddressId(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== "string" ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    throw new CheckoutError("CHECKOUT_INVALID_ADDRESS", "Selected address is invalid.");
  }
  return value;
}

function assertRequestObject(value: unknown): asserts value is Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new CheckoutError("CHECKOUT_INCOMPLETE", "Checkout request must be a JSON object.");
  }
  const unexpected = Object.keys(value).filter((key) => key !== "selectedAddressId");
  if (unexpected.length) throw new CheckoutError("CHECKOUT_INCOMPLETE", "Checkout request contains unsupported fields.");
}

async function readRequest(request: Request): Promise<CheckoutRequest> {
  const contentLength = request.headers.get("content-length");
  if (contentLength !== null) {
    const length = Number(contentLength);
    if (!Number.isSafeInteger(length) || length < 0 || length > CHECKOUT_API_MAX_BODY_BYTES) {
      throw new CheckoutError("CHECKOUT_INCOMPLETE", "Checkout request is invalid.");
    }
  }
  const body = await request.text();
  if (new TextEncoder().encode(body).byteLength > CHECKOUT_API_MAX_BODY_BYTES) {
    throw new CheckoutError("CHECKOUT_INCOMPLETE", "Checkout request is too large.");
  }
  if (!body.trim()) return {};
  try {
    const parsed = JSON.parse(body);
    assertRequestObject(parsed);
    return { selectedAddressId: parseSelectedAddressId(parsed.selectedAddressId) };
  } catch (error) {
    if (error instanceof CheckoutError) throw error;
    throw new CheckoutError("CHECKOUT_INCOMPLETE", "Checkout request must contain valid JSON.");
  }
}

export function createCheckoutApplication(dependencies: Partial<CheckoutApplicationDependencies> = {}) {
  const resolveCustomer = dependencies.resolveCustomer ?? (async (request: Request) => {
    const current = await resolveCurrentCustomer(request);
    return current?.customer ?? null;
  });
  const getCart = dependencies.getCart ?? ((request: Request) => cartApplication.getCurrentCart(request));
  const getAddress = dependencies.getAddress ?? ((customerId: string, addressId: string) => addressService.getAddress(customerId, addressId));
  const listAddresses = dependencies.listAddresses ?? ((customerId: string) => addressService.listAddresses(customerId));

  async function validate(request: Request, input: CheckoutRequest = {}) {
    const customer = await resolveCustomer(request);
    if (!customer) throw new AuthenticationError("SESSION_INVALID", "Authentication is required.");
    return createCheckoutService({
      customer,
      getCart: () => getCart(request),
      getAddress,
      listAddresses,
    }).validate(input);
  }
  return { validate, readRequest };
}
