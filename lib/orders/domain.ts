import { Prisma } from "@prisma/client";
import type { CreateOrderItemInput, CreateOrderAddressSnapshotInput } from "@/lib/orders/repository";
import { OrderDomainError } from "@/lib/orders/errors";

export type OrderCheckoutItem = {
  id: string;
  productId: string;
  variantId: string | null;
  productTitle: string;
  variantTitle: string | null;
  sku: string | null;
  selectedOptions: Record<string, string>;
  quantity: number;
  unitPrice: string;
  lineTotal: string;
  currency: string;
};

export type OrderCheckoutSnapshot = {
  checkoutReference: string;
  cartId: string;
  address: CreateOrderAddressSnapshotInput;
  items: OrderCheckoutItem[];
  subtotal: string;
  total: string;
  currency: string;
};

export type OrderPaymentSnapshot = {
  id: string;
  customerId: string;
  checkoutReference: string;
  status: string;
  amount: Prisma.Decimal;
  currency: string;
  completedAt: Date | null;
};

export type OrderCreationResult = {
  id: string;
  orderNumber: string;
  customerId: string;
  checkoutReference: string;
  paymentId: string;
  status: "PENDING" | "CONFIRMED";
  total: string;
  currency: string;
  createdAt: string;
};

export function validateVerifiedPayment(
  payment: OrderPaymentSnapshot | null,
  customerId: string,
): asserts payment is OrderPaymentSnapshot {
  if (!payment) {
    throw new OrderDomainError("PAYMENT_NOT_FOUND", "Payment could not be found.");
  }
  if (payment.customerId !== customerId) {
    throw new OrderDomainError("PAYMENT_ACCESS_DENIED", "Payment is not available to this customer.");
  }
  if (payment.status !== "SUCCEEDED" || !payment.completedAt) {
    throw new OrderDomainError("PAYMENT_NOT_VERIFIED", "Payment has not reached a verified successful state.");
  }
}

export function validateCheckoutForOrder(
  checkout: OrderCheckoutSnapshot | null,
  payment: OrderPaymentSnapshot,
): asserts checkout is OrderCheckoutSnapshot {
  if (!checkout || !checkout.items.length) {
    throw new OrderDomainError("CHECKOUT_INVALID", "Checkout is no longer valid for Order creation.");
  }
  if (checkout.checkoutReference !== payment.checkoutReference) {
    throw new OrderDomainError("CHECKOUT_PAYMENT_MISMATCH", "Payment does not match the validated Checkout.");
  }

  const checkoutTotal = new Prisma.Decimal(checkout.total);
  if (!checkoutTotal.eq(payment.amount)) {
    throw new OrderDomainError("AMOUNT_MISMATCH", "Payment amount does not match the authoritative Checkout total.");
  }
  if (checkout.currency !== payment.currency) {
    throw new OrderDomainError("CURRENCY_MISMATCH", "Payment currency does not match the authoritative Checkout currency.");
  }
  if (!/^[A-Z]{3}$/.test(checkout.currency)) {
    throw new OrderDomainError("CURRENCY_MISMATCH", "Checkout currency is invalid.");
  }

  for (const item of checkout.items) {
    if (!Number.isSafeInteger(item.quantity) || item.quantity < 1) {
      throw new OrderDomainError("INVALID_ORDER_ITEM", "Checkout contains an invalid item quantity.");
    }
    const expectedLineTotal = new Prisma.Decimal(item.unitPrice).mul(item.quantity).toFixed(2);
    if (expectedLineTotal !== item.lineTotal) {
      throw new OrderDomainError("INVALID_ORDER_ITEM", "Checkout contains an internally inconsistent item total.");
    }
    if (item.currency !== checkout.currency) {
      throw new OrderDomainError("CURRENCY_MISMATCH", "Checkout item currency does not match the Checkout currency.");
    }
  }

  const itemSubtotal = checkout.items
    .reduce((sum, item) => sum.add(new Prisma.Decimal(item.lineTotal)), new Prisma.Decimal(0))
    .toFixed(2);
  if (itemSubtotal !== checkout.subtotal || checkout.subtotal !== checkout.total) {
    throw new OrderDomainError("CHECKOUT_INVALID", "Checkout totals are internally inconsistent.");
  }
}

export function buildOrderItems(checkout: OrderCheckoutSnapshot): CreateOrderItemInput[] {
  return checkout.items.map((item) => ({
    productId: item.productId,
    variantId: item.variantId,
    productTitleSnapshot: item.productTitle,
    variantTitleSnapshot: item.variantTitle,
    skuSnapshot: item.sku,
    selectedOptionsSnapshot: Object.keys(item.selectedOptions).length ? item.selectedOptions : null,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    lineTotal: item.lineTotal,
    currency: item.currency,
  }));
}

export function buildAddressSnapshot(checkout: OrderCheckoutSnapshot): CreateOrderAddressSnapshotInput {
  return { ...checkout.address };
}


export type OrderLifecycleStatus = "PENDING" | "CONFIRMED";
export type OrderCustomerStatus = "PENDING" | "CONFIRMED";

const ALLOWED_TRANSITIONS: Readonly<Record<OrderLifecycleStatus, readonly OrderLifecycleStatus[]>> = {
  PENDING: ["CONFIRMED"],
  CONFIRMED: [],
};

export function assertOrderTransition(
  current: OrderLifecycleStatus,
  next: OrderLifecycleStatus,
): void {
  if (!ALLOWED_TRANSITIONS[current]?.includes(next)) {
    if (current === "CONFIRMED") {
      throw new OrderDomainError("ORDER_TERMINAL", "The Order cannot transition from its current terminal state.");
    }
    throw new OrderDomainError("ORDER_INVALID_TRANSITION", "The requested Order state transition is not allowed.");
  }
}

export function customerStatusForOrder(status: OrderLifecycleStatus): OrderCustomerStatus {
  if (status === "PENDING") return "PENDING";
  return "CONFIRMED";
}

export function isOrderLifecycleStatus(value: string): value is OrderLifecycleStatus {
  return value === "PENDING" || value === "CONFIRMED";
}
