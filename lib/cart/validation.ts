import { CartServiceError } from "@/lib/cart/errors";

export type CartItemSelection = {
  productId: string;
  variantId?: string | null;
  quantity: number;
};

export function requireCartId(cartId: string): void {
  if (typeof cartId !== "string" || !cartId.trim()) {
    throw new CartServiceError("INVALID_CART_INPUT", "Cart ID is required.");
  }
}

export function requireCartItemId(cartItemId: string): void {
  if (typeof cartItemId !== "string" || !cartItemId.trim()) {
    throw new CartServiceError("INVALID_CART_INPUT", "CartItem ID is required.");
  }
}

export function requireProductId(productId: string): void {
  if (typeof productId !== "string" || !productId.trim()) {
    throw new CartServiceError("INVALID_CART_INPUT", "Product ID is required.");
  }
}

export function validateCartQuantity(quantity: number): void {
  if (typeof quantity !== "number" || !Number.isInteger(quantity) || quantity < 1) {
    throw new CartServiceError("INVALID_QUANTITY", "Cart quantity must be a positive integer.");
  }
}

export function validateCartSelection(input: CartItemSelection): void {
  requireProductId(input.productId);
  if (input.variantId !== undefined && input.variantId !== null && (!input.variantId.trim())) {
    throw new CartServiceError("INVALID_VARIANT", "Variant ID must be non-empty when provided.");
  }
  validateCartQuantity(input.quantity);
}
