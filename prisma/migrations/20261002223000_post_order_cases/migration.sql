CREATE TYPE "CaseStatus" AS ENUM ('OPEN','TRIAGED','ASSIGNED','IN_PROGRESS','WAITING','RESOLVED','CLOSED');
CREATE TYPE "CaseCategory" AS ENUM ('ORDER_ISSUE','PAYMENT_ISSUE','FULFILLMENT_ISSUE','SHIPPING_ISSUE','DELIVERY_ISSUE','TRACKING_ISSUE','CANCELLATION_REVIEW','RETURN_REVIEW','RETURN_INSPECTION','REFUND_ISSUE','PROVIDER_EXCEPTION','RECONCILIATION_EXCEPTION','CUSTOMER_SUPPORT');
CREATE TYPE "CasePriority" AS ENUM ('LOW','NORMAL','HIGH','URGENT');
CREATE TYPE "CaseSource" AS ENUM ('CUSTOMER','SYSTEM','OPERATOR');
CREATE TYPE "CaseResolutionType" AS ENUM ('INFORMATION_PROVIDED','CUSTOMER_ACTION_REQUIRED','PROVIDER_RECONCILED','ORDER_CANCELLED','RETURN_APPROVED','RETURN_REJECTED','REFUND_REQUESTED','REFUND_COMPLETED','SHIPMENT_RECONCILED','FULFILLMENT_RESOLVED','NO_ACTION_REQUIRED','DUPLICATE','ESCALATED');
CREATE TYPE "CaseAuditAction" AS ENUM ('CREATED','ASSIGNED','PRIORITY_CHANGED','NOTE_ADDED','TRANSITIONED','DOMAIN_ACTION_EXECUTED','RESOLVED','CLOSED','CUSTOMER_UPDATED');

CREATE TABLE "Case" (
"id" UUID NOT NULL,"caseReference" VARCHAR(64) NOT NULL,"customerId" UUID,"orderId" UUID,"orderItemId" UUID,"shipmentId" UUID,"fulfillmentId" UUID,"returnRequestId" UUID,"cancellationRequestId" UUID,"paymentId" UUID,"category" "CaseCategory" NOT NULL,"status" "CaseStatus" NOT NULL DEFAULT 'OPEN',"priority" "CasePriority" NOT NULL DEFAULT 'NORMAL',"source" "CaseSource" NOT NULL,"sourceReference" VARCHAR(255),"deduplicationKey" VARCHAR(255),"title" VARCHAR(200) NOT NULL,"customerDescription" VARCHAR(4000),"resolutionType" "CaseResolutionType","resolutionSummary" VARCHAR(1000),"assignedOperatorId" UUID,"correlationId" VARCHAR(128),"version" INTEGER NOT NULL DEFAULT 1,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"updatedAt" TIMESTAMP(3) NOT NULL,"resolvedAt" TIMESTAMP(3),"closedAt" TIMESTAMP(3),
CONSTRAINT "Case_pkey" PRIMARY KEY ("id"),CONSTRAINT "Case_caseReference_key" UNIQUE ("caseReference"),CONSTRAINT "Case_deduplicationKey_key" UNIQUE ("deduplicationKey"));
CREATE TABLE "CaseNote" ("id" UUID NOT NULL,"caseId" UUID NOT NULL,"authorId" UUID NOT NULL,"body" VARCHAR(4000) NOT NULL,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,CONSTRAINT "CaseNote_pkey" PRIMARY KEY ("id"));
CREATE TABLE "CaseAssignment" ("id" UUID NOT NULL,"caseId" UUID NOT NULL,"operatorId" UUID NOT NULL,"assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,CONSTRAINT "CaseAssignment_pkey" PRIMARY KEY ("id"));
CREATE TABLE "CaseAuditEvent" ("id" UUID NOT NULL,"caseId" UUID NOT NULL,"actorId" UUID,"action" "CaseAuditAction" NOT NULL,"previousState" TEXT,"newState" TEXT,"reason" VARCHAR(1000),"correlationId" VARCHAR(128),"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,CONSTRAINT "CaseAuditEvent_pkey" PRIMARY KEY ("id"));

CREATE INDEX "Case_customerId_createdAt_idx" ON "Case"("customerId","createdAt");
CREATE INDEX "Case_orderId_createdAt_idx" ON "Case"("orderId","createdAt");
CREATE INDEX "Case_status_priority_updatedAt_idx" ON "Case"("status","priority","updatedAt");
CREATE INDEX "Case_assignedOperatorId_status_updatedAt_idx" ON "Case"("assignedOperatorId","status","updatedAt");
CREATE INDEX "Case_category_createdAt_idx" ON "Case"("category","createdAt");
CREATE INDEX "Case_source_sourceReference_idx" ON "Case"("source","sourceReference");
CREATE INDEX "CaseNote_caseId_createdAt_idx" ON "CaseNote"("caseId","createdAt");
CREATE INDEX "CaseAssignment_caseId_assignedAt_idx" ON "CaseAssignment"("caseId","assignedAt");
CREATE INDEX "CaseAssignment_operatorId_assignedAt_idx" ON "CaseAssignment"("operatorId","assignedAt");
CREATE INDEX "CaseAuditEvent_caseId_createdAt_idx" ON "CaseAuditEvent"("caseId","createdAt");
CREATE INDEX "CaseAuditEvent_actorId_createdAt_idx" ON "CaseAuditEvent"("actorId","createdAt");

ALTER TABLE "Case" ADD CONSTRAINT "Case_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Case" ADD CONSTRAINT "Case_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Case" ADD CONSTRAINT "Case_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Case" ADD CONSTRAINT "Case_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "Shipment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Case" ADD CONSTRAINT "Case_fulfillmentId_fkey" FOREIGN KEY ("fulfillmentId") REFERENCES "Fulfillment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Case" ADD CONSTRAINT "Case_returnRequestId_fkey" FOREIGN KEY ("returnRequestId") REFERENCES "ReturnRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Case" ADD CONSTRAINT "Case_cancellationRequestId_fkey" FOREIGN KEY ("cancellationRequestId") REFERENCES "CancellationRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Case" ADD CONSTRAINT "Case_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Case" ADD CONSTRAINT "Case_assignedOperatorId_fkey" FOREIGN KEY ("assignedOperatorId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CaseNote" ADD CONSTRAINT "CaseNote_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CaseNote" ADD CONSTRAINT "CaseNote_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CaseAssignment" ADD CONSTRAINT "CaseAssignment_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CaseAssignment" ADD CONSTRAINT "CaseAssignment_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CaseAuditEvent" ADD CONSTRAINT "CaseAuditEvent_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CaseAuditEvent" ADD CONSTRAINT "CaseAuditEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
