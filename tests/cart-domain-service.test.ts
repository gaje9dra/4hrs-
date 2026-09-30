import test from "node:test";
import assert from "node:assert/strict";
import { CartServiceError } from "@/lib/cart/errors";
import { createCartService, type CartOwnershipBoundary } from "@/lib/cart/service";
import type { CartRepository } from "@/lib/cart/repository";

const product = {
  id: "product-1",
  title: "Test Tee",
  slug: "test-tee",
  description: null,
  shortDescription: null,
  price: "499.00",
  compareAtPrice: null,
  currency: "INR",
  status: "ACTIVE" as const,
  seoTitle: null,
  seoDescription: null,
  media: [{ id: "image-1", url: "/tee.jpg", altText: "Test Tee", sortOrder: 0, isPrimary: true, mediaType: "IMAGE" as const }],
  variants: [{
    id: "variant-1",
    displayName: "Black / M",
    size: "M",
    color: "Black",
    price: "549.00",
    compareAtPrice: null,
    availability: { state: "IN_STOCK" as const, availableQuantity: 5 },
    media: [],
    optionValues: [],
  }],
  options: [],
  categories: [],
  collections: [],
  tags: [],
  availability: { state: "IN_STOCK" as const, availableQuantity: 5 },
};

function makeRepository() {
  const items: Array<{ id: string; cartId: string; productId: string; variantId: string | null; quantity: number }> = [];
  const cart = { id: "cart-1", items };

  const repository = {
    withTransaction: async <T>(work: (repository: CartRepository) => Promise<T>) => work(repository as unknown as CartRepository),
    createCart: async () => ({ id: "cart-1", createdAt: new Date(), updatedAt: new Date() }),
    findCartById: async (cartId: string) => cartId === cart.id ? { ...cart, items: [...items] } : null,
    createCartItem: async (input: { cartId: string; productId: string; variantId?: string | null; quantity: number }) => {
      const item = { id: `item-${items.length + 1}`, cartId: input.cartId, productId: input.productId, variantId: input.variantId ?? null, quantity: input.quantity };
      items.push(item);
      return item;
    },
    findCartItemById: async (id: string) => items.find((item) => item.id === id) ?? null,
    findCartItem: async (cartId: string, productId: string, variantId?: string | null) =>
      items.find((item) => item.cartId === cartId && item.productId === productId && item.variantId === (variantId ?? null)) ?? null,
    updateCartItemQuantity: async (id: string, quantity: number) => {
      const item = items.find((candidate) => candidate.id === id);
      if (!item) throw new Error("missing item");
      item.quantity = quantity;
      return item;
    },
    removeCartItem: async (id: string) => {
      const index = items.findIndex((item) => item.id === id);
      if (index < 0) throw new Error("missing item");
      return items.splice(index, 1)[0];
    },
    clearCartItems: async (cartId: string) => {
      const before = items.length;
      for (let index = items.length - 1; index >= 0; index -= 1) {
        if (items[index].cartId === cartId) items.splice(index, 1);
      }
      return { count: before - items.length };
    },
  };

  return repository as unknown as CartRepository;
}

function makeOwnership(): CartOwnershipBoundary {
  return {
    authorizeCartAccess: async (cartId) => {
      if (cartId !== "cart-1") throw new CartServiceError("CART_UNAUTHORIZED", "Cart access is not authorized.");
    },
    authorizeCartCreation: async () => undefined,
  };
}

function makeService(overrides: Partial<Parameters<typeof createCartService>[0]> = {}) {
  return createCartService({
    repository: makeRepository(),
    ownership: makeOwnership(),
    catalogRepository: {
      getProductById: async (id: string) => id === product.id ? {
        id: product.id,
        title: product.title,
        slug: product.slug,
        status: product.status,
      } : null,
    } as never,
    catalogQuery: {
      getPublishedProductDetailsBySlug: async () => product,
    } as never,
    ...overrides,
  });
}

test("Cart service fails closed when no ownership mechanism is configured", async () => {
  const service = createCartService();
  await assert.rejects(
    service.createCart("opaque-owner"),
    (error: unknown) => error instanceof CartServiceError && error.code === "CART_OWNERSHIP_UNAVAILABLE",
  );
});

test("addItem validates the canonical selection and increments an existing logical item", async () => {
  const service = makeService();

  const created = await service.addItem("cart-1", {
    productId: "product-1",
    variantId: "variant-1",
    quantity: 2,
  }, "owner");
  assert.equal(created.quantity, 2);

  const updated = await service.addItem("cart-1", {
    productId: "product-1",
    variantId: "variant-1",
    quantity: 1,
  }, "owner");
  assert.equal(updated.quantity, 3);
});

test("Cart service rejects invalid quantity, invalid variant, and insufficient availability", async () => {
  const service = makeService();

  await assert.rejects(
    service.addItem("cart-1", { productId: "product-1", variantId: "variant-1", quantity: 0 }, "owner"),
    (error: unknown) => error instanceof CartServiceError && error.code === "INVALID_QUANTITY",
  );

  await assert.rejects(
    service.addItem("cart-1", { productId: "product-1", variantId: "missing", quantity: 1 }, "owner"),
    (error: unknown) => error instanceof CartServiceError && error.code === "INVALID_VARIANT",
  );

  await assert.rejects(
    service.addItem("cart-1", { productId: "product-1", variantId: "variant-1", quantity: 6 }, "owner"),
    (error: unknown) => error instanceof CartServiceError && error.code === "INSUFFICIENT_AVAILABILITY",
  );
});

