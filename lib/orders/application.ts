import { Prisma, type PrismaClient } from "@prisma/client";
import { requireCurrentCustomer } from "@/lib/auth/context";
import { createOrderRepository, type OrderRepository } from "@/lib/orders/repository";
import { OrderDomainError } from "@/lib/orders/errors";
import {
  buildAddressSnapshot,
  buildOrderItems,
  validateCheckoutForOrder,
  validateVerifiedPayment,
  type OrderCreationResult,
} from "@/lib/orders/domain";
import { resolveOrderCheckout, type OrderCheckoutResolverClient } from "@/lib/orders/checkout-resolver";
import { createPaymentRepository, type PaymentRepository } from "@/lib/payments/repository";
import { db } from "@/lib/db/client";
import { logOrderCreationObservation } from "@/lib/orders/observability";

type CustomerContext = { id: string };

export type OrderApplicationDependencies = {
  database?: PrismaClient;
  orderRepository?: OrderRepository;
  paymentRepository?: PaymentRepository;
  resolveCustomer?: (request?: Request) => Promise<CustomerContext | null>;
  resolveCheckout?: (
    client: OrderCheckoutResolverClient,
    customerId: string,
    paymentCheckoutReference: string,
  ) => Promise<Awaited<ReturnType<typeof resolveOrderCheckout>>>;
};

export type CreateOrderFromVerifiedPaymentInput = {
  paymentId: string;
  request?: Request;
};

export type OrderApplicationService = {
  createOrderFromVerifiedPayment(input: CreateOrderFromVerifiedPaymentInput): Promise<OrderCreationResult>;
};

function isRetryableSerializationConflict(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034";
}

function isUniqueConflict(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

function toResult(order: Awaited<ReturnType<OrderRepository["getOrderById"]>>): OrderCreationResult {
  if (!order) throw new OrderDomainError("ORDER_CREATION_FAILED", "Order could not be loaded after creation.");
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    customerId: order.customerId,
    checkoutReference: order.checkoutReference,
    paymentId: order.paymentId,
    status: order.status,
    total: order.total.toFixed(2),
    currency: order.currency,
    createdAt: order.createdAt.toISOString(),
  };
}

function validatePaymentId(paymentId: string): void {
  if (!paymentId.trim()) {
    throw new OrderDomainError("PAYMENT_NOT_FOUND", "Payment could not be found.");
  }
}

