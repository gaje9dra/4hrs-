import { Prisma, type NotificationEventType } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { db } from "@/lib/db/client";
import { logger } from "@/lib/observability/logger";
import { incrementMetric } from "@/lib/observability/metrics";
import { getNotificationTemplate, renderNotificationTemplate } from "./templates";
import { NOTIFICATION_BATCH_SIZE, NOTIFICATION_MAX_ATTEMPTS } from "./config";
import { resolveNotificationProvider, sendWithTimeout, type ProviderMessage } from "./provider";
import { isRetryableFailure, retryDelaySeconds } from "./retry";
import { evaluateNotificationEligibility } from "@/lib/communications/preferences";
import type { NotificationDeliverySummary, NotificationEventInput } from "./types";

type DbClient = typeof db | Prisma.TransactionClient;

function deliveryIdempotencyKey(input: NotificationEventInput, templateKey: string): string {
  return `${input.idempotencyKey}:EMAIL:${templateKey}`.slice(0, 255);
}

export async function enqueueNotificationEvent(client: DbClient, input: NotificationEventInput): Promise<{ eventId: string; deliveryId: string | null; created: boolean }> {
  const existing = await client.notificationEvent.findUnique({ where: { idempotencyKey: input.idempotencyKey }, select: { id: true, deliveries: { select: { id: true }, take: 1 } } });
  if (existing) return { eventId: existing.id, deliveryId: existing.deliveries[0]?.id ?? null, created: false };

  const event = await client.notificationEvent.create({
    data: { customerId: input.customerId, communicationCategory: input.communicationCategory ?? "REQUIRED_TRANSACTIONAL", orderId: input.orderId ?? null, returnRequestId: input.returnRequestId ?? null, type: input.type, payload: input.payload === null ? undefined : input.payload, idempotencyKey: input.idempotencyKey.slice(0,255), correlationId: input.correlationId?.slice(0,128) ?? null },
  });

  const customer = await client.customer.findUnique({ where: { id: input.customerId }, select: { email: true, status: true, anonymizedAt: true } });
  if (!customer || customer.anonymizedAt || customer.status !== "ACTIVE") return { eventId: event.id, deliveryId: null, created: true };

  const template = getNotificationTemplate(input.type);
  const eligibility = await evaluateNotificationEligibility({ customerId: input.customerId, category: input.communicationCategory ?? "REQUIRED_TRANSACTIONAL", channel: template.channel, client });
  const delivery = await client.notificationDelivery.create({
    data: {
      notificationEventId: event.id,
      customerId: input.customerId,
      channel: template.channel,
      templateKey: template.key,
      templateVersion: template.version,
      locale: "en-IN",
      recipientAddress: customer.email,
      status: eligibility.eligible ? "PENDING" : "SUPPRESSED",
      suppressionReason: eligibility.eligible ? null : (eligibility.reason === "CUSTOMER_DELETED" ? "CUSTOMER_DELETED" : eligibility.reason === "CUSTOMER_OPTED_OUT" ? "CUSTOMER_OPTED_OUT" : eligibility.reason === "CONSENT_NOT_PRESENT" ? "CONSENT_NOT_PRESENT" : "CHANNEL_UNAVAILABLE"),
      maxAttempts: NOTIFICATION_MAX_ATTEMPTS,
      correlationId: input.correlationId?.slice(0,128) ?? null,
      idempotencyKey: deliveryIdempotencyKey(input, template.key),
    },
  });
  incrementMetric("notification_operations_total" as never, { operation: eligibility.eligible ? "enqueue" : "suppressed", reason: eligibility.eligible ? "eligible" : eligibility.reason });
  return { eventId: event.id, deliveryId: delivery.id, created: true };
}

