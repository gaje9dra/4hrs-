import { CartServiceError } from "@/lib/cart/errors";
import type { CartDto, CartItemDto, AddCartItemInput, UpdateCartItemInput } from "@/lib/cart/contracts";
import { createCartService, type CartOwnerContext, type CartService } from "@/lib/cart/service";
import { validateCartQuantity } from "@/lib/cart/validation";
import { resolveCurrentCustomer } from "@/lib/auth/context";
import { createCustomerRepository } from "@/lib/customer/repository";
import { createAuthenticatedCartOwnershipBoundary } from "@/lib/cart/auth-ownership";

export const CART_API_MAX_BODY_BYTES = 64 * 1024;
export const CART_API_MAX_QUANTITY = 100;

export type CartRequestContext = {
  cartId: string;
  owner: CartOwnerContext;
};

export type CartRequestContextResolver = (request: Request) => Promise<CartRequestContext>;

const customerRepository = createCustomerRepository();
const cartOwnership = createAuthenticatedCartOwnershipBoundary();
const authenticatedCartService = createCartService({ ownership: cartOwnership });

const authenticatedRequestContext: CartRequestContextResolver = async (request) => {
  const current = await resolveCurrentCustomer(request);
  if (!current) {
    throw new CartServiceError("CART_UNAUTHORIZED", "Authentication is required to access this Cart.");
  }

  let cart = await customerRepository.findCustomerCart(current.customer.id);
  if (!cart) {
    try {
      cart = await authenticatedCartService.createCart({ customerId: current.customer.id });
    } catch (error) {
      if (error instanceof CartServiceError && error.code === "CART_ITEM_CONFLICT") {
        cart = await customerRepository.findCustomerCart(current.customer.id);
      } else {
        throw error;
      }
    }
  }

  if (!cart) throw new CartServiceError("CART_DATABASE_ERROR", "Cart could not be initialized.");
  return { cartId: cart.id, owner: { customerId: current.customer.id } };
};

export function toCartItemDto(item: Awaited<ReturnType<CartService["getCart"]>>["items"][number]): CartItemDto {
  return {
    id: item.id,
    product: item.product,
    variant: item.variant,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    currency: item.currency,
    subtotal: item.subtotal,
    availability: item.state,
  };
}

export function toCartDto(cart: Awaited<ReturnType<CartService["getCart"]>>): CartDto {
  return {
    id: cart.id,
    items: cart.items.map(toCartItemDto),
    subtotal: cart.subtotal,
    currency: cart.currency,
    hasUnavailableItems: cart.hasUnavailableItems,
    warnings: cart.items
      .flatMap((item) => item.state === "AVAILABLE" ? [] : [{ code: item.state, itemId: item.id }]),
  };
}

function assertObject(value: unknown, message = "Request body must be a JSON object."): asserts value is Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new CartServiceError("INVALID_CART_INPUT", message);
  }
}

function assertNoUnexpectedFields(value: Record<string, unknown>, allowed: readonly string[]) {
  const allowedSet = new Set(allowed);
  const unexpected = Object.keys(value).filter((key) => !allowedSet.has(key));
  if (unexpected.length) {
    throw new CartServiceError("INVALID_CART_INPUT", "Request contains unsupported fields.", {
      fieldCount: unexpected.length,
    });
  }
}

function assertUuid(value: unknown, field: string): string {
  if (typeof value !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    throw new CartServiceError("INVALID_CART_INPUT", field + " must be a valid identifier.");
  }
  return value;
}

function assertQuantity(value: unknown): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value)) {
    throw new CartServiceError("INVALID_QUANTITY", "Quantity must be an integer.");
  }
  if (value < 1 || value > CART_API_MAX_QUANTITY) {
    throw new CartServiceError(
      "INVALID_QUANTITY",
      "Quantity must be between 1 and " + CART_API_MAX_QUANTITY + ".",
    );
  }
  validateCartQuantity(value);
  return value;
}

export function parseAddCartItemInput(value: unknown): AddCartItemInput {
  assertObject(value);
  assertNoUnexpectedFields(value, ["productId", "variantId", "quantity"]);

  const productId = assertUuid(value.productId, "productId");
  const variantId = value.variantId === undefined || value.variantId === null
    ? null
    : assertUuid(value.variantId, "variantId");

  return { productId, variantId, quantity: assertQuantity(value.quantity) };
}

export function parseUpdateCartItemInput(value: unknown): UpdateCartItemInput {
  assertObject(value);
  assertNoUnexpectedFields(value, ["quantity"]);
  return { quantity: assertQuantity(value.quantity) };
}

export function assertCartItemId(value: string): string {
  return assertUuid(value, "cartItemId");
}

export async function readJsonBody(request: Request): Promise<unknown> {
  const contentLength = request.headers.get("content-length");
  if (contentLength !== null) {
    const length = Number(contentLength);
    if (!Number.isSafeInteger(length) || length < 0) {
      throw new CartServiceError("INVALID_CART_INPUT", "Invalid request content length.");
    }
    if (length > CART_API_MAX_BODY_BYTES) {
      throw new CartServiceError("INVALID_CART_INPUT", "Request body is too large.");
    }
  }

  const body = await request.text();
  if (new TextEncoder().encode(body).byteLength > CART_API_MAX_BODY_BYTES) {
    throw new CartServiceError("INVALID_CART_INPUT", "Request body is too large.");
  }
  if (!body.trim()) {
    throw new CartServiceError("INVALID_CART_INPUT", "Request body is required.");
  }

  try {
    return JSON.parse(body);
  } catch {
    throw new CartServiceError("INVALID_CART_INPUT", "Request body must contain valid JSON.");
  }
}

export function createCartApplication(options: {
  service?: CartService;
  resolveRequestContext?: CartRequestContextResolver;
} = {}) {
  const service = options.service ?? authenticatedCartService;
  const resolveRequestContext = options.resolveRequestContext ?? authenticatedRequestContext;

  async function getCurrentCart(request: Request): Promise<CartDto> {
    const context = await resolveRequestContext(request);
    return toCartDto(await service.getCart(context.cartId, context.owner));
  }

  async function addItem(request: Request): Promise<CartDto> {
    const input = parseAddCartItemInput(await readJsonBody(request));
    const context = await resolveRequestContext(request);
    await service.addItem(context.cartId, input, context.owner);
    return getCurrentCart(request);
  }

  async function updateItem(request: Request, cartItemId: string): Promise<CartDto> {
    const itemId = assertCartItemId(cartItemId);
    const input = parseUpdateCartItemInput(await readJsonBody(request));
    const context = await resolveRequestContext(request);
    await service.updateItemQuantity(context.cartId, itemId, input.quantity, context.owner);
    return getCurrentCart(request);
  }

  async function removeItem(request: Request, cartItemId: string): Promise<CartDto> {
    const itemId = assertCartItemId(cartItemId);
    const context = await resolveRequestContext(request);
    await service.removeItem(context.cartId, itemId, context.owner);
    return getCurrentCart(request);
  }

  async function clearCart(request: Request): Promise<CartDto> {
    const context = await resolveRequestContext(request);
    await service.clearCart(context.cartId, context.owner);
    return getCurrentCart(request);
  }

  return { getCurrentCart, addItem, updateItem, removeItem, clearCart };
}

export type CartApplication = ReturnType<typeof createCartApplication>;
