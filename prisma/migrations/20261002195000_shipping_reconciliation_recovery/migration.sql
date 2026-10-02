-- Phase 13.6: recoverable Shipping reconciliation state and operational audit actions
ALTER TABLE "Shipment"
  ADD COLUMN "reconciliationRequired" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "reconciliationReason" VARCHAR(500),
  ADD COLUMN "reconciliationRequestedAt" TIMESTAMP(3);

CREATE INDEX "Shipment_reconciliationRequired_updatedAt_idx"
  ON "Shipment"("reconciliationRequired", "updatedAt");

CREATE TABLE "ShipmentRecoveryAction" (
  "id" UUID NOT NULL,
  "shipmentId" UUID NOT NULL,
  "operatorId" VARCHAR(128) NOT NULL,
  "reason" VARCHAR(500) NOT NULL,
  "idempotencyKey" VARCHAR(128) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ShipmentRecoveryAction_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ShipmentRecoveryAction_idempotencyKey_key"
  ON "ShipmentRecoveryAction"("idempotencyKey");
CREATE INDEX "ShipmentRecoveryAction_shipmentId_createdAt_idx"
  ON "ShipmentRecoveryAction"("shipmentId", "createdAt");

ALTER TABLE "ShipmentRecoveryAction"
  ADD CONSTRAINT "ShipmentRecoveryAction_shipmentId_fkey"
  FOREIGN KEY ("shipmentId") REFERENCES "Shipment"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
