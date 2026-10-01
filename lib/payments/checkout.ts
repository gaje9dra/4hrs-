import { createHash } from "node:crypto";
import type { CheckoutDto } from "@/lib/checkout/contracts";

export function createCheckoutPaymentReference(customerId: string, checkout: CheckoutDto): string {
  if (!checkout.customer || checkout.customer.id !== customerId) {
    throw new Error("Checkout customer does not match the authenticated customer.");
  }
  const addressId = checkout.address?.id ?? "";
  const value = [
    customerId,
    checkout.cart.id,
    checkout.revision.cart,
    checkout.revision.pricing,
    checkout.revision.availability,
    addressId,
    checkout.totals.total,
    checkout.totals.currency ?? "",
  ].join("\n");
  return createHash("sha256").update(value).digest("hex");
}

export function isCheckoutPayable(checkout: CheckoutDto): boolean {
  return checkout.validation.state === "VALID" &&
    checkout.address !== null &&
    checkout.totals.currency !== null &&
    checkout.totals.total !== "0.00";
}
