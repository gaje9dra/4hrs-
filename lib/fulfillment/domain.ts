import { FulfillmentStatus } from "@prisma/client";
import { FulfillmentDomainError } from "@/lib/fulfillment/errors";

export type FulfillmentLifecycleStatus = FulfillmentStatus;

const ALLOWED_TRANSITIONS: Readonly<Record<FulfillmentLifecycleStatus, readonly FulfillmentLifecycleStatus[]>> = {
  PENDING: ["SUBMITTED", "FAILED"],
  SUBMITTED: ["COMPLETED", "FAILED"],
  FAILED: ["SUBMITTED"],
  COMPLETED: [],
};

export function assertFulfillmentTransition(current: FulfillmentLifecycleStatus, next: FulfillmentLifecycleStatus): void {
  if (current === next) throw new FulfillmentDomainError("FULFILLMENT_INVALID_TRANSITION", "The Fulfillment state must change.");
  if (!ALLOWED_TRANSITIONS[current]?.includes(next)) {
    if (current === "COMPLETED") throw new FulfillmentDomainError("FULFILLMENT_INVALID_STATE", "Completed Fulfillment is terminal.");
    throw new FulfillmentDomainError("FULFILLMENT_INVALID_TRANSITION", "The requested Fulfillment state transition is not allowed.");
  }
}

export function isFulfillmentLifecycleStatus(value: string): value is FulfillmentLifecycleStatus {
  return value === "PENDING" || value === "SUBMITTED" || value === "FAILED" || value === "COMPLETED";
}

export function isFulfillmentTerminal(status: FulfillmentLifecycleStatus): boolean {
  return status === "COMPLETED";
}

export type FulfillmentItemMapping = Readonly<{
  orderItemId: string;
  quantity: number;
  sku: string | null;
  variantId: string | null;
}>;

export function mapOrderItemsToFulfillment(items: readonly Readonly<{
  id: string;
  quantity: number;
  skuSnapshot: string | null;
  variantId: string | null;
}>[]): FulfillmentItemMapping[] {
  if (!items.length) throw new FulfillmentDomainError("FULFILLMENT_NOT_ELIGIBLE", "Order contains no fulfillable items.");
  return items.map((item) => {
    if (!Number.isSafeInteger(item.quantity) || item.quantity < 1) {
      throw new FulfillmentDomainError("FULFILLMENT_ITEM_INVALID", "Order contains an invalid fulfillment quantity.");
    }
    if (!item.skuSnapshot?.trim()) {
      throw new FulfillmentDomainError("FULFILLMENT_ITEM_INVALID", "Order item is missing its historical SKU mapping.");
    }
    return { orderItemId: item.id, quantity: item.quantity, sku: item.skuSnapshot, variantId: item.variantId };
  });
}

export function assertOrderFulfillmentEligibility(order: Readonly<{
  status: string;
  paymentStatus: string;
  paymentCompletedAt: Date | null;
  items: readonly { id: string; quantity: number; skuSnapshot: string | null; variantId: string | null }[];
  shippingAddress: { recipientName: string; addressLine1: string; city: string; stateOrProvince: string; postalCode: string; countryCode: string } | null;
}>): void {
  if (order.status !== "CONFIRMED") throw new FulfillmentDomainError("FULFILLMENT_NOT_ELIGIBLE", "Order is not in a fulfillment-eligible state.");
  if (order.paymentStatus !== "SUCCEEDED" || !order.paymentCompletedAt) {
    throw new FulfillmentDomainError("FULFILLMENT_NOT_ELIGIBLE", "Order payment is not authoritative for fulfillment.");
  }
  if (!order.shippingAddress) throw new FulfillmentDomainError("FULFILLMENT_NOT_ELIGIBLE", "Order has no historical shipping address.");
  for (const value of [order.shippingAddress.recipientName, order.shippingAddress.addressLine1, order.shippingAddress.city, order.shippingAddress.stateOrProvince, order.shippingAddress.postalCode, order.shippingAddress.countryCode]) {
    if (!value.trim()) throw new FulfillmentDomainError("FULFILLMENT_NOT_ELIGIBLE", "Order shipping snapshot is incomplete.");
  }
  mapOrderItemsToFulfillment(order.items);
}
