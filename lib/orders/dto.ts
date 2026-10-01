import type { Prisma } from "@prisma/client";
import type { OrderWithRelations } from "@/lib/orders/repository";
import type { PublicOrderDto, PublicOrderListDto } from "@/lib/orders/contracts";

function selectedOptions(value: Prisma.JsonValue | null): Record<string, string> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const result: Record<string, string> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (typeof entry === "string") result[key] = entry;
  }
  return Object.keys(result).length ? result : null;
}

export function toPublicOrderDto(order: OrderWithRelations): PublicOrderDto {
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    status: order.status,
    createdAt: order.createdAt.toISOString(),
    currency: order.currency,
    subtotal: order.subtotal.toFixed(2),
    total: order.total.toFixed(2),
    address: order.shippingAddress
      ? {
          recipientName: order.shippingAddress.recipientName,
          phone: order.shippingAddress.phone,
          addressLine1: order.shippingAddress.addressLine1,
          addressLine2: order.shippingAddress.addressLine2,
          city: order.shippingAddress.city,
          stateOrProvince: order.shippingAddress.stateOrProvince,
          postalCode: order.shippingAddress.postalCode,
          countryCode: order.shippingAddress.countryCode,
          label: order.shippingAddress.label,
        }
      : null,
    items: order.items.map((item) => ({
      productId: item.productId,
      variantId: item.variantId,
      productTitle: item.productTitleSnapshot,
      variantTitle: item.variantTitleSnapshot,
      sku: item.skuSnapshot,
      selectedOptions: selectedOptions(item.selectedOptionsSnapshot),
      quantity: item.quantity,
      unitPrice: item.unitPrice.toFixed(2),
      lineTotal: item.lineTotal.toFixed(2),
      currency: item.currency,
    })),
  };
}

export function toPublicOrderListDto(input: {
  orders: OrderWithRelations[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
}): PublicOrderListDto {
  return {
    orders: input.orders.map(toPublicOrderDto),
    pagination: {
      page: input.page,
      pageSize: input.pageSize,
      total: input.total,
      totalPages: input.totalPages,
      hasNextPage: input.hasNextPage,
    },
  };
}
