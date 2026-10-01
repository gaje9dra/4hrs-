import { randomUUID } from "node:crypto";
import { Prisma, type PaymentStatus as PrismaPaymentStatus } from "@prisma/client";
import {
  assertPaymentTransition,
  canRetryPayment,
  isTerminalPaymentStatus,
  validatePaymentAmount,
  type PaymentDto,
  type PaymentStatus,
} from "@/lib/payments/domain";
import { PaymentError } from "@/lib/payments/errors";
import {
  createPaymentRepository,
  type PaymentRecord,
  type PaymentRepository,
} from "@/lib/payments/repository";
import type { NormalizedPaymentEvent, PaymentProviderAdapter, PaymentProviderResolver } from "@/lib/payments/provider";

export type ValidatedCheckoutPaymentContext = {
  customerId: string;
  checkoutReference: string;
  amount: { value: string; currency: string };
  expiresAt?: Date | null;
};

export type CreatePaymentFromCheckoutInput = {
  checkout: ValidatedCheckoutPaymentContext;
  idempotencyKey: string;
};

export type TransitionPaymentInput = {
  paymentId: string;
  customerId: string;
  nextStatus: PaymentStatus;
};

export type PaymentApplicationDependencies = {
  repository?: PaymentRepository;
  providerResolver?: PaymentProviderResolver;
};

export type PaymentApplicationService = {
  createPaymentFromCheckout(input: CreatePaymentFromCheckoutInput): Promise<PaymentDto>;
  getPayment(paymentId: string, customerId: string): Promise<PaymentDto>;
  transitionPaymentState(input: TransitionPaymentInput): Promise<PaymentDto>;
  retryPayment(paymentId: string, customerId: string): Promise<PaymentDto>;
  processNormalizedPaymentEvent(event: NormalizedPaymentEvent): Promise<{
    duplicate: boolean;
    processed: boolean;
    payment: PaymentDto | null;
  }>;
  startProviderPayment(paymentId: string, customerId: string): Promise<never>;
};

function toPaymentDto(payment: PaymentRecord): PaymentDto {
  return {
    id: payment.id,
    reference: payment.internalReference,
    checkoutReference: payment.checkoutReference,
    status: payment.status,
    amount: { value: payment.amount.toFixed(2), currency: payment.currency },
    expiresAt: payment.expiresAt?.toISOString() ?? null,
    nextAction: null,
    createdAt: payment.createdAt.toISOString(),
    updatedAt: payment.updatedAt.toISOString(),
  };
}

function fingerprint(checkout: ValidatedCheckoutPaymentContext): string {
  return [checkout.checkoutReference, checkout.amount.value, checkout.amount.currency, checkout.expiresAt?.toISOString() ?? ""].join("|");
}

