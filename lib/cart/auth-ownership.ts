import { createCartRepository, type CartRepository } from "@/lib/cart/repository";
import { CartServiceError } from "@/lib/cart/errors";
import type { CartOwnershipBoundary, CartOwnerContext } from "@/lib/cart/service";

function customerIdFromOwner(owner: CartOwnerContext): string {
  if (!owner || typeof owner !== "object" || !("customerId" in owner) || typeof owner.customerId !== "string") {
    throw new CartServiceError("CART_UNAUTHORIZED", "Cart access is not authorized.");
  }
  return owner.customerId;
}

export function createAuthenticatedCartOwnershipBoundary(
  repository: Pick<CartRepository, "findCartById"> = createCartRepository(),
): CartOwnershipBoundary {
  return {
    async authorizeCartAccess(cartId, owner) {
      const customerId = customerIdFromOwner(owner);
      const cart = await repository.findCartById(cartId);
      if (!cart || cart.customerId !== customerId) {
        throw new CartServiceError("CART_UNAUTHORIZED", "Cart access is not authorized.");
      }
    },
    async authorizeCartCreation(owner) {
      customerIdFromOwner(owner);
    },
  };
}
