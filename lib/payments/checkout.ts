import { createHash } from "node:crypto";

export type CheckoutPaymentReferenceInput = {
  customer: { id: string; email: string; displayName: string | null } | null;
  cart: { id: string };
  address: { id: string } | null;
  totals: { total: string; currency: string | null };
  revision: { cart: string; pricing: string; availability: string };
  validation: { state: string };
  couponCode?: string | null;
  discountTotal?: string;
};

export function createCheckoutPaymentReference(
  customerId: string,
  checkout: CheckoutPaymentReferenceInput,
): string {
  if (!checkout.customer || checkout.customer.id !== customerId) {
    throw new Error("Checkout customer does not match the authenticated customer.");
  }
  const value = [
    customerId,
    checkout.cart.id,
    checkout.revision.cart,
    checkout.revision.pricing,
    checkout.revision.availability,
    checkout.address?.id ?? "",
    checkout.totals.total,
    checkout.totals.currency ?? "",
    checkout.couponCode?.trim().toUpperCase() ?? "",
    checkout.discountTotal ?? "0.00",
  ].join("\n");
  return createHash("sha256").update(value).digest("hex");
}

export function isCheckoutPayable(checkout: CheckoutPaymentReferenceInput): boolean {
  return checkout.validation.state === "VALID" &&
    checkout.address !== null &&
    checkout.totals.currency !== null &&
    checkout.totals.total !== "0.00";
}