export function createOrderApplication(
  dependencies: OrderApplicationDependencies = {},
): OrderApplicationService {
  const database = dependencies.database ?? db;
  const orderRepository = dependencies.orderRepository ?? createOrderRepository();
  const paymentRepository = dependencies.paymentRepository ?? createPaymentRepository();
  const resolveCustomer = dependencies.resolveCustomer ?? (async (request?: Request) => {
    const current = await requireCurrentCustomer(request);
    return { id: current.customer.id };
  });
  const resolveCheckout = dependencies.resolveCheckout ?? resolveOrderCheckout;

  async function existingForPayment(paymentId: string, customerId: string) {
    const existing = await orderRepository.getOrderByPayment(paymentId);
    if (!existing) return null;
    if (existing.customerId !== customerId) {
      throw new OrderDomainError("PAYMENT_ACCESS_DENIED", "Payment is not available to this customer.");
    }
    return existing;
  }

  async function createOrderFromVerifiedPayment(
    input: CreateOrderFromVerifiedPaymentInput,
  ): Promise<OrderCreationResult> {
    const startedAt = Date.now();
    validatePaymentId(input.paymentId);

    let customer: CustomerContext | null = null;
    try {
      customer = await resolveCustomer(input.request);
      if (!customer) throw new OrderDomainError("PAYMENT_ACCESS_DENIED", "Authentication is required.");

      const existing = await existingForPayment(input.paymentId, customer.id);
      if (existing) {
        logOrderCreationObservation({
          operation: "create-from-payment",
          customerId: customer.id,
          paymentId: input.paymentId,
          orderId: existing.id,
          orderNumber: existing.orderNumber,
          checkoutReference: existing.checkoutReference,
          result: "success",
          durationMs: Date.now() - startedAt,
        });
        return toResult(existing);
      }

      for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
          const result = await database.$transaction(async (tx) => {
            const txPayments = createPaymentRepository(tx);
            const txOrders = createOrderRepository(tx);

            const payment = await txPayments.getPaymentById(input.paymentId, customer!.id);
            validateVerifiedPayment(payment, customer!.id);

            const existingPaymentOrder = await txOrders.getOrderByPayment(payment.id);
            if (existingPaymentOrder) {
              if (existingPaymentOrder.customerId !== customer!.id) {
                throw new OrderDomainError("PAYMENT_ACCESS_DENIED", "Payment is not available to this customer.");
              }
              return toResult(existingPaymentOrder);
            }

            const checkout = await resolveCheckout(tx, customer!.id, payment.checkoutReference);
            validateCheckoutForOrder(checkout, payment);

            const existingCheckoutOrder = await txOrders.getOrderByCheckout(checkout.checkoutReference);
            if (existingCheckoutOrder) {
              if (existingCheckoutOrder.customerId !== customer!.id) {
                throw new OrderDomainError("CHECKOUT_ACCESS_DENIED" as never, "Checkout is not available to this customer.");
              }
              if (existingCheckoutOrder.paymentId === payment.id) return toResult(existingCheckoutOrder);
              throw new OrderDomainError("CHECKOUT_ALREADY_CONVERTED", "Checkout has already been converted into an Order.");
            }

            const created = await txOrders.createOrderWithItems({
              customerId: customer!.id,
              checkoutReference: checkout.checkoutReference,
              paymentId: payment.id,
              subtotal: checkout.subtotal,
              total: checkout.total,
              currency: checkout.currency,
              status: "PENDING",
              items: buildOrderItems(checkout),
              shippingAddress: buildAddressSnapshot(checkout),
            });

            return toResult(created);
          });

          logOrderCreationObservation({
            operation: "create-from-payment",
            customerId: customer.id,
            paymentId: input.paymentId,
            orderId: result.id,
            orderNumber: result.orderNumber,
            checkoutReference: result.checkoutReference,
            result: "success",
            durationMs: Date.now() - startedAt,
          });
          return result;
        } catch (error) {
          if (isRetryableSerializationConflict(error) && attempt < 2) continue;

          if (isUniqueConflict(error)) {
            const racedPaymentOrder = await orderRepository.getOrderByPayment(input.paymentId);
            if (racedPaymentOrder && racedPaymentOrder.customerId === customer.id) {
              return toResult(racedPaymentOrder);
            }
            if (racedPaymentOrder) {
              throw new OrderDomainError("PAYMENT_ACCESS_DENIED", "Payment is not available to this customer.");
            }

            const payment = await paymentRepository.getPaymentById(input.paymentId, customer.id);
            if (payment) {
              const racedCheckoutOrder = await orderRepository.getOrderByCheckout(payment.checkoutReference);
              if (racedCheckoutOrder && racedCheckoutOrder.customerId === customer.id && racedCheckoutOrder.paymentId === payment.id) {
                return toResult(racedCheckoutOrder);
              }
              if (racedCheckoutOrder) {
                throw new OrderDomainError("CHECKOUT_ALREADY_CONVERTED", "Checkout has already been converted into an Order.");
              }
            }
          }

          if (error instanceof OrderDomainError) throw error;
          throw new OrderDomainError(
            "ORDER_CREATION_FAILED",
            "Order creation could not be completed safely.",
            undefined,
            { cause: error },
          );
        }
      }

      throw new OrderDomainError("ORDER_CREATION_FAILED", "Order creation could not be completed safely after concurrent retries.");
    } catch (error) {
      const domainError = error instanceof OrderDomainError
        ? error
        : new OrderDomainError("ORDER_CREATION_FAILED", "Order creation could not be completed safely.", undefined, { cause: error });

      logOrderCreationObservation({
        operation: "create-from-payment",
        customerId: customer?.id,
        paymentId: input.paymentId,
        result: "failure",
        failureCode: domainError.code,
        durationMs: Date.now() - startedAt,
      });
      throw domainError;
    }
  }

  return { createOrderFromVerifiedPayment };
}
