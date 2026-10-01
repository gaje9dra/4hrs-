import type { CheckoutErrorCode } from "@/lib/checkout/errors";

export type CheckoutObservation = {
  operation: string;
  classification: "validation_failure" | "authorization_failure" | "stale_state" | "unexpected_failure";
  durationMs: number;
  errorCode?: CheckoutErrorCode;
};

export function logCheckoutObservation(observation: CheckoutObservation): void {
  if (process.env.NODE_ENV === "test") return;
  const payload = {
    scope: "checkout",
    operation: observation.operation,
    classification: observation.classification,
    durationMs: Math.round(observation.durationMs),
    errorCode: observation.errorCode,
  };
  if (observation.classification === "unexpected_failure") console.error("[checkout]", payload);
  else console.warn("[checkout]", payload);
}
