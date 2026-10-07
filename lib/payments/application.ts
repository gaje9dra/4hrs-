import { randomUUID } from "node:crypto";
import { Prisma, type PaymentStatus as PrismaPaymentStatus, type PaymentRefundReason, PaymentRefundStatus } from "@prisma/client";
import {
  assertPaymentTransition,
  canRetryPayment,
  isTerminalPaymentStatus,
  validatePaymentAmount,
  type PaymentDto,
  type PaymentAmount,
  type PaymentStatus,
} from "@/lib/payments/domain";
import { PaymentError } from "@/lib/payments/errors";
import {
  createPaymentRepository,
  type PaymentRecord,
  type PaymentRepository,
} from "@/lib/payments/repository";
import type { NormalizedPaymentEvent, PaymentProviderAdapter, PaymentProviderResolver } from "@/lib/payments/provider";
import { normalizeClientAction } from "@/lib/payments/client-action";
import { getPaymentProviderRegistry } from "@/lib/payments/registry";
import { createPaymentProviderResolver } from "@/lib/payments/resolver";

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

export type AdminRefundReason = "CUSTOMER_REQUEST" | "ORDER_CANCELLED" | "RETURN_APPROVED" | "DUPLICATE_PAYMENT" | "PAYMENT_ERROR" | "OPERATIONAL_CORRECTION" | "OTHER";
export type AdminRefundInput = { paymentId: string; amount: string; currency: string; reason: AdminRefundReason; note?: string | null; idempotencyKey: string };
export type AdminRefundResult = { refundId: string; status: "PENDING" | "SUCCEEDED" | "FAILED" | "AMBIGUOUS"; payment: PaymentDto; amount: PaymentAmount; currency: string; providerReference: string | null; failureCode: string | null };

