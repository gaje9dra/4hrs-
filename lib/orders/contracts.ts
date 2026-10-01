export type PublicOrderStatus = "PENDING" | "CONFIRMED";

export type PublicOrderItemDto = {
  productId: string | null;
  variantId: string | null;
  productTitle: string;
  variantTitle: string | null;
  sku: string | null;
  selectedOptions: Record<string, string> | null;
  quantity: number;
  unitPrice: string;
  lineTotal: string;
  currency: string;
};

export type PublicOrderAddressDto = {
  recipientName: string;
  phone: string | null;
  addressLine1: string;
  addressLine2: string | null;
  city: string;
  stateOrProvince: string;
  postalCode: string;
  countryCode: string;
  label: string | null;
};

export type PublicOrderDto = {
  id: string;
  orderNumber: string;
  status: PublicOrderStatus;
  createdAt: string;
  currency: string;
  subtotal: string;
  total: string;
  address: PublicOrderAddressDto | null;
  items: PublicOrderItemDto[];
};

export type PublicOrderListDto = {
  orders: PublicOrderDto[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
  };
};

export type CreateOrderRequest = {
  paymentId: string;
};
