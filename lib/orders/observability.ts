import type { OrderErrorCode } from "@/lib/orders/errors";

export type OrderCreationObservation = {
  operation: "create-from-payment";
  customerId?: string;
  paymentId?: string;
  orderId?: string;
  orderNumber?: string;
  checkoutReference?: string;
  result: "success" | "failure";
  failureCode?: OrderErrorCode;
  durationMs: number;
};

export function logOrderCreationObservation(observation: OrderCreationObservation): void {
  if (process.env.NODE_ENV === "test") return;
  const payload = {
    scope: "order",
    operation: observation.operation,
    customerId: observation.customerId,
    paymentId: observation.paymentId,
    orderId: observation.orderId,
    orderNumber: observation.orderNumber,
    checkoutReference: observation.checkoutReference,
    result: observation.result,
    failureCode: observation.failureCode,
    durationMs: Math.round(observation.durationMs),
  };
  if (observation.result === "failure") console.warn("[order]", payload);
  else console.info("[order]", payload);
}


export type OrderLifecycleObservation = {
  operation: "transition";
  orderId: string;
  orderNumber?: string;
  from: "PENDING" | "CONFIRMED";
  to: "PENDING" | "CONFIRMED";
  actor: "SYSTEM";
  result: "success" | "rejected" | "concurrency-conflict";
  failureCode?: string;
};

export function logOrderLifecycleObservation(observation: OrderLifecycleObservation): void {
  if (process.env.NODE_ENV === "test") return;
  const payload = {
    scope: "order",
    operation: observation.operation,
    orderId: observation.orderId,
    orderNumber: observation.orderNumber,
    from: observation.from,
    to: observation.to,
    actor: observation.actor,
    result: observation.result,
    failureCode: observation.failureCode,
  };
  if (observation.result === "success") console.info("[order]", payload);
  else console.warn("[order]", payload);
}