test("Cart service rejects cross-cart access before CartItem mutation", async () => {
  const service = makeService();

  await assert.rejects(
    service.addItem("other-cart", { productId: "product-1", variantId: "variant-1", quantity: 1 }, "owner"),
    (error: unknown) => error instanceof CartServiceError && error.code === "CART_UNAUTHORIZED",
  );
});

test("getCart resolves authoritative current price and server-side subtotal", async () => {
  const service = makeService();
  await service.addItem("cart-1", { productId: "product-1", variantId: "variant-1", quantity: 2 }, "owner");

  const cart = await service.getCart("cart-1", "owner");
  assert.equal(cart.items[0]?.unitPrice, "549.00");
  assert.equal(cart.items[0]?.subtotal, "1098.00");
  assert.equal(cart.subtotal, "1098.00");
  assert.equal(cart.items[0]?.state, "AVAILABLE");
});

test("removeItem and clearCart are deterministic and scoped to the owned Cart", async () => {
  const service = makeService();
  await service.addItem("cart-1", { productId: "product-1", variantId: "variant-1", quantity: 1 }, "owner");

  const removed = await service.removeItem("cart-1", "item-1", "owner");
  assert.equal(removed.removed, true);

  const missing = await service.removeItem("cart-1", "item-1", "owner");
  assert.equal(missing.removed, false);

  await service.addItem("cart-1", { productId: "product-1", variantId: "variant-1", quantity: 1 }, "owner");
  const cleared = await service.clearCart("cart-1", "owner");
  assert.equal(cleared.removedItemCount, 1);
});

test("updateItemQuantity revalidates availability and preserves CartItem identity", async () => {
  const service = makeService();
  await service.addItem("cart-1", { productId: "product-1", variantId: "variant-1", quantity: 1 }, "owner");

  const updated = await service.updateItemQuantity("cart-1", "item-1", 4, "owner");
  assert.equal(updated.id, "item-1");
  assert.equal(updated.quantity, 4);

  await assert.rejects(
    service.updateItemQuantity("cart-1", "item-1", 6, "owner"),
    (error: unknown) => error instanceof CartServiceError && error.code === "INSUFFICIENT_AVAILABILITY",
  );
});

test("update, remove, and clear operations cannot cross the ownership boundary", async () => {
  const service = makeService();
  await service.addItem("cart-1", { productId: "product-1", variantId: "variant-1", quantity: 1 }, "owner");

  await assert.rejects(
    service.updateItemQuantity("other-cart", "item-1", 2, "owner"),
    (error: unknown) => error instanceof CartServiceError && error.code === "CART_UNAUTHORIZED",
  );
  await assert.rejects(
    service.removeItem("other-cart", "item-1", "owner"),
    (error: unknown) => error instanceof CartServiceError && error.code === "CART_UNAUTHORIZED",
  );
  await assert.rejects(
    service.clearCart("other-cart", "owner"),
    (error: unknown) => error instanceof CartServiceError && error.code === "CART_UNAUTHORIZED",
  );
});

test("price changes are resolved from the current catalog rather than Cart persistence", async () => {
  let currentProduct = product;
  const service = createCartService({
    repository: makeRepository(),
    ownership: makeOwnership(),
    catalogRepository: {
      getProductById: async () => ({ id: product.id, title: product.title, slug: product.slug, status: product.status }),
    } as never,
    catalogQuery: {
      getPublishedProductDetailsBySlug: async () => currentProduct,
    } as never,
  });

  await service.addItem("cart-1", { productId: "product-1", variantId: "variant-1", quantity: 1 }, "owner");
  currentProduct = {
    ...product,
    variants: [{ ...product.variants[0], price: "599.00" }],
  };

  const cart = await service.getCart("cart-1", "owner");
  assert.equal(cart.items[0]?.unitPrice, "599.00");
  assert.equal(cart.items[0]?.subtotal, "599.00");
});

test("stale product publication state becomes a structured unavailable line", async () => {
  const repository = makeRepository();
  const service = createCartService({
    repository,
    ownership: makeOwnership(),
    catalogRepository: {
      getProductById: async () => ({ id: product.id, title: product.title, slug: product.slug, status: "DRAFT" }),
    } as never,
    catalogQuery: {
      getPublishedProductDetailsBySlug: async () => {
        throw new CartServiceError("PRODUCT_UNAVAILABLE", "Product is not currently purchasable.");
      },
    } as never,
  });

  const seeded = await repository.createCartItem({
    cartId: "cart-1",
    productId: "product-1",
    variantId: "variant-1",
    quantity: 1,
  });

  const cart = await service.getCart("cart-1", "owner");
  assert.equal(cart.items[0]?.id, seeded.id);
  assert.equal(cart.items[0]?.state, "PRODUCT_UNAVAILABLE");
  assert.equal(cart.hasUnavailableItems, true);
});
