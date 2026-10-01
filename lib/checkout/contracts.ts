import type { CartDto, CartItemDto } from "@/lib/cart/contracts";
import type { CustomerAddressDto, CustomerDto } from "@/lib/customer/contracts";

export type CheckoutValidationState =
  | "VALID" | "UNAUTHENTICATED" | "CART_MISSING" | "CART_EMPTY"
  | "INVALID_CART_ITEM" | "PRODUCT_UNAVAILABLE" | "VARIANT_UNAVAILABLE" | "CART_CHANGED"
  | "INVALID_QUANTITY" | "PRICE_CHANGED" | "CURRENCY_CHANGED"
  | "INVALID_ADDRESS" | "ADDRESS_NOT_OWNED" | "ADDRESS_NOT_FOUND"
  | "INCOMPLETE_CHECKOUT" | "UNSUPPORTED_CHECKOUT_STATE" | "INTERNAL_VALIDATION_FAILURE";

export type CheckoutIssue = {
  code: Exclude<CheckoutValidationState, "VALID">;
  message: string;
  itemId?: string;
};

export type CheckoutRevision = {\n  cart: string;\n  pricing: string;\n  availability: string;\n};\n\nexport type CheckoutTotals = {
  merchandiseSubtotal: string;
  adjustments: Array<{ code: string; amount: string }>;
  charges: Array<{ code: string; amount: string }>;
  total: string;
  currency: string | null;
};

export type CheckoutItemDto = CartItemDto;

export type CheckoutDto = {
  customer: { id: string; email: string; displayName: string | null } | null;
  cart: { id: string; items: CheckoutItemDto[] };
  address: CustomerAddressDto | null;
  totals: CheckoutTotals;
  validation: { state: CheckoutValidationState; issues: CheckoutIssue[] };
  payment: { ready: false; reason: "PAYMENT_NOT_IMPLEMENTED" };
};

export type CheckoutRequest = { selectedAddressId?: string | null; expectedRevision?: CheckoutRevision };

export type CheckoutApplicationDependencies = {
  resolveCustomer: (request: Request) => Promise<CustomerDto | null>;
  getCart: (request: Request) => Promise<CartDto>;
  getAddress: (customerId: string, addressId: string) => Promise<CustomerAddressDto>;
  listAddresses: (customerId: string) => Promise<CustomerAddressDto[]>;
};

export function toCheckoutCustomer(customer: CustomerDto | null) {
  if (!customer) return null;
  return { id: customer.id, email: customer.email, displayName: customer.displayName ?? null };
}
