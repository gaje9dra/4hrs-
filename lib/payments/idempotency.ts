export function paymentIdempotencyScope(customerId: string, operation: string): string {
  return `customer:${customerId}:payment:${operation}`;
}

export function assertIdempotencyFingerprint(
  existingFingerprint: string,
  requestFingerprint: string,
): void {
  if (existingFingerprint !== requestFingerprint) {
    throw new Error("Payment idempotency conflict.");
  }
}

export function paymentRequestFingerprint(parts: readonly string[]): string {
  return parts.join("|");
}
