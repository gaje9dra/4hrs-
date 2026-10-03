import { Prisma, type CommunicationCategory, type NotificationChannel, type NotificationDeliveryStatus, type NotificationEventType, type NotificationFailureCategory } from "@prisma/client";

export type NotificationEventInput = {
  customerId: string;
  orderId?: string | null;
  returnRequestId?: string | null;
  type: NotificationEventType;
  communicationCategory?: CommunicationCategory;
  payload?: Prisma.InputJsonValue | null;
  idempotencyKey: string;
  correlationId?: string | null;
};

export type NotificationTemplate = {
  key: string;
  version: number;
  channel: NotificationChannel;
  subject: string;
  text: string;
  html: string;
  requiredVariables: readonly string[];
};

export type NotificationDeliveryResult =
  | { outcome: "accepted"; providerId: string; providerReference: string | null }
  | { outcome: "delivered"; providerId: string; providerReference: string | null }
  | { outcome: "ambiguous"; providerId: string; providerReference: string | null; failureCode: string }
  | { outcome: "failed"; providerId: string; providerReference: string | null; failureCategory: NotificationFailureCategory; failureCode: string };

export type NotificationDeliverySummary = {
  id: string;
  status: NotificationDeliveryStatus;
  attempts: number;
};