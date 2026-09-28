import { InventoryAdjustmentReason, Prisma } from "@prisma/client";
import { db } from "@/lib/db/client";

export type InventoryAvailability = "UNTRACKED" | "IN_STOCK" | "LOW_STOCK" | "OUT_OF_STOCK";

export function calculateAvailableQuantity(onHand: number, reserved: number): number {
  if (!Number.isInteger(onHand) || !Number.isInteger(reserved)) {
    throw new Error("Inventory quantities must be integers.");
  }
  if (onHand < 0 || reserved < 0 || reserved > onHand) {
    throw new Error("Invalid inventory quantities.");
  }
  return onHand - reserved;
}

export function getInventoryAvailability(input: {
  trackingEnabled: boolean;
  onHand: number;
  reserved: number;
  lowStockThreshold: number;
}): InventoryAvailability {
  if (!input.trackingEnabled) {
    return "UNTRACKED";
  }

  const available = calculateAvailableQuantity(input.onHand, input.reserved);

  if (available === 0) {
    return "OUT_OF_STOCK";
  }

  if (available <= input.lowStockThreshold) {
    return "LOW_STOCK";
  }

  return "IN_STOCK";
}

export async function getInventoryByVariant(variantId: string) {
  return db.inventory.findUnique({
    where: { variantId },
  });
}

export async function getInventoryHistory(inventoryId: string) {
  return db.inventoryTransaction.findMany({
    where: { inventoryId },
    orderBy: { createdAt: "desc" },
  });
}

export async function createInventory(input: {
  variantId: string;
  trackingEnabled?: boolean;
  onHand?: number;
  reserved?: number;
  lowStockThreshold?: number;
  actorId?: string;
  source?: string;
  note?: string;
  reference?: string;
}) {
  const onHand = input.onHand ?? 0;
  const reserved = input.reserved ?? 0;
  const lowStockThreshold = input.lowStockThreshold ?? 0;

  if (!Number.isInteger(onHand) || onHand < 0) {
    throw new Error("onHand must be a non-negative integer.");
  }
  if (!Number.isInteger(reserved) || reserved < 0 || reserved > onHand) {
    throw new Error("reserved must be a non-negative integer no greater than onHand.");
  }
  if (!Number.isInteger(lowStockThreshold) || lowStockThreshold < 0) {
    throw new Error("lowStockThreshold must be a non-negative integer.");
  }

  return db.$transaction(
    async (tx) => {
      const inventory = await tx.inventory.create({
        data: {
          variantId: input.variantId,
          trackingEnabled: input.trackingEnabled ?? true,
          onHand,
          reserved,
          lowStockThreshold,
        },
      });

      if (onHand > 0) {
        await tx.inventoryTransaction.create({
          data: {
            inventoryId: inventory.id,
            quantityDelta: onHand,
            previousOnHand: 0,
            resultingOnHand: onHand,
            reason: InventoryAdjustmentReason.INITIAL_STOCK,
            actorId: input.actorId,
            source: input.source,
            note: input.note,
            reference: input.reference,
          },
        });
      }

      return inventory;
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}

export async function adjustInventory(input: {
  inventoryId: string;
  quantityDelta: number;
  reason: InventoryAdjustmentReason;
  actorId?: string;
  source?: string;
  note?: string;
  reference?: string;
}) {
  if (!Number.isInteger(input.quantityDelta) || input.quantityDelta === 0) {
    throw new Error("quantityDelta must be a non-zero integer.");
  }

  return db.$transaction(
    async (tx) => {
      const inventory = await tx.inventory.findUnique({
        where: { id: input.inventoryId },
      });

      if (!inventory) {
        throw new Error("Inventory record not found.");
      }

      const decrement = input.quantityDelta < 0 ? Math.abs(input.quantityDelta) : 0;

      const result = await tx.inventory.updateMany({
        where: {
          id: input.inventoryId,
          ...(decrement > 0 ? { onHand: { gte: decrement } } : {}),
        },
        data:
          input.quantityDelta > 0
            ? { onHand: { increment: input.quantityDelta } }
            : { onHand: { decrement: decrement } },
      });

      if (result.count !== 1) {
        throw new Error("Inventory adjustment would make onHand negative.");
      }

      const updated = await tx.inventory.findUniqueOrThrow({
        where: { id: input.inventoryId },
      });

      await tx.inventoryTransaction.create({
        data: {
          inventoryId: updated.id,
          quantityDelta: input.quantityDelta,
          previousOnHand: inventory.onHand,
          resultingOnHand: updated.onHand,
          reason: input.reason,
          actorId: input.actorId,
          source: input.source,
          note: input.note,
          reference: input.reference,
        },
      });

      return updated;
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    },
  );
}
