import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import type { CartDto } from "@/lib/cart/contracts";
import { CartServiceError } from "@/lib/cart/errors";
import type { CustomerAddressDto, CustomerDto } from "@/lib/customer/contracts";
import { CustomerAddressError } from "@/lib/customer/errors";
import { CheckoutError, type CheckoutErrorCode } from "@/lib/checkout/errors";
import {
  toCheckoutCustomer,
  type CheckoutDto,
  type CheckoutIssue,
  type CheckoutRequest,
  type CheckoutTotals,
  type CheckoutRevision,
} from "@/lib/checkout/contracts";
import { logCheckoutObservation } from "@/lib/checkout/observability";
import { createCheckoutPaymentReference, isCheckoutPayable } from "@/lib/payments/checkout";
import { calculateCouponDiscount, CouponEligibilityError } from "@/lib/coupons/calculation";

type CheckoutDependencies = {
  getCart: () => Promise<CartDto>;
  getAddress: (customerId: string, addressId: string) => Promise<CustomerAddressDto>;
  listAddresses: (customerId: string) => Promise<CustomerAddressDto[]>;
  customer: CustomerDto;
  findCoupon?: (code: string) => Promise<{ coupon: { id: string; code: string; status: "DRAFT" | "ACTIVE" | "INACTIVE"; discountPercent: number; startsAt: Date | null; expiresAt: Date; minimumSubtotal: Prisma.Decimal | null; maximumDiscountAmount: Prisma.Decimal | null; maxRedemptions: number; perCustomerLimit: number | null }; completed: number; reserved: number; customerUses: number } | null>;
};

function issue(code: CheckoutIssue["code"], message: string, itemId?: string): CheckoutIssue {
  return itemId === undefined ? { code, message } : { code, message, itemId };
}

