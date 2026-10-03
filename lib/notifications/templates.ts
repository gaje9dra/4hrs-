import type { NotificationEventType } from "@prisma/client";
import type { NotificationTemplate } from "./types";
import { normalizeLocale, type SupportedLocale } from "@/lib/i18n/registry";
import { translate } from "@/lib/i18n/messages";

const templates: Record<NotificationEventType, NotificationTemplate> = {
  SECURITY_PASSWORD_CHANGED: { key: "security-password-changed", version: 1, channel: "EMAIL", subject: "Your 4HRS+ password was changed", text: "Your 4HRS+ account password was changed. If you did not make this change, secure your account immediately.", html: "<p>Your 4HRS+ account password was changed.</p><p>If you did not make this change, secure your account immediately.</p>", requiredVariables: [] },
  SECURITY_SESSIONS_REVOKED: { key: "security-sessions-revoked", version: 1, channel: "EMAIL", subject: "Your 4HRS+ sessions were signed out", text: "All active sessions for your 4HRS+ account were signed out.", html: "<p>All active sessions for your 4HRS+ account were signed out.</p>", requiredVariables: [] },
  ORDER_CONFIRMED: { key: "order-confirmed", version: 1, channel: "EMAIL", subject: "Your 4HRS+ order is confirmed", text: "Your order {{orderNumber}} is confirmed.", html: "<p>Your order <strong>{{orderNumber}}</strong> is confirmed.</p>", requiredVariables: ["orderNumber"] },
  PAYMENT_SUCCEEDED: { key: "payment-succeeded", version: 1, channel: "EMAIL", subject: "Payment received for order {{orderNumber}}", text: "We received your payment for order {{orderNumber}}.", html: "<p>We received your payment for order <strong>{{orderNumber}}</strong>.</p>", requiredVariables: ["orderNumber"] },
  PAYMENT_FAILED: { key: "payment-failed", version: 1, channel: "EMAIL", subject: "Payment update for order {{orderNumber}}", text: "Your payment for order {{orderNumber}} was not completed.", html: "<p>Your payment for order <strong>{{orderNumber}}</strong> was not completed.</p>", requiredVariables: ["orderNumber"] },
  FULFILLMENT_SUBMITTED: { key: "fulfillment-submitted", version: 1, channel: "EMAIL", subject: "Your order is being prepared", text: "Your order {{orderNumber}} has been submitted for fulfillment.", html: "<p>Your order <strong>{{orderNumber}}</strong> has been submitted for fulfillment.</p>", requiredVariables: ["orderNumber"] },
  FULFILLMENT_FAILED: { key: "fulfillment-failed", version: 1, channel: "EMAIL", subject: "Update on order {{orderNumber}}", text: "We need to review fulfillment for order {{orderNumber}}.", html: "<p>We need to review fulfillment for order <strong>{{orderNumber}}</strong>.</p>", requiredVariables: ["orderNumber"] },
  SHIPMENT_CREATED: { key: "shipment-created", version: 1, channel: "EMAIL", subject: "Your order has shipped", text: "Shipment {{shipmentReference}} has been created for order {{orderNumber}}.", html: "<p>Shipment <strong>{{shipmentReference}}</strong> has been created for order <strong>{{orderNumber}}</strong>.</p>", requiredVariables: ["orderNumber", "shipmentReference"] },
  SHIPMENT_IN_TRANSIT: { key: "shipment-in-transit", version: 1, channel: "EMAIL", subject: "Your order is in transit", text: "Shipment {{shipmentReference}} for order {{orderNumber}} is in transit.", html: "<p>Shipment <strong>{{shipmentReference}}</strong> for order <strong>{{orderNumber}}</strong> is in transit.</p>", requiredVariables: ["orderNumber", "shipmentReference"] },
  SHIPMENT_OUT_FOR_DELIVERY: { key: "shipment-out-for-delivery", version: 1, channel: "EMAIL", subject: "Your order is out for delivery", text: "Shipment {{shipmentReference}} for order {{orderNumber}} is out for delivery.", html: "<p>Shipment <strong>{{shipmentReference}}</strong> for order <strong>{{orderNumber}}</strong> is out for delivery.</p>", requiredVariables: ["orderNumber", "shipmentReference"] },
  SHIPMENT_DELIVERED: { key: "shipment-delivered", version: 1, channel: "EMAIL", subject: "Your order was delivered", text: "Shipment {{shipmentReference}} for order {{orderNumber}} was delivered.", html: "<p>Shipment <strong>{{shipmentReference}}</strong> for order <strong>{{orderNumber}}</strong> was delivered.</p>", requiredVariables: ["orderNumber", "shipmentReference"] },
  SHIPMENT_DELIVERY_FAILED: { key: "shipment-delivery-failed", version: 1, channel: "EMAIL", subject: "Delivery update for order {{orderNumber}}", text: "Delivery of shipment {{shipmentReference}} for order {{orderNumber}} needs attention.", html: "<p>Delivery of shipment <strong>{{shipmentReference}}</strong> for order <strong>{{orderNumber}}</strong> needs attention.</p>", requiredVariables: ["orderNumber", "shipmentReference"] },
  CANCELLATION_REQUESTED: { key: "cancellation-requested", version: 1, channel: "EMAIL", subject: "Cancellation request received", text: "We received your cancellation request {{cancellationReference}} for order {{orderNumber}}.", html: "<p>We received cancellation request <strong>{{cancellationReference}}</strong> for order <strong>{{orderNumber}}</strong>.</p>", requiredVariables: ["orderNumber", "cancellationReference"] },
  CANCELLATION_APPROVED: { key: "cancellation-approved", version: 1, channel: "EMAIL", subject: "Cancellation approved", text: "Your cancellation request {{cancellationReference}} for order {{orderNumber}} was approved.", html: "<p>Your cancellation request <strong>{{cancellationReference}}</strong> for order <strong>{{orderNumber}}</strong> was approved.</p>", requiredVariables: ["orderNumber", "cancellationReference"] },
  CANCELLATION_REJECTED: { key: "cancellation-rejected", version: 1, channel: "EMAIL", subject: "Cancellation update", text: "Your cancellation request {{cancellationReference}} for order {{orderNumber}} was rejected.", html: "<p>Your cancellation request <strong>{{cancellationReference}}</strong> for order <strong>{{orderNumber}}</strong> was rejected.</p>", requiredVariables: ["orderNumber", "cancellationReference"] },
  RETURN_REQUESTED: { key: "return-requested", version: 1, channel: "EMAIL", subject: "Return request received", text: "We received return request {{returnReference}} for order {{orderNumber}}.", html: "<p>We received return request <strong>{{returnReference}}</strong> for order <strong>{{orderNumber}}</strong>.</p>", requiredVariables: ["orderNumber", "returnReference"] },
  RETURN_APPROVED: { key: "return-approved", version: 1, channel: "EMAIL", subject: "Return approved", text: "Your return request {{returnReference}} for order {{orderNumber}} was approved.", html: "<p>Your return request <strong>{{returnReference}}</strong> for order <strong>{{orderNumber}}</strong> was approved.</p>", requiredVariables: ["orderNumber", "returnReference"] },
  RETURN_REJECTED: { key: "return-rejected", version: 1, channel: "EMAIL", subject: "Return update", text: "Your return request {{returnReference}} for order {{orderNumber}} was rejected.", html: "<p>Your return request <strong>{{returnReference}}</strong> for order <strong>{{orderNumber}}</strong> was rejected.</p>", requiredVariables: ["orderNumber", "returnReference"] },
  RETURN_RECEIVED: { key: "return-received", version: 1, channel: "EMAIL", subject: "Your return was received", text: "Your return {{returnReference}} for order {{orderNumber}} was received.", html: "<p>Your return <strong>{{returnReference}}</strong> for order <strong>{{orderNumber}}</strong> was received.</p>", requiredVariables: ["orderNumber", "returnReference"] },
  RETURN_RESOLUTION_COMPLETED: { key: "return-resolution-completed", version: 1, channel: "EMAIL", subject: "Your return has been resolved", text: "Return {{returnReference}} for order {{orderNumber}} has been resolved.", html: "<p>Return <strong>{{returnReference}}</strong> for order <strong>{{orderNumber}}</strong> has been resolved.</p>", requiredVariables: ["orderNumber", "returnReference"] },
  REFUND_INITIATED: { key: "refund-initiated", version: 1, channel: "EMAIL", subject: "Refund initiated", text: "A refund has been initiated for order {{orderNumber}}.", html: "<p>A refund has been initiated for order <strong>{{orderNumber}}</strong>.</p>", requiredVariables: ["orderNumber"] },
  REFUND_COMPLETED: { key: "refund-completed", version: 1, channel: "EMAIL", subject: "Refund completed", text: "Your refund for order {{orderNumber}} has been completed.", html: "<p>Your refund for order <strong>{{orderNumber}}</strong> has been completed.</p>", requiredVariables: ["orderNumber"] },
  REFUND_FAILED: { key: "refund-failed", version: 1, channel: "EMAIL", subject: "Refund update", text: "Your refund for order {{orderNumber}} requires review.", html: "<p>Your refund for order <strong>{{orderNumber}}</strong> requires review.</p>", requiredVariables: ["orderNumber"] },
  CASE_CREATED: { key: "case-created", version: 1, channel: "EMAIL", subject: "Your support case was created", text: "Support case {{caseReference}} was created.", html: "<p>Support case <strong>{{caseReference}}</strong> was created.</p>", requiredVariables: ["caseReference"] },
  CASE_RESOLVED: { key: "case-resolved", version: 1, channel: "EMAIL", subject: "Your support case was resolved", text: "Support case {{caseReference}} was resolved.", html: "<p>Support case <strong>{{caseReference}}</strong> was resolved.</p>", requiredVariables: ["caseReference"] },
};

