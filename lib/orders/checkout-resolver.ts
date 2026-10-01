import { createHash } from "node:crypto";
import { Prisma, type PrismaClient } from "@prisma/client";
import type { OrderCheckoutItem, OrderCheckoutSnapshot } from "@/lib/orders/domain";
import { OrderDomainError } from "@/lib/orders/errors";
import { createCheckoutPaymentReference } from "@/lib/payments/checkout";

export type OrderCheckoutResolverClient = PrismaClient | Prisma.TransactionClient;

function digest(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function revisionForItems(cartId: string, items: OrderCheckoutItem[]) {
  const sorted = [...items].sort((a, b) => a.id.localeCompare(b.id));
  const structure = sorted.map((item) =>
    [item.id, item.productId, item.variantId ?? "", item.quantity].join("|"),
  ).join("\n");
  const pricing = sorted.map((item) =>
    [item.id, item.unitPrice, item.lineTotal, item.currency].join("|"),
  ).join("\n");
  const availability = sorted.map((item) =>
    [item.id, "AVAILABLE", item.quantity, item.productId, item.variantId ?? ""].join("|"),
  ).join("\n");

  return {
    cart: digest([cartId, structure].join("\n")),
    pricing: digest([sorted[0]?.currency ?? "", pricing].join("\n")),
    availability: digest(availability),
  };
}

function availabilityFor(
  inventory: { trackingEnabled: boolean; onHand: number; reserved: number } | null,
): { availableQuantity: number | null; available: boolean } {
  if (!inventory) return { availableQuantity: null, available: true };
  if (!inventory.trackingEnabled) return { availableQuantity: null, available: true };
  const availableQuantity = inventory.onHand - inventory.reserved;
  return { availableQuantity, available: availableQuantity > 0 };
}

export async function resolveOrderCheckout(
  client: OrderCheckoutResolverClient,
  customerId: string,
  paymentCheckoutReference: string,
): Promise<OrderCheckoutSnapshot> {
  const cart = await client.cart.findUnique({
    where: { customerId },
    include: { items: true },
  });

  if (!cart || cart.items.length === 0) {
    throw new OrderDomainError("CHECKOUT_INVALID", "Checkout Cart is missing or empty.");
  }

  const productIds = [...new Set(cart.items.map((item) => item.productId))];
  const products = await client.product.findMany({
    where: { id: { in: productIds } },
    include: {
      variants: {
        include: {
          optionValues: {
            include: { optionValue: { include: { optionType: true } } },
            orderBy: { optionValue: { sortOrder: "asc" } },
          },
          inventory: true,
        },
      },
    },
  });
  const productsById = new Map(products.map((product) => [product.id, product]));

  const items: OrderCheckoutItem[] = [];
  const currencies = new Set<string>();

  for (const cartItem of cart.items) {
    if (!Number.isSafeInteger(cartItem.quantity) || cartItem.quantity < 1) {
      throw new OrderDomainError("INVALID_ORDER_ITEM", "Checkout contains an invalid item quantity.");
    }

    const product = productsById.get(cartItem.productId);
    if (!product || product.status !== "ACTIVE" || !product.title.trim() || !product.slug.trim()) {
      throw new OrderDomainError("INVALID_ORDER_ITEM", "A Checkout product is no longer purchasable.");
    }

    const variant = cartItem.variantId
      ? product.variants.find((candidate) => candidate.id === cartItem.variantId)
      : null;

    if (cartItem.variantId && (!variant || variant.status !== "ACTIVE")) {
      throw new OrderDomainError("INVALID_ORDER_ITEM", "A Checkout variant is no longer purchasable.");
    }
    if (!cartItem.variantId && product.variants.length > 0) {
      throw new OrderDomainError("INVALID_ORDER_ITEM", "A Product with variants requires a selected variant.");
    }

    const effectivePrice = variant?.price ?? product.price;
    const unitPrice = new Prisma.Decimal(effectivePrice);
    if (!unitPrice.isFinite() || unitPrice.isNegative()) {
      throw new OrderDomainError("INVALID_ORDER_ITEM", "Checkout contains an invalid product price.");
    }

    if (!variant) {\n      throw new OrderDomainError("INVALID_ORDER_ITEM", "A purchasable Checkout item requires a valid ProductVariant.");\n    }\n\n    const availability = availabilityFor(variant.inventory);
    if (!availability.available || (availability.availableQuantity !== null && cartItem.quantity > availability.availableQuantity)) {
      throw new OrderDomainError("INVALID_ORDER_ITEM", "A Checkout item is no longer available in the requested quantity.");
    }

    const currency = product.currency;
    if (!/^[A-Z]{3}$/.test(currency)) {
      throw new OrderDomainError("CURRENCY_MISMATCH", "Checkout currency is invalid.");
    }
    currencies.add(currency);

    const selectedOptions: Record<string, string> = {};
    for (const option of variant?.optionValues ?? []) {
      selectedOptions[option.optionValue.optionType.normalizedName] = option.optionValue.displayName;
    }

    const lineTotal = unitPrice.mul(cartItem.quantity).toFixed(2);
    items.push({
      id: cartItem.id,
      productId: product.id,
      variantId: variant?.id ?? null,
      productTitle: product.title,
      variantTitle: variant?.displayName ?? null,
      sku: variant?.sku ?? null,
      selectedOptions,
      quantity: cartItem.quantity,
      unitPrice: unitPrice.toFixed(2),
      lineTotal,
      currency,
    });
  }

  if (currencies.size !== 1) {
    throw new OrderDomainError("CURRENCY_MISMATCH", "Checkout contains incompatible currencies.");
  }

  const currency = [...currencies][0];
  const subtotal = items
    .reduce((sum, item) => sum.add(new Prisma.Decimal(item.lineTotal)), new Prisma.Decimal(0))
    .toFixed(2);
  const revision = revisionForItems(cart.id, items);

  const addresses = await client.customerAddress.findMany({
    where: { customerId },
    orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }, { id: "desc" }],
  });

  for (const address of addresses) {
    const checkoutReference = createCheckoutPaymentReference(customerId, {
      customer: { id: customerId, email: "", displayName: null },
      cart: { id: cart.id },
      address: { id: address.id },
      totals: { total: subtotal, currency },
      revision,
      validation: { state: "VALID" },
    });

    if (checkoutReference === paymentCheckoutReference) {
      return {
        checkoutReference,
        cartId: cart.id,
        address: {
          recipientName: address.recipientName,
          phone: address.phone,
          addressLine1: address.addressLine1,
          addressLine2: address.addressLine2,
          city: address.city,
          stateOrProvince: address.stateOrProvince,
          postalCode: address.postalCode,
          countryCode: address.countryCode,
          label: address.label,
        },
        items,
        subtotal,
        total: subtotal,
        currency,
      };
    }
  }

  throw new OrderDomainError("CHECKOUT_INVALID", "The authoritative Checkout no longer matches the Payment.");
}