function digest(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function revisionForCart(cart: CartDto): CheckoutRevision {
  const items = [...cart.items].sort((a, b) => a.id.localeCompare(b.id));
  const structure = items.map((item) =>
    [item.id, item.product?.id ?? "", item.variant?.id ?? "", item.quantity].join("|"),
  ).join("\n");
  const pricing = items.map((item) =>
    [item.id, item.unitPrice ?? "", item.subtotal ?? "", item.currency ?? ""].join("|"),
  ).join("\n");
  const availability = items.map((item) =>
    [item.id, item.availability, item.quantity, item.product?.id ?? "", item.variant?.id ?? ""].join("|"),
  ).join("\n");

  return {
    cart: digest([cart.id, structure].join("\n")),
    pricing: digest([cart.currency ?? "", pricing].join("\n")),
    availability: digest(availability),
  };
}

function compareRevision(current: CheckoutRevision, expected?: CheckoutRevision): CheckoutIssue | null {
  if (!expected) return null;
  if (expected.cart !== current.cart) {
    return issue("CART_CHANGED", "Your Cart changed while Checkout was open.");
  }
  if (expected.availability !== current.availability) {
    return issue("VARIANT_UNAVAILABLE", "Cart availability changed while Checkout was open.");
  }
  if (expected.pricing !== current.pricing) {
    return issue("PRICE_CHANGED", "A Cart price changed while Checkout was open.");
  }
  return null;
}

function validateCart(cart: CartDto): CheckoutIssue[] {
  if (!cart || typeof cart.id !== "string" || !cart.id) {
    return [issue("CART_MISSING", "Your Cart could not be loaded.")];
  }
  if (cart.items.length === 0) return [issue("CART_EMPTY", "Your Cart is empty.")];

  const issues: CheckoutIssue[] = [];
  const currencies = new Set<string>();

  for (const item of [...cart.items].sort((a, b) => a.id.localeCompare(b.id))) {
    if (!Number.isSafeInteger(item.quantity) || item.quantity < 1) {
      issues.push(issue("INVALID_QUANTITY", "Cart quantity is invalid.", item.id));
      continue;
    }
    if (item.availability === "PRODUCT_UNAVAILABLE") {
      issues.push(issue("PRODUCT_UNAVAILABLE", "A product in your Cart is no longer available.", item.id));
      continue;
    }
    if (item.availability === "VARIANT_UNAVAILABLE" || item.availability === "INSUFFICIENT_AVAILABILITY") {
      issues.push(issue("VARIANT_UNAVAILABLE", "A selected item is no longer available in the requested quantity.", item.id));
      continue;
    }
    if (!item.product || !item.unitPrice || !item.currency || !item.subtotal) {
      issues.push(issue("INVALID_CART_ITEM", "A Cart item could not be validated.", item.id));
      continue;
    }
    currencies.add(item.currency);
    try {
      const expectedSubtotal = new Prisma.Decimal(item.unitPrice).mul(item.quantity).toFixed(2);
      if (expectedSubtotal !== item.subtotal) {
        issues.push(issue("PRICE_CHANGED", "A Cart item price is no longer internally consistent.", item.id));
      }
    } catch {
      issues.push(issue("INVALID_CART_ITEM", "A Cart item could not be validated.", item.id));
    }
  }

  if (currencies.size > 1 || (currencies.size === 1 && !currencies.has(cart.currency ?? ""))) {
    issues.push(issue("CURRENCY_CHANGED", "Cart items use incompatible currencies."));
  }
  if (cart.items.some((item) => item.availability !== "AVAILABLE") && !cart.hasUnavailableItems) {
    issues.push(issue("INVALID_CART_ITEM", "Cart availability state is inconsistent."));
  }
  if (currencies.size === 1 && cart.currency === null) {
    issues.push(issue("CURRENCY_CHANGED", "Cart currency is missing."));
  }

  return issues;
}

function totalsForCart(cart: CartDto): CheckoutTotals {
  return {
    merchandiseSubtotal: cart.subtotal,
    adjustments: [],
    charges: [],
    total: cart.subtotal,
    currency: cart.currency,
  };
}

function mapAddressError(error: unknown): CheckoutIssue {
  if (error instanceof CustomerAddressError && error.code === "CUSTOMER_ADDRESS_INVALID") {
    return issue("INVALID_ADDRESS", "The selected address is invalid.");
  }
  if (error instanceof CustomerAddressError && error.code === "CUSTOMER_ADDRESS_NOT_FOUND") {
    return issue("ADDRESS_NOT_OWNED", "The selected address is not available for this customer.");
  }
  return issue("INVALID_ADDRESS", "The selected address could not be validated.");
}

export function createCheckoutService(dependencies: CheckoutDependencies) {
  async function validate(input: CheckoutRequest = {}): Promise<CheckoutDto> {
    const startedAt = Date.now();

    try {
      const cart = await dependencies.getCart();
      const currentRevision = revisionForCart(cart);
      const issues = validateCart(cart);
      const staleIssue = compareRevision(currentRevision, input.expectedRevision);
      if (staleIssue) issues.unshift(staleIssue);

      let address: CustomerAddressDto | null = null;
      const addressId = input.selectedAddressId?.trim() || null;

      if (addressId) {
        try {
          address = await dependencies.getAddress(dependencies.customer.id, addressId);
        } catch (error) {
          issues.push(mapAddressError(error));
        }
      } else {
        const addresses = await dependencies.listAddresses(dependencies.customer.id);
        address = addresses.find((candidate) => candidate.isDefault) ?? null;
        if (!address && addresses.length > 0) {
          issues.push(issue("INCOMPLETE_CHECKOUT", "Select a delivery address before continuing."));
        } else if (!address) {
          issues.push(issue("INVALID_ADDRESS", "Add a delivery address before continuing."));
        }
      }

      const validationState = issues[0]?.code ?? "VALID";
      if (issues.length > 0) {
        logCheckoutObservation({
          operation: "validate",
          classification:
            validationState === "PRODUCT_UNAVAILABLE" ||
            validationState === "VARIANT_UNAVAILABLE" ||
            validationState === "INVALID_QUANTITY" ||
            validationState === "PRICE_CHANGED" ||
            validationState === "CURRENCY_CHANGED" ||
            validationState === "CART_CHANGED"
              ? "stale_state"
              : validationState === "ADDRESS_NOT_OWNED" || validationState === "ADDRESS_NOT_FOUND"
                ? "authorization_failure"
                : "validation_failure",
          durationMs: Date.now() - startedAt,
          errorCode: ("CHECKOUT_" + validationState) as CheckoutErrorCode,
        });
      }

      let totals = totalsForCart(cart);
      let coupon: { code: string; discountPercent: number; discountAmount: string; eligibleSubtotal: string } | null = null;
      if (input.couponCode) {
        try {
          if (!dependencies.findCoupon) throw new Error("Coupon validation is unavailable.");
          const found = await dependencies.findCoupon(input.couponCode);
          if (!found) throw new CouponEligibilityError("COUPON_INVALID", "This coupon code is not valid.");
          if (found.completed + found.reserved >= found.coupon.maxRedemptions) throw new CouponEligibilityError("COUPON_EXHAUSTED", "This coupon has reached its redemption limit.");
          if (found.coupon.perCustomerLimit !== null && found.customerUses >= found.coupon.perCustomerLimit) throw new CouponEligibilityError("COUPON_LIMIT_REACHED", "You have reached this coupon’s usage limit.");
          const calculation = calculateCouponDiscount({ coupon: found.coupon, eligibleSubtotal: cart.subtotal, currency: cart.currency ?? "", now: new Date() });
          coupon = { code: calculation.code, discountPercent: calculation.discountPercent, discountAmount: calculation.discountAmount, eligibleSubtotal: calculation.eligibleSubtotal };
          totals = { ...totals, adjustments: [{ code: "Coupon " + calculation.code, amount: "-" + calculation.discountAmount }], total: calculation.payableTotal };
        } catch (error) {
          const message = error instanceof Error ? error.message : "Coupon could not be validated.";
          issues.push(issue("INCOMPLETE_CHECKOUT", message));
        }
      }
      const finalValidationState = issues[0]?.code ?? "VALID";
      const result = {
        customer: toCheckoutCustomer(dependencies.customer),
        cart: { id: cart.id, items: cart.items },
        address,
        totals,
        revision: currentRevision,
        validation: { state: finalValidationState },
        couponCode: coupon?.code ?? null,
        discountTotal: coupon?.discountAmount ?? "0.00",
      };
      const checkoutReference = createCheckoutPaymentReference(dependencies.customer.id, result);
      return {
        ...result,
        ...(coupon ? { coupon } : { coupon: null }),
        validation: { state: finalValidationState, issues },
        payment: {
          ready: isCheckoutPayable({ ...result, validation: { state: finalValidationState } }),
          checkoutReference,
          reason: isCheckoutPayable({ ...result, validation: { state: finalValidationState } }) ? "PAYMENT_READY" as const : "CHECKOUT_NOT_PAYABLE" as const,
        },
      };
    } catch (error) {
      if (error instanceof CheckoutError) throw error;
      if (error instanceof CartServiceError) {
        if (error.code === "CART_NOT_FOUND") {
          throw new CheckoutError("CHECKOUT_CART_MISSING", "Your Cart could not be loaded.");
        }
        if (error.code === "CART_UNAUTHORIZED") {
          throw new CheckoutError("CHECKOUT_INVALID_CART", "Your Cart could not be validated.");
        }
      }
      throw new CheckoutError(
        "CHECKOUT_DATABASE_ERROR",
        "Checkout validation is temporarily unavailable.",
        undefined,
        { cause: error },
      );
    }
  }

  return { validate };
}

export type CheckoutService = ReturnType<typeof createCheckoutService>;