function escapeHtml(value: string): string {
  return value.replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#39;");
}

export function getNotificationTemplate(type: NotificationEventType, locale: SupportedLocale = "en-IN"): NotificationTemplate {
  const template = templates[type];
  const normalizedLocale = normalizeLocale(locale);
  if (type === "ORDER_CONFIRMED") {
    const subject = translate(normalizedLocale, "notifications", "orderConfirmed");
    return { ...template, subject, text: subject + ".", html: "<p>" + subject + ".</p>" };
  }
  if (type === "PAYMENT_SUCCEEDED") {
    const subject = translate(normalizedLocale, "notifications", "paymentReceived", { orderNumber: "{{orderNumber}}" });
    return { ...template, subject, text: subject + ".", html: "<p>" + subject + ".</p>" };
  }
  if (type === "PAYMENT_FAILED") {
    const subject = translate(normalizedLocale, "notifications", "paymentFailed", { orderNumber: "{{orderNumber}}" });
    return { ...template, subject, text: "Your payment for order {{orderNumber}} was not completed.", html: "<p>Your payment for order <strong>{{orderNumber}}</strong> was not completed.</p>" };
  }
  return template;
}

export function renderNotificationTemplate(template: NotificationTemplate, payload: Record<string, unknown> | null | undefined) {
  const variables = Object.fromEntries(Object.entries(payload ?? {}).map(([key, value]) => [key, String(value)]));
  for (const key of template.requiredVariables) {
    if (!variables[key]?.trim()) throw new Error(`Missing notification template variable: ${key}`);
  }
  const replace = (source: string) => source.replace(/{{([A-Za-z][A-Za-z0-9_]*)}}/g, (_, key: string) => escapeHtml(variables[key] ?? ""));
  return { subject: replace(template.subject), text: replace(template.text), html: replace(template.html) };
}