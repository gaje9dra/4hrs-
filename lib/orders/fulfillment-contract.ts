import type { OrderLifecycleStatus } from "@/lib/orders/domain";

export type FulfillmentOrderItem = Readonly<{
  productId: string | null;
  variantId: string | null;
  sku: string | null;
  quantity: number;
  productTitle: string;
  variantTitle: string | null;
}>;

export type FulfillmentOrderAddress = Readonly<{
  recipientName: string;
  phone: string | null;
  addressLine1: string;
  addressLine2: string | null;
  city: string;
  stateOrProvince: string;
  postalCode: string;
  countryCode: string;
}>;

export type FulfillmentOrderInput = Readonly<{
  orderId: string;
  orderNumber: string;
  status: OrderLifecycleStatus;
  paymentState: "SUCCEEDED";
  currency: string;
  items: readonly FulfillmentOrderItem[];
  shippingAddress: FulfillmentOrderAddress | null;
}>;

/**
 * Internal boundary only. Future Fulfillment may consume this snapshot.
 * Fulfillment must never mutate OrderItem or address snapshot fields directly.
 * Provider identifiers, shipment/tracking data, and credentials belong outside Order.
 */
export type FulfillmentOrderStateUpdate = Readonly<{
  orderId: string;
  source: "FULFILLMENT";
  nextOrderState: OrderLifecycleStatus;
}>;
