import test from "node:test";
import assert from "node:assert/strict";
import { calculateAvailableQuantity } from "../lib/inventory/repository.ts";

test("inventory availability preserves onHand - reserved and rejects invalid quantities", () => {
  assert.equal(calculateAvailableQuantity(10, 3), 7);
  assert.throws(() => calculateAvailableQuantity(3, 4), /Invalid inventory quantities/);
  assert.throws(() => calculateAvailableQuantity(-1, 0), /Invalid inventory quantities/);
});

test("catalog integrity migration defines database-level ownership and quantity guards", async () => {
  const { readFile } = await import("node:fs/promises");
  const migration = await readFile(
    new URL("../prisma/migrations/20260929150000_catalog_integrity_constraints/migration.sql", import.meta.url),
    "utf8",
  );

  assert.match(migration, /ProductImage_exactly_one_owner_check/);
  assert.match(migration, /Inventory_non_negative_quantities_check/);
  assert.match(migration, /Inventory_reserved_not_above_on_hand_check/);
  assert.match(migration, /Category_not_self_parent_check/);
});
