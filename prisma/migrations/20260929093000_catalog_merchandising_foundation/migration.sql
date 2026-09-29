ALTER TABLE "ProductCategory"
  ADD COLUMN "position" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "priority" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "isFeatured" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "ProductCollection"
  ADD COLUMN "position" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "priority" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "isFeatured" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "ProductCategory_categoryId_isFeatured_priority_position_idx"
  ON "ProductCategory"("categoryId", "isFeatured", "priority", "position");

CREATE INDEX "ProductCollection_collectionId_isFeatured_priority_position_idx"
  ON "ProductCollection"("collectionId", "isFeatured", "priority", "position");
