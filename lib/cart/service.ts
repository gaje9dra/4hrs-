import { Prisma } from "@prisma/client";
import { createCartRepository, type CartRepository } from "@/lib/cart/repository";
import { CartServiceError } from "@/lib/cart/errors";
import { logCartObservation } from "@/lib/cart/observability";
import { validateCartQuantity, validateCartSelection, requireCartId, requireCartItemId } from "@/lib/cart/validation";
import { createCatalogQueryService, type CatalogAvailability, type PublishedProductDetailResult } from "@/lib/catalog/query";
import { CatalogServiceError } from "@/lib/catalog/errors";
import * as catalogRepository from "@/lib/catalog/repository";

export type CartOwnerContext = unknown;

export type CartOwnershipBoundary = {
  authorizeCartAccess: (cartId: string, owner: CartOwnerContext) => Promise<void>;
  authorizeCartCreation: (owner: CartOwnerContext) => Promise<void>;
};

const unavailableOwnershipBoundary: CartOwnershipBoundary = {
  async authorizeCartAccess() {
    throw new CartServiceError(
      "CART_OWNERSHIP_UNAVAILABLE",
      "Cart ownership cannot be verified because no supported customer/session identity mechanism exists.",
    );
  },
  async authorizeCartCreation() {
    throw new CartServiceError(
      "CART_OWNERSHIP_UNAVAILABLE",
      "Cart ownership cannot be established because no supported customer/session identity mechanism exists.",
    );
  },
};

type CartServiceDependencies = {
  repository?: CartRepository;
  catalogRepository?: typeof catalogRepository;
  catalogQuery?: ReturnType<typeof createCatalogQueryService>;
  ownership?: CartOwnershipBoundary;
};

export type CartLineState =
  | "AVAILABLE"
  | "PRODUCT_UNAVAILABLE"
  | "VARIANT_UNAVAILABLE"
  | "INSUFFICIENT_AVAILABILITY";

export type CartLine = {
  id: string;
  productId: string;
  variantId: string | null;
  quantity: number;
  state: CartLineState;
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
  unitPrice: string | null;
  currency: string | null;
  subtotal: string | null;
  availableQuantity: number | null;
};

export type CartView = {
  id: string;
  items: CartLine[];
  subtotal: string;
  currency: string | null;
  hasUnavailableItems: boolean;
};

type ResolvedSelection = {
  product: PublishedProductDetailResult;
  variant: PublishedProductDetailResult["variants"][number] | null;
  unitPrice: string;
  currency: string;
  availableQuantity: number | null;
};

function money(value: string): Prisma.Decimal {
  return new Prisma.Decimal(value);
}

function mapPersistenceError(error: unknown): never {
  if (error instanceof CartServiceError) throw error;

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2025") {
      throw new CartServiceError("CART_NOT_FOUND", "The requested Cart record was not found.", undefined, error);
    }
    if (error.code === "P2002" || error.code === "P2034") {
      throw new CartServiceError(
        "CART_ITEM_CONFLICT",
        "The Cart changed concurrently. Please retry the Cart operation.",
        undefined,
        error,
      );
    }
  }

  throw new CartServiceError("CART_DATABASE_ERROR", "Cart persistence operation failed.", undefined, error);
}

function assertAvailability(quantity: number, availableQuantity: number | null, state: CatalogAvailability["state"]): void {
  validateCartQuantity(quantity);
  if (state === "OUT_OF_STOCK") {
    throw new CartServiceError("INSUFFICIENT_AVAILABILITY", "The selected item is currently unavailable.");
  }
  if (availableQuantity !== null && quantity > availableQuantity) {
    throw new CartServiceError(
      "INSUFFICIENT_AVAILABILITY",
      "The requested quantity is not currently available.",
      { requestedQuantity: quantity, availableQuantity },
    );
  }
}

async function retrySerializable<T>(work: () => Promise<T>): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await work();
    } catch (error) {
      lastError = error;
      if (
        !(error instanceof Prisma.PrismaClientKnownRequestError) ||
        (error.code !== "P2002" && error.code !== "P2034")
      ) {
        throw error;
      }
    }
  }
  throw lastError;
}

