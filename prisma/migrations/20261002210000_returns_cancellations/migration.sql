CREATE TYPE "CancellationStatus" AS ENUM ('REQUESTED','APPROVED','REJECTED','PROCESSING','COMPLETED','FAILED','REQUIRES_REVIEW');
CREATE TYPE "ReturnRequestStatus" AS ENUM ('REQUESTED','UNDER_REVIEW','APPROVED','REJECTED','RETURN_IN_TRANSIT','RETURN_RECEIVED','INSPECTION_PENDING','INSPECTED','RESOLUTION_PENDING','RESOLVED','FAILED');
CREATE TYPE "ReturnReasonCode" AS ENUM ('WRONG_ITEM','DAMAGED','DEFECTIVE','SIZE_OR_FIT','NOT_AS_EXPECTED','CHANGED_MIND','OTHER');
CREATE TYPE "ReturnShipmentStatus" AS ENUM ('RETURN_AUTHORIZED','RETURN_IN_TRANSIT','RETURN_RECEIVED','CANCELLED');
CREATE TYPE "ReturnResolutionType" AS ENUM ('REFUND','REPLACEMENT','STORE_CREDIT','REJECTED','PARTIAL_REFUND');
CREATE TYPE "ReturnInspectionOutcome" AS ENUM ('ACCEPTED','PARTIALLY_ACCEPTED','REJECTED');
CREATE TYPE "CommerceExceptionActorType" AS ENUM ('CUSTOMER','ADMIN','SYSTEM');
CREATE TYPE "CommerceExceptionAction" AS ENUM ('CANCELLATION_REQUESTED','CANCELLATION_APPROVED','CANCELLATION_REJECTED','CANCELLATION_COMPLETED','RETURN_REQUESTED','RETURN_APPROVED','RETURN_REJECTED','RETURN_RECEIVED','RETURN_INSPECTED','RETURN_RESOLVED','REFUND_INTENT_CREATED');
CREATE TYPE "NotificationEventType" AS ENUM ('CANCELLATION_REQUESTED','CANCELLATION_APPROVED','CANCELLATION_REJECTED','RETURN_REQUESTED','RETURN_APPROVED','RETURN_REJECTED','RETURN_RECEIVED','RETURN_RESOLUTION_COMPLETED','REFUND_INITIATED','REFUND_COMPLETED','REFUND_FAILED');

