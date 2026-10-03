import { db } from "@/lib/db/client";
import { checkDatabaseHealth } from "@/lib/observability/health";
import { incidentFingerprint, type ReliabilityFinding } from "./incidents";

export const RELIABILITY_THRESHOLDS = {
  paymentProcessingMinutes: Number(process.env.RELIABILITY_PAYMENT_PROCESSING_MINUTES ?? 30),
  paymentEventMinutes: Number(process.env.RELIABILITY_PAYMENT_EVENT_MINUTES ?? 15),
  orderPendingMinutes: Number(process.env.RELIABILITY_ORDER_PENDING_MINUTES ?? 30),
  fulfillmentPendingMinutes: Number(process.env.RELIABILITY_FULFILLMENT_PENDING_MINUTES ?? 60),
  shipmentCreatedMinutes: Number(process.env.RELIABILITY_SHIPMENT_CREATED_MINUTES ?? 60),
  notificationRetryMinutes: Number(process.env.RELIABILITY_NOTIFICATION_RETRY_MINUTES ?? 30),
  contentScheduleMinutes: Number(process.env.RELIABILITY_CONTENT_SCHEDULE_MINUTES ?? 15),
} as const;

function thresholdDate(now: Date, minutes: number): Date {
  return new Date(now.getTime() - Math.max(1, minutes) * 60_000);
}

