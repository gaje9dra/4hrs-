import { Prisma, type PrismaClient, type PaymentStatus, type PaymentEventProcessingStatus } from "@prisma/client";
import { db } from "@/lib/db/client";

export type PaymentRepositoryClient = PrismaClient | Prisma.TransactionClient;

type PaymentRecord = Prisma.PaymentGetPayload<Record<string, never>>;
type PaymentAttemptRecord = Prisma.PaymentAttemptGetPayload<Record<string, never>>;
type PaymentEventRecord = Prisma.PaymentEventGetPayload<Record<string, never>>;
type PaymentIdempotencyRecord = Prisma.PaymentIdempotencyGetPayload<Record<string, never>>;

export type CreatePaymentInput = {
  customerId: string;
  checkoutReference: string;
  internalReference: string;
  amount: Prisma.Decimal | string;
  currency: string;
  providerId?: string | null;
  providerReference?: string | null;
  status?: PaymentStatus;
  expiresAt?: Date | null;
};

export type CreatePaymentAttemptInput = {
  paymentId: string;
  attemptNumber: number;
  amount: Prisma.Decimal | string;
  currency: string;
  providerId?: string | null;
  providerAttemptReference?: string | null;
  status?: PaymentStatus;
  failureCode?: string | null;
  failureCategory?: string | null;
  metadata?: Prisma.InputJsonValue;
};

export type CreatePaymentEventInput = {
  providerId: string;
  providerEventId: string;
  eventType: string;
  normalizedEventType?: string | null;
  paymentId?: string | null;
  occurredAt?: Date | null;
  metadata?: Prisma.InputJsonValue;
};

export type CreatePaymentIdempotencyInput = {
  customerId: string;
  checkoutReference: string;
  operation: string;
  key: string;
  requestFingerprint: string;
  paymentId: string;
  response?: Prisma.InputJsonValue;
  expiresAt?: Date | null;
};

export type PaymentEventRecordResult = {
  record: PaymentEventRecord;
  created: boolean;
};

export type PaymentRepository = {
  withTransaction<T>(
    work: (repository: PaymentRepository) => Promise<T>,
    options?: PaymentRepositoryTransactionOptions,
  ): Promise<T>;
  createPayment(input: CreatePaymentInput): Promise<PaymentRecord>;
  createPaymentWithInitialAttempt(
    payment: CreatePaymentInput,
    attempt: CreatePaymentAttemptInput,
  ): Promise<{ payment: PaymentRecord; attempt: PaymentAttemptRecord }>;
  getPaymentById(paymentId: string, customerId: string): Promise<PaymentRecord | null>;
  getPaymentsByCustomer(customerId: string): Promise<PaymentRecord[]>;
  getPaymentByCheckout(customerId: string, checkoutReference: string): Promise<PaymentRecord | null>;
  getPaymentByProviderReference(
    providerId: string,
    providerReference: string,
  ): Promise<PaymentRecord | null>;
  updatePaymentStatus(
    paymentId: string,
    expectedStatus: PaymentStatus,
    nextStatus: PaymentStatus,
    completedAt?: Date | null,
  ): Promise<PaymentRecord>;
  createPaymentAttempt(input: CreatePaymentAttemptInput): Promise<PaymentAttemptRecord>;
  getPaymentAttempts(paymentId: string): Promise<PaymentAttemptRecord[]>;
  getPaymentAttemptByProviderReference(
    providerId: string,
    providerAttemptReference: string,
  ): Promise<PaymentAttemptRecord | null>;
  recordPaymentEvent(input: CreatePaymentEventInput): Promise<PaymentEventRecordResult>;
  findPaymentEventByProviderEventId(
    providerId: string,
    providerEventId: string,
  ): Promise<PaymentEventRecord | null>;
  markPaymentEventProcessed(
    eventId: string,
    processedAt?: Date,
  ): Promise<PaymentEventRecord>;
  markPaymentEventFailed(
    eventId: string,
    processingError: string,
  ): Promise<PaymentEventRecord>;
  lookupByIdempotencyKey(
    customerId: string,
    operation: string,
    key: string,
  ): Promise<PaymentIdempotencyRecord | null>;
  createPaymentIdempotency(
    input: CreatePaymentIdempotencyInput,
  ): Promise<PaymentIdempotencyRecord>;
};