CREATE TABLE "CancellationRequest" (
  "id" UUID NOT NULL,
  "cancellationReference" VARCHAR(64) NOT NULL,
  "customerId" UUID NOT NULL,
  "orderId" UUID NOT NULL,
  "status" "CancellationStatus" NOT NULL DEFAULT 'REQUESTED',
  "reason" VARCHAR(120) NOT NULL,
  "customerDescription" VARCHAR(2000),
  "operationalReason" VARCHAR(500),
  "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reviewedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CancellationRequest_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CancellationRequest_cancellationReference_key" UNIQUE ("cancellationReference"),
  CONSTRAINT "CancellationRequest_orderId_key" UNIQUE ("orderId"),
  CONSTRAINT "CancellationRequest_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "CancellationRequest_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "CancellationRequest_customerId_createdAt_idx" ON "CancellationRequest"("customerId","createdAt");
CREATE INDEX "CancellationRequest_status_updatedAt_idx" ON "CancellationRequest"("status","updatedAt");

CREATE TABLE "ReturnRequest" (
  "id" UUID NOT NULL,
  "returnReference" VARCHAR(64) NOT NULL,
  "customerId" UUID NOT NULL,
  "orderId" UUID NOT NULL,
  "status" "ReturnRequestStatus" NOT NULL DEFAULT 'REQUESTED',
  "reasonCode" "ReturnReasonCode" NOT NULL,
  "customerDescription" VARCHAR(2000),
  "operationalReason" VARCHAR(500),
  "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reviewedAt" TIMESTAMP(3),
  "resolvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ReturnRequest_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ReturnRequest_returnReference_key" UNIQUE ("returnReference"),
  CONSTRAINT "ReturnRequest_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ReturnRequest_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "ReturnRequest_customerId_createdAt_idx" ON "ReturnRequest"("customerId","createdAt");
CREATE INDEX "ReturnRequest_orderId_createdAt_idx" ON "ReturnRequest"("orderId","createdAt");
CREATE INDEX "ReturnRequest_status_updatedAt_idx" ON "ReturnRequest"("status","updatedAt");

CREATE TABLE "ReturnItem" (
  "id" UUID NOT NULL,
  "returnRequestId" UUID NOT NULL,
  "orderItemId" UUID NOT NULL,
  "quantity" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ReturnItem_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ReturnItem_returnRequestId_orderItemId_key" UNIQUE ("returnRequestId","orderItemId"),
  CONSTRAINT "ReturnItem_returnRequestId_fkey" FOREIGN KEY ("returnRequestId") REFERENCES "ReturnRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ReturnItem_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "ReturnItem_orderItemId_createdAt_idx" ON "ReturnItem"("orderItemId","createdAt");

CREATE TABLE "ReturnShipment" (
  "id" UUID NOT NULL,
  "returnRequestId" UUID NOT NULL,
  "sourceShipmentId" UUID,
  "reference" VARCHAR(64) NOT NULL,
  "status" "ReturnShipmentStatus" NOT NULL DEFAULT 'RETURN_AUTHORIZED',
  "carrier" VARCHAR(120),
  "trackingNumber" VARCHAR(160),
  "trackingUrl" VARCHAR(1000),
  "externallySupplied" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ReturnShipment_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ReturnShipment_returnRequestId_key" UNIQUE ("returnRequestId"),
  CONSTRAINT "ReturnShipment_reference_key" UNIQUE ("reference"),
  CONSTRAINT "ReturnShipment_returnRequestId_fkey" FOREIGN KEY ("returnRequestId") REFERENCES "ReturnRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ReturnShipment_sourceShipmentId_fkey" FOREIGN KEY ("sourceShipmentId") REFERENCES "Shipment"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "ReturnShipment_sourceShipmentId_idx" ON "ReturnShipment"("sourceShipmentId");
CREATE INDEX "ReturnShipment_status_updatedAt_idx" ON "ReturnShipment"("status","updatedAt");

CREATE TABLE "ReturnInspection" (
  "id" UUID NOT NULL,
  "returnRequestId" UUID NOT NULL,
  "receivedQuantity" INTEGER NOT NULL,
  "acceptedQuantity" INTEGER NOT NULL,
  "rejectedQuantity" INTEGER NOT NULL,
  "outcome" "ReturnInspectionOutcome" NOT NULL,
  "internalReason" VARCHAR(500),
  "operatorId" VARCHAR(128) NOT NULL,
  "inspectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ReturnInspection_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ReturnInspection_returnRequestId_key" UNIQUE ("returnRequestId"),
  CONSTRAINT "ReturnInspection_returnRequestId_fkey" FOREIGN KEY ("returnRequestId") REFERENCES "ReturnRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "ReturnInspection_operatorId_inspectedAt_idx" ON "ReturnInspection"("operatorId","inspectedAt");

CREATE TABLE "ReturnResolution" (
  "id" UUID NOT NULL,
  "returnRequestId" UUID NOT NULL,
  "type" "ReturnResolutionType" NOT NULL,
  "refundAmount" DECIMAL(12,2),
  "currency" VARCHAR(3),
  "paymentRefundIntentReference" VARCHAR(64),
  "note" VARCHAR(500),
  "resolvedBy" VARCHAR(128) NOT NULL,
  "resolvedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ReturnResolution_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ReturnResolution_returnRequestId_key" UNIQUE ("returnRequestId"),
  CONSTRAINT "ReturnResolution_paymentRefundIntentReference_key" UNIQUE ("paymentRefundIntentReference"),
  CONSTRAINT "ReturnResolution_returnRequestId_fkey" FOREIGN KEY ("returnRequestId") REFERENCES "ReturnRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "ReturnResolution_type_resolvedAt_idx" ON "ReturnResolution"("type","resolvedAt");

CREATE TABLE "CommerceExceptionAuditEvent" (
  "id" UUID NOT NULL,
  "actorType" "CommerceExceptionActorType" NOT NULL,
  "actorId" VARCHAR(128),
  "action" "CommerceExceptionAction" NOT NULL,
  "previousState" VARCHAR(64),
  "newState" VARCHAR(64),
  "reason" VARCHAR(500),
  "orderId" UUID NOT NULL,
  "returnRequestId" UUID,
  "cancellationRequestId" UUID,
  "orderItemId" UUID,
  "correlationId" VARCHAR(128),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CommerceExceptionAuditEvent_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "CommerceExceptionAuditEvent_orderId_createdAt_idx" ON "CommerceExceptionAuditEvent"("orderId","createdAt");
CREATE INDEX "CommerceExceptionAuditEvent_returnRequestId_createdAt_idx" ON "CommerceExceptionAuditEvent"("returnRequestId","createdAt");
CREATE INDEX "CommerceExceptionAuditEvent_cancellationRequestId_createdAt_idx" ON "CommerceExceptionAuditEvent"("cancellationRequestId","createdAt");
CREATE INDEX "CommerceExceptionAuditEvent_correlationId_idx" ON "CommerceExceptionAuditEvent"("correlationId");

CREATE TABLE "NotificationEvent" (
  "id" UUID NOT NULL,
  "customerId" UUID NOT NULL,
  "orderId" UUID,
  "returnRequestId" UUID,
  "type" "NotificationEventType" NOT NULL,
  "payload" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "NotificationEvent_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "NotificationEvent_customerId_createdAt_idx" ON "NotificationEvent"("customerId","createdAt");
CREATE INDEX "NotificationEvent_orderId_createdAt_idx" ON "NotificationEvent"("orderId","createdAt");
CREATE INDEX "NotificationEvent_returnRequestId_createdAt_idx" ON "NotificationEvent"("returnRequestId","createdAt");