export type PaymentApplicationService = {
  createPaymentFromCheckout(input: CreatePaymentFromCheckoutInput): Promise<PaymentDto>;
  getPayment(paymentId: string, customerId: string): Promise<PaymentDto>;
  transitionPaymentState(input: TransitionPaymentInput): Promise<PaymentDto>;
  retryPayment(paymentId: string, customerId: string, idempotencyKey?: string): Promise<PaymentDto>;
  refundPayment(input: AdminRefundInput): Promise<AdminRefundResult>;
  reconcilePayment(paymentId: string, customerId: string): Promise<PaymentDto>;
  processNormalizedPaymentEvent(event: NormalizedPaymentEvent): Promise<{
    duplicate: boolean;
    processed: boolean;
    payment: PaymentDto | null;
  }>;
  startProviderPayment(paymentId: string, customerId: string): Promise<PaymentDto>;
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
  const providerResolver = dependencies.providerResolver ?? createPaymentProviderResolver({ registry: getPaymentProviderRegistry() });

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

  async function retryPayment(paymentId: string, customerId: string, idempotencyKey?: string): Promise<PaymentDto> {
    const payment = await repository.getPaymentById(paymentId, customerId);
    if (!payment) throw new PaymentError("PAYMENT_NOT_FOUND", "Payment could not be found.");
    if (!idempotencyKey) {
      if (!canRetryPayment(payment.status)) {
        if (payment.status === "SUCCEEDED") throw new PaymentError("PAYMENT_ALREADY_COMPLETED", "Payment has already completed.");
        if (isTerminalPaymentStatus(payment.status)) throw new PaymentError("PAYMENT_ALREADY_TERMINAL", "Payment can no longer be retried.");
        return toPaymentDto(payment);
      }
    } else {
      assertValidIdempotencyKey(idempotencyKey);
      const existing = await repository.lookupByIdempotencyKey(customerId, "admin-retry", idempotencyKey);
      if (existing) {
        if (existing.requestFingerprint !== paymentId) throw new PaymentError("IDEMPOTENCY_CONFLICT", "The idempotency key was already used for a different payment request.");
        const replay = await repository.getPaymentById(paymentId, customerId);
        if (!replay) throw new PaymentError("PAYMENT_NOT_FOUND", "Payment could not be found.");
        return toPaymentDto(replay);
      }
    }
    try {
      return await repository.withTransaction(async (tx) => {
        const current = await tx.getPaymentById(paymentId, customerId);
        if (!current) throw new PaymentError("PAYMENT_NOT_FOUND", "Payment could not be found.");
        if (!canRetryPayment(current.status)) {
          if (current.status === "SUCCEEDED") throw new PaymentError("PAYMENT_ALREADY_COMPLETED", "Payment has already completed.");
          if (isTerminalPaymentStatus(current.status)) throw new PaymentError("PAYMENT_ALREADY_TERMINAL", "Payment can no longer be retried.");
          return toPaymentDto(current);
        }
        const attempts = await tx.getPaymentAttempts(paymentId);
        const nextAttemptNumber = attempts.reduce((max, attempt) => Math.max(max, attempt.attemptNumber), 0) + 1;
        const updated = await tx.updatePaymentStatus(paymentId, asPrismaStatus("FAILED"), asPrismaStatus("PROCESSING"));
        await tx.createPaymentAttempt({ paymentId, attemptNumber: nextAttemptNumber, amount: current.amount, currency: current.currency, status: asPrismaStatus("PROCESSING") });
        if (idempotencyKey) {
          await tx.createPaymentIdempotency({ customerId, checkoutReference: current.checkoutReference, operation: "admin-retry", key: idempotencyKey, requestFingerprint: paymentId, paymentId: current.id, response: { paymentId: current.id } });
        }
        return toPaymentDto(updated);
      });
    } catch (error) {
      if (error instanceof PaymentError) throw error;
      if (isPrismaUniqueConflict(error) && idempotencyKey) {
        const raced = await repository.lookupByIdempotencyKey(customerId, "admin-retry", idempotencyKey);
        if (raced && raced.requestFingerprint === paymentId) {
          const replay = await repository.getPaymentById(paymentId, customerId);
          if (replay) return toPaymentDto(replay);
        }
      }
      throw new PaymentError("INVALID_STATE_TRANSITION", "Payment retry could not be applied safely.", { cause: error });
    }
  }

  function validateRefundReason(reason: string): AdminRefundReason {
    const allowed: readonly AdminRefundReason[] = ["CUSTOMER_REQUEST","ORDER_CANCELLED","RETURN_APPROVED","DUPLICATE_PAYMENT","PAYMENT_ERROR","OPERATIONAL_CORRECTION","OTHER"];
    if (!allowed.includes(reason as AdminRefundReason)) throw new PaymentError("INVALID_PAYMENT_REQUEST", "Refund reason is invalid.");
    return reason as AdminRefundReason;
  }

  async function refundPayment(input: AdminRefundInput): Promise<AdminRefundResult> {
    assertValidIdempotencyKey(input.idempotencyKey);
    const payment = await repository.getPaymentForAdmin(input.paymentId);
    if (!payment) throw new PaymentError("PAYMENT_NOT_FOUND", "Payment could not be found.");
    if (input.currency !== payment.currency) throw new PaymentError("INVALID_CURRENCY", "Refund currency does not match the payment currency.");
    if (!/^\d+(?:\.\d{1,2})?$/.test(input.amount)) throw new PaymentError("INVALID_AMOUNT", "Refund amount is invalid.");
    const amount = new Prisma.Decimal(input.amount);
    if (!amount.isFinite() || amount.lte(0)) throw new PaymentError("INVALID_AMOUNT", "Refund amount is invalid.");
    const reason = validateRefundReason(input.reason);
    if (input.note && input.note.length > 1000) throw new PaymentError("INVALID_PAYMENT_REQUEST", "Refund note is invalid.");

    const existingKey = await repository.lookupByIdempotencyKey(payment.customerId, "admin-refund", input.idempotencyKey);
    if (existingKey) {
      if (existingKey.requestFingerprint !== [input.paymentId,input.amount,input.currency,input.reason].join("|")) throw new PaymentError("IDEMPOTENCY_CONFLICT", "The idempotency key was already used for a different refund request.");
      const refund = await repository.getRefundByIdempotencyKey(input.idempotencyKey);
      if (!refund) throw new PaymentError("PAYMENT_INTERNAL_ERROR", "Refund idempotency record could not be resolved.");
      return { refundId: refund.id, status: refund.status, payment: toPaymentDto(payment), amount: { value: refund.amount.toFixed(2), currency: refund.currency }, currency: refund.currency, providerReference: refund.providerReference, failureCode: refund.failureCode };
    }

    if (payment.status !== "SUCCEEDED" && payment.status !== "PARTIALLY_REFUNDED") throw new PaymentError("INVALID_STATE_TRANSITION", "Payment is not eligible for refund.");
    const reserved = payment.refunds.reduce((sum, refund) => refund.status === "SUCCEEDED" || refund.status === "PENDING" || refund.status === "AMBIGUOUS" ? sum.plus(refund.amount) : sum, new Prisma.Decimal(0));
    const refundable = payment.amount.minus(reserved);
    if (amount.gt(refundable)) throw new PaymentError("INVALID_AMOUNT", "Refund amount exceeds the remaining refundable balance.");
    const fingerprintValue = [input.paymentId,input.amount,input.currency,input.reason].join("|");

    let refund = await repository.withTransaction(async (tx) => {
      const current = await tx.getPaymentForAdmin(input.paymentId);
      if (!current) throw new PaymentError("PAYMENT_NOT_FOUND", "Payment could not be found.");
      if (current.status !== "SUCCEEDED" && current.status !== "PARTIALLY_REFUNDED") throw new PaymentError("INVALID_STATE_TRANSITION", "Payment is not eligible for refund.");
      const reservedNow = current.refunds.reduce((sum, item) => item.status === "SUCCEEDED" || item.status === "PENDING" || item.status === "AMBIGUOUS" ? sum.plus(item.amount) : sum, new Prisma.Decimal(0));
      if (amount.gt(current.amount.minus(reservedNow))) throw new PaymentError("INVALID_AMOUNT", "Refund amount exceeds the remaining refundable balance.");
      const created = await tx.createPaymentRefund({ paymentId: current.id, idempotencyKey: input.idempotencyKey, amount, currency: current.currency, reason: reason as PaymentRefundReason, note: input.note ?? null });
      await tx.createPaymentIdempotency({ customerId: current.customerId, checkoutReference: current.checkoutReference, operation: "admin-refund", key: input.idempotencyKey, requestFingerprint: fingerprintValue, paymentId: current.id, response: { refundId: created.id } });
      return created;
    });

    if (!payment.providerId || !payment.providerReference) {
      refund = await repository.updatePaymentRefund({ id: refund.id, status: PaymentRefundStatus.FAILED, failureCode: "PROVIDER_REFERENCE_MISSING" });
      throw new PaymentError("PROVIDER_UNAVAILABLE", "Payment provider reference is unavailable; no refund was executed.");
    }
    const adapter = providerResolver.resolve({ customerId: payment.customerId, checkoutReference: payment.checkoutReference, currency: payment.currency, providerId: payment.providerId });
    if (!adapter || !adapter.capabilities.refunds || !adapter.refundPayment) {
      refund = await repository.updatePaymentRefund({ id: refund.id, status: "FAILED", failureCode: "REFUND_UNSUPPORTED" });
      throw new PaymentError("PROVIDER_UNAVAILABLE", "The configured payment provider does not support refunds.");
    }
    let providerConfirmed = false;
    try {
      const result = await adapter.refundPayment({ providerPaymentReference: payment.providerReference, paymentReference: payment.internalReference, amount: { value: amount.toFixed(2), currency: payment.currency } });
      if (result.providerId !== adapter.id) throw new PaymentError("PROVIDER_CONFIGURATION_ERROR", "Provider response identity is invalid.");
      if (result.status !== "REFUNDED" && result.status !== "PARTIALLY_REFUNDED") throw new PaymentError("INVALID_STATE_TRANSITION", "Provider did not confirm a valid refund state.");
      providerConfirmed = true;
      refund = await repository.withTransaction(async (tx) => {
        const updatedRefund = await tx.updatePaymentRefund({ id: refund.id, status: PaymentRefundStatus.SUCCEEDED, providerId: result.providerId, providerReference: result.providerPaymentReference, completedAt: new Date() });
        if (result.status !== payment.status) await tx.updatePaymentStatus(payment.id, asPrismaStatus(payment.status), asPrismaStatus(result.status));
        return updatedRefund;
      });
    } catch (error) {
      if (providerConfirmed) {
        refund = await repository.updatePaymentRefund({ id: refund.id, status: PaymentRefundStatus.AMBIGUOUS, failureCode: "LOCAL_FINALIZATION_FAILED" });
        throw new PaymentError("PAYMENT_INTERNAL_ERROR", "The provider accepted the refund but local state could not be finalized; reconcile the payment before retrying.", { cause: error });
      }
      if (error instanceof PaymentError) {
        refund = await repository.updatePaymentRefund({ id: refund.id, status: "FAILED", failureCode: error.code });
        throw error;
      }
      const category = adapter.normalizeError(error);
      if (category === "PROVIDER_TIMEOUT" || category === "PROVIDER_NETWORK_ERROR") {
        refund = await repository.updatePaymentRefund({ id: refund.id, status: "AMBIGUOUS", failureCode: category });
        throw new PaymentError("PROVIDER_TIMEOUT", "Refund outcome is ambiguous; reconcile the payment before retrying.", { cause: error });
      }
      refund = await repository.updatePaymentRefund({ id: refund.id, status: "FAILED", failureCode: category });
      throw new PaymentError("PROVIDER_REJECTED", "The payment provider rejected the refund.", { cause: error });
    }
    const refreshed = await repository.getPaymentForAdmin(payment.id);
    if (!refreshed) throw new PaymentError("PAYMENT_INTERNAL_ERROR", "Payment could not be reloaded after refund.");
    return { refundId: refund.id, status: refund.status, payment: toPaymentDto(refreshed), amount: { value: refund.amount.toFixed(2), currency: refund.currency }, currency: refund.currency, providerReference: refund.providerReference, failureCode: refund.failureCode };
  }

  async function reconcilePayment(paymentId: string, customerId: string): Promise<PaymentDto> {
    const payment = await repository.getPaymentById(paymentId, customerId);
    if (!payment) throw new PaymentError("PAYMENT_NOT_FOUND", "Payment could not be found.");
    if (!payment.providerId || !payment.providerReference) throw new PaymentError("PROVIDER_UNAVAILABLE", "Payment provider reference is unavailable.");
    const adapter = providerResolver.resolve({ customerId, checkoutReference: payment.checkoutReference, currency: payment.currency, providerId: payment.providerId });
    if (!adapter || !adapter.capabilities.statusLookup) throw new PaymentError("PROVIDER_UNAVAILABLE", "The configured payment provider does not support reconciliation.");
    const result = await adapter.retrievePayment({ providerPaymentReference: payment.providerReference, paymentReference: payment.internalReference });
    if (result.providerId !== adapter.id) throw new PaymentError("PROVIDER_CONFIGURATION_ERROR", "Provider response identity is invalid.");
    if (result.status === payment.status) return toPaymentDto(payment);
    if (result.status === "PARTIALLY_REFUNDED" || result.status === "REFUNDED") {
      const refunds = await repository.getPaymentRefunds(payment.id);
      const succeededRefunded = refunds.reduce((sum, refund) => refund.status === PaymentRefundStatus.SUCCEEDED ? sum.plus(refund.amount) : sum, new Prisma.Decimal(0));
      const provesState = result.status === "REFUNDED"
        ? succeededRefunded.eq(payment.amount)
        : succeededRefunded.gt(0) && succeededRefunded.lt(payment.amount);
      if (!provesState) {
        throw new PaymentError("INVALID_STATE_TRANSITION", "Provider refund state cannot be applied because local refund history cannot substantiate the refunded balance.");
      }
    }
    assertPaymentTransition(payment.status, result.status);
    return toPaymentDto(await repository.updatePaymentStatus(payment.id, asPrismaStatus(payment.status), asPrismaStatus(result.status), result.status === "SUCCEEDED" ? new Date() : undefined));
  }

  async function processNormalizedPaymentEvent(event: NormalizedPaymentEvent) {
    if (!event.providerId.trim() || !event.providerEventReference.trim()) {
      throw new PaymentError("INVALID_PAYMENT_REQUEST", "Payment event identity is invalid.");
    }
    let occurredAt: Date;
    try {
      occurredAt = new Date(event.occurredAt);
      if (Number.isNaN(occurredAt.getTime())) throw new Error("invalid timestamp");
      validatePaymentAmount(event.amount);
    } catch (error) {
      throw new PaymentError("INVALID_PAYMENT_REQUEST", "Payment event financial data is invalid.", { cause: error });
    }
    if (event.currency !== event.amount.currency) {
      throw new PaymentError("INVALID_CURRENCY", "Payment event currency is inconsistent.");
    }

    const existing = await repository.recordPaymentEvent({
      providerId: event.providerId,
      providerEventId: event.providerEventReference,
      eventType: event.normalizedEventType,
      normalizedEventType: event.normalizedEventType,
      occurredAt,
      metadata: event.metadata ? { ...event.metadata } : undefined,
    });

    if (!existing.created && existing.record.processingStatus === "PROCESSED") {
      const replayPayment = event.internalPaymentReference
        ? await repository.getPaymentByInternalReference(event.internalPaymentReference)
        : event.providerPaymentReference
          ? await repository.getPaymentByProviderReference(event.providerId, event.providerPaymentReference)
          : null;
      return { duplicate: true, processed: true, payment: replayPayment ? toPaymentDto(replayPayment) : null };
    }

    try {
      const result = await repository.withTransaction(async (tx) => {
        const payment = event.internalPaymentReference
          ? await tx.getPaymentByInternalReference(event.internalPaymentReference)
          : event.providerPaymentReference
            ? await tx.getPaymentByProviderReference(event.providerId, event.providerPaymentReference)
            : null;

        if (!payment) {
          throw new PaymentError("PAYMENT_NOT_FOUND", "Payment could not be resolved for this event.");
        }
        if (payment.amount.toFixed(2) !== new Prisma.Decimal(event.amount.value).toFixed(2)) {
          throw new PaymentError("INVALID_AMOUNT", "Payment event amount does not match the authoritative payment amount.");
        }
        if (payment.currency !== event.currency) {
          throw new PaymentError("INVALID_CURRENCY", "Payment event currency does not match the authoritative payment currency.");
        }

        const latestEvent = await tx.findPaymentEventByProviderEventId(event.providerId, event.providerEventReference);
        if (latestEvent?.processingStatus === "PROCESSED") {
          return { duplicate: true, payment };
        }

        if (payment.status === event.status) {
          await tx.markPaymentEventProcessed(existing.record.id);
          return { duplicate: true, payment };
        }

        try {
          assertPaymentTransition(payment.status, event.status);
        } catch (error) {
          throw new PaymentError("INVALID_STATE_TRANSITION", "Payment event requested an invalid state transition.", { cause: error });
        }

        const updated = await tx.updatePaymentStatus(
          payment.id,
          asPrismaStatus(payment.status),
          asPrismaStatus(event.status),
          event.status === "SUCCEEDED" ? occurredAt : undefined,
        );

        if (event.providerPaymentReference) {
          const attempts = await tx.getPaymentAttempts(payment.id);
          const latestAttempt = attempts.at(-1);
          if (!latestAttempt) {
            throw new PaymentError("PAYMENT_INTERNAL_ERROR", "Payment attempt could not be resolved.");
          }
          await tx.updatePaymentProviderReferences(
            payment.id,
            latestAttempt.id,
            event.providerId,
            event.providerPaymentReference,
            event.internalPaymentReference ?? latestAttempt.providerAttemptReference,
          );
        }

        await tx.markPaymentEventProcessed(existing.record.id);
        return { duplicate: !existing.created, payment: updated };
      });
      return { duplicate: result.duplicate, processed: true, payment: toPaymentDto(result.payment) };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") {
        const settled = await repository.findPaymentEventByProviderEventId(event.providerId, event.providerEventReference);
        if (settled?.processingStatus === "PROCESSED") {
          const payment = event.internalPaymentReference
            ? await repository.getPaymentByInternalReference(event.internalPaymentReference)
            : event.providerPaymentReference
              ? await repository.getPaymentByProviderReference(event.providerId, event.providerPaymentReference)
              : null;
          return { duplicate: true, processed: true, payment: payment ? toPaymentDto(payment) : null };
        }
        throw new PaymentError("INVALID_STATE_TRANSITION", "Payment event conflicted with a concurrent financial update; retry safely.", { cause: error });
      }
      if (error instanceof PaymentError) {
        if (error.code !== "PAYMENT_NOT_FOUND" && error.code !== "INVALID_AMOUNT" && error.code !== "INVALID_CURRENCY" && error.code !== "INVALID_STATE_TRANSITION") {
          await repository.markPaymentEventFailed(existing.record.id, error.code);
        }
        throw error;
      }
      throw new PaymentError("INVALID_STATE_TRANSITION", "Payment event could not be applied safely.", { cause: error });
    }
  }

  async function startProviderPayment(paymentId: string, customerId: string): Promise<PaymentDto> {
    const payment = await repository.getPaymentById(paymentId, customerId);
    if (!payment) throw new PaymentError("PAYMENT_NOT_FOUND", "Payment could not be found.");
    if (!providerResolver) throw new PaymentError("PROVIDER_CONFIGURATION_MISSING", "No payment provider is configured.");

    const adapter: PaymentProviderAdapter | undefined = providerResolver.resolve({
      customerId,
      checkoutReference: payment.checkoutReference,
      currency: payment.currency,
    });
    if (!adapter) throw new PaymentError("PROVIDER_UNAVAILABLE", "Payment provider is currently unavailable.");
    if (!adapter.capabilities.createPayment) {
      throw new PaymentError("PROVIDER_UNAVAILABLE", "The configured provider does not support payment creation.");
    }

    const attempts = await repository.getPaymentAttempts(payment.id);
    const attempt = attempts.at(-1);
    if (!attempt) throw new PaymentError("PAYMENT_INTERNAL_ERROR", "Payment attempt could not be resolved.");

    const idempotencyReference = `payment:${payment.id}:attempt:${attempt.id}`;
    try {
      const result = await adapter.createPayment({
        paymentReference: payment.internalReference,
        attemptReference: attempt.id,
        amount: { value: payment.amount.toFixed(2), currency: payment.currency },
        idempotencyReference,
      });

      if (result.providerId !== adapter.id) {
        throw new PaymentError("PROVIDER_CONFIGURATION_ERROR", "Provider response identity is invalid.");
      }

      const nextStatus = result.status;
      const safeAction = normalizeClientAction(result.clientAction);

      // A retried browser request can find the same payment after the first
      // provider-start call already moved it to REQUIRES_ACTION. Reuse the
      // provider's idempotent action instead of attempting an invalid
      // REQUIRES_ACTION -> REQUIRES_ACTION state transition.
      if (payment.status === "REQUIRES_ACTION" && nextStatus === "REQUIRES_ACTION") {
        return { ...toPaymentDto(payment), nextAction: safeAction };
      }

      assertPaymentTransition(payment.status, nextStatus);
      if (safeAction.type !== "NONE") {
        // Client-action data is normalized here; the current Payment DTO intentionally remains secret-safe.
      }

      const updated = await repository.withTransaction(async (tx) => {
        await tx.updatePaymentProviderReferences(
          payment.id,
          attempt.id,
          result.providerId,
          result.providerPaymentReference,
          result.providerAttemptReference,
        );
        return tx.updatePaymentStatus(
          payment.id,
          asPrismaStatus(payment.status),
          asPrismaStatus(nextStatus),
          nextStatus === "SUCCEEDED" ? new Date() : undefined,
        );
      });
      return { ...toPaymentDto(updated), nextAction: safeAction };
    } catch (error) {
      if (error instanceof PaymentError) throw error;
      const category = adapter.normalizeError(error);
      if (category === "PROVIDER_TIMEOUT") {
        throw new PaymentError("PROVIDER_TIMEOUT", "Payment provider response timed out.", { cause: error });
      }
      if (category === "PROVIDER_NETWORK_ERROR") {
        throw new PaymentError("PROVIDER_NETWORK_ERROR", "Payment provider could not be reached.", { cause: error });
      }
      if (category === "PAYMENT_DECLINED") {
        throw new PaymentError("PAYMENT_DECLINED", "Payment was declined.", { cause: error });
      }
      throw new PaymentError("PROVIDER_REJECTED", "Payment provider rejected the request.", { cause: error });
    }
  }

  return {
    createPaymentFromCheckout,
    getPayment,
    transitionPaymentState,
    retryPayment,
    refundPayment,
    reconcilePayment,
    processNormalizedPaymentEvent,
    startProviderPayment,
  };
}
