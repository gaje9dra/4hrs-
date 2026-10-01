import { Prisma } from "@prisma/client";
import type { CartDto } from "@/lib/cart/contracts";
import { CartServiceError } from "@/lib/cart/errors";
import type { CustomerAddressDto, CustomerDto } from "@/lib/customer/contracts";
import { CustomerAddressError } from "@/lib/customer/errors";
import { CheckoutError, type CheckoutErrorCode } from "@/lib/checkout/errors";
import { toCheckoutCustomer, type CheckoutDto, type CheckoutIssue, type CheckoutRequest, type CheckoutTotals } from "@/lib/checkout/contracts";
import { logCheckoutObservation } from "@/lib/checkout/observability";

type CheckoutDependencies = {
  getCart: () => Promise<CartDto>;
  getAddress: (customerId: string, addressId: string) => Promise<CustomerAddressDto>;
  listAddresses: (customerId: string) => Promise<CustomerAddressDto[]>;
  customer: CustomerDto;
};

function money(value: string) { return new Prisma.Decimal(value); }

function issue(code: CheckoutIssue["code"], message: string, itemId?: string): CheckoutIssue {
  return itemId === undefined ? { code, message } : { code, message, itemId };
}

function calculateTotals(cart: CartDto): CheckoutTotals {
  const available = cart.items.filter((item) => item.availability === "AVAILABLE" && item.subtotal !== null);
  const subtotal = available.reduce((sum, item) => sum.add(money(item.subtotal!)), new Prisma.Decimal(0)).toFixed(2);
  return { merchandiseSubtotal: subtotal, adjustments: [], charges: [], total: subtotal, currency: cart.currency };
}

function validateCart(cart: CartDto): CheckoutIssue[] {
  if (!cart || typeof cart.id !== "string" || !cart.id) return [issue("CART_MISSING", "Your Cart could not be loaded.")];
  if (cart.items.length === 0) return [issue("CART_EMPTY", "Your Cart is empty.")];

  const issues: CheckoutIssue[] = [];
  const currencies = new Set<string>();

  for (const item of cart.items) {
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
    if (!item.unitPrice || !item.currency || !item.subtotal) {
      issues.push(issue("INVALID_CART_ITEM", "A Cart item could not be validated.", item.id));
      continue;
    }
    currencies.add(item.currency);
    const expectedSubtotal = money(item.unitPrice).mul(item.quantity).toFixed(2);
    if (expectedSubtotal !== item.subtotal) {
      issues.push(issue("PRICE_CHANGED", "A Cart item price is no longer consistent with the authoritative price.", item.id));
    }
  }

  if (currencies.size > 1) issues.push(issue("CURRENCY_CHANGED", "Cart items use incompatible currencies."));
  if (cart.currency && currencies.size === 1 && !currencies.has(cart.currency)) {
    issues.push(issue("CURRENCY_CHANGED", "Cart currency is no longer consistent."));
  }
  return issues;
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
      const issues = validateCart(cart);
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
        if (!address && addresses.length > 0) issues.push(issue("INCOMPLETE_CHECKOUT", "Select a delivery address before continuing."));
        else if (!address) issues.push(issue("INVALID_ADDRESS", "Add a delivery address before continuing."));
      }

      if (issues.length > 0) {
        const state = issues[0].code;
        logCheckoutObservation({
          operation: "validate",
          classification: state === "PRODUCT_UNAVAILABLE" || state === "VARIANT_UNAVAILABLE" ||
            state === "PRICE_CHANGED" || state === "CURRENCY_CHANGED"
            ? "stale_state"
            : state === "ADDRESS_NOT_OWNED" || state === "ADDRESS_NOT_FOUND"
              ? "authorization_failure" : "validation_failure",
          durationMs: Date.now() - startedAt,
          errorCode: ("CHECKOUT_" + state) as CheckoutErrorCode,
        });
        return {
          customer: toCheckoutCustomer(dependencies.customer),
          cart: { id: cart.id, items: cart.items },
          address,
          totals: calculateTotals(cart),
          validation: { state, issues },
          payment: { ready: false, reason: "PAYMENT_NOT_IMPLEMENTED" },
        };
      }

      return {
        customer: toCheckoutCustomer(dependencies.customer),
        cart: { id: cart.id, items: cart.items },
        address,
        totals: calculateTotals(cart),
        validation: { state: "VALID", issues: [] },
        payment: { ready: false, reason: "PAYMENT_NOT_IMPLEMENTED" },
      };
    } catch (error) {
      if (error instanceof CheckoutError) throw error;
      if (error instanceof CartServiceError) {
        if (error.code === "CART_NOT_FOUND") throw new CheckoutError("CHECKOUT_CART_MISSING", "Your Cart could not be loaded.");
        if (error.code === "CART_UNAUTHORIZED") throw new CheckoutError("CHECKOUT_INVALID_CART", "Your Cart could not be validated.");
      }
      throw new CheckoutError("CHECKOUT_DATABASE_ERROR", "Checkout validation is temporarily unavailable.", undefined, { cause: error });
    }
  }
  return { validate };
}
export type CheckoutService = ReturnType<typeof createCheckoutService>;
