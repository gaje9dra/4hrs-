import { Prisma } from "@prisma/client";
import type { AdminAuthorizationContext } from "@/lib/admin/authorization";
import { requirePermission } from "@/lib/admin/authorization";
import { db } from "@/lib/db/client";
import { recordAdminAudit } from "@/lib/admin/audit";

export type RepairIntent = Readonly<{ shipmentId: string; operatorId: string; reason: string; idempotencyKey: string; dryRun: boolean }>;
export type RepairResult = Readonly<{ dryRun: boolean; alreadyApplied: boolean; shipmentId: string; before: { reconciliationRequired: boolean; reconciliationReason: string | null }; after: { reconciliationRequired: boolean; reconciliationReason: string | null } }>;

export function validateRepairIntent(input: RepairIntent): void {
  if (!input.shipmentId || !input.operatorId || !input.idempotencyKey) throw new Error("Explicit recovery target, operator, and idempotency key are required.");
  if (input.reason.trim().length < 3 || input.reason.length > 500) throw new Error("A recovery reason between 3 and 500 characters is required.");
}

export function assertRecoveryPermission(context: AdminAuthorizationContext): void {
  requirePermission(context, "shipping.recovery");
}

export async function requestShipmentReconciliation(input: RepairIntent, authorizedContext?: AdminAuthorizationContext): Promise<RepairResult> {
  validateRepairIntent(input);
  if (!input.dryRun) {
    if (!authorizedContext) throw new Error("An authorized recovery context is required for non-dry-run repair.");
    assertRecoveryPermission(authorizedContext);
  }

  const shipment = await db.shipment.findUnique({ where: { id: input.shipmentId }, select: { id: true, reconciliationRequired: true, reconciliationReason: true } });
  if (!shipment) throw new Error("Recovery target was not found.");

  const after = { reconciliationRequired: true, reconciliationReason: input.reason.trim() };
  if (input.dryRun || shipment.reconciliationRequired && shipment.reconciliationReason === after.reconciliationReason) {
    return { dryRun: input.dryRun, alreadyApplied: !input.dryRun, shipmentId: shipment.id, before: { reconciliationRequired: shipment.reconciliationRequired, reconciliationReason: shipment.reconciliationReason }, after };
  }

  return db.$transaction(async (tx) => {
    const existing = await tx.shipmentRecoveryAction.findUnique({ where: { idempotencyKey: input.idempotencyKey }, select: { id: true } });
    if (existing) return { dryRun: false, alreadyApplied: true, shipmentId: shipment.id, before: { reconciliationRequired: shipment.reconciliationRequired, reconciliationReason: shipment.reconciliationReason }, after };

    const current = await tx.shipment.findUnique({ where: { id: shipment.id }, select: { id: true, reconciliationRequired: true, reconciliationReason: true } });
    if (!current) throw new Error("Recovery target was not found.");
    await tx.shipment.update({ where: { id: current.id }, data: { reconciliationRequired: true, reconciliationReason: input.reason.trim(), reconciliationRequestedAt: new Date() } });
    await tx.shipmentRecoveryAction.create({ data: { shipmentId: current.id, operatorId: input.operatorId.slice(0, 128), reason: input.reason.trim(), idempotencyKey: input.idempotencyKey.slice(0, 128) } });
    await recordAdminAudit({ actorAdminId: authorizedContext?.adminUser.id, action: "RECOVERY_SHIPMENT_RECONCILIATION", resourceType: "Shipment", resourceId: current.id, success: true, reason: input.reason.trim() }, tx);
    return { dryRun: false, alreadyApplied: false, shipmentId: current.id, before: { reconciliationRequired: current.reconciliationRequired, reconciliationReason: current.reconciliationReason }, after };
  });
}