function primaryMedia(product: PublishedProductDetailResult) {
  const image = product.media.find((item) => item.isPrimary) ?? product.media[0] ?? null;
  return image ? { url: image.url, altText: image.altText } : null;
}

export function createCartService(dependencies: CartServiceDependencies = {}) {
  const repository = dependencies.repository ?? createCartRepository();
  const catalog = dependencies.catalogRepository ?? catalogRepository;
  const catalogQuery = dependencies.catalogQuery ?? createCatalogQueryService();
  const ownership = dependencies.ownership ?? unavailableOwnershipBoundary;

  async function authorizeCart(cartId: string, owner: CartOwnerContext) {
    requireCartId(cartId);
    try {
      await ownership.authorizeCartAccess(cartId, owner);
    } catch (error) {
      if (error instanceof CartServiceError) throw error;
      throw new CartServiceError("CART_UNAUTHORIZED", "Cart access is not authorized.", undefined, error);
    }
  }

  async function resolveSelection(productId: string, variantId: string | null | undefined): Promise<ResolvedSelection> {
    const productRecord = await catalog.getProductById(productId);
    if (!productRecord) throw new CartServiceError("PRODUCT_NOT_FOUND", "Product was not found.");

    let product: PublishedProductDetailResult;
    try {
      product = await catalogQuery.getPublishedProductDetailsBySlug(productRecord.slug);
    } catch (error) {
      if (error instanceof CartServiceError) throw error;
      if (error instanceof CatalogServiceError && error.code === "PRODUCT_NOT_FOUND") {
        throw new CartServiceError("PRODUCT_UNAVAILABLE", "Product is not currently purchasable.", undefined, error);
      }
      if (error instanceof CatalogServiceError) {
        throw new CartServiceError("PRODUCT_UNAVAILABLE", "Product is not currently purchasable.", undefined, error);
      }
      throw error;
    }

    if (product.status !== "ACTIVE") {
      throw new CartServiceError("PRODUCT_UNAVAILABLE", "Product is not currently purchasable.");
    }

    if (!variantId) {
      if (product.variants.length > 0) {
        throw new CartServiceError(
          "INVALID_VARIANT",
          "A valid ProductVariant must be selected for this Product.",
        );
      }
      assertAvailability(1, product.availability.availableQuantity, product.availability.state);
      return {
        product,
        variant: null,
        unitPrice: product.price,
        currency: product.currency,
        availableQuantity: product.availability.availableQuantity,
      };
    }

    const variant = product.variants.find((item) => item.id === variantId);
    if (!variant) {
      throw new CartServiceError("INVALID_VARIANT", "The selected ProductVariant is not valid for this Product.");
    }

    assertAvailability(1, variant.availability.availableQuantity, variant.availability.state);
    return {
      product,
      variant,
      unitPrice: variant.price,
      currency: product.currency,
      availableQuantity: variant.availability.availableQuantity,
    };
  }

  async function resolveLine(line: {
    id: string;
    productId: string;
    variantId: string | null;
    quantity: number;
  }): Promise<CartLine> {
    try {
      const resolved = await resolveSelection(line.productId, line.variantId);
      const availableQuantity = resolved.availableQuantity;
      const state: CartLineState =
        resolved.variant?.availability.state === "OUT_OF_STOCK" ||
        resolved.product.availability.state === "OUT_OF_STOCK"
          ? "INSUFFICIENT_AVAILABILITY"
          : availableQuantity !== null && line.quantity > availableQuantity
            ? "INSUFFICIENT_AVAILABILITY"
            : "AVAILABLE";
      const subtotal = money(resolved.unitPrice).mul(line.quantity).toFixed(2);
      return {
        id: line.id,
        productId: line.productId,
        variantId: line.variantId,
        quantity: line.quantity,
        state,
        product: {
          id: resolved.product.id,
          title: resolved.product.title,
          slug: resolved.product.slug,
          media: primaryMedia(resolved.product),
        },
        variant: resolved.variant
          ? {
              id: resolved.variant.id,
              displayName: resolved.variant.displayName,
              size: resolved.variant.size,
              color: resolved.variant.color,
            }
          : null,
        unitPrice: resolved.unitPrice,
        currency: resolved.currency,
        subtotal,
        availableQuantity,
      };
    } catch (error) {
      if (error instanceof CartServiceError && error.code === "PRODUCT_NOT_FOUND") {
        return {
          id: line.id,
          productId: line.productId,
          variantId: line.variantId,
          quantity: line.quantity,
          state: "PRODUCT_UNAVAILABLE",
          product: null,
          variant: null,
          unitPrice: null,
          currency: null,
          subtotal: null,
          availableQuantity: null,
        };
      }
      if (
        error instanceof CartServiceError &&
        (error.code === "PRODUCT_UNAVAILABLE" || error.code === "INVALID_VARIANT" || error.code === "VARIANT_NOT_FOUND")
      ) {
        return {
          id: line.id,
          productId: line.productId,
          variantId: line.variantId,
          quantity: line.quantity,
          state: error.code === "PRODUCT_UNAVAILABLE" ? "PRODUCT_UNAVAILABLE" : "VARIANT_UNAVAILABLE",
          product: null,
          variant: null,
          unitPrice: null,
          currency: null,
          subtotal: null,
          availableQuantity: null,
        };
      }
      if (error instanceof CartServiceError && error.code === "INSUFFICIENT_AVAILABILITY") {
        return {
          id: line.id,
          productId: line.productId,
          variantId: line.variantId,
          quantity: line.quantity,
          state: "INSUFFICIENT_AVAILABILITY",
          product: null,
          variant: null,
          unitPrice: null,
          currency: null,
          subtotal: null,
          availableQuantity: null,
        };
      }
      throw error;
    }
  }

  async function getCart(cartId: string, owner: CartOwnerContext): Promise<CartView> {
    const startedAt = Date.now();
    try {
      await authorizeCart(cartId, owner);
      const cart = await repository.findCartById(cartId);
      if (!cart) throw new CartServiceError("CART_NOT_FOUND", "Cart was not found.");

      const items = await Promise.all(cart.items.map(resolveLine));
      const availableItems = items.filter((item) => item.state === "AVAILABLE");
      const currency = availableItems[0]?.currency ?? items.find((item) => item.currency)?.currency ?? null;
      const subtotal = availableItems
        .reduce((total, item) => total.add(money(item.subtotal!)), new Prisma.Decimal(0))
        .toFixed(2);

      return {
        id: cart.id,
        items,
        subtotal,
        currency,
        hasUnavailableItems: items.some((item) => item.state !== "AVAILABLE"),
      };
    } catch (error) {
      const classification =
        error instanceof CartServiceError && error.code.includes("OWNERSHIP")
          ? "ownership_failure"
          : error instanceof CartServiceError && error.code.endsWith("INPUT")
            ? "validation_failure"
            : error instanceof CartServiceError && error.code.endsWith("DATABASE_ERROR")
              ? "persistence_failure"
              : error instanceof CartServiceError
                ? "domain_failure"
                : "unexpected_failure";
      logCartObservation({
        operation: "getCart",
        classification,
        durationMs: Date.now() - startedAt,
        errorCode: error instanceof CartServiceError ? error.code : undefined,
      });
      throw error;
    }
  }

  async function createCart(owner: CartOwnerContext) {
    try {
      await ownership.authorizeCartCreation(owner);
      const customerId = typeof owner === "object" && owner !== null && "customerId" in owner && typeof owner.customerId === "string"
        ? owner.customerId
        : undefined;
      return await repository.createCart(customerId);
    } catch (error) {
      if (error instanceof CartServiceError) throw error;
      mapPersistenceError(error);
    }
  }

  async function addItem(
    cartId: string,
    input: { productId: string; variantId?: string | null; quantity: number },
    owner: CartOwnerContext,
  ) {
    validateCartSelection(input);
    await authorizeCart(cartId, owner);
    const resolved = await resolveSelection(input.productId, input.variantId);
    if (resolved.availableQuantity !== null && input.quantity > resolved.availableQuantity) {
      throw new CartServiceError(
        "INSUFFICIENT_AVAILABILITY",
        "The requested quantity is not currently available.",
        { requestedQuantity: input.quantity, availableQuantity: resolved.availableQuantity },
      );
    }

    try {
      return await retrySerializable(async () =>
        repository.withTransaction(async (txRepository) => {
          const cart = await txRepository.findCartById(cartId);
          if (!cart) throw new CartServiceError("CART_NOT_FOUND", "Cart was not found.");

          const existing = await txRepository.findCartItem(cartId, input.productId, input.variantId);
          if (!existing) {
            return txRepository.createCartItem({
              cartId,
              productId: input.productId,
              variantId: input.variantId ?? null,
              quantity: input.quantity,
            });
          }

          const nextQuantity = existing.quantity + input.quantity;
          if (resolved.availableQuantity !== null && nextQuantity > resolved.availableQuantity) {
            throw new CartServiceError(
              "INSUFFICIENT_AVAILABILITY",
              "The requested cumulative quantity is not currently available.",
              { requestedQuantity: nextQuantity, availableQuantity: resolved.availableQuantity },
            );
          }
          return txRepository.updateCartItemQuantity(existing.id, nextQuantity);
        }),
      );
    } catch (error) {
      mapPersistenceError(error);
    }
  }

  async function updateItemQuantity(cartId: string, cartItemId: string, quantity: number, owner: CartOwnerContext) {
    validateCartQuantity(quantity);
    await authorizeCart(cartId, owner);
    requireCartItemId(cartItemId);

    const item = await repository.findCartItemById(cartItemId);
    if (!item) throw new CartServiceError("CART_ITEM_NOT_FOUND", "CartItem was not found.");
    if (item.cartId !== cartId) throw new CartServiceError("CART_ITEM_NOT_FOUND", "CartItem was not found.");

    const resolved = await resolveSelection(item.productId, item.variantId);
    if (resolved.availableQuantity !== null && quantity > resolved.availableQuantity) {
      throw new CartServiceError(
        "INSUFFICIENT_AVAILABILITY",
        "The requested quantity is not currently available.",
        { requestedQuantity: quantity, availableQuantity: resolved.availableQuantity },
      );
    }

    try {
      return await retrySerializable(async () =>
        repository.withTransaction(async (txRepository) => {
          const latest = await txRepository.findCartItemById(cartItemId);
          if (!latest || latest.cartId !== cartId) {
            throw new CartServiceError("CART_ITEM_NOT_FOUND", "CartItem was not found.");
          }
          return txRepository.updateCartItemQuantity(cartItemId, quantity);
        }),
      );
    } catch (error) {
      mapPersistenceError(error);
    }
  }

  async function removeItem(cartId: string, cartItemId: string, owner: CartOwnerContext) {
    await authorizeCart(cartId, owner);
    requireCartItemId(cartItemId);

    const cart = await repository.findCartById(cartId);
    if (!cart) throw new CartServiceError("CART_NOT_FOUND", "Cart was not found.");
    const item = await repository.findCartItemById(cartItemId);
    if (!item || item.cartId !== cartId) return { removed: false, cartId, cartItemId };

    try {
      await retrySerializable(async () =>
        repository.withTransaction(async (txRepository) => {
          const latest = await txRepository.findCartItemById(cartItemId);
          if (!latest || latest.cartId !== cartId) return;
          await txRepository.removeCartItem(cartItemId);
        }),
      );
      return { removed: true, cartId, cartItemId };
    } catch (error) {
      mapPersistenceError(error);
    }
  }

  async function clearCart(cartId: string, owner: CartOwnerContext) {
    await authorizeCart(cartId, owner);
    const cart = await repository.findCartById(cartId);
    if (!cart) throw new CartServiceError("CART_NOT_FOUND", "Cart was not found.");

    try {
      const result = await retrySerializable(async () =>
        repository.withTransaction((txRepository) => txRepository.clearCartItems(cartId)),
      );
      return { cartId, removedItemCount: result.count };
    } catch (error) {
      mapPersistenceError(error);
    }
  }

  return {
    createCart,
    getCart,
    addItem,
    updateItemQuantity,
    removeItem,
    clearCart,
  };
}

export type CartService = ReturnType<typeof createCartService>;
