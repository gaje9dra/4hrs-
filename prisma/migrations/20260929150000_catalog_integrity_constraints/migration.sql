-- Phase 2.15: catalog referential-integrity checks.
-- These constraints are intentionally additive. They reject invalid new/updated rows
-- without changing existing records or introducing destructive cleanup.
--
-- This migration is defensive because an earlier deployment may have partially
-- applied one or more constraints before failing.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'ProductImage_exactly_one_owner_check'
      AND conrelid = '"ProductImage"'::regclass
  ) THEN
    ALTER TABLE "ProductImage"
      ADD CONSTRAINT "ProductImage_exactly_one_owner_check"
      CHECK (("productId" IS NOT NULL AND "variantId" IS NULL)
          OR ("productId" IS NULL AND "variantId" IS NOT NULL))
      NOT VALID;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'Inventory_non_negative_quantities_check'
      AND conrelid = '"Inventory"'::regclass
  ) THEN
    ALTER TABLE "Inventory"
      ADD CONSTRAINT "Inventory_non_negative_quantities_check"
      CHECK ("onHand" >= 0 AND "reserved" >= 0 AND "lowStockThreshold" >= 0)
      NOT VALID;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'Inventory_reserved_not_above_on_hand_check'
      AND conrelid = '"Inventory"'::regclass
  ) THEN
    ALTER TABLE "Inventory"
      ADD CONSTRAINT "Inventory_reserved_not_above_on_hand_check"
      CHECK ("reserved" <= "onHand")
      NOT VALID;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'Category_not_self_parent_check'
      AND conrelid = '"Category"'::regclass
  ) THEN
    ALTER TABLE "Category"
      ADD CONSTRAINT "Category_not_self_parent_check"
      CHECK ("parentId" IS NULL OR "parentId" <> "id")
      NOT VALID;
  END IF;
END
$$;
