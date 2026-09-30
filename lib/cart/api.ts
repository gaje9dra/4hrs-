import { CartServiceError } from "@/lib/cart/errors";
import { createCartService, type CartOwnerContext, type CartService } from "@/lib/cart/service";
import { validateCartQuantity, requireCartItemId, requireProductId } from "@/lib/cart/validation";

export const CART_API_MAX_BODY_BYTES = 64 * 1024;
export const CART_API_MAX_QUANTITY = 100;

export type CartRequestContext = {
  cartId: string;
  owner: CartOwnerContext;
};

export type CartRequestContextResolver = (request: Request) => Promise<CartRequestContext>;

const unavailableRequestContext: CartRequestContextResolver = async () => {
  throw new CartServiceError(
    "CART_OWNERSHIP_UNAVAILABLE",
    "Cart ownership cannot be resolved because customer/session identity is not implemented.",
  );
};

export type CartWarning = {
  code: "PRODUCT_UNAVAILABLE" | "VARIANT_UNAVAILABLE" | "INSUFFICIENT_AVAILABILITY";
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
  availability: "AVAILABLE" | "PRODUCT_UNAVAILABLE" | "VARIANT_UNAVAILABLE" | "INSUFFICIENT_AVAILABILITY";
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
      .filter((item) => item.state !== "AVAILABLE")
      .map((item) => ({
        code: item.state,
        itemId: item.id,
      })),
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
  const service = options.service ?? createCartService();
  const resolveRequestContext = options.resolveRequestContext ?? unavailableRequestContext;

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