async function claimDelivery() {
  const now = new Date();
  const candidate = await db.notificationDelivery.findFirst({
    where: { OR: [{ status: "PENDING" }, { status: "RETRY_SCHEDULED", nextAttemptAt: { lte: now } }] },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: { id: true },
  });
  if (!candidate) return null;
  const claimed = await db.notificationDelivery.updateMany({ where: { id: candidate.id, OR: [{ status: "PENDING" }, { status: "RETRY_SCHEDULED", nextAttemptAt: { lte: now } }] }, data: { status: "PROCESSING", attempts: { increment: 1 }, lastAttemptAt: now } });
  if (claimed.count !== 1) return null;
  return db.notificationDelivery.findUnique({ where: { id: candidate.id }, include: { notificationEvent: true } });
}

async function processOne(delivery: NonNullable<Awaited<ReturnType<typeof claimDelivery>>>): Promise<NotificationDeliverySummary> {
  let eligibility;
  try {
    eligibility = await evaluateNotificationEligibility({ customerId: delivery.customerId, category: delivery.notificationEvent.communicationCategory, channel: delivery.channel });
  } catch (error) {
    const failureCode = "NOTIFICATION_PREFERENCE_EVALUATION_FAILED";
    const terminal = delivery.attempts >= delivery.maxAttempts;
    await db.notificationDelivery.update({ where: { id: delivery.id }, data: { status: terminal ? "FAILED" : "RETRY_SCHEDULED", failureCategory: "CONNECTION", failureCode, nextAttemptAt: terminal ? null : new Date(Date.now() + retryDelaySeconds(delivery.attempts) * 1000) } });
    logger.error("notification.preference_evaluation_failed", { operationId: delivery.id, correlationId: delivery.correlationId, resourceType: "NotificationDelivery", resourceId: delivery.id, outcome: "failure", errorCode: error instanceof Error ? error.name : failureCode });
    return { id: delivery.id, status: terminal ? "FAILED" : "RETRY_SCHEDULED", attempts: delivery.attempts };
  }
  if (!eligibility.eligible) {
    const suppressionReason = eligibility.reason === "CUSTOMER_DELETED" ? "CUSTOMER_DELETED" : eligibility.reason === "CUSTOMER_OPTED_OUT" ? "CUSTOMER_OPTED_OUT" : eligibility.reason === "CONSENT_NOT_PRESENT" ? "CONSENT_NOT_PRESENT" : "CHANNEL_UNAVAILABLE";
    await db.notificationDelivery.update({ where: { id: delivery.id }, data: { status: "SUPPRESSED", suppressionReason, nextAttemptAt: null, failureCategory: null, failureCode: null } });
    incrementMetric("notification_operations_total" as never, { operation: "suppressed", reason: suppressionReason });
    return { id: delivery.id, status: "SUPPRESSED", attempts: delivery.attempts };
  }
  if (!delivery.recipientAddress) {
    await db.notificationDelivery.update({ where: { id: delivery.id }, data: { status: "FAILED", failureCategory: "PERMANENT_RECIPIENT", failureCode: "RECIPIENT_REDACTED" } });
    return { id: delivery.id, status: "FAILED", attempts: delivery.attempts };
  }

  try {
    const template = getNotificationTemplate(delivery.notificationEvent.type);
    const rendered = renderNotificationTemplate(template, (delivery.notificationEvent.payload ?? null) as Record<string, unknown> | null);
    const provider = resolveNotificationProvider();
    const result = await sendWithTimeout(provider, { channel: "EMAIL", recipientAddress: delivery.recipientAddress, subject: rendered.subject, text: rendered.text, html: rendered.html, idempotencyKey: delivery.idempotencyKey });

    if (result.outcome === "accepted" || result.outcome === "delivered") {
      await db.notificationDelivery.update({ where: { id: delivery.id }, data: { status: result.outcome === "delivered" ? "DELIVERED" : "SENT", providerId: result.providerId, providerReference: result.providerReference, sentAt: new Date(), deliveredAt: result.outcome === "delivered" ? new Date() : null, failureCategory: null, failureCode: null } });
      incrementMetric("notification_operations_total" as never, { operation: "sent", provider: result.providerId });
      return { id: delivery.id, status: result.outcome === "delivered" ? "DELIVERED" : "SENT", attempts: delivery.attempts };
    }

    if (result.outcome === "ambiguous") {
      await db.notificationDelivery.update({ where: { id: delivery.id }, data: { status: "AMBIGUOUS", providerId: result.providerId, providerReference: result.providerReference, failureCategory: "AMBIGUOUS_RESULT", failureCode: result.failureCode } });
      incrementMetric("notification_operations_total" as never, { operation: "ambiguous", provider: result.providerId });
      return { id: delivery.id, status: "AMBIGUOUS", attempts: delivery.attempts };
    }

    const terminal = !isRetryableFailure(result.failureCategory) || delivery.attempts >= delivery.maxAttempts;
    await db.notificationDelivery.update({ where: { id: delivery.id }, data: { status: terminal ? "FAILED" : "RETRY_SCHEDULED", providerId: result.providerId, providerReference: result.providerReference, failureCategory: result.failureCategory, failureCode: result.failureCode, nextAttemptAt: terminal ? null : new Date(Date.now() + retryDelaySeconds(delivery.attempts) * 1000) } });
    incrementMetric("notification_operations_total" as never, { operation: terminal ? "failed" : "retry", provider: result.providerId });
    return { id: delivery.id, status: terminal ? "FAILED" : "RETRY_SCHEDULED", attempts: delivery.attempts };
  } catch (error) {
    const failureCode = error instanceof Error && "code" in error ? String((error as { code?: unknown }).code) : "NOTIFICATION_PROCESSING_ERROR";
    const terminal = delivery.attempts >= delivery.maxAttempts;
    await db.notificationDelivery.update({ where: { id: delivery.id }, data: { status: terminal ? "FAILED" : "RETRY_SCHEDULED", failureCategory: failureCode === "NOTIFICATION_PROVIDER_TIMEOUT" ? "TIMEOUT" : "TEMPORARY_PROVIDER", failureCode: failureCode.slice(0,120), nextAttemptAt: terminal ? null : new Date(Date.now() + retryDelaySeconds(delivery.attempts) * 1000) } });
    logger.error("notification.delivery_failed", { operationId: delivery.id, correlationId: delivery.correlationId, resourceType: "NotificationDelivery", resourceId: delivery.id, outcome: "failure", errorCode: failureCode });
    incrementMetric("notification_operations_total" as never, { operation: terminal ? "failed" : "retry" });
    return { id: delivery.id, status: terminal ? "FAILED" : "RETRY_SCHEDULED", attempts: delivery.attempts };
  }
}

