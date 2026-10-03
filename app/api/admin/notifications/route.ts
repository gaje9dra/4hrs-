import { db } from "@/lib/db/client";
import { requireAdmin } from "@/lib/admin/authorization";
import { adminErrorResponse, adminJson, assertAdminSameOrigin, readAdminJson, isValidAdminId } from "@/lib/admin/http";
import { auditAdminAction } from "@/lib/admin/audit";
import { requireHighRiskReason } from "@/lib/admin/authorization";
import { resendNotificationDelivery } from "@/lib/notifications/service";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function toDto(row: {
  id: string;
  customerId: string;
  channel: string;
  templateKey: string;
  templateVersion: number;
  locale: string;
  status: string;
  attempts: number;
  maxAttempts: number;
  nextAttemptAt: Date | null;
  lastAttemptAt: Date | null;
  sentAt: Date | null;
  deliveredAt: Date | null;
  providerId: string | null;
  providerReference: string | null;
  failureCategory: string | null;
  failureCode: string | null;
  correlationId: string | null;
  createdAt: Date;
  updatedAt: Date;
  notificationEvent: { type: string; orderId: string | null; returnRequestId: string | null; createdAt: Date };
}) {
  return {
    id: row.id,
    customerId: row.customerId,
    channel: row.channel,
    template: { key: row.templateKey, version: row.templateVersion, locale: row.locale },
    event: {
      type: row.notificationEvent.type,
      orderId: row.notificationEvent.orderId,
      returnRequestId: row.notificationEvent.returnRequestId,
      createdAt: row.notificationEvent.createdAt.toISOString(),
    },
    status: row.status,
    attempts: row.attempts,
    maxAttempts: row.maxAttempts,
    nextAttemptAt: row.nextAttemptAt?.toISOString() ?? null,
    lastAttemptAt: row.lastAttemptAt?.toISOString() ?? null,
    sentAt: row.sentAt?.toISOString() ?? null,
    deliveredAt: row.deliveredAt?.toISOString() ?? null,
    provider: row.providerId,
    providerReference: row.providerReference,
    failureCategory: row.failureCategory,
    failureCode: row.failureCode,
    correlationId: row.correlationId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function GET(request: Request) {
  try {
    const context = await requireAdmin(request, "notifications.read");
    const url = new URL(request.url);
    const status = url.searchParams.get("status");
    const take = Math.min(Math.max(Number(url.searchParams.get("limit") ?? "50"), 1), 100);
    const rows = await db.notificationDelivery.findMany({
      where: status && ["PENDING","PROCESSING","SENT","DELIVERED","RETRY_SCHEDULED","FAILED","AMBIGUOUS"].includes(status)
        ? { status: status as never }
        : undefined,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take,
      include: { notificationEvent: { select: { type: true, orderId: true, returnRequestId: true, createdAt: true } } },
    });
    void context;
    return adminJson(rows.map(toDto));
  } catch (error) {
    return adminErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const context = await requireAdmin(request, "notifications.manage");
    assertAdminSameOrigin(request);
    const body = await readAdminJson(request);
    if (body.action !== "RESEND" || !isValidAdminId(body.deliveryId)) {
      throw new Error("INVALID_REQUEST");
    }
    const reason = requireHighRiskReason(body.reason);
    const result = await resendNotificationDelivery(body.deliveryId);
    await auditAdminAction(context, {
      action: "NOTIFICATION_RESEND",
      resourceType: "NotificationDelivery",
      resourceId: body.deliveryId,
      success: true,
      reason,
      requestId: request.headers.get("x-request-id"),
      metadata: { replacementDeliveryId: result.id },
    });
    return adminJson(result, { status: 202 });
  } catch (error) {
    if (error instanceof Error && error.message === "INVALID_REQUEST") {
      return adminJson({ error: { code: "INVALID_REQUEST", message: "The notification resend request is invalid." } }, { status: 400 });
    }
    return adminErrorResponse(error);
  }
}
