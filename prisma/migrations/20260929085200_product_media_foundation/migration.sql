CREATE TYPE "ProductMediaType" AS ENUM ('IMAGE');

ALTER TABLE "ProductImage"
  ADD COLUMN "storageReference" TEXT,
  ADD COLUMN "mediaType" "ProductMediaType" NOT NULL DEFAULT 'IMAGE';

ALTER TABLE "ProductImage"
  ADD CONSTRAINT "ProductImage_storageReference_check"
  CHECK ("storageReference" IS NULL OR length(btrim("storageReference")) > 0);

CREATE INDEX "ProductImage_productId_primary_sort_idx"
  ON "ProductImage"("productId", "isPrimary", "sortOrder");

CREATE INDEX "ProductImage_variantId_sort_id_idx"
  ON "ProductImage"("variantId", "sortOrder", "id");
