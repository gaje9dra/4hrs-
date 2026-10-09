import { AuthenticationError } from "@/lib/auth/errors";
import { resolveCurrentCustomer } from "@/lib/auth/context";
import { createCartApplication } from "@/lib/cart/api";
import { createCustomerAddressService } from "@/lib/customer/address-service";
import { CheckoutError } from "@/lib/checkout/errors";
import type { CheckoutApplicationDependencies, CheckoutRequest, CheckoutRevision, CheckoutPaymentMethod } from "@/lib/checkout/contracts";
import { createCheckoutService } from "@/lib/checkout/service";
import { db } from "@/lib/db/client";

export const CHECKOUT_API_MAX_BODY_BYTES = 16 * 1024;
const cartApplication = createCartApplication();
const addressService = createCustomerAddressService();


function parseExpectedRevision(value: unknown): CheckoutRevision | undefined {
  if (value === undefined) return undefined;
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new CheckoutError("CHECKOUT_INCOMPLETE", "Checkout revision is invalid.");
  }
  const revision = value as Record<string, unknown>;
  if (
    Object.keys(revision).length !== 3 ||
    !Object.keys(revision).every((key) => key === "cart" || key === "pricing" || key === "availability") ||
    !["cart", "pricing", "availability"].every((key) =>
      typeof revision[key] === "string" && /^[0-9a-f]{64}$/i.test(revision[key] as string),
    )
  ) {
    throw new CheckoutError("CHECKOUT_INCOMPLETE", "Checkout revision is invalid.");
  }
  return {
    cart: revision.cart as string,
    pricing: revision.pricing as string,
    availability: revision.availability as string,
  };
}

function parseSelectedAddressId(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== "string" ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    throw new CheckoutError("CHECKOUT_INVALID_ADDRESS", "Selected address is invalid.");
  }
  return value;
}

function parseCouponCode(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  if (typeof value !== "string" || value.trim().length < 3 || value.trim().length > 64 || !/^[A-Za-z0-9][A-Za-z0-9_-]{2,63}$/.test(value.trim())) {
    throw new CheckoutError("CHECKOUT_INCOMPLETE", "Coupon code is invalid.");
  }
  return value.trim().toUpperCase();
}

function parsePaymentMethod(value: unknown): CheckoutPaymentMethod | undefined {
  if (value === undefined) return undefined;
  if (value !== "upi" && value !== "cards" && value !== "netbanking") {
    throw new CheckoutError("CHECKOUT_INCOMPLETE", "Payment method is invalid.");
  }
  return value;
}

function assertRequestObject(value: unknown): asserts value is Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new CheckoutError("CHECKOUT_INCOMPLETE", "Checkout request must be a JSON object.");
  }
  const unexpected = Object.keys(value).filter((key) => !["selectedAddressId", "expectedRevision", "paymentMethod", "couponCode"].includes(key));
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
    return { selectedAddressId: parseSelectedAddressId(parsed.selectedAddressId), expectedRevision: parseExpectedRevision(parsed.expectedRevision), paymentMethod: parsePaymentMethod(parsed.paymentMethod), couponCode: parseCouponCode(parsed.couponCode) };
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
      findCoupon: async (code: string) => {
        const coupon = await db.discountCoupon.findUnique({ where: { code } });
        if (!coupon) return null;
        const now = new Date();
        const [completed, reserved, customerUses] = await Promise.all([
          db.couponRedemption.count({ where: { couponId: coupon.id, status: "REDEEMED" } }),
          db.couponRedemption.count({ where: { couponId: coupon.id, status: "RESERVED", OR: [{ reservationExpiresAt: null }, { reservationExpiresAt: { gt: now } }] } }),
          db.couponRedemption.count({ where: { couponId: coupon.id, customerId: customer.id, status: { in: ["REDEEMED", "RESERVED"] }, OR: [{ status: "REDEEMED" }, { reservationExpiresAt: null }, { reservationExpiresAt: { gt: now } }] } }),
        ]);
        return { coupon, completed, reserved, customerUses };
      },
    }).validate(input);
  }
  return { validate, readRequest };
}
