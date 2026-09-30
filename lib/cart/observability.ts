import type { CartErrorCode } from "@/lib/cart/errors";

export type CartObservation = {
  operation: string;
  classification: "validation_failure" | "ownership_failure" | "domain_failure" | "persistence_failure" | "unexpected_failure";
  durationMs: number;
  errorCode?: CartErrorCode;
};

export function logCartObservation(observation: CartObservation): void {
  if (process.env.NODE_ENV === "test") return;
  const level = observation.classification === "unexpected_failure" || observation.classification === "persistence_failure"
    ? "error"
    : "warn";
  const payload = {
    scope: "cart",
    ...observation,
  };
  if (level === "error") console.error("[cart]", payload);
  else console.warn("[cart]", payload);
}
