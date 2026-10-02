import { db } from "@/lib/db/client";

export type FulfillmentOperationalDiagnostics = Readonly<{
  fulfillment: {
    id: string;
    orderId: string;
    provider: string;
    providerFulfillmentReference: string | null;
    status: string;
    idempotencyKey: string;
    requestedAt: string;
    createdAt: string;
    updatedAt: string;
    submittedAt: string | null;
    acceptedAt: string | null;
    completedAt: string | null;
    failedAt: string | null;
    errorCode: string | null;
    errorMessage: string | null;
    reconciliationState: "NOT_REQUIRED" | "RETRYABLE" | "RECONCILIATION_REQUIRED" | "TERMINAL" | "UNKNOWN";
    submissionAttempts: number;
  };
  items: readonly {
    id: string;
    orderItemId: string;
    quantity: number;
    providerSku: string | null;
    providerVariantReference: string | null;
    status: string | null;
  }[];
}>;

function iso(value: Date | null): string | null {
  return value?.toISOString() ?? null;
}

function metadataState(metadata: unknown, status: string): {
  state: FulfillmentOperationalDiagnostics["fulfillment"]["reconciliationState"];
  attempts: number;
} {
  if (status === "COMPLETED") return { state: "TERMINAL", attempts: 0 };
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return { state: "UNKNOWN", attempts: 0 };
  const record = metadata as Record<string, unknown>;
  const attempts = typeof record.submissionAttempts === "number" && Number.isSafeInteger(record.submissionAttempts)
    ? Math.max(0, record.submissionAttempts)
    : 0;
  if (record.ambiguous === true || record.reconciliationRequired === true) {
    return { state: "RECONCILIATION_REQUIRED", attempts };
  }
  if (record.retryable === true) return { state: "RETRYABLE", attempts };
  if (status === "SUBMITTED") return { state: "NOT_REQUIRED", attempts };
  if (status === "FAILED") return { state: "NOT_REQUIRED", attempts };
  return { state: "UNKNOWN", attempts };
}

export async function getFulfillmentOperationalDiagnostics(
  fulfillmentId: string,
): Promise<FulfillmentOperationalDiagnostics | null> {
  const fulfillment = await db.fulfillment.findUnique({
    where: { id: fulfillmentId },
    include: { items: true },
  });
  if (!fulfillment) return null;

  const reconciliation = metadataState(fulfillment.reconciliationMetadata, fulfillment.status);

  return {
    fulfillment: {
      id: fulfillment.id,
      orderId: fulfillment.orderId,
      provider: fulfillment.provider,
      providerFulfillmentReference: fulfillment.providerFulfillmentReference,
      status: fulfillment.status,
      idempotencyKey: fulfillment.idempotencyKey,
      requestedAt: fulfillment.requestedAt.toISOString(),
      createdAt: fulfillment.createdAt.toISOString(),
      updatedAt: fulfillment.updatedAt.toISOString(),
      submittedAt: iso(fulfillment.submittedAt),
      acceptedAt: iso(fulfillment.acceptedAt),
      completedAt: iso(fulfillment.completedAt),
      failedAt: iso(fulfillment.failedAt),
      errorCode: fulfillment.errorCode,
      errorMessage: fulfillment.errorMessage,
      reconciliationState: reconciliation.state,
      submissionAttempts: reconciliation.attempts,
    },
    items: fulfillment.items.map((item) => ({
      id: item.id,
      orderItemId: item.orderItemId,
      quantity: item.quantity,
      providerSku: item.providerSku,
      providerVariantReference: item.providerVariantReference,
      status: item.status,
    })),
  };
}
