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
  repository: Pick<CartRepository, "findCartById" | "findCartOwner"> = createCartRepository(),
): CartOwnershipBoundary {
  return {
    async authorizeCartAccess(cartId, owner) {
      const customerId = customerIdFromOwner(owner);
      const verifiedCartId = owner && typeof owner === "object" && "verifiedCartId" in owner
        ? owner.verifiedCartId
        : null;

      // The API context resolver obtained this cart through a customer-scoped
      // lookup. Reuse that server-only proof instead of querying ownership
      // again. Direct service callers still take the database verification path.
      if (verifiedCartId === cartId) return;

      const cart = repository.findCartOwner
        ? await repository.findCartOwner(cartId)
        : await repository.findCartById(cartId);
      if (!cart || cart.customerId !== customerId) {
        throw new CartServiceError("CART_UNAUTHORIZED", "Cart access is not authorized.");
      }
    },
    async authorizeCartCreation(owner) {
      customerIdFromOwner(owner);
    },
  };
}
