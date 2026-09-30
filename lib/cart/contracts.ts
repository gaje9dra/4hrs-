export type CartAvailabilityState =
  | "AVAILABLE"
  | "PRODUCT_UNAVAILABLE"
  | "VARIANT_UNAVAILABLE"
  | "INSUFFICIENT_AVAILABILITY";

export type CartWarning = {
  code: Exclude<CartAvailabilityState, "AVAILABLE">;
  itemId: string;
};

export type CartItemDto = {
  id: string;
  product: {
    id: string;
    title: string;
    slug: string;
    media: { url: string; altText: string | null } | null;
  } | null;
  variant: {
    id: string;
    displayName: string | null;
    size: string | null;
    color: string | null;
  } | null;
  quantity: number;
  unitPrice: string | null;
  currency: string | null;
  subtotal: string | null;
  availability: CartAvailabilityState;
};

export type CartDto = {
  id: string;
  items: CartItemDto[];
  subtotal: string;
  currency: string | null;
  hasUnavailableItems: boolean;
  warnings: CartWarning[];
};

export type AddCartItemInput = {
  productId: string;
  variantId: string | null;
  quantity: number;
};

export type UpdateCartItemInput = {
  quantity: number;
};