export async function processNotificationBatch(limit = NOTIFICATION_BATCH_SIZE): Promise<NotificationDeliverySummary[]> {
  const boundedLimit = Math.max(1, Math.min(100, Math.trunc(limit)));
  const results: NotificationDeliverySummary[] = [];
  for (let i = 0; i < boundedLimit; i++) {
    const delivery = await claimDelivery();
    if (!delivery) break;
    results.push(await processOne(delivery));
  }
  return results;
}

export async function resendNotificationDelivery(deliveryId: string): Promise<NotificationDeliverySummary> {
  const source = await db.notificationDelivery.findUnique({ where: { id: deliveryId }, select: { id: true, customerId: true, notificationEventId: true, channel: true, templateKey: true, templateVersion: true, locale: true, recipientAddress: true, correlationId: true } });
  if (!source) throw new Error("NOTIFICATION_NOT_FOUND");
  if (!source.recipientAddress) throw new Error("NOTIFICATION_RECIPIENT_UNAVAILABLE");
  const next = await db.notificationDelivery.create({ data: { notificationEventId: source.notificationEventId, customerId: source.customerId, channel: source.channel, templateKey: source.templateKey, templateVersion: source.templateVersion, locale: source.locale, recipientAddress: source.recipientAddress, status: "PENDING", maxAttempts: NOTIFICATION_MAX_ATTEMPTS, correlationId: source.correlationId, idempotencyKey: `resend:${source.id}:${randomUUID()}` } });
  return { id: next.id, status: next.status, attempts: next.attempts };
}