import { Prisma, type PrismaClient } from "@prisma/client";
import { db } from "@/lib/db/client";

export type CartRepositoryClient = PrismaClient | Prisma.TransactionClient;

type CartRecord = Prisma.CartGetPayload<{ include: { items: true } }>;
type CartItemRecord = Prisma.CartItemGetPayload<{}>;

export type CartRepository = {
  withTransaction<T>(work: (transactionRepository: CartRepository) => Promise<T>, options?: CartRepositoryTransactionOptions): Promise<T>;
  createCart(customerId?: string): Promise<Prisma.CartGetPayload<{}>>;
  findCartById(cartId: string): Promise<CartRecord | null>;
  createCartItem(input: CreateCartItemInput): Promise<CartItemRecord>;
  findCartItemById(cartItemId: string): Promise<CartItemRecord | null>;
  findCartItem(cartId: string, productId: string, variantId?: string | null): Promise<CartItemRecord | null>;
  updateCartItemQuantity(cartItemId: string, quantity: number): Promise<CartItemRecord>;
  removeCartItem(cartItemId: string): Promise<CartItemRecord>;
  clearCartItems(cartId: string): Promise<Prisma.BatchPayload>;
};

export type CartRepositoryTransactionOptions = {
  maxWait?: number;
  timeout?: number;
};

export type CreateCartItemInput = {
  cartId: string;
  productId: string;
  variantId?: string | null;
  quantity: number;
};

function clientOrDefault(client?: CartRepositoryClient): CartRepositoryClient {
  return client ?? db;
}

function assertPositiveQuantity(quantity: number) {
  if (!Number.isInteger(quantity) || quantity < 1) {
    throw new Error("Cart item quantity must be a positive integer.");
  }
}

export function createCartRepository(client?: CartRepositoryClient): CartRepository {
  const database = clientOrDefault(client);

  return {
    withTransaction<T>(work: (transactionRepository: CartRepository) => Promise<T>, options?: CartRepositoryTransactionOptions) {
      if ("$transaction" in database) {
        return database.$transaction(
          async (tx) => work(createCartRepository(tx)),
          {
            ...(options?.maxWait !== undefined ? { maxWait: options.maxWait } : {}),
            ...(options?.timeout !== undefined ? { timeout: options.timeout } : {}),
            isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
          },
        );
      }
      return work(createCartRepository(database));
    },

    createCart(customerId?: string) {
      return database.cart.create({
        data: customerId ? { customerId } : {},
      });
    },

    findCartById(cartId: string) {
      return database.cart.findUnique({
        where: { id: cartId },
        include: {
          items: {
            orderBy: [{ createdAt: "asc" }, { id: "asc" }],
          },
        },
      });
    },

    createCartItem(input: CreateCartItemInput) {
      assertPositiveQuantity(input.quantity);

      return database.cartItem.create({
        data: {
          cartId: input.cartId,
          productId: input.productId,
          variantId: input.variantId ?? null,
          quantity: input.quantity,
        },
      });
    },

    findCartItemById(cartItemId: string) {
      return database.cartItem.findUnique({
        where: { id: cartItemId },
      });
    },

    findCartItem(
      cartId: string,
      productId: string,
      variantId?: string | null,
    ) {
      return database.cartItem.findFirst({
        where: {
          cartId,
          productId,
          variantId: variantId ?? null,
        },
      });
    },

    updateCartItemQuantity(cartItemId: string, quantity: number) {
      assertPositiveQuantity(quantity);

      return database.cartItem.update({
        where: { id: cartItemId },
        data: { quantity },
      });
    },

    removeCartItem(cartItemId: string) {
      return database.cartItem.delete({
        where: { id: cartItemId },
      });
    },

    clearCartItems(cartId: string) {
      return database.cartItem.deleteMany({
        where: { cartId },
      });
    },
  };
}

