ALTER TABLE "Product"
  ADD CONSTRAINT "Product_title_not_blank_check"
  CHECK (length(btrim("title")) > 0);

ALTER TABLE "ProductVariant"
  ADD CONSTRAINT "ProductVariant_sku_not_blank_check"
  CHECK (length(btrim("sku")) > 0);

ALTER TABLE "ProductImage"
  ADD CONSTRAINT "ProductImage_sortOrder_check"
  CHECK ("sortOrder" >= 0);

ALTER TABLE "Category"
  ADD CONSTRAINT "Category_name_not_blank_check"
  CHECK (length(btrim("name")) > 0);

ALTER TABLE "Collection"
  ADD CONSTRAINT "Collection_name_not_blank_check"
  CHECK (length(btrim("name")) > 0);

ALTER TABLE "Tag"
  ADD CONSTRAINT "Tag_name_not_blank_check"
  CHECK (length(btrim("name")) > 0);

CREATE UNIQUE INDEX "Product_primary_image_unique"
  ON "ProductImage" ("productId")
  WHERE "productId" IS NOT NULL AND "isPrimary" = true;