export async function runReliabilityChecks(now = new Date()): Promise<ReliabilityFinding[]> {
  const findings: ReliabilityFinding[] = [];
  const database = await checkDatabaseHealth();
  if (!database.ok) {
    findings.push({
      fingerprint: incidentFingerprint("STOREFRONT", "DEPENDENCY", "database-unavailable", "DATABASE"),
      severity: "CRITICAL", category: "DEPENDENCY", capability: "STOREFRONT",
      title: "Database unavailable", summary: "The application database readiness check is failing.", dependency: "DATABASE",
    });
    return findings;
  }

  const [
    processingPayments,
    stalePaymentEvents,
    pendingOrders,
    stuckFulfillments,
    staleShipments,
    retryingNotifications,
    staleScheduledContent,
    paidWithoutOrder,
    confirmedWithoutSucceededPayment,
  ] = await Promise.all([
    db.payment.count({ where: { status: "PROCESSING", updatedAt: { lt: thresholdDate(now, RELIABILITY_THRESHOLDS.paymentProcessingMinutes) } } }),
    db.paymentEvent.count({ where: { processingStatus: "RECEIVED", receivedAt: { lt: thresholdDate(now, RELIABILITY_THRESHOLDS.paymentEventMinutes) } } }),
    db.order.count({ where: { status: "PENDING", updatedAt: { lt: thresholdDate(now, RELIABILITY_THRESHOLDS.orderPendingMinutes) } } }),
    db.fulfillment.count({ where: { status: { in: ["PENDING", "SUBMITTED"] }, updatedAt: { lt: thresholdDate(now, RELIABILITY_THRESHOLDS.fulfillmentPendingMinutes) } } }),
    db.shipment.count({ where: { status: "CREATED", updatedAt: { lt: thresholdDate(now, RELIABILITY_THRESHOLDS.shipmentCreatedMinutes) }, reconciliationRequired: false } }),
    db.notificationDelivery.count({ where: { status: { in: ["PENDING", "PROCESSING", "RETRY_SCHEDULED"] }, OR: [{ nextAttemptAt: { lt: thresholdDate(now, RELIABILITY_THRESHOLDS.notificationRetryMinutes) } }, { nextAttemptAt: null, createdAt: { lt: thresholdDate(now, RELIABILITY_THRESHOLDS.notificationRetryMinutes) } }] } }),
    db.contentItem.count({ where: { status: "SCHEDULED", publicationStartAt: { lt: thresholdDate(now, RELIABILITY_THRESHOLDS.contentScheduleMinutes) } } }),
    db.payment.count({ where: { status: "SUCCEEDED", completedAt: { lt: thresholdDate(now, RELIABILITY_THRESHOLDS.orderPendingMinutes) }, order: { is: null } } }),
    db.order.count({ where: { status: "CONFIRMED", payment: { status: { not: "SUCCEEDED" } } } }),
  ]);

  if (processingPayments > 0) findings.push({
    fingerprint: incidentFingerprint("PAYMENT","FINANCIAL","stuck-processing","PAYMENT_PROVIDER"),
    severity: "MAJOR", category: "FINANCIAL", capability: "PAYMENT", dependency: "PAYMENT_PROVIDER",
    title: "Payments stuck processing", summary: `${processingPayments} payment(s) have remained PROCESSING beyond the provisional threshold.`, metadata: { count: processingPayments },
  });
  if (stalePaymentEvents > 0) findings.push({
    fingerprint: incidentFingerprint("PAYMENT","FINANCIAL","unprocessed-callback","PAYMENT_PROVIDER"),
    severity: "CRITICAL", category: "FINANCIAL", capability: "PAYMENT", dependency: "PAYMENT_PROVIDER",
    title: "Payment callbacks remain unprocessed", summary: `${stalePaymentEvents} received payment event(s) exceed the provisional processing threshold.`, metadata: { count: stalePaymentEvents },
  });
  if (pendingOrders > 0) findings.push({
    fingerprint: incidentFingerprint("ORDER","OPERATIONS","stuck-pending","APPLICATION"),
    severity: "MAJOR", category: "OPERATIONS", capability: "ORDER", dependency: "APPLICATION",
    title: "Orders stuck pending", summary: `${pendingOrders} order(s) remain PENDING beyond the provisional threshold.`, metadata: { count: pendingOrders },
  });
  if (stuckFulfillments > 0) findings.push({
    fingerprint: incidentFingerprint("FULFILLMENT","PROVIDER","stuck-provider-handoff","QIKINK"),
    severity: "MAJOR", category: "PROVIDER", capability: "FULFILLMENT", dependency: "QIKINK",
    title: "Fulfillment handoffs are stuck", summary: `${stuckFulfillments} fulfillment record(s) exceed the provisional handoff threshold.`, metadata: { count: stuckFulfillments },
  });
  if (staleShipments > 0) findings.push({
    fingerprint: incidentFingerprint("SHIPPING","OPERATIONS","shipment-creation-dwell","SHIPPING_PROVIDER"),
    severity: "MAJOR", category: "OPERATIONS", capability: "SHIPPING", dependency: "SHIPPING_PROVIDER",
    title: "Shipment creation is stale", summary: `${staleShipments} shipment(s) remain in CREATED beyond the provisional threshold.`, metadata: { count: staleShipments },
  });
  if (retryingNotifications > 0) findings.push({
    fingerprint: incidentFingerprint("NOTIFICATIONS","DEPENDENCY","retry-backlog","NOTIFICATION_PROVIDER"),
    severity: "OPERATIONAL", category: "DEPENDENCY", capability: "NOTIFICATIONS", dependency: "NOTIFICATION_PROVIDER",
    title: "Notification retry backlog", summary: `${retryingNotifications} notification delivery record(s) have exceeded the provisional retry dwell threshold.`, metadata: { count: retryingNotifications },
  });
  if (staleScheduledContent > 0) findings.push({
    fingerprint: incidentFingerprint("CONTENT","OPERATIONS","scheduled-publication-lag","APPLICATION"),
    severity: "OPERATIONAL", category: "OPERATIONS", capability: "CONTENT", dependency: "APPLICATION",
    title: "Scheduled content publication is delayed", summary: `${staleScheduledContent} content item(s) are past their scheduled publication window.`, metadata: { count: staleScheduledContent },
  });
  if (paidWithoutOrder > 0) findings.push({
    fingerprint: incidentFingerprint("ORDER","FINANCIAL","paid-without-order","APPLICATION"),
    severity: "CRITICAL", category: "FINANCIAL", capability: "ORDER", dependency: "APPLICATION",
    title: "Successful payments without orders", summary: `${paidWithoutOrder} successful payment(s) have no order beyond the provisional reconciliation threshold.`, metadata: { count: paidWithoutOrder },
  });
  if (confirmedWithoutSucceededPayment > 0) findings.push({
    fingerprint: incidentFingerprint("ORDER","DATA_INTEGRITY","confirmed-without-paid-payment","APPLICATION"),
    severity: "CRITICAL", category: "DATA_INTEGRITY", capability: "ORDER", dependency: "APPLICATION",
    title: "Confirmed orders lack successful payment state", summary: `${confirmedWithoutSucceededPayment} confirmed order(s) reference a payment that is not SUCCEEDED.`, metadata: { count: confirmedWithoutSucceededPayment },
  });

  return findings;
}
