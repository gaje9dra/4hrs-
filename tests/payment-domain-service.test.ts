import assert from "node:assert/strict";
import test from "node:test";
import { Prisma } from "@prisma/client";
import {
  createPaymentApplication,
  type ValidatedCheckoutPaymentContext,
} from "@/lib/payments/application";
import { isTerminalPaymentStatus } from "@/lib/payments/domain";
import { PaymentError } from "@/lib/payments/errors";
import { createPaymentProviderRegistry, createPaymentProviderResolver } from "@/lib/payments/resolver";
import type { PaymentProviderAdapter } from "@/lib/payments/provider";
import type { PaymentRepository } from "@/lib/payments/repository";

const customerId = "11111111-1111-4111-8111-111111111111";
const checkoutReference = "a".repeat(64);

function payment(overrides: Partial<Record<string, unknown>> = {}) {
  const now = new Date("2026-10-01T00:00:00.000Z");
  return {
    id: "22222222-2222-4222-8222-222222222222",
    customerId,
    checkoutReference,
    internalReference: "payment-ref-1",
    providerId: null,
    providerReference: null,
    status: "CREATED",
    amount: new Prisma.Decimal("998.00"),
    currency: "INR",
    completedAt: null,
    expiresAt: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function fakeRepository(initial = payment()): PaymentRepository {
  let current = initial;
  const attempts = [{ id: "attempt-1", paymentId: current.id, attemptNumber: 1, amount: current.amount, currency: current.currency, providerId: null, providerAttemptReference: null, status: current.status, failureCode: null, failureCategory: null, metadata: null, createdAt: current.createdAt, updatedAt: current.updatedAt }];
  const idempotency = new Map<string, Record<string, unknown>>();
  const events = new Map<string, Record<string, unknown>>();

  const repository = {
    withTransaction: async <T>(work: (repository: PaymentRepository) => Promise<T>) => work(repository as unknown as PaymentRepository),
    createPayment: async () => current,
    createPaymentWithInitialAttempt: async () => {
      current = payment();
      return { payment: current, attempt: attempts[0] };
    },
    getPaymentById: async (id: string, owner: string) => id === current.id && owner === current.customerId ? current : null,
    getPaymentsByCustomer: async () => [current],
    getPaymentByCheckout: async (owner: string, reference: string) =>
      idempotency.size > 0 && owner === current.customerId && reference === current.checkoutReference ? current : null,
    getPaymentByInternalReference: async (reference: string) =>
      reference === current.internalReference ? current : null,
    getPaymentByProviderReference: async () => null,
    updatePaymentStatus: async (_id: string, expected: string, next: string) => {
      if (current.status !== expected) throw new Error("concurrent");
      current = payment({ ...current, status: next, updatedAt: new Date() });
      return current;
    },
    updatePaymentProviderReferences: async (_paymentId: string, _attemptId: string, providerId: string, providerReference: string | null, providerAttemptReference: string | null) => {
      current = { ...current, providerId, providerReference } as unknown as typeof current;
      attempts[attempts.length - 1] = { ...attempts[attempts.length - 1], providerId, providerAttemptReference } as unknown as typeof attempts[number];
      return { payment: current, attempt: attempts[attempts.length - 1] };
    },
    createPaymentAttempt: async (input: Record<string, unknown>) => {
      const record = { ...attempts[0], ...input, id: `attempt-${attempts.length + 1}` };
      attempts.push(record as typeof attempts[number]);
      return record;
    },
    getPaymentAttempts: async () => attempts,
    getPaymentAttemptByProviderReference: async () => null,
    recordPaymentEvent: async (input: Record<string, unknown>) => {
      const key = `${input.providerId}:${input.providerEventId}`;
      const existing = events.get(key);
      if (existing) return { record: existing, created: false };
      const record = {
        id: `event-${events.size + 1}`,
        processingStatus: "RECEIVED",
        ...input,
      };
      events.set(key, record);
      return { record, created: true };
    },
    findPaymentEventByProviderEventId: async () => null,
    markPaymentEventProcessed: async (id: string) => {
      for (const record of events.values()) {
        if (record.id === id) record.processingStatus = "PROCESSED";
      }
      return { id, processingStatus: "PROCESSED" };
    },
    markPaymentEventFailed: async (id: string, reason: string) => ({ id, processingStatus: "FAILED", processingError: reason }),
    lookupByIdempotencyKey: async (owner: string, operation: string, key: string) => {
      const record = idempotency.get(`${owner}:${operation}:${key}`);
      return record ?? null;
    },
    createPaymentIdempotency: async (input: Record<string, unknown>) => {
      const key = `${input.customerId}:${input.operation}:${input.key}`;
      if (idempotency.has(key)) {
        throw new Error("P2002");
      }
      const record = { id: key, ...input };
      idempotency.set(key, record);
      return record;
    },
  };
  return repository as unknown as PaymentRepository;
}

const checkout: ValidatedCheckoutPaymentContext = {
  customerId,
  checkoutReference,
  amount: { value: "998.00", currency: "INR" },
};

test("creates a Payment only from an authoritative Checkout context", async () => {
  const app = createPaymentApplication({ repository: fakeRepository() });
  const result = await app.createPaymentFromCheckout({ checkout, idempotencyKey: "idem-key-1234567890" });
  assert.equal(result.amount.value, "998.00");
  assert.equal(result.amount.currency, "INR");
  assert.equal(result.status, "CREATED");
  assert.equal(result.nextAction, null);
});

test("same idempotency key replays the existing Payment", async () => {
  const repository = fakeRepository();
  const app = createPaymentApplication({ repository });
  const first = await app.createPaymentFromCheckout({ checkout, idempotencyKey: "idem-key-1234567890" });
  const second = await app.createPaymentFromCheckout({ checkout, idempotencyKey: "idem-key-1234567890" });
  assert.equal(second.id, first.id);
});

test("idempotency conflict is deterministic", async () => {
  const repository = fakeRepository();
  const app = createPaymentApplication({ repository });
  await app.createPaymentFromCheckout({ checkout, idempotencyKey: "idem-key-1234567890" });
  await assert.rejects(
    () => app.createPaymentFromCheckout({
      checkout: { ...checkout, amount: { value: "999.00", currency: "INR" } },
      idempotencyKey: "idem-key-1234567890",
    }),
    (error: unknown) => error instanceof PaymentError && error.code === "IDEMPOTENCY_CONFLICT",
  );
});

test("rejects malformed idempotency keys", async () => {
  const app = createPaymentApplication({ repository: fakeRepository() });
  await assert.rejects(
    () => app.createPaymentFromCheckout({ checkout, idempotencyKey: "short" }),
    (error: unknown) => error instanceof PaymentError && error.code === "INVALID_PAYMENT_REQUEST",
  );
});

test("valid lifecycle transition is centralized", async () => {
  const app = createPaymentApplication({ repository: fakeRepository() });
  const result = await app.transitionPaymentState({
    paymentId: "22222222-2222-4222-8222-222222222222",
    customerId,
    nextStatus: "PROCESSING",
  });
  assert.equal(result.status, "PROCESSING");
});

test("invalid lifecycle transition cannot overwrite payment state", async () => {
  const repository = fakeRepository(payment({ status: "SUCCEEDED" }));
  const app = createPaymentApplication({ repository });
  await assert.rejects(
    () => app.transitionPaymentState({
      paymentId: "22222222-2222-4222-8222-222222222222",
      customerId,
      nextStatus: "FAILED",
    }),
    (error: unknown) => error instanceof PaymentError && error.code === "PAYMENT_ALREADY_TERMINAL",
  );
});

test("FAILED payment can be retried without creating a second Payment", async () => {
  const repository = fakeRepository(payment({ status: "FAILED" }));
  const app = createPaymentApplication({ repository });
  const result = await app.retryPayment("22222222-2222-4222-8222-222222222222", customerId);
  assert.equal(result.status, "PROCESSING");
});

test("terminal states are protected from retry", async () => {
  const repository = fakeRepository(payment({ status: "REFUNDED" }));
  const app = createPaymentApplication({ repository });
  assert.equal(isTerminalPaymentStatus("REFUNDED"), true);
  await assert.rejects(
    () => app.retryPayment("22222222-2222-4222-8222-222222222222", customerId),
    (error: unknown) => error instanceof PaymentError && error.code === "PAYMENT_ALREADY_TERMINAL",
  );
});

test("provider selection is server-controlled and unconfigured execution is safe", async () => {
  const app = createPaymentApplication({ repository: fakeRepository() });
  await assert.rejects(
    () => app.startProviderPayment("22222222-2222-4222-8222-222222222222", customerId),
    (error: unknown) => error instanceof PaymentError && error.code === "PROVIDER_UNAVAILABLE",
  );
});

test("normalized duplicate events do not transition a Payment twice", async () => {
  const repository = fakeRepository();
  const app = createPaymentApplication({ repository });
  const event = {
    providerId: "test-provider",
    providerEventReference: "event-1",
    providerPaymentReference: null,
    internalPaymentReference: "payment-ref-1",
    normalizedEventType: "PAYMENT_SUCCEEDED",
    status: "SUCCEEDED" as const,
    occurredAt: "2026-10-01T00:00:00.000Z", amount: { value: "100.00", currency: "INR" }, currency: "INR",
  };
  const first = await app.processNormalizedPaymentEvent(event);
  assert.equal(first.processed, true);
  const second = await app.processNormalizedPaymentEvent(event);
  assert.equal(second.duplicate, true);
  assert.equal(second.payment?.status, "SUCCEEDED");
});

test("configured provider adapter is invoked through the resolver and normalized state is persisted", async () => {
  let calls = 0;
  const adapter: PaymentProviderAdapter = {
    id: "test-provider",
    capabilities: { createPayment: true, clientAction: false, webhookVerification: true, statusLookup: true, cancellation: false, refunds: false, partialRefunds: false },
    async createPayment(request) {
      calls += 1;
      assert.equal(request.amount.value, "998.00");
      assert.equal(request.amount.currency, "INR");
      assert.match(request.idempotencyReference, /^payment:/);
      return { providerId: "test-provider", providerPaymentReference: "provider-payment-1", providerAttemptReference: "provider-attempt-1", status: "PROCESSING", clientAction: { type: "NONE" } };
    },
    async retrievePayment() { throw new Error("not used"); },
    async verifyPayment() { throw new Error("not used"); },
    async verifyWebhook() { throw new Error("not used"); },
    normalizeStatus() { return "PROCESSING"; },
    normalizeError() { return "PROVIDER_UNKNOWN_ERROR"; },
  };
  const resolver = createPaymentProviderResolver({
    registry: createPaymentProviderRegistry([adapter]),
    configuration: {
      id: "test-provider", enabled: true, mode: "test", publicKey: null,
      secretReference: "SECRET_REF", webhookSecretReference: "WEBHOOK_SECRET_REF",
      timeoutMs: 10000, capabilities: {},
    },
  });
  const repository = fakeRepository();
  const app = createPaymentApplication({ repository, providerResolver: resolver });
  const result = await app.startProviderPayment("22222222-2222-4222-8222-222222222222", customerId);
  assert.equal(result.status, "PROCESSING");
  assert.equal(calls, 1);
});