export type PaymentRepositoryTransactionOptions = {
  maxWait?: number;
  timeout?: number;
};

function clientOrDefault(client?: PaymentRepositoryClient): PaymentRepositoryClient {
  return client ?? db;
}

function assertNonEmpty(value: string, field: string) {
  if (!value.trim()) throw new Error(`${field} must not be empty.`);
}

function assertAttemptNumber(value: number) {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new Error("Payment attempt number must be a positive integer.");
  }
}

export function createPaymentRepository(client?: PaymentRepositoryClient): PaymentRepository {
  const database = clientOrDefault(client);

  return {
    withTransaction<T>(
      work: (repository: PaymentRepository) => Promise<T>,
      options?: PaymentRepositoryTransactionOptions,
    ) {
      if ("$transaction" in database) {
        return database.$transaction(
          async (tx) => work(createPaymentRepository(tx)),
          {
            ...(options?.maxWait !== undefined ? { maxWait: options.maxWait } : {}),
            ...(options?.timeout !== undefined ? { timeout: options.timeout } : {}),
            isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
          },
        );
      }
      return work(createPaymentRepository(database));
    },

    createPayment(input) {
      assertNonEmpty(input.customerId, "customerId");
      assertNonEmpty(input.checkoutReference, "checkoutReference");
      assertNonEmpty(input.internalReference, "internalReference");
      assertNonEmpty(input.currency, "currency");

      return database.payment.create({
        data: {
          customerId: input.customerId,
          checkoutReference: input.checkoutReference,
          internalReference: input.internalReference,
          amount: input.amount,
          currency: input.currency,
          ...(input.providerId !== undefined ? { providerId: input.providerId } : {}),
          ...(input.providerReference !== undefined ? { providerReference: input.providerReference } : {}),
          ...(input.status !== undefined ? { status: input.status } : {}),
          ...(input.expiresAt !== undefined ? { expiresAt: input.expiresAt } : {}),
        },
      });
    },

    async createPaymentWithInitialAttempt(paymentInput, attemptInput) {
      if ("$transaction" in database) {
        return database.$transaction(
          async (tx: Prisma.TransactionClient) => {
            const repository = createPaymentRepository(tx);
            const payment = await repository.createPayment(paymentInput);
            const attempt = await repository.createPaymentAttempt({
              ...attemptInput,
              paymentId: payment.id,
            });
            return { payment, attempt };
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
        );
      }

      const payment = await createPaymentRepository(database).createPayment(paymentInput);
      const attempt = await createPaymentRepository(database).createPaymentAttempt({
        ...attemptInput,
        paymentId: payment.id,
      });
      return { payment, attempt };
    },

    getPaymentById(paymentId, customerId) {
      return database.payment.findFirst({
        where: { id: paymentId, customerId },
      });
    },

    getPaymentsByCustomer(customerId) {
      return database.payment.findMany({
        where: { customerId },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      });
    },

    getPaymentByCheckout(customerId, checkoutReference) {
      return database.payment.findFirst({
        where: { customerId, checkoutReference },
      });
    },

    getPaymentByProviderReference(providerId, providerReference) {
      return database.payment.findFirst({
        where: { providerId, providerReference },
      });
    },

    async updatePaymentStatus(paymentId, expectedStatus, nextStatus, completedAt) {
      const result = await database.payment.updateMany({
        where: { id: paymentId, status: expectedStatus },
        data: {
          status: nextStatus,
          ...(completedAt !== undefined ? { completedAt } : {}),
        },
      });
      if (result.count !== 1) {
        throw new Error("Payment status changed concurrently or payment was not found.");
      }
      const payment = await database.payment.findUnique({ where: { id: paymentId } });
      if (!payment) throw new Error("Payment was not found after status update.");
      return payment;
    },

    createPaymentAttempt(input) {
      assertNonEmpty(input.paymentId, "paymentId");
      assertAttemptNumber(input.attemptNumber);
      assertNonEmpty(input.currency, "currency");

      return database.paymentAttempt.create({
        data: {
          paymentId: input.paymentId,
          attemptNumber: input.attemptNumber,
          amount: input.amount,
          currency: input.currency,
          ...(input.providerId !== undefined ? { providerId: input.providerId } : {}),
          ...(input.providerAttemptReference !== undefined
            ? { providerAttemptReference: input.providerAttemptReference }
            : {}),
          ...(input.status !== undefined ? { status: input.status } : {}),
          ...(input.failureCode !== undefined ? { failureCode: input.failureCode } : {}),
          ...(input.failureCategory !== undefined ? { failureCategory: input.failureCategory } : {}),
          ...(input.metadata !== undefined ? { metadata: input.metadata } : {}),
        },
      });
    },

    getPaymentAttempts(paymentId) {
      return database.paymentAttempt.findMany({
        where: { paymentId },
        orderBy: [{ attemptNumber: "asc" }, { createdAt: "asc" }],
      });
    },

    getPaymentAttemptByProviderReference(providerId, providerAttemptReference) {
      return database.paymentAttempt.findFirst({
        where: { providerId, providerAttemptReference },
      });
    },

    async recordPaymentEvent(input) {
      const existing = await database.paymentEvent.findUnique({
        where: {
          providerId_providerEventId: {
            providerId: input.providerId,
            providerEventId: input.providerEventId,
          },
        },
      });
      if (existing) return { record: existing, created: false };

      try {
        const data: Prisma.PaymentEventUncheckedCreateInput = {
          providerId: input.providerId,
          providerEventId: input.providerEventId,
          eventType: input.eventType,
          ...(input.normalizedEventType !== undefined
            ? { normalizedEventType: input.normalizedEventType }
            : {}),
          ...(input.paymentId ? { paymentId: input.paymentId } : {}),
          ...(input.occurredAt !== undefined ? { occurredAt: input.occurredAt } : {}),
          ...(input.metadata !== undefined ? { metadata: input.metadata } : {}),
        };
        const record = await database.paymentEvent.create({ data });
        return { record, created: true };
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
          const record = await database.paymentEvent.findUnique({
            where: {
              providerId_providerEventId: {
                providerId: input.providerId,
                providerEventId: input.providerEventId,
              },
            },
          });
          if (record) return { record, created: false };
        }
        throw error;
      }
    },

    findPaymentEventByProviderEventId(providerId, providerEventId) {
      return database.paymentEvent.findUnique({
        where: {
          providerId_providerEventId: {
            providerId,
            providerEventId,
          },
        },
      });
    },

    markPaymentEventProcessed(eventId, processedAt = new Date()) {
      return database.paymentEvent.update({
        where: { id: eventId },
        data: {
          processingStatus: "PROCESSED" satisfies PaymentEventProcessingStatus,
          processedAt,
          processingError: null,
        },
      });
    },

    markPaymentEventFailed(eventId, processingError) {
      return database.paymentEvent.update({
        where: { id: eventId },
        data: {
          processingStatus: "FAILED" satisfies PaymentEventProcessingStatus,
          processingError: processingError.slice(0, 500),
        },
      });
    },

    lookupByIdempotencyKey(customerId, operation, key) {
      return database.paymentIdempotency.findUnique({
        where: {
          customerId_operation_key: { customerId, operation, key },
        },
      });
    },

    createPaymentIdempotency(input) {
      assertNonEmpty(input.customerId, "customerId");
      assertNonEmpty(input.checkoutReference, "checkoutReference");
      assertNonEmpty(input.operation, "operation");
      assertNonEmpty(input.key, "key");
      assertNonEmpty(input.requestFingerprint, "requestFingerprint");
      assertNonEmpty(input.paymentId, "paymentId");

      return database.paymentIdempotency.create({
        data: {
          customerId: input.customerId,
          checkoutReference: input.checkoutReference,
          operation: input.operation,
          key: input.key,
          requestFingerprint: input.requestFingerprint,
          paymentId: input.paymentId,
          ...(input.response !== undefined ? { response: input.response } : {}),
          ...(input.expiresAt !== undefined ? { expiresAt: input.expiresAt } : {}),
        },
      });
    },
  };
}