function isPrismaUniqueConflict(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

function asPrismaStatus(status: PaymentStatus): PrismaPaymentStatus {
  return status as PrismaPaymentStatus;
}

function assertValidIdempotencyKey(key: string): void {
  if (!/^[A-Za-z0-9._~-]{16,128}$/.test(key)) {
    throw new PaymentError("INVALID_PAYMENT_REQUEST", "Payment idempotency key is invalid.");
  }
}

function assertCheckoutContext(checkout: ValidatedCheckoutPaymentContext): void {
  if (!checkout.customerId.trim() || !checkout.checkoutReference.trim()) {
    throw new PaymentError("INVALID_CHECKOUT", "Checkout could not be validated.");
  }
  try {
    validatePaymentAmount(checkout.amount);
  } catch (error) {
    throw new PaymentError("INVALID_AMOUNT", "Checkout payment amount is invalid.", { cause: error });
  }
}

export function createPaymentApplication(
  dependencies: PaymentApplicationDependencies = {},
): PaymentApplicationService {
  const repository = dependencies.repository ?? createPaymentRepository();
  const providerResolver = dependencies.providerResolver;

  async function createPaymentFromCheckout(input: CreatePaymentFromCheckoutInput): Promise<PaymentDto> {
    assertValidIdempotencyKey(input.idempotencyKey);
    assertCheckoutContext(input.checkout);

    const requestFingerprint = fingerprint(input.checkout);
    const operation = "create-payment";
    const existingKey = await repository.lookupByIdempotencyKey(input.checkout.customerId, operation, input.idempotencyKey);

    if (existingKey) {
      if (existingKey.requestFingerprint !== requestFingerprint) {
        throw new PaymentError("IDEMPOTENCY_CONFLICT", "The idempotency key was already used for a different payment request.");
      }
      const payment = await repository.getPaymentById(existingKey.paymentId, input.checkout.customerId);
      if (!payment) throw new PaymentError("PAYMENT_NOT_FOUND", "Payment could not be found.");
      return toPaymentDto(payment);
    }

    const existingPayment = await repository.getPaymentByCheckout(input.checkout.customerId, input.checkout.checkoutReference);
    if (existingPayment) {
      if (existingPayment.status === "SUCCEEDED") {
        throw new PaymentError("PAYMENT_ALREADY_COMPLETED", "This Checkout has already been paid.");
      }
      if (isTerminalPaymentStatus(existingPayment.status)) {
        throw new PaymentError("PAYMENT_ALREADY_TERMINAL", "This Payment can no longer be used.");
      }
      return toPaymentDto(existingPayment);
    }

    try {
      return await repository.withTransaction(async (tx) => {
        const paymentReference = randomUUID();
        const created = await tx.createPaymentWithInitialAttempt(
          {
            customerId: input.checkout.customerId,
            checkoutReference: input.checkout.checkoutReference,
            internalReference: paymentReference,
            amount: input.checkout.amount.value,
            currency: input.checkout.amount.currency,
            status: asPrismaStatus("CREATED"),
            expiresAt: input.checkout.expiresAt ?? null,
          },
          {
            paymentId: paymentReference,
            attemptNumber: 1,
            amount: input.checkout.amount.value,
            currency: input.checkout.amount.currency,
            status: asPrismaStatus("CREATED"),
          },
        );

        const response = toPaymentDto(created.payment);
        await tx.createPaymentIdempotency({
          customerId: input.checkout.customerId,
          checkoutReference: input.checkout.checkoutReference,
          operation,
          key: input.idempotencyKey,
          requestFingerprint,
          paymentId: created.payment.id,
          response: response as unknown as Prisma.InputJsonValue,
        });
        return response;
      });
    } catch (error) {
      if (isPrismaUniqueConflict(error)) {
        const raced = await repository.lookupByIdempotencyKey(input.checkout.customerId, operation, input.idempotencyKey);
        if (raced) {
          if (raced.requestFingerprint !== requestFingerprint) {
            throw new PaymentError("IDEMPOTENCY_CONFLICT", "The idempotency key was already used for a different payment request.");
          }
          const payment = await repository.getPaymentById(raced.paymentId, input.checkout.customerId);
          if (payment) return toPaymentDto(payment);
        }
        const duplicate = await repository.getPaymentByCheckout(input.checkout.customerId, input.checkout.checkoutReference);
        if (duplicate) return toPaymentDto(duplicate);
      }
      if (error instanceof PaymentError) throw error;
      throw new PaymentError("PAYMENT_INTERNAL_ERROR", "Payment creation is temporarily unavailable.", { cause: error });
    }
  }

  async function getPayment(paymentId: string, customerId: string): Promise<PaymentDto> {
    if (!paymentId.trim() || !customerId.trim()) {
      throw new PaymentError("INVALID_PAYMENT_REQUEST", "Payment request is invalid.");
    }
    const payment = await repository.getPaymentById(paymentId, customerId);
    if (!payment) throw new PaymentError("PAYMENT_NOT_FOUND", "Payment could not be found.");
    return toPaymentDto(payment);
  }

  async function transitionPaymentState(input: TransitionPaymentInput): Promise<PaymentDto> {
    if (!input.paymentId.trim() || !input.customerId.trim()) {
      throw new PaymentError("INVALID_PAYMENT_REQUEST", "Payment request is invalid.");
    }
    const payment = await repository.getPaymentById(input.paymentId, input.customerId);
    if (!payment) throw new PaymentError("PAYMENT_NOT_FOUND", "Payment could not be found.");

    try {
      assertPaymentTransition(payment.status, input.nextStatus);
    } catch (error) {
      if (isTerminalPaymentStatus(payment.status)) {
        throw new PaymentError("PAYMENT_ALREADY_TERMINAL", "Payment is already in a terminal state.", { cause: error });
      }
      throw new PaymentError("INVALID_STATE_TRANSITION", "Payment state transition is not allowed.", { cause: error });
    }

    try {
      return toPaymentDto(await repository.updatePaymentStatus(
        payment.id,
        asPrismaStatus(payment.status),
        asPrismaStatus(input.nextStatus),
        input.nextStatus === "SUCCEEDED" ? new Date() : undefined,
      ));
    } catch (error) {
      throw new PaymentError("INVALID_STATE_TRANSITION", "Payment state changed concurrently; retry the operation.", { cause: error });
    }
  }

  async function retryPayment(paymentId: string, customerId: string): Promise<PaymentDto> {
    const payment = await repository.getPaymentById(paymentId, customerId);
    if (!payment) throw new PaymentError("PAYMENT_NOT_FOUND", "Payment could not be found.");
    if (!canRetryPayment(payment.status)) {
      if (payment.status === "SUCCEEDED") throw new PaymentError("PAYMENT_ALREADY_COMPLETED", "Payment has already completed.");
      if (isTerminalPaymentStatus(payment.status)) throw new PaymentError("PAYMENT_ALREADY_TERMINAL", "Payment can no longer be retried.");
      return toPaymentDto(payment);
    }

    const attempts = await repository.getPaymentAttempts(payment.id);
    const nextAttemptNumber = attempts.reduce((max, attempt) => Math.max(max, attempt.attemptNumber), 0) + 1;
    try {
      const result = await repository.withTransaction(async (tx) => {
        const updated = await tx.updatePaymentStatus(payment.id, asPrismaStatus("FAILED"), asPrismaStatus("PROCESSING"));
        await tx.createPaymentAttempt({
          paymentId: payment.id,
          attemptNumber: nextAttemptNumber,
          amount: payment.amount,
          currency: payment.currency,
          status: asPrismaStatus("PROCESSING"),
        });
        return updated;
      });
      return toPaymentDto(result);
    } catch (error) {
      throw new PaymentError("INVALID_STATE_TRANSITION", "Payment retry could not be applied safely.", { cause: error });
    }
  }

  async function processNormalizedPaymentEvent(event: NormalizedPaymentEvent) {
    if (!event.providerId.trim() || !event.providerEventReference.trim()) {
      throw new PaymentError("INVALID_PAYMENT_REQUEST", "Payment event identity is invalid.");
    }

    const existing = await repository.recordPaymentEvent({
      providerId: event.providerId,
      providerEventId: event.providerEventReference,
      eventType: event.normalizedEventType,
      normalizedEventType: event.normalizedEventType,
      occurredAt: new Date(event.occurredAt),
      metadata: event.metadata ? { ...event.metadata } : undefined,
    });

    const payment = event.internalPaymentReference
      ? await repository.getPaymentByInternalReference(event.internalPaymentReference)
      : event.providerPaymentReference
        ? await repository.getPaymentByProviderReference(event.providerId, event.providerPaymentReference)
        : null;

    if (!payment) {
      await repository.markPaymentEventFailed(existing.record.id, "Payment reference could not be resolved.");
      throw new PaymentError("PAYMENT_NOT_FOUND", "Payment could not be resolved for this event.");
    }

    if (!existing.created && existing.record.processingStatus === "PROCESSED") {
      return { duplicate: true, processed: true, payment: toPaymentDto(payment) };
    }

    try {
      assertPaymentTransition(payment.status, event.status);
    } catch (error) {
      await repository.markPaymentEventFailed(existing.record.id, "Payment event requested an invalid state transition.");
      throw new PaymentError("INVALID_STATE_TRANSITION", "Payment event requested an invalid state transition.", { cause: error });
    }

    try {
      const result = await repository.withTransaction(async (tx) => {
        const updated = await tx.updatePaymentStatus(
          payment.id,
          asPrismaStatus(payment.status),
          asPrismaStatus(event.status),
          event.status === "SUCCEEDED" ? new Date(event.occurredAt) : undefined,
        );
        await tx.markPaymentEventProcessed(existing.record.id);
        return updated;
      });
      return { duplicate: !existing.created, processed: true, payment: toPaymentDto(result) };
    } catch (error) {
      await repository.markPaymentEventFailed(existing.record.id, "Payment event could not be applied.");
      throw new PaymentError("INVALID_STATE_TRANSITION", "Payment event could not be applied.", { cause: error });
    }
  }

  async function startProviderPayment(paymentId: string, customerId: string): Promise<never> {
    const payment = await repository.getPaymentById(paymentId, customerId);
    if (!payment) throw new PaymentError("PAYMENT_NOT_FOUND", "Payment could not be found.");
    if (!providerResolver) {
      throw new PaymentError("PROVIDER_CONFIGURATION_MISSING", "No payment provider is configured.");
    }
    const adapter: PaymentProviderAdapter | undefined = providerResolver.resolve({
      customerId,
      checkoutReference: payment.checkoutReference,
      currency: payment.currency,
    });
    if (!adapter) throw new PaymentError("PROVIDER_UNAVAILABLE", "Payment provider is currently unavailable.");
    throw new PaymentError("PROVIDER_UNAVAILABLE", "Provider execution is reserved for the next payment-integration phase.");
  }

  return {
    createPaymentFromCheckout,
    getPayment,
    transitionPaymentState,
    retryPayment,
    processNormalizedPaymentEvent,
    startProviderPayment,
  };
}
