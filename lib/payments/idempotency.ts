export type PaymentIdempotencyRecord = {
  scope: string;
  key: string;
  requestFingerprint: string;
  paymentId: string;
  response: unknown;
  createdAt: string;
  expiresAt: string | null;
};

export interface PaymentIdempotencyStore {
  get(scope: string, key: string): Promise<PaymentIdempotencyRecord | null>;

  put(record: PaymentIdempotencyRecord): Promise<void>;
}

export function paymentIdempotencyScope(customerId: string, operation: string): string {
  return `customer:${customerId}:payment:${operation}`;
}

export function assertIdempotencyFingerprint(
  existing: PaymentIdempotencyRecord,
  requestFingerprint: string,
): void {
  if (existing.requestFingerprint !== requestFingerprint) {
    throw new Error("Payment idempotency conflict.");
  }
}
