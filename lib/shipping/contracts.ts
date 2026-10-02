export const SHIPPING_STATUSES = [
  "CREATED",
  "IN_TRANSIT",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
  "DELIVERY_FAILED",
  "RETURNED",
] as const;

export type ShipmentStatus = (typeof SHIPPING_STATUSES)[number];

export type ShipmentReference = Readonly<{
  id: string;
  orderId: string;
  fulfillmentId: string;
  providerId: string;
  shipmentReference: string | null;
  carrier: string | null;
  trackingNumber: string | null;
  trackingUrl: string | null;
  service: string | null;
  status: ShipmentStatus;
  providerReference: string | null;
  createdAt: string;
  updatedAt: string;
  deliveredAt: string | null;
}>;

export type TrackingEvent = Readonly<{
  id: string;
  shipmentId: string;
  providerEventId: string | null;
  providerStatus: string | null;
  normalizedStatus: ShipmentStatus;
  occurredAt: string;
  receivedAt: string;
  location: string | null;
  description: string | null;
  source: "WEBHOOK" | "POLLING" | "MANUAL" | "PROVIDER";
}>;

export type CustomerShipmentDto = Readonly<{
  status: ShipmentStatus;
  carrier: string | null;
  trackingNumber: string | null;
  trackingUrl: string | null;
  events: readonly Readonly<{
    status: ShipmentStatus;
    occurredAt: string;
    location: string | null;
    description: string | null;
  }>[];
  createdAt: string;
  updatedAt: string;
  deliveredAt: string | null;
}>;

export type ShippingProviderCapabilities = Readonly<{
  createShipment: boolean;
  trackingLookup: boolean;
  webhooks: boolean;
}>;

export type ShippingProviderAdapter = Readonly<{
  id: string;
  capabilities: ShippingProviderCapabilities;
}>;

export type ShipmentCreationContext = Readonly<{
  orderId: string;
  fulfillmentId: string;
  providerId: string;
  orderAddressSnapshot: Readonly<{
    recipientName: string;
    phone: string | null;
    addressLine1: string;
    addressLine2: string | null;
    city: string;
    stateOrProvince: string;
    postalCode: string;
    countryCode: string;
  }>;
}>;

export type ShippingProviderSnapshot = Readonly<{
  providerId: string;
  providerReference: string | null;
  shipmentReference: string | null;
  carrier: string | null;
  trackingNumber: string | null;
  trackingUrl: string | null;
  providerStatus: string | null;
  normalizedStatus: ShipmentStatus;
}>;
