CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TYPE "ProductStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED');
CREATE TYPE "ProductVariantStatus" AS ENUM ('ACTIVE', 'INACTIVE');
CREATE TYPE "CategoryStatus" AS ENUM ('ACTIVE', 'ARCHIVED');
CREATE TYPE "CollectionStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

CREATE TABLE "Product" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "title" TEXT NOT NULL, "slug" TEXT NOT NULL,
  "description" TEXT, "shortDescription" TEXT, "status" "ProductStatus" NOT NULL DEFAULT 'DRAFT',
  "price" DECIMAL(12,2) NOT NULL, "compareAtPrice" DECIMAL(12,2), "currency" VARCHAR(3) NOT NULL DEFAULT 'INR',
  "seoTitle" TEXT, "seoDescription" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "Product" ADD CONSTRAINT "Product_price_check" CHECK ("price" >= 0);
ALTER TABLE "Product" ADD CONSTRAINT "Product_compareAtPrice_check" CHECK ("compareAtPrice" IS NULL OR "compareAtPrice" >= "price");
ALTER TABLE "Product" ADD CONSTRAINT "Product_currency_check" CHECK ("currency" ~ '^[A-Z]{3}
CREATE INDEX "Product_status_idx" ON "Product"("status");
CREATE INDEX "Product_createdAt_idx" ON "Product"("createdAt");

CREATE TABLE "ProductVariant" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "productId" UUID NOT NULL, "displayName" TEXT,
  "size" TEXT, "color" TEXT, "sku" TEXT NOT NULL, "price" DECIMAL(12,2), "compareAtPrice" DECIMAL(12,2),
  "status" "ProductVariantStatus" NOT NULL DEFAULT 'ACTIVE', "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "ProductVariant_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ProductVariant_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
ALTER TABLE "ProductVariant" ADD CONSTRAINT "ProductVariant_price_check" CHECK ("price" IS NULL OR "price" >= 0);
ALTER TABLE "ProductVariant" ADD CONSTRAINT "ProductVariant_compareAtPrice_check" CHECK ("compareAtPrice" IS NULL OR "compareAtPrice" >= COALESCE("price", 0));
ALTER TABLE "ProductVariant" ADD CONSTRAINT "ProductVariant_sku_check" CHECK (length(trim("sku")) > 0);
CREATE UNIQUE INDEX "ProductVariant_sku_key" ON "ProductVariant"("sku");
CREATE INDEX "ProductVariant_productId_idx" ON "ProductVariant"("productId");
CREATE INDEX "ProductVariant_status_idx" ON "ProductVariant"("status");
CREATE INDEX "ProductVariant_productId_size_color_idx" ON "ProductVariant"("productId","size","color");

CREATE TABLE "ProductImage" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "productId" UUID, "variantId" UUID, "url" TEXT NOT NULL,
  "altText" TEXT, "sortOrder" INTEGER NOT NULL DEFAULT 0, "isPrimary" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProductImage_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ProductImage_owner_check" CHECK (("productId" IS NOT NULL AND "variantId" IS NULL) OR ("productId" IS NULL AND "variantId" IS NOT NULL)),
  CONSTRAINT "ProductImage_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ProductImage_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "ProductImage_productId_idx" ON "ProductImage"("productId");
CREATE INDEX "ProductImage_variantId_idx" ON "ProductImage"("variantId");
CREATE INDEX "ProductImage_productId_sortOrder_idx" ON "ProductImage"("productId","sortOrder");
CREATE INDEX "ProductImage_variantId_sortOrder_idx" ON "ProductImage"("variantId","sortOrder");

CREATE TABLE "Category" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "name" TEXT NOT NULL, "slug" TEXT NOT NULL, "description" TEXT,
  "parentId" UUID, "status" "CategoryStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Category_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Category_not_self_parent_check" CHECK ("parentId" IS NULL OR "parentId" <> "id"),
  CONSTRAINT "Category_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
ALTER TABLE "Category" ADD CONSTRAINT "Category_slug_format_check" CHECK ("slug" ~ '^[a-z0-9]+(?:-[a-z0-9]+)*
CREATE INDEX "Category_parentId_idx" ON "Category"("parentId");
CREATE INDEX "Category_status_idx" ON "Category"("status");

CREATE TABLE "Collection" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "name" TEXT NOT NULL, "slug" TEXT NOT NULL, "description" TEXT,
  "status" "CollectionStatus" NOT NULL DEFAULT 'ACTIVE', "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "Collection_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "Collection" ADD CONSTRAINT "Collection_slug_format_check" CHECK ("slug" ~ '^[a-z0-9]+(?:-[a-z0-9]+)*
CREATE INDEX "Collection_status_idx" ON "Collection"("status");

CREATE TABLE "Tag" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "name" TEXT NOT NULL, "slug" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Tag_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "Tag" ADD CONSTRAINT "Tag_slug_format_check" CHECK ("slug" ~ '^[a-z0-9]+(?:-[a-z0-9]+)*

CREATE TABLE "ProductCategory" (
  "productId" UUID NOT NULL, "categoryId" UUID NOT NULL, CONSTRAINT "ProductCategory_pkey" PRIMARY KEY ("productId","categoryId"),
  CONSTRAINT "ProductCategory_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ProductCategory_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "ProductCategory_categoryId_idx" ON "ProductCategory"("categoryId");

CREATE TABLE "ProductCollection" (
  "productId" UUID NOT NULL, "collectionId" UUID NOT NULL, CONSTRAINT "ProductCollection_pkey" PRIMARY KEY ("productId","collectionId"),
  CONSTRAINT "ProductCollection_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ProductCollection_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "Collection"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "ProductCollection_collectionId_idx" ON "ProductCollection"("collectionId");

CREATE TABLE "ProductTag" (
  "productId" UUID NOT NULL, "tagId" UUID NOT NULL, CONSTRAINT "ProductTag_pkey" PRIMARY KEY ("productId","tagId"),
  CONSTRAINT "ProductTag_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ProductTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "ProductTag_tagId_idx" ON "ProductTag"("tagId");
);
ALTER TABLE "Product" ADD CONSTRAINT "Product_slug_format_check" CHECK ("slug" ~ '^[a-z0-9]+(?:-[a-z0-9]+)*
CREATE INDEX "Product_status_idx" ON "Product"("status");
CREATE INDEX "Product_createdAt_idx" ON "Product"("createdAt");

CREATE TABLE "ProductVariant" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "productId" UUID NOT NULL, "displayName" TEXT,
  "size" TEXT, "color" TEXT, "sku" TEXT NOT NULL, "price" DECIMAL(12,2), "compareAtPrice" DECIMAL(12,2),
  "status" "ProductVariantStatus" NOT NULL DEFAULT 'ACTIVE', "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "ProductVariant_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ProductVariant_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "ProductVariant_sku_key" ON "ProductVariant"("sku");
CREATE INDEX "ProductVariant_productId_idx" ON "ProductVariant"("productId");
CREATE INDEX "ProductVariant_status_idx" ON "ProductVariant"("status");
CREATE INDEX "ProductVariant_productId_size_color_idx" ON "ProductVariant"("productId","size","color");

CREATE TABLE "ProductImage" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "productId" UUID, "variantId" UUID, "url" TEXT NOT NULL,
  "altText" TEXT, "sortOrder" INTEGER NOT NULL DEFAULT 0, "isPrimary" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProductImage_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ProductImage_owner_check" CHECK (("productId" IS NOT NULL AND "variantId" IS NULL) OR ("productId" IS NULL AND "variantId" IS NOT NULL)),
  CONSTRAINT "ProductImage_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ProductImage_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "ProductImage_productId_idx" ON "ProductImage"("productId");
CREATE INDEX "ProductImage_variantId_idx" ON "ProductImage"("variantId");
CREATE INDEX "ProductImage_productId_sortOrder_idx" ON "ProductImage"("productId","sortOrder");
CREATE INDEX "ProductImage_variantId_sortOrder_idx" ON "ProductImage"("variantId","sortOrder");

CREATE TABLE "Category" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "name" TEXT NOT NULL, "slug" TEXT NOT NULL, "description" TEXT,
  "parentId" UUID, "status" "CategoryStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Category_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Category_not_self_parent_check" CHECK ("parentId" IS NULL OR "parentId" <> "id"),
  CONSTRAINT "Category_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "Category_slug_key" ON "Category"("slug");
CREATE INDEX "Category_parentId_idx" ON "Category"("parentId");
CREATE INDEX "Category_status_idx" ON "Category"("status");

CREATE TABLE "Collection" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "name" TEXT NOT NULL, "slug" TEXT NOT NULL, "description" TEXT,
  "status" "CollectionStatus" NOT NULL DEFAULT 'ACTIVE', "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "Collection_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Collection_slug_key" ON "Collection"("slug");
CREATE INDEX "Collection_status_idx" ON "Collection"("status");

CREATE TABLE "Tag" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "name" TEXT NOT NULL, "slug" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Tag_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Tag_slug_key" ON "Tag"("slug");

CREATE TABLE "ProductCategory" (
  "productId" UUID NOT NULL, "categoryId" UUID NOT NULL, CONSTRAINT "ProductCategory_pkey" PRIMARY KEY ("productId","categoryId"),
  CONSTRAINT "ProductCategory_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ProductCategory_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "ProductCategory_categoryId_idx" ON "ProductCategory"("categoryId");

CREATE TABLE "ProductCollection" (
  "productId" UUID NOT NULL, "collectionId" UUID NOT NULL, CONSTRAINT "ProductCollection_pkey" PRIMARY KEY ("productId","collectionId"),
  CONSTRAINT "ProductCollection_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ProductCollection_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "Collection"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "ProductCollection_collectionId_idx" ON "ProductCollection"("collectionId");

CREATE TABLE "ProductTag" (
  "productId" UUID NOT NULL, "tagId" UUID NOT NULL, CONSTRAINT "ProductTag_pkey" PRIMARY KEY ("productId","tagId"),
  CONSTRAINT "ProductTag_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ProductTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "ProductTag_tagId_idx" ON "ProductTag"("tagId");
);
CREATE UNIQUE INDEX "Product_slug_key" ON "Product"("slug");
CREATE INDEX "Product_status_idx" ON "Product"("status");
CREATE INDEX "Product_createdAt_idx" ON "Product"("createdAt");

CREATE TABLE "ProductVariant" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "productId" UUID NOT NULL, "displayName" TEXT,
  "size" TEXT, "color" TEXT, "sku" TEXT NOT NULL, "price" DECIMAL(12,2), "compareAtPrice" DECIMAL(12,2),
  "status" "ProductVariantStatus" NOT NULL DEFAULT 'ACTIVE', "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "ProductVariant_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ProductVariant_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "ProductVariant_sku_key" ON "ProductVariant"("sku");
CREATE INDEX "ProductVariant_productId_idx" ON "ProductVariant"("productId");
CREATE INDEX "ProductVariant_status_idx" ON "ProductVariant"("status");
CREATE INDEX "ProductVariant_productId_size_color_idx" ON "ProductVariant"("productId","size","color");

CREATE TABLE "ProductImage" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "productId" UUID, "variantId" UUID, "url" TEXT NOT NULL,
  "altText" TEXT, "sortOrder" INTEGER NOT NULL DEFAULT 0, "isPrimary" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProductImage_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ProductImage_owner_check" CHECK (("productId" IS NOT NULL AND "variantId" IS NULL) OR ("productId" IS NULL AND "variantId" IS NOT NULL)),
  CONSTRAINT "ProductImage_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ProductImage_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "ProductImage_productId_idx" ON "ProductImage"("productId");
CREATE INDEX "ProductImage_variantId_idx" ON "ProductImage"("variantId");
CREATE INDEX "ProductImage_productId_sortOrder_idx" ON "ProductImage"("productId","sortOrder");
CREATE INDEX "ProductImage_variantId_sortOrder_idx" ON "ProductImage"("variantId","sortOrder");

CREATE TABLE "Category" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "name" TEXT NOT NULL, "slug" TEXT NOT NULL, "description" TEXT,
  "parentId" UUID, "status" "CategoryStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Category_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Category_not_self_parent_check" CHECK ("parentId" IS NULL OR "parentId" <> "id"),
  CONSTRAINT "Category_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "Category_slug_key" ON "Category"("slug");
CREATE INDEX "Category_parentId_idx" ON "Category"("parentId");
CREATE INDEX "Category_status_idx" ON "Category"("status");

CREATE TABLE "Collection" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "name" TEXT NOT NULL, "slug" TEXT NOT NULL, "description" TEXT,
  "status" "CollectionStatus" NOT NULL DEFAULT 'ACTIVE', "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "Collection_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Collection_slug_key" ON "Collection"("slug");
CREATE INDEX "Collection_status_idx" ON "Collection"("status");

CREATE TABLE "Tag" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "name" TEXT NOT NULL, "slug" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Tag_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Tag_slug_key" ON "Tag"("slug");

CREATE TABLE "ProductCategory" (
  "productId" UUID NOT NULL, "categoryId" UUID NOT NULL, CONSTRAINT "ProductCategory_pkey" PRIMARY KEY ("productId","categoryId"),
  CONSTRAINT "ProductCategory_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ProductCategory_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "ProductCategory_categoryId_idx" ON "ProductCategory"("categoryId");

CREATE TABLE "ProductCollection" (
  "productId" UUID NOT NULL, "collectionId" UUID NOT NULL, CONSTRAINT "ProductCollection_pkey" PRIMARY KEY ("productId","collectionId"),
  CONSTRAINT "ProductCollection_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ProductCollection_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "Collection"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "ProductCollection_collectionId_idx" ON "ProductCollection"("collectionId");

CREATE TABLE "ProductTag" (
  "productId" UUID NOT NULL, "tagId" UUID NOT NULL, CONSTRAINT "ProductTag_pkey" PRIMARY KEY ("productId","tagId"),
  CONSTRAINT "ProductTag_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ProductTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "ProductTag_tagId_idx" ON "ProductTag"("tagId");
);
CREATE UNIQUE INDEX "Category_slug_key" ON "Category"("slug");
CREATE INDEX "Category_parentId_idx" ON "Category"("parentId");
CREATE INDEX "Category_status_idx" ON "Category"("status");

CREATE TABLE "Collection" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "name" TEXT NOT NULL, "slug" TEXT NOT NULL, "description" TEXT,
  "status" "CollectionStatus" NOT NULL DEFAULT 'ACTIVE', "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "Collection_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Collection_slug_key" ON "Collection"("slug");
CREATE INDEX "Collection_status_idx" ON "Collection"("status");

CREATE TABLE "Tag" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "name" TEXT NOT NULL, "slug" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Tag_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Tag_slug_key" ON "Tag"("slug");

CREATE TABLE "ProductCategory" (
  "productId" UUID NOT NULL, "categoryId" UUID NOT NULL, CONSTRAINT "ProductCategory_pkey" PRIMARY KEY ("productId","categoryId"),
  CONSTRAINT "ProductCategory_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ProductCategory_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "ProductCategory_categoryId_idx" ON "ProductCategory"("categoryId");

CREATE TABLE "ProductCollection" (
  "productId" UUID NOT NULL, "collectionId" UUID NOT NULL, CONSTRAINT "ProductCollection_pkey" PRIMARY KEY ("productId","collectionId"),
  CONSTRAINT "ProductCollection_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ProductCollection_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "Collection"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "ProductCollection_collectionId_idx" ON "ProductCollection"("collectionId");

CREATE TABLE "ProductTag" (
  "productId" UUID NOT NULL, "tagId" UUID NOT NULL, CONSTRAINT "ProductTag_pkey" PRIMARY KEY ("productId","tagId"),
  CONSTRAINT "ProductTag_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ProductTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "ProductTag_tagId_idx" ON "ProductTag"("tagId");
);
ALTER TABLE "Product" ADD CONSTRAINT "Product_slug_format_check" CHECK ("slug" ~ '^[a-z0-9]+(?:-[a-z0-9]+)*
CREATE INDEX "Product_status_idx" ON "Product"("status");
CREATE INDEX "Product_createdAt_idx" ON "Product"("createdAt");

CREATE TABLE "ProductVariant" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "productId" UUID NOT NULL, "displayName" TEXT,
  "size" TEXT, "color" TEXT, "sku" TEXT NOT NULL, "price" DECIMAL(12,2), "compareAtPrice" DECIMAL(12,2),
  "status" "ProductVariantStatus" NOT NULL DEFAULT 'ACTIVE', "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "ProductVariant_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ProductVariant_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "ProductVariant_sku_key" ON "ProductVariant"("sku");
CREATE INDEX "ProductVariant_productId_idx" ON "ProductVariant"("productId");
CREATE INDEX "ProductVariant_status_idx" ON "ProductVariant"("status");
CREATE INDEX "ProductVariant_productId_size_color_idx" ON "ProductVariant"("productId","size","color");

CREATE TABLE "ProductImage" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "productId" UUID, "variantId" UUID, "url" TEXT NOT NULL,
  "altText" TEXT, "sortOrder" INTEGER NOT NULL DEFAULT 0, "isPrimary" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProductImage_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ProductImage_owner_check" CHECK (("productId" IS NOT NULL AND "variantId" IS NULL) OR ("productId" IS NULL AND "variantId" IS NOT NULL)),
  CONSTRAINT "ProductImage_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ProductImage_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "ProductImage_productId_idx" ON "ProductImage"("productId");
CREATE INDEX "ProductImage_variantId_idx" ON "ProductImage"("variantId");
CREATE INDEX "ProductImage_productId_sortOrder_idx" ON "ProductImage"("productId","sortOrder");
CREATE INDEX "ProductImage_variantId_sortOrder_idx" ON "ProductImage"("variantId","sortOrder");

CREATE TABLE "Category" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "name" TEXT NOT NULL, "slug" TEXT NOT NULL, "description" TEXT,
  "parentId" UUID, "status" "CategoryStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Category_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Category_not_self_parent_check" CHECK ("parentId" IS NULL OR "parentId" <> "id"),
  CONSTRAINT "Category_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "Category_slug_key" ON "Category"("slug");
CREATE INDEX "Category_parentId_idx" ON "Category"("parentId");
CREATE INDEX "Category_status_idx" ON "Category"("status");

CREATE TABLE "Collection" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "name" TEXT NOT NULL, "slug" TEXT NOT NULL, "description" TEXT,
  "status" "CollectionStatus" NOT NULL DEFAULT 'ACTIVE', "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "Collection_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Collection_slug_key" ON "Collection"("slug");
CREATE INDEX "Collection_status_idx" ON "Collection"("status");

CREATE TABLE "Tag" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "name" TEXT NOT NULL, "slug" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Tag_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Tag_slug_key" ON "Tag"("slug");

CREATE TABLE "ProductCategory" (
  "productId" UUID NOT NULL, "categoryId" UUID NOT NULL, CONSTRAINT "ProductCategory_pkey" PRIMARY KEY ("productId","categoryId"),
  CONSTRAINT "ProductCategory_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ProductCategory_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "ProductCategory_categoryId_idx" ON "ProductCategory"("categoryId");

CREATE TABLE "ProductCollection" (
  "productId" UUID NOT NULL, "collectionId" UUID NOT NULL, CONSTRAINT "ProductCollection_pkey" PRIMARY KEY ("productId","collectionId"),
  CONSTRAINT "ProductCollection_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ProductCollection_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "Collection"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "ProductCollection_collectionId_idx" ON "ProductCollection"("collectionId");

CREATE TABLE "ProductTag" (
  "productId" UUID NOT NULL, "tagId" UUID NOT NULL, CONSTRAINT "ProductTag_pkey" PRIMARY KEY ("productId","tagId"),
  CONSTRAINT "ProductTag_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ProductTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "ProductTag_tagId_idx" ON "ProductTag"("tagId");
);
CREATE UNIQUE INDEX "Product_slug_key" ON "Product"("slug");
CREATE INDEX "Product_status_idx" ON "Product"("status");
CREATE INDEX "Product_createdAt_idx" ON "Product"("createdAt");

CREATE TABLE "ProductVariant" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "productId" UUID NOT NULL, "displayName" TEXT,
  "size" TEXT, "color" TEXT, "sku" TEXT NOT NULL, "price" DECIMAL(12,2), "compareAtPrice" DECIMAL(12,2),
  "status" "ProductVariantStatus" NOT NULL DEFAULT 'ACTIVE', "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "ProductVariant_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ProductVariant_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "ProductVariant_sku_key" ON "ProductVariant"("sku");
CREATE INDEX "ProductVariant_productId_idx" ON "ProductVariant"("productId");
CREATE INDEX "ProductVariant_status_idx" ON "ProductVariant"("status");
CREATE INDEX "ProductVariant_productId_size_color_idx" ON "ProductVariant"("productId","size","color");

CREATE TABLE "ProductImage" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "productId" UUID, "variantId" UUID, "url" TEXT NOT NULL,
  "altText" TEXT, "sortOrder" INTEGER NOT NULL DEFAULT 0, "isPrimary" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProductImage_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ProductImage_owner_check" CHECK (("productId" IS NOT NULL AND "variantId" IS NULL) OR ("productId" IS NULL AND "variantId" IS NOT NULL)),
  CONSTRAINT "ProductImage_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ProductImage_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "ProductImage_productId_idx" ON "ProductImage"("productId");
CREATE INDEX "ProductImage_variantId_idx" ON "ProductImage"("variantId");
CREATE INDEX "ProductImage_productId_sortOrder_idx" ON "ProductImage"("productId","sortOrder");
CREATE INDEX "ProductImage_variantId_sortOrder_idx" ON "ProductImage"("variantId","sortOrder");

CREATE TABLE "Category" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "name" TEXT NOT NULL, "slug" TEXT NOT NULL, "description" TEXT,
  "parentId" UUID, "status" "CategoryStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Category_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Category_not_self_parent_check" CHECK ("parentId" IS NULL OR "parentId" <> "id"),
  CONSTRAINT "Category_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "Category_slug_key" ON "Category"("slug");
CREATE INDEX "Category_parentId_idx" ON "Category"("parentId");
CREATE INDEX "Category_status_idx" ON "Category"("status");

CREATE TABLE "Collection" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "name" TEXT NOT NULL, "slug" TEXT NOT NULL, "description" TEXT,
  "status" "CollectionStatus" NOT NULL DEFAULT 'ACTIVE', "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "Collection_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Collection_slug_key" ON "Collection"("slug");
CREATE INDEX "Collection_status_idx" ON "Collection"("status");

CREATE TABLE "Tag" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "name" TEXT NOT NULL, "slug" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Tag_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Tag_slug_key" ON "Tag"("slug");

CREATE TABLE "ProductCategory" (
  "productId" UUID NOT NULL, "categoryId" UUID NOT NULL, CONSTRAINT "ProductCategory_pkey" PRIMARY KEY ("productId","categoryId"),
  CONSTRAINT "ProductCategory_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ProductCategory_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "ProductCategory_categoryId_idx" ON "ProductCategory"("categoryId");

CREATE TABLE "ProductCollection" (
  "productId" UUID NOT NULL, "collectionId" UUID NOT NULL, CONSTRAINT "ProductCollection_pkey" PRIMARY KEY ("productId","collectionId"),
  CONSTRAINT "ProductCollection_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ProductCollection_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "Collection"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "ProductCollection_collectionId_idx" ON "ProductCollection"("collectionId");

CREATE TABLE "ProductTag" (
  "productId" UUID NOT NULL, "tagId" UUID NOT NULL, CONSTRAINT "ProductTag_pkey" PRIMARY KEY ("productId","tagId"),
  CONSTRAINT "ProductTag_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ProductTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "ProductTag_tagId_idx" ON "ProductTag"("tagId");
);
CREATE UNIQUE INDEX "Collection_slug_key" ON "Collection"("slug");
CREATE INDEX "Collection_status_idx" ON "Collection"("status");

CREATE TABLE "Tag" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "name" TEXT NOT NULL, "slug" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Tag_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Tag_slug_key" ON "Tag"("slug");

CREATE TABLE "ProductCategory" (
  "productId" UUID NOT NULL, "categoryId" UUID NOT NULL, CONSTRAINT "ProductCategory_pkey" PRIMARY KEY ("productId","categoryId"),
  CONSTRAINT "ProductCategory_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ProductCategory_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "ProductCategory_categoryId_idx" ON "ProductCategory"("categoryId");

CREATE TABLE "ProductCollection" (
  "productId" UUID NOT NULL, "collectionId" UUID NOT NULL, CONSTRAINT "ProductCollection_pkey" PRIMARY KEY ("productId","collectionId"),
  CONSTRAINT "ProductCollection_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ProductCollection_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "Collection"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "ProductCollection_collectionId_idx" ON "ProductCollection"("collectionId");

CREATE TABLE "ProductTag" (
  "productId" UUID NOT NULL, "tagId" UUID NOT NULL, CONSTRAINT "ProductTag_pkey" PRIMARY KEY ("productId","tagId"),
  CONSTRAINT "ProductTag_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ProductTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "ProductTag_tagId_idx" ON "ProductTag"("tagId");
);
ALTER TABLE "Product" ADD CONSTRAINT "Product_slug_format_check" CHECK ("slug" ~ '^[a-z0-9]+(?:-[a-z0-9]+)*
CREATE INDEX "Product_status_idx" ON "Product"("status");
CREATE INDEX "Product_createdAt_idx" ON "Product"("createdAt");

CREATE TABLE "ProductVariant" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "productId" UUID NOT NULL, "displayName" TEXT,
  "size" TEXT, "color" TEXT, "sku" TEXT NOT NULL, "price" DECIMAL(12,2), "compareAtPrice" DECIMAL(12,2),
  "status" "ProductVariantStatus" NOT NULL DEFAULT 'ACTIVE', "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "ProductVariant_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ProductVariant_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "ProductVariant_sku_key" ON "ProductVariant"("sku");
CREATE INDEX "ProductVariant_productId_idx" ON "ProductVariant"("productId");
CREATE INDEX "ProductVariant_status_idx" ON "ProductVariant"("status");
CREATE INDEX "ProductVariant_productId_size_color_idx" ON "ProductVariant"("productId","size","color");

CREATE TABLE "ProductImage" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "productId" UUID, "variantId" UUID, "url" TEXT NOT NULL,
  "altText" TEXT, "sortOrder" INTEGER NOT NULL DEFAULT 0, "isPrimary" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProductImage_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ProductImage_owner_check" CHECK (("productId" IS NOT NULL AND "variantId" IS NULL) OR ("productId" IS NULL AND "variantId" IS NOT NULL)),
  CONSTRAINT "ProductImage_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ProductImage_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "ProductImage_productId_idx" ON "ProductImage"("productId");
CREATE INDEX "ProductImage_variantId_idx" ON "ProductImage"("variantId");
CREATE INDEX "ProductImage_productId_sortOrder_idx" ON "ProductImage"("productId","sortOrder");
CREATE INDEX "ProductImage_variantId_sortOrder_idx" ON "ProductImage"("variantId","sortOrder");

CREATE TABLE "Category" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "name" TEXT NOT NULL, "slug" TEXT NOT NULL, "description" TEXT,
  "parentId" UUID, "status" "CategoryStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Category_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Category_not_self_parent_check" CHECK ("parentId" IS NULL OR "parentId" <> "id"),
  CONSTRAINT "Category_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "Category_slug_key" ON "Category"("slug");
CREATE INDEX "Category_parentId_idx" ON "Category"("parentId");
CREATE INDEX "Category_status_idx" ON "Category"("status");

CREATE TABLE "Collection" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "name" TEXT NOT NULL, "slug" TEXT NOT NULL, "description" TEXT,
  "status" "CollectionStatus" NOT NULL DEFAULT 'ACTIVE', "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "Collection_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Collection_slug_key" ON "Collection"("slug");
CREATE INDEX "Collection_status_idx" ON "Collection"("status");

CREATE TABLE "Tag" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "name" TEXT NOT NULL, "slug" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Tag_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Tag_slug_key" ON "Tag"("slug");

CREATE TABLE "ProductCategory" (
  "productId" UUID NOT NULL, "categoryId" UUID NOT NULL, CONSTRAINT "ProductCategory_pkey" PRIMARY KEY ("productId","categoryId"),
  CONSTRAINT "ProductCategory_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ProductCategory_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "ProductCategory_categoryId_idx" ON "ProductCategory"("categoryId");

CREATE TABLE "ProductCollection" (
  "productId" UUID NOT NULL, "collectionId" UUID NOT NULL, CONSTRAINT "ProductCollection_pkey" PRIMARY KEY ("productId","collectionId"),
  CONSTRAINT "ProductCollection_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ProductCollection_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "Collection"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "ProductCollection_collectionId_idx" ON "ProductCollection"("collectionId");

CREATE TABLE "ProductTag" (
  "productId" UUID NOT NULL, "tagId" UUID NOT NULL, CONSTRAINT "ProductTag_pkey" PRIMARY KEY ("productId","tagId"),
  CONSTRAINT "ProductTag_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ProductTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "ProductTag_tagId_idx" ON "ProductTag"("tagId");
);
CREATE UNIQUE INDEX "Product_slug_key" ON "Product"("slug");
CREATE INDEX "Product_status_idx" ON "Product"("status");
CREATE INDEX "Product_createdAt_idx" ON "Product"("createdAt");

CREATE TABLE "ProductVariant" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "productId" UUID NOT NULL, "displayName" TEXT,
  "size" TEXT, "color" TEXT, "sku" TEXT NOT NULL, "price" DECIMAL(12,2), "compareAtPrice" DECIMAL(12,2),
  "status" "ProductVariantStatus" NOT NULL DEFAULT 'ACTIVE', "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "ProductVariant_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ProductVariant_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "ProductVariant_sku_key" ON "ProductVariant"("sku");
CREATE INDEX "ProductVariant_productId_idx" ON "ProductVariant"("productId");
CREATE INDEX "ProductVariant_status_idx" ON "ProductVariant"("status");
CREATE INDEX "ProductVariant_productId_size_color_idx" ON "ProductVariant"("productId","size","color");

CREATE TABLE "ProductImage" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "productId" UUID, "variantId" UUID, "url" TEXT NOT NULL,
  "altText" TEXT, "sortOrder" INTEGER NOT NULL DEFAULT 0, "isPrimary" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProductImage_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ProductImage_owner_check" CHECK (("productId" IS NOT NULL AND "variantId" IS NULL) OR ("productId" IS NULL AND "variantId" IS NOT NULL)),
  CONSTRAINT "ProductImage_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ProductImage_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "ProductImage_productId_idx" ON "ProductImage"("productId");
CREATE INDEX "ProductImage_variantId_idx" ON "ProductImage"("variantId");
CREATE INDEX "ProductImage_productId_sortOrder_idx" ON "ProductImage"("productId","sortOrder");
CREATE INDEX "ProductImage_variantId_sortOrder_idx" ON "ProductImage"("variantId","sortOrder");

CREATE TABLE "Category" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "name" TEXT NOT NULL, "slug" TEXT NOT NULL, "description" TEXT,
  "parentId" UUID, "status" "CategoryStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Category_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Category_not_self_parent_check" CHECK ("parentId" IS NULL OR "parentId" <> "id"),
  CONSTRAINT "Category_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "Category_slug_key" ON "Category"("slug");
CREATE INDEX "Category_parentId_idx" ON "Category"("parentId");
CREATE INDEX "Category_status_idx" ON "Category"("status");

CREATE TABLE "Collection" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "name" TEXT NOT NULL, "slug" TEXT NOT NULL, "description" TEXT,
  "status" "CollectionStatus" NOT NULL DEFAULT 'ACTIVE', "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "Collection_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Collection_slug_key" ON "Collection"("slug");
CREATE INDEX "Collection_status_idx" ON "Collection"("status");

CREATE TABLE "Tag" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "name" TEXT NOT NULL, "slug" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Tag_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Tag_slug_key" ON "Tag"("slug");

CREATE TABLE "ProductCategory" (
  "productId" UUID NOT NULL, "categoryId" UUID NOT NULL, CONSTRAINT "ProductCategory_pkey" PRIMARY KEY ("productId","categoryId"),
  CONSTRAINT "ProductCategory_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ProductCategory_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "ProductCategory_categoryId_idx" ON "ProductCategory"("categoryId");

CREATE TABLE "ProductCollection" (
  "productId" UUID NOT NULL, "collectionId" UUID NOT NULL, CONSTRAINT "ProductCollection_pkey" PRIMARY KEY ("productId","collectionId"),
  CONSTRAINT "ProductCollection_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ProductCollection_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "Collection"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "ProductCollection_collectionId_idx" ON "ProductCollection"("collectionId");

CREATE TABLE "ProductTag" (
  "productId" UUID NOT NULL, "tagId" UUID NOT NULL, CONSTRAINT "ProductTag_pkey" PRIMARY KEY ("productId","tagId"),
  CONSTRAINT "ProductTag_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ProductTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "ProductTag_tagId_idx" ON "ProductTag"("tagId");
);
CREATE UNIQUE INDEX "Category_slug_key" ON "Category"("slug");
CREATE INDEX "Category_parentId_idx" ON "Category"("parentId");
CREATE INDEX "Category_status_idx" ON "Category"("status");

CREATE TABLE "Collection" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "name" TEXT NOT NULL, "slug" TEXT NOT NULL, "description" TEXT,
  "status" "CollectionStatus" NOT NULL DEFAULT 'ACTIVE', "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "Collection_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Collection_slug_key" ON "Collection"("slug");
CREATE INDEX "Collection_status_idx" ON "Collection"("status");

CREATE TABLE "Tag" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "name" TEXT NOT NULL, "slug" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Tag_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Tag_slug_key" ON "Tag"("slug");

CREATE TABLE "ProductCategory" (
  "productId" UUID NOT NULL, "categoryId" UUID NOT NULL, CONSTRAINT "ProductCategory_pkey" PRIMARY KEY ("productId","categoryId"),
  CONSTRAINT "ProductCategory_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ProductCategory_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "ProductCategory_categoryId_idx" ON "ProductCategory"("categoryId");

CREATE TABLE "ProductCollection" (
  "productId" UUID NOT NULL, "collectionId" UUID NOT NULL, CONSTRAINT "ProductCollection_pkey" PRIMARY KEY ("productId","collectionId"),
  CONSTRAINT "ProductCollection_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ProductCollection_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "Collection"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "ProductCollection_collectionId_idx" ON "ProductCollection"("collectionId");

CREATE TABLE "ProductTag" (
  "productId" UUID NOT NULL, "tagId" UUID NOT NULL, CONSTRAINT "ProductTag_pkey" PRIMARY KEY ("productId","tagId"),
  CONSTRAINT "ProductTag_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ProductTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "ProductTag_tagId_idx" ON "ProductTag"("tagId");
);
ALTER TABLE "Product" ADD CONSTRAINT "Product_slug_format_check" CHECK ("slug" ~ '^[a-z0-9]+(?:-[a-z0-9]+)*
CREATE INDEX "Product_status_idx" ON "Product"("status");
CREATE INDEX "Product_createdAt_idx" ON "Product"("createdAt");

CREATE TABLE "ProductVariant" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "productId" UUID NOT NULL, "displayName" TEXT,
  "size" TEXT, "color" TEXT, "sku" TEXT NOT NULL, "price" DECIMAL(12,2), "compareAtPrice" DECIMAL(12,2),
  "status" "ProductVariantStatus" NOT NULL DEFAULT 'ACTIVE', "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "ProductVariant_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ProductVariant_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "ProductVariant_sku_key" ON "ProductVariant"("sku");
CREATE INDEX "ProductVariant_productId_idx" ON "ProductVariant"("productId");
CREATE INDEX "ProductVariant_status_idx" ON "ProductVariant"("status");
CREATE INDEX "ProductVariant_productId_size_color_idx" ON "ProductVariant"("productId","size","color");

CREATE TABLE "ProductImage" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "productId" UUID, "variantId" UUID, "url" TEXT NOT NULL,
  "altText" TEXT, "sortOrder" INTEGER NOT NULL DEFAULT 0, "isPrimary" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProductImage_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ProductImage_owner_check" CHECK (("productId" IS NOT NULL AND "variantId" IS NULL) OR ("productId" IS NULL AND "variantId" IS NOT NULL)),
  CONSTRAINT "ProductImage_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ProductImage_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "ProductImage_productId_idx" ON "ProductImage"("productId");
CREATE INDEX "ProductImage_variantId_idx" ON "ProductImage"("variantId");
CREATE INDEX "ProductImage_productId_sortOrder_idx" ON "ProductImage"("productId","sortOrder");
CREATE INDEX "ProductImage_variantId_sortOrder_idx" ON "ProductImage"("variantId","sortOrder");

CREATE TABLE "Category" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "name" TEXT NOT NULL, "slug" TEXT NOT NULL, "description" TEXT,
  "parentId" UUID, "status" "CategoryStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Category_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Category_not_self_parent_check" CHECK ("parentId" IS NULL OR "parentId" <> "id"),
  CONSTRAINT "Category_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "Category_slug_key" ON "Category"("slug");
CREATE INDEX "Category_parentId_idx" ON "Category"("parentId");
CREATE INDEX "Category_status_idx" ON "Category"("status");

CREATE TABLE "Collection" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "name" TEXT NOT NULL, "slug" TEXT NOT NULL, "description" TEXT,
  "status" "CollectionStatus" NOT NULL DEFAULT 'ACTIVE', "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "Collection_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Collection_slug_key" ON "Collection"("slug");
CREATE INDEX "Collection_status_idx" ON "Collection"("status");

CREATE TABLE "Tag" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "name" TEXT NOT NULL, "slug" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Tag_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Tag_slug_key" ON "Tag"("slug");

CREATE TABLE "ProductCategory" (
  "productId" UUID NOT NULL, "categoryId" UUID NOT NULL, CONSTRAINT "ProductCategory_pkey" PRIMARY KEY ("productId","categoryId"),
  CONSTRAINT "ProductCategory_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ProductCategory_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "ProductCategory_categoryId_idx" ON "ProductCategory"("categoryId");

CREATE TABLE "ProductCollection" (
  "productId" UUID NOT NULL, "collectionId" UUID NOT NULL, CONSTRAINT "ProductCollection_pkey" PRIMARY KEY ("productId","collectionId"),
  CONSTRAINT "ProductCollection_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ProductCollection_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "Collection"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "ProductCollection_collectionId_idx" ON "ProductCollection"("collectionId");

CREATE TABLE "ProductTag" (
  "productId" UUID NOT NULL, "tagId" UUID NOT NULL, CONSTRAINT "ProductTag_pkey" PRIMARY KEY ("productId","tagId"),
  CONSTRAINT "ProductTag_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ProductTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "ProductTag_tagId_idx" ON "ProductTag"("tagId");
);
CREATE UNIQUE INDEX "Product_slug_key" ON "Product"("slug");
CREATE INDEX "Product_status_idx" ON "Product"("status");
CREATE INDEX "Product_createdAt_idx" ON "Product"("createdAt");

CREATE TABLE "ProductVariant" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "productId" UUID NOT NULL, "displayName" TEXT,
  "size" TEXT, "color" TEXT, "sku" TEXT NOT NULL, "price" DECIMAL(12,2), "compareAtPrice" DECIMAL(12,2),
  "status" "ProductVariantStatus" NOT NULL DEFAULT 'ACTIVE', "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "ProductVariant_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ProductVariant_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "ProductVariant_sku_key" ON "ProductVariant"("sku");
CREATE INDEX "ProductVariant_productId_idx" ON "ProductVariant"("productId");
CREATE INDEX "ProductVariant_status_idx" ON "ProductVariant"("status");
CREATE INDEX "ProductVariant_productId_size_color_idx" ON "ProductVariant"("productId","size","color");

CREATE TABLE "ProductImage" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "productId" UUID, "variantId" UUID, "url" TEXT NOT NULL,
  "altText" TEXT, "sortOrder" INTEGER NOT NULL DEFAULT 0, "isPrimary" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProductImage_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ProductImage_owner_check" CHECK (("productId" IS NOT NULL AND "variantId" IS NULL) OR ("productId" IS NULL AND "variantId" IS NOT NULL)),
  CONSTRAINT "ProductImage_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ProductImage_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "ProductImage_productId_idx" ON "ProductImage"("productId");
CREATE INDEX "ProductImage_variantId_idx" ON "ProductImage"("variantId");
CREATE INDEX "ProductImage_productId_sortOrder_idx" ON "ProductImage"("productId","sortOrder");
CREATE INDEX "ProductImage_variantId_sortOrder_idx" ON "ProductImage"("variantId","sortOrder");

CREATE TABLE "Category" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "name" TEXT NOT NULL, "slug" TEXT NOT NULL, "description" TEXT,
  "parentId" UUID, "status" "CategoryStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Category_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Category_not_self_parent_check" CHECK ("parentId" IS NULL OR "parentId" <> "id"),
  CONSTRAINT "Category_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "Category_slug_key" ON "Category"("slug");
CREATE INDEX "Category_parentId_idx" ON "Category"("parentId");
CREATE INDEX "Category_status_idx" ON "Category"("status");

CREATE TABLE "Collection" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "name" TEXT NOT NULL, "slug" TEXT NOT NULL, "description" TEXT,
  "status" "CollectionStatus" NOT NULL DEFAULT 'ACTIVE', "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "Collection_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Collection_slug_key" ON "Collection"("slug");
CREATE INDEX "Collection_status_idx" ON "Collection"("status");

CREATE TABLE "Tag" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "name" TEXT NOT NULL, "slug" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Tag_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Tag_slug_key" ON "Tag"("slug");

CREATE TABLE "ProductCategory" (
  "productId" UUID NOT NULL, "categoryId" UUID NOT NULL, CONSTRAINT "ProductCategory_pkey" PRIMARY KEY ("productId","categoryId"),
  CONSTRAINT "ProductCategory_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ProductCategory_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "ProductCategory_categoryId_idx" ON "ProductCategory"("categoryId");

CREATE TABLE "ProductCollection" (
  "productId" UUID NOT NULL, "collectionId" UUID NOT NULL, CONSTRAINT "ProductCollection_pkey" PRIMARY KEY ("productId","collectionId"),
  CONSTRAINT "ProductCollection_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ProductCollection_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "Collection"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "ProductCollection_collectionId_idx" ON "ProductCollection"("collectionId");

CREATE TABLE "ProductTag" (
  "productId" UUID NOT NULL, "tagId" UUID NOT NULL, CONSTRAINT "ProductTag_pkey" PRIMARY KEY ("productId","tagId"),
  CONSTRAINT "ProductTag_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ProductTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "ProductTag_tagId_idx" ON "ProductTag"("tagId");
);
CREATE UNIQUE INDEX "Tag_slug_key" ON "Tag"("slug");

CREATE TABLE "ProductCategory" (
  "productId" UUID NOT NULL, "categoryId" UUID NOT NULL, CONSTRAINT "ProductCategory_pkey" PRIMARY KEY ("productId","categoryId"),
  CONSTRAINT "ProductCategory_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ProductCategory_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "ProductCategory_categoryId_idx" ON "ProductCategory"("categoryId");

CREATE TABLE "ProductCollection" (
  "productId" UUID NOT NULL, "collectionId" UUID NOT NULL, CONSTRAINT "ProductCollection_pkey" PRIMARY KEY ("productId","collectionId"),
  CONSTRAINT "ProductCollection_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ProductCollection_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "Collection"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "ProductCollection_collectionId_idx" ON "ProductCollection"("collectionId");

CREATE TABLE "ProductTag" (
  "productId" UUID NOT NULL, "tagId" UUID NOT NULL, CONSTRAINT "ProductTag_pkey" PRIMARY KEY ("productId","tagId"),
  CONSTRAINT "ProductTag_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ProductTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "ProductTag_tagId_idx" ON "ProductTag"("tagId");
);
ALTER TABLE "Product" ADD CONSTRAINT "Product_slug_format_check" CHECK ("slug" ~ '^[a-z0-9]+(?:-[a-z0-9]+)*
CREATE INDEX "Product_status_idx" ON "Product"("status");
CREATE INDEX "Product_createdAt_idx" ON "Product"("createdAt");

CREATE TABLE "ProductVariant" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "productId" UUID NOT NULL, "displayName" TEXT,
  "size" TEXT, "color" TEXT, "sku" TEXT NOT NULL, "price" DECIMAL(12,2), "compareAtPrice" DECIMAL(12,2),
  "status" "ProductVariantStatus" NOT NULL DEFAULT 'ACTIVE', "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "ProductVariant_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ProductVariant_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "ProductVariant_sku_key" ON "ProductVariant"("sku");
CREATE INDEX "ProductVariant_productId_idx" ON "ProductVariant"("productId");
CREATE INDEX "ProductVariant_status_idx" ON "ProductVariant"("status");
CREATE INDEX "ProductVariant_productId_size_color_idx" ON "ProductVariant"("productId","size","color");

CREATE TABLE "ProductImage" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "productId" UUID, "variantId" UUID, "url" TEXT NOT NULL,
  "altText" TEXT, "sortOrder" INTEGER NOT NULL DEFAULT 0, "isPrimary" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProductImage_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ProductImage_owner_check" CHECK (("productId" IS NOT NULL AND "variantId" IS NULL) OR ("productId" IS NULL AND "variantId" IS NOT NULL)),
  CONSTRAINT "ProductImage_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ProductImage_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "ProductImage_productId_idx" ON "ProductImage"("productId");
CREATE INDEX "ProductImage_variantId_idx" ON "ProductImage"("variantId");
CREATE INDEX "ProductImage_productId_sortOrder_idx" ON "ProductImage"("productId","sortOrder");
CREATE INDEX "ProductImage_variantId_sortOrder_idx" ON "ProductImage"("variantId","sortOrder");

CREATE TABLE "Category" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "name" TEXT NOT NULL, "slug" TEXT NOT NULL, "description" TEXT,
  "parentId" UUID, "status" "CategoryStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Category_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Category_not_self_parent_check" CHECK ("parentId" IS NULL OR "parentId" <> "id"),
  CONSTRAINT "Category_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "Category_slug_key" ON "Category"("slug");
CREATE INDEX "Category_parentId_idx" ON "Category"("parentId");
CREATE INDEX "Category_status_idx" ON "Category"("status");

CREATE TABLE "Collection" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "name" TEXT NOT NULL, "slug" TEXT NOT NULL, "description" TEXT,
  "status" "CollectionStatus" NOT NULL DEFAULT 'ACTIVE', "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "Collection_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Collection_slug_key" ON "Collection"("slug");
CREATE INDEX "Collection_status_idx" ON "Collection"("status");

CREATE TABLE "Tag" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "name" TEXT NOT NULL, "slug" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Tag_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Tag_slug_key" ON "Tag"("slug");

CREATE TABLE "ProductCategory" (
  "productId" UUID NOT NULL, "categoryId" UUID NOT NULL, CONSTRAINT "ProductCategory_pkey" PRIMARY KEY ("productId","categoryId"),
  CONSTRAINT "ProductCategory_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ProductCategory_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "ProductCategory_categoryId_idx" ON "ProductCategory"("categoryId");

CREATE TABLE "ProductCollection" (
  "productId" UUID NOT NULL, "collectionId" UUID NOT NULL, CONSTRAINT "ProductCollection_pkey" PRIMARY KEY ("productId","collectionId"),
  CONSTRAINT "ProductCollection_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ProductCollection_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "Collection"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "ProductCollection_collectionId_idx" ON "ProductCollection"("collectionId");

CREATE TABLE "ProductTag" (
  "productId" UUID NOT NULL, "tagId" UUID NOT NULL, CONSTRAINT "ProductTag_pkey" PRIMARY KEY ("productId","tagId"),
  CONSTRAINT "ProductTag_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ProductTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "ProductTag_tagId_idx" ON "ProductTag"("tagId");
);
CREATE UNIQUE INDEX "Product_slug_key" ON "Product"("slug");
CREATE INDEX "Product_status_idx" ON "Product"("status");
CREATE INDEX "Product_createdAt_idx" ON "Product"("createdAt");

CREATE TABLE "ProductVariant" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "productId" UUID NOT NULL, "displayName" TEXT,
  "size" TEXT, "color" TEXT, "sku" TEXT NOT NULL, "price" DECIMAL(12,2), "compareAtPrice" DECIMAL(12,2),
  "status" "ProductVariantStatus" NOT NULL DEFAULT 'ACTIVE', "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "ProductVariant_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ProductVariant_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "ProductVariant_sku_key" ON "ProductVariant"("sku");
CREATE INDEX "ProductVariant_productId_idx" ON "ProductVariant"("productId");
CREATE INDEX "ProductVariant_status_idx" ON "ProductVariant"("status");
CREATE INDEX "ProductVariant_productId_size_color_idx" ON "ProductVariant"("productId","size","color");

CREATE TABLE "ProductImage" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "productId" UUID, "variantId" UUID, "url" TEXT NOT NULL,
  "altText" TEXT, "sortOrder" INTEGER NOT NULL DEFAULT 0, "isPrimary" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProductImage_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ProductImage_owner_check" CHECK (("productId" IS NOT NULL AND "variantId" IS NULL) OR ("productId" IS NULL AND "variantId" IS NOT NULL)),
  CONSTRAINT "ProductImage_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ProductImage_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "ProductImage_productId_idx" ON "ProductImage"("productId");
CREATE INDEX "ProductImage_variantId_idx" ON "ProductImage"("variantId");
CREATE INDEX "ProductImage_productId_sortOrder_idx" ON "ProductImage"("productId","sortOrder");
CREATE INDEX "ProductImage_variantId_sortOrder_idx" ON "ProductImage"("variantId","sortOrder");

CREATE TABLE "Category" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "name" TEXT NOT NULL, "slug" TEXT NOT NULL, "description" TEXT,
  "parentId" UUID, "status" "CategoryStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Category_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Category_not_self_parent_check" CHECK ("parentId" IS NULL OR "parentId" <> "id"),
  CONSTRAINT "Category_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "Category_slug_key" ON "Category"("slug");
CREATE INDEX "Category_parentId_idx" ON "Category"("parentId");
CREATE INDEX "Category_status_idx" ON "Category"("status");

CREATE TABLE "Collection" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "name" TEXT NOT NULL, "slug" TEXT NOT NULL, "description" TEXT,
  "status" "CollectionStatus" NOT NULL DEFAULT 'ACTIVE', "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "Collection_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Collection_slug_key" ON "Collection"("slug");
CREATE INDEX "Collection_status_idx" ON "Collection"("status");

CREATE TABLE "Tag" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "name" TEXT NOT NULL, "slug" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Tag_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Tag_slug_key" ON "Tag"("slug");

CREATE TABLE "ProductCategory" (
  "productId" UUID NOT NULL, "categoryId" UUID NOT NULL, CONSTRAINT "ProductCategory_pkey" PRIMARY KEY ("productId","categoryId"),
  CONSTRAINT "ProductCategory_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ProductCategory_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "ProductCategory_categoryId_idx" ON "ProductCategory"("categoryId");

CREATE TABLE "ProductCollection" (
  "productId" UUID NOT NULL, "collectionId" UUID NOT NULL, CONSTRAINT "ProductCollection_pkey" PRIMARY KEY ("productId","collectionId"),
  CONSTRAINT "ProductCollection_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ProductCollection_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "Collection"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "ProductCollection_collectionId_idx" ON "ProductCollection"("collectionId");

CREATE TABLE "ProductTag" (
  "productId" UUID NOT NULL, "tagId" UUID NOT NULL, CONSTRAINT "ProductTag_pkey" PRIMARY KEY ("productId","tagId"),
  CONSTRAINT "ProductTag_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ProductTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "ProductTag_tagId_idx" ON "ProductTag"("tagId");
);
CREATE UNIQUE INDEX "Category_slug_key" ON "Category"("slug");
CREATE INDEX "Category_parentId_idx" ON "Category"("parentId");
CREATE INDEX "Category_status_idx" ON "Category"("status");

CREATE TABLE "Collection" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "name" TEXT NOT NULL, "slug" TEXT NOT NULL, "description" TEXT,
  "status" "CollectionStatus" NOT NULL DEFAULT 'ACTIVE', "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "Collection_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Collection_slug_key" ON "Collection"("slug");
CREATE INDEX "Collection_status_idx" ON "Collection"("status");

CREATE TABLE "Tag" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "name" TEXT NOT NULL, "slug" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Tag_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Tag_slug_key" ON "Tag"("slug");

CREATE TABLE "ProductCategory" (
  "productId" UUID NOT NULL, "categoryId" UUID NOT NULL, CONSTRAINT "ProductCategory_pkey" PRIMARY KEY ("productId","categoryId"),
  CONSTRAINT "ProductCategory_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ProductCategory_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "ProductCategory_categoryId_idx" ON "ProductCategory"("categoryId");

CREATE TABLE "ProductCollection" (
  "productId" UUID NOT NULL, "collectionId" UUID NOT NULL, CONSTRAINT "ProductCollection_pkey" PRIMARY KEY ("productId","collectionId"),
  CONSTRAINT "ProductCollection_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ProductCollection_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "Collection"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "ProductCollection_collectionId_idx" ON "ProductCollection"("collectionId");

CREATE TABLE "ProductTag" (
  "productId" UUID NOT NULL, "tagId" UUID NOT NULL, CONSTRAINT "ProductTag_pkey" PRIMARY KEY ("productId","tagId"),
  CONSTRAINT "ProductTag_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ProductTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "ProductTag_tagId_idx" ON "ProductTag"("tagId");
);
ALTER TABLE "Product" ADD CONSTRAINT "Product_slug_format_check" CHECK ("slug" ~ '^[a-z0-9]+(?:-[a-z0-9]+)*
CREATE INDEX "Product_status_idx" ON "Product"("status");
CREATE INDEX "Product_createdAt_idx" ON "Product"("createdAt");

CREATE TABLE "ProductVariant" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "productId" UUID NOT NULL, "displayName" TEXT,
  "size" TEXT, "color" TEXT, "sku" TEXT NOT NULL, "price" DECIMAL(12,2), "compareAtPrice" DECIMAL(12,2),
  "status" "ProductVariantStatus" NOT NULL DEFAULT 'ACTIVE', "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "ProductVariant_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ProductVariant_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "ProductVariant_sku_key" ON "ProductVariant"("sku");
CREATE INDEX "ProductVariant_productId_idx" ON "ProductVariant"("productId");
CREATE INDEX "ProductVariant_status_idx" ON "ProductVariant"("status");
CREATE INDEX "ProductVariant_productId_size_color_idx" ON "ProductVariant"("productId","size","color");

CREATE TABLE "ProductImage" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "productId" UUID, "variantId" UUID, "url" TEXT NOT NULL,
  "altText" TEXT, "sortOrder" INTEGER NOT NULL DEFAULT 0, "isPrimary" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProductImage_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ProductImage_owner_check" CHECK (("productId" IS NOT NULL AND "variantId" IS NULL) OR ("productId" IS NULL AND "variantId" IS NOT NULL)),
  CONSTRAINT "ProductImage_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ProductImage_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "ProductImage_productId_idx" ON "ProductImage"("productId");
CREATE INDEX "ProductImage_variantId_idx" ON "ProductImage"("variantId");
CREATE INDEX "ProductImage_productId_sortOrder_idx" ON "ProductImage"("productId","sortOrder");
CREATE INDEX "ProductImage_variantId_sortOrder_idx" ON "ProductImage"("variantId","sortOrder");

CREATE TABLE "Category" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "name" TEXT NOT NULL, "slug" TEXT NOT NULL, "description" TEXT,
  "parentId" UUID, "status" "CategoryStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Category_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Category_not_self_parent_check" CHECK ("parentId" IS NULL OR "parentId" <> "id"),
  CONSTRAINT "Category_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "Category_slug_key" ON "Category"("slug");
CREATE INDEX "Category_parentId_idx" ON "Category"("parentId");
CREATE INDEX "Category_status_idx" ON "Category"("status");

CREATE TABLE "Collection" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "name" TEXT NOT NULL, "slug" TEXT NOT NULL, "description" TEXT,
  "status" "CollectionStatus" NOT NULL DEFAULT 'ACTIVE', "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "Collection_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Collection_slug_key" ON "Collection"("slug");
CREATE INDEX "Collection_status_idx" ON "Collection"("status");

CREATE TABLE "Tag" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "name" TEXT NOT NULL, "slug" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Tag_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Tag_slug_key" ON "Tag"("slug");

CREATE TABLE "ProductCategory" (
  "productId" UUID NOT NULL, "categoryId" UUID NOT NULL, CONSTRAINT "ProductCategory_pkey" PRIMARY KEY ("productId","categoryId"),
  CONSTRAINT "ProductCategory_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ProductCategory_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "ProductCategory_categoryId_idx" ON "ProductCategory"("categoryId");

CREATE TABLE "ProductCollection" (
  "productId" UUID NOT NULL, "collectionId" UUID NOT NULL, CONSTRAINT "ProductCollection_pkey" PRIMARY KEY ("productId","collectionId"),
  CONSTRAINT "ProductCollection_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ProductCollection_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "Collection"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "ProductCollection_collectionId_idx" ON "ProductCollection"("collectionId");

CREATE TABLE "ProductTag" (
  "productId" UUID NOT NULL, "tagId" UUID NOT NULL, CONSTRAINT "ProductTag_pkey" PRIMARY KEY ("productId","tagId"),
  CONSTRAINT "ProductTag_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ProductTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "ProductTag_tagId_idx" ON "ProductTag"("tagId");
);
CREATE UNIQUE INDEX "Product_slug_key" ON "Product"("slug");
CREATE INDEX "Product_status_idx" ON "Product"("status");
CREATE INDEX "Product_createdAt_idx" ON "Product"("createdAt");

CREATE TABLE "ProductVariant" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "productId" UUID NOT NULL, "displayName" TEXT,
  "size" TEXT, "color" TEXT, "sku" TEXT NOT NULL, "price" DECIMAL(12,2), "compareAtPrice" DECIMAL(12,2),
  "status" "ProductVariantStatus" NOT NULL DEFAULT 'ACTIVE', "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "ProductVariant_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ProductVariant_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "ProductVariant_sku_key" ON "ProductVariant"("sku");
CREATE INDEX "ProductVariant_productId_idx" ON "ProductVariant"("productId");
CREATE INDEX "ProductVariant_status_idx" ON "ProductVariant"("status");
CREATE INDEX "ProductVariant_productId_size_color_idx" ON "ProductVariant"("productId","size","color");

CREATE TABLE "ProductImage" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "productId" UUID, "variantId" UUID, "url" TEXT NOT NULL,
  "altText" TEXT, "sortOrder" INTEGER NOT NULL DEFAULT 0, "isPrimary" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProductImage_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ProductImage_owner_check" CHECK (("productId" IS NOT NULL AND "variantId" IS NULL) OR ("productId" IS NULL AND "variantId" IS NOT NULL)),
  CONSTRAINT "ProductImage_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ProductImage_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "ProductImage_productId_idx" ON "ProductImage"("productId");
CREATE INDEX "ProductImage_variantId_idx" ON "ProductImage"("variantId");
CREATE INDEX "ProductImage_productId_sortOrder_idx" ON "ProductImage"("productId","sortOrder");
CREATE INDEX "ProductImage_variantId_sortOrder_idx" ON "ProductImage"("variantId","sortOrder");

CREATE TABLE "Category" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "name" TEXT NOT NULL, "slug" TEXT NOT NULL, "description" TEXT,
  "parentId" UUID, "status" "CategoryStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Category_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Category_not_self_parent_check" CHECK ("parentId" IS NULL OR "parentId" <> "id"),
  CONSTRAINT "Category_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "Category_slug_key" ON "Category"("slug");
CREATE INDEX "Category_parentId_idx" ON "Category"("parentId");
CREATE INDEX "Category_status_idx" ON "Category"("status");

CREATE TABLE "Collection" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "name" TEXT NOT NULL, "slug" TEXT NOT NULL, "description" TEXT,
  "status" "CollectionStatus" NOT NULL DEFAULT 'ACTIVE', "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "Collection_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Collection_slug_key" ON "Collection"("slug");
CREATE INDEX "Collection_status_idx" ON "Collection"("status");

CREATE TABLE "Tag" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "name" TEXT NOT NULL, "slug" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Tag_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Tag_slug_key" ON "Tag"("slug");

CREATE TABLE "ProductCategory" (
  "productId" UUID NOT NULL, "categoryId" UUID NOT NULL, CONSTRAINT "ProductCategory_pkey" PRIMARY KEY ("productId","categoryId"),
  CONSTRAINT "ProductCategory_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ProductCategory_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "ProductCategory_categoryId_idx" ON "ProductCategory"("categoryId");

CREATE TABLE "ProductCollection" (
  "productId" UUID NOT NULL, "collectionId" UUID NOT NULL, CONSTRAINT "ProductCollection_pkey" PRIMARY KEY ("productId","collectionId"),
  CONSTRAINT "ProductCollection_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ProductCollection_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "Collection"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "ProductCollection_collectionId_idx" ON "ProductCollection"("collectionId");

CREATE TABLE "ProductTag" (
  "productId" UUID NOT NULL, "tagId" UUID NOT NULL, CONSTRAINT "ProductTag_pkey" PRIMARY KEY ("productId","tagId"),
  CONSTRAINT "ProductTag_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ProductTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "ProductTag_tagId_idx" ON "ProductTag"("tagId");
);
CREATE UNIQUE INDEX "Collection_slug_key" ON "Collection"("slug");
CREATE INDEX "Collection_status_idx" ON "Collection"("status");

CREATE TABLE "Tag" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "name" TEXT NOT NULL, "slug" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Tag_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Tag_slug_key" ON "Tag"("slug");

CREATE TABLE "ProductCategory" (
  "productId" UUID NOT NULL, "categoryId" UUID NOT NULL, CONSTRAINT "ProductCategory_pkey" PRIMARY KEY ("productId","categoryId"),
  CONSTRAINT "ProductCategory_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ProductCategory_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "ProductCategory_categoryId_idx" ON "ProductCategory"("categoryId");

CREATE TABLE "ProductCollection" (
  "productId" UUID NOT NULL, "collectionId" UUID NOT NULL, CONSTRAINT "ProductCollection_pkey" PRIMARY KEY ("productId","collectionId"),
  CONSTRAINT "ProductCollection_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ProductCollection_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "Collection"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "ProductCollection_collectionId_idx" ON "ProductCollection"("collectionId");

CREATE TABLE "ProductTag" (
  "productId" UUID NOT NULL, "tagId" UUID NOT NULL, CONSTRAINT "ProductTag_pkey" PRIMARY KEY ("productId","tagId"),
  CONSTRAINT "ProductTag_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ProductTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "ProductTag_tagId_idx" ON "ProductTag"("tagId");
);
ALTER TABLE "Product" ADD CONSTRAINT "Product_slug_format_check" CHECK ("slug" ~ '^[a-z0-9]+(?:-[a-z0-9]+)*
CREATE INDEX "Product_status_idx" ON "Product"("status");
CREATE INDEX "Product_createdAt_idx" ON "Product"("createdAt");

CREATE TABLE "ProductVariant" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "productId" UUID NOT NULL, "displayName" TEXT,
  "size" TEXT, "color" TEXT, "sku" TEXT NOT NULL, "price" DECIMAL(12,2), "compareAtPrice" DECIMAL(12,2),
  "status" "ProductVariantStatus" NOT NULL DEFAULT 'ACTIVE', "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "ProductVariant_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ProductVariant_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "ProductVariant_sku_key" ON "ProductVariant"("sku");
CREATE INDEX "ProductVariant_productId_idx" ON "ProductVariant"("productId");
CREATE INDEX "ProductVariant_status_idx" ON "ProductVariant"("status");
CREATE INDEX "ProductVariant_productId_size_color_idx" ON "ProductVariant"("productId","size","color");

CREATE TABLE "ProductImage" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "productId" UUID, "variantId" UUID, "url" TEXT NOT NULL,
  "altText" TEXT, "sortOrder" INTEGER NOT NULL DEFAULT 0, "isPrimary" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProductImage_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ProductImage_owner_check" CHECK (("productId" IS NOT NULL AND "variantId" IS NULL) OR ("productId" IS NULL AND "variantId" IS NOT NULL)),
  CONSTRAINT "ProductImage_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ProductImage_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "ProductImage_productId_idx" ON "ProductImage"("productId");
CREATE INDEX "ProductImage_variantId_idx" ON "ProductImage"("variantId");
CREATE INDEX "ProductImage_productId_sortOrder_idx" ON "ProductImage"("productId","sortOrder");
CREATE INDEX "ProductImage_variantId_sortOrder_idx" ON "ProductImage"("variantId","sortOrder");

CREATE TABLE "Category" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "name" TEXT NOT NULL, "slug" TEXT NOT NULL, "description" TEXT,
  "parentId" UUID, "status" "CategoryStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Category_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Category_not_self_parent_check" CHECK ("parentId" IS NULL OR "parentId" <> "id"),
  CONSTRAINT "Category_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "Category_slug_key" ON "Category"("slug");
CREATE INDEX "Category_parentId_idx" ON "Category"("parentId");
CREATE INDEX "Category_status_idx" ON "Category"("status");

CREATE TABLE "Collection" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "name" TEXT NOT NULL, "slug" TEXT NOT NULL, "description" TEXT,
  "status" "CollectionStatus" NOT NULL DEFAULT 'ACTIVE', "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "Collection_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Collection_slug_key" ON "Collection"("slug");
CREATE INDEX "Collection_status_idx" ON "Collection"("status");

CREATE TABLE "Tag" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "name" TEXT NOT NULL, "slug" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Tag_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Tag_slug_key" ON "Tag"("slug");

CREATE TABLE "ProductCategory" (
  "productId" UUID NOT NULL, "categoryId" UUID NOT NULL, CONSTRAINT "ProductCategory_pkey" PRIMARY KEY ("productId","categoryId"),
  CONSTRAINT "ProductCategory_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ProductCategory_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "ProductCategory_categoryId_idx" ON "ProductCategory"("categoryId");

CREATE TABLE "ProductCollection" (
  "productId" UUID NOT NULL, "collectionId" UUID NOT NULL, CONSTRAINT "ProductCollection_pkey" PRIMARY KEY ("productId","collectionId"),
  CONSTRAINT "ProductCollection_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ProductCollection_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "Collection"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "ProductCollection_collectionId_idx" ON "ProductCollection"("collectionId");

CREATE TABLE "ProductTag" (
  "productId" UUID NOT NULL, "tagId" UUID NOT NULL, CONSTRAINT "ProductTag_pkey" PRIMARY KEY ("productId","tagId"),
  CONSTRAINT "ProductTag_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ProductTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "ProductTag_tagId_idx" ON "ProductTag"("tagId");
);
CREATE UNIQUE INDEX "Product_slug_key" ON "Product"("slug");
CREATE INDEX "Product_status_idx" ON "Product"("status");
CREATE INDEX "Product_createdAt_idx" ON "Product"("createdAt");

CREATE TABLE "ProductVariant" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "productId" UUID NOT NULL, "displayName" TEXT,
  "size" TEXT, "color" TEXT, "sku" TEXT NOT NULL, "price" DECIMAL(12,2), "compareAtPrice" DECIMAL(12,2),
  "status" "ProductVariantStatus" NOT NULL DEFAULT 'ACTIVE', "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "ProductVariant_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ProductVariant_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "ProductVariant_sku_key" ON "ProductVariant"("sku");
CREATE INDEX "ProductVariant_productId_idx" ON "ProductVariant"("productId");
CREATE INDEX "ProductVariant_status_idx" ON "ProductVariant"("status");
CREATE INDEX "ProductVariant_productId_size_color_idx" ON "ProductVariant"("productId","size","color");

CREATE TABLE "ProductImage" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "productId" UUID, "variantId" UUID, "url" TEXT NOT NULL,
  "altText" TEXT, "sortOrder" INTEGER NOT NULL DEFAULT 0, "isPrimary" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProductImage_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ProductImage_owner_check" CHECK (("productId" IS NOT NULL AND "variantId" IS NULL) OR ("productId" IS NULL AND "variantId" IS NOT NULL)),
  CONSTRAINT "ProductImage_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ProductImage_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "ProductImage_productId_idx" ON "ProductImage"("productId");
CREATE INDEX "ProductImage_variantId_idx" ON "ProductImage"("variantId");
CREATE INDEX "ProductImage_productId_sortOrder_idx" ON "ProductImage"("productId","sortOrder");
CREATE INDEX "ProductImage_variantId_sortOrder_idx" ON "ProductImage"("variantId","sortOrder");

CREATE TABLE "Category" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "name" TEXT NOT NULL, "slug" TEXT NOT NULL, "description" TEXT,
  "parentId" UUID, "status" "CategoryStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Category_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Category_not_self_parent_check" CHECK ("parentId" IS NULL OR "parentId" <> "id"),
  CONSTRAINT "Category_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "Category_slug_key" ON "Category"("slug");
CREATE INDEX "Category_parentId_idx" ON "Category"("parentId");
CREATE INDEX "Category_status_idx" ON "Category"("status");

CREATE TABLE "Collection" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "name" TEXT NOT NULL, "slug" TEXT NOT NULL, "description" TEXT,
  "status" "CollectionStatus" NOT NULL DEFAULT 'ACTIVE', "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "Collection_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Collection_slug_key" ON "Collection"("slug");
CREATE INDEX "Collection_status_idx" ON "Collection"("status");

CREATE TABLE "Tag" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "name" TEXT NOT NULL, "slug" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Tag_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Tag_slug_key" ON "Tag"("slug");

CREATE TABLE "ProductCategory" (
  "productId" UUID NOT NULL, "categoryId" UUID NOT NULL, CONSTRAINT "ProductCategory_pkey" PRIMARY KEY ("productId","categoryId"),
  CONSTRAINT "ProductCategory_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ProductCategory_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "ProductCategory_categoryId_idx" ON "ProductCategory"("categoryId");

CREATE TABLE "ProductCollection" (
  "productId" UUID NOT NULL, "collectionId" UUID NOT NULL, CONSTRAINT "ProductCollection_pkey" PRIMARY KEY ("productId","collectionId"),
  CONSTRAINT "ProductCollection_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ProductCollection_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "Collection"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "ProductCollection_collectionId_idx" ON "ProductCollection"("collectionId");

CREATE TABLE "ProductTag" (
  "productId" UUID NOT NULL, "tagId" UUID NOT NULL, CONSTRAINT "ProductTag_pkey" PRIMARY KEY ("productId","tagId"),
  CONSTRAINT "ProductTag_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ProductTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "ProductTag_tagId_idx" ON "ProductTag"("tagId");
);
CREATE UNIQUE INDEX "Category_slug_key" ON "Category"("slug");
CREATE INDEX "Category_parentId_idx" ON "Category"("parentId");
CREATE INDEX "Category_status_idx" ON "Category"("status");

CREATE TABLE "Collection" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "name" TEXT NOT NULL, "slug" TEXT NOT NULL, "description" TEXT,
  "status" "CollectionStatus" NOT NULL DEFAULT 'ACTIVE', "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "Collection_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Collection_slug_key" ON "Collection"("slug");
CREATE INDEX "Collection_status_idx" ON "Collection"("status");

CREATE TABLE "Tag" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "name" TEXT NOT NULL, "slug" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Tag_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Tag_slug_key" ON "Tag"("slug");

CREATE TABLE "ProductCategory" (
  "productId" UUID NOT NULL, "categoryId" UUID NOT NULL, CONSTRAINT "ProductCategory_pkey" PRIMARY KEY ("productId","categoryId"),
  CONSTRAINT "ProductCategory_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ProductCategory_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "ProductCategory_categoryId_idx" ON "ProductCategory"("categoryId");

CREATE TABLE "ProductCollection" (
  "productId" UUID NOT NULL, "collectionId" UUID NOT NULL, CONSTRAINT "ProductCollection_pkey" PRIMARY KEY ("productId","collectionId"),
  CONSTRAINT "ProductCollection_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ProductCollection_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "Collection"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "ProductCollection_collectionId_idx" ON "ProductCollection"("collectionId");

CREATE TABLE "ProductTag" (
  "productId" UUID NOT NULL, "tagId" UUID NOT NULL, CONSTRAINT "ProductTag_pkey" PRIMARY KEY ("productId","tagId"),
  CONSTRAINT "ProductTag_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ProductTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "ProductTag_tagId_idx" ON "ProductTag"("tagId");
);
ALTER TABLE "Product" ADD CONSTRAINT "Product_slug_format_check" CHECK ("slug" ~ '^[a-z0-9]+(?:-[a-z0-9]+)*
CREATE INDEX "Product_status_idx" ON "Product"("status");
CREATE INDEX "Product_createdAt_idx" ON "Product"("createdAt");

CREATE TABLE "ProductVariant" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "productId" UUID NOT NULL, "displayName" TEXT,
  "size" TEXT, "color" TEXT, "sku" TEXT NOT NULL, "price" DECIMAL(12,2), "compareAtPrice" DECIMAL(12,2),
  "status" "ProductVariantStatus" NOT NULL DEFAULT 'ACTIVE', "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "ProductVariant_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ProductVariant_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "ProductVariant_sku_key" ON "ProductVariant"("sku");
CREATE INDEX "ProductVariant_productId_idx" ON "ProductVariant"("productId");
CREATE INDEX "ProductVariant_status_idx" ON "ProductVariant"("status");
CREATE INDEX "ProductVariant_productId_size_color_idx" ON "ProductVariant"("productId","size","color");

CREATE TABLE "ProductImage" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "productId" UUID, "variantId" UUID, "url" TEXT NOT NULL,
  "altText" TEXT, "sortOrder" INTEGER NOT NULL DEFAULT 0, "isPrimary" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProductImage_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ProductImage_owner_check" CHECK (("productId" IS NOT NULL AND "variantId" IS NULL) OR ("productId" IS NULL AND "variantId" IS NOT NULL)),
  CONSTRAINT "ProductImage_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ProductImage_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "ProductImage_productId_idx" ON "ProductImage"("productId");
CREATE INDEX "ProductImage_variantId_idx" ON "ProductImage"("variantId");
CREATE INDEX "ProductImage_productId_sortOrder_idx" ON "ProductImage"("productId","sortOrder");
CREATE INDEX "ProductImage_variantId_sortOrder_idx" ON "ProductImage"("variantId","sortOrder");

CREATE TABLE "Category" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "name" TEXT NOT NULL, "slug" TEXT NOT NULL, "description" TEXT,
  "parentId" UUID, "status" "CategoryStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Category_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Category_not_self_parent_check" CHECK ("parentId" IS NULL OR "parentId" <> "id"),
  CONSTRAINT "Category_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "Category_slug_key" ON "Category"("slug");
CREATE INDEX "Category_parentId_idx" ON "Category"("parentId");
CREATE INDEX "Category_status_idx" ON "Category"("status");

CREATE TABLE "Collection" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "name" TEXT NOT NULL, "slug" TEXT NOT NULL, "description" TEXT,
  "status" "CollectionStatus" NOT NULL DEFAULT 'ACTIVE', "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "Collection_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Collection_slug_key" ON "Collection"("slug");
CREATE INDEX "Collection_status_idx" ON "Collection"("status");

CREATE TABLE "Tag" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "name" TEXT NOT NULL, "slug" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Tag_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Tag_slug_key" ON "Tag"("slug");

CREATE TABLE "ProductCategory" (
  "productId" UUID NOT NULL, "categoryId" UUID NOT NULL, CONSTRAINT "ProductCategory_pkey" PRIMARY KEY ("productId","categoryId"),
  CONSTRAINT "ProductCategory_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ProductCategory_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "ProductCategory_categoryId_idx" ON "ProductCategory"("categoryId");

CREATE TABLE "ProductCollection" (
  "productId" UUID NOT NULL, "collectionId" UUID NOT NULL, CONSTRAINT "ProductCollection_pkey" PRIMARY KEY ("productId","collectionId"),
  CONSTRAINT "ProductCollection_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ProductCollection_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "Collection"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "ProductCollection_collectionId_idx" ON "ProductCollection"("collectionId");

CREATE TABLE "ProductTag" (
  "productId" UUID NOT NULL, "tagId" UUID NOT NULL, CONSTRAINT "ProductTag_pkey" PRIMARY KEY ("productId","tagId"),
  CONSTRAINT "ProductTag_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ProductTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "ProductTag_tagId_idx" ON "ProductTag"("tagId");
);
CREATE UNIQUE INDEX "Product_slug_key" ON "Product"("slug");
CREATE INDEX "Product_status_idx" ON "Product"("status");
CREATE INDEX "Product_createdAt_idx" ON "Product"("createdAt");

CREATE TABLE "ProductVariant" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "productId" UUID NOT NULL, "displayName" TEXT,
  "size" TEXT, "color" TEXT, "sku" TEXT NOT NULL, "price" DECIMAL(12,2), "compareAtPrice" DECIMAL(12,2),
  "status" "ProductVariantStatus" NOT NULL DEFAULT 'ACTIVE', "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "ProductVariant_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ProductVariant_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "ProductVariant_sku_key" ON "ProductVariant"("sku");
CREATE INDEX "ProductVariant_productId_idx" ON "ProductVariant"("productId");
CREATE INDEX "ProductVariant_status_idx" ON "ProductVariant"("status");
CREATE INDEX "ProductVariant_productId_size_color_idx" ON "ProductVariant"("productId","size","color");

CREATE TABLE "ProductImage" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "productId" UUID, "variantId" UUID, "url" TEXT NOT NULL,
  "altText" TEXT, "sortOrder" INTEGER NOT NULL DEFAULT 0, "isPrimary" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProductImage_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ProductImage_owner_check" CHECK (("productId" IS NOT NULL AND "variantId" IS NULL) OR ("productId" IS NULL AND "variantId" IS NOT NULL)),
  CONSTRAINT "ProductImage_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ProductImage_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "ProductImage_productId_idx" ON "ProductImage"("productId");
CREATE INDEX "ProductImage_variantId_idx" ON "ProductImage"("variantId");
CREATE INDEX "ProductImage_productId_sortOrder_idx" ON "ProductImage"("productId","sortOrder");
CREATE INDEX "ProductImage_variantId_sortOrder_idx" ON "ProductImage"("variantId","sortOrder");

CREATE TABLE "Category" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "name" TEXT NOT NULL, "slug" TEXT NOT NULL, "description" TEXT,
  "parentId" UUID, "status" "CategoryStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Category_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Category_not_self_parent_check" CHECK ("parentId" IS NULL OR "parentId" <> "id"),
  CONSTRAINT "Category_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "Category_slug_key" ON "Category"("slug");
CREATE INDEX "Category_parentId_idx" ON "Category"("parentId");
CREATE INDEX "Category_status_idx" ON "Category"("status");

CREATE TABLE "Collection" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "name" TEXT NOT NULL, "slug" TEXT NOT NULL, "description" TEXT,
  "status" "CollectionStatus" NOT NULL DEFAULT 'ACTIVE', "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "Collection_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Collection_slug_key" ON "Collection"("slug");
CREATE INDEX "Collection_status_idx" ON "Collection"("status");

CREATE TABLE "Tag" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "name" TEXT NOT NULL, "slug" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Tag_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Tag_slug_key" ON "Tag"("slug");

CREATE TABLE "ProductCategory" (
  "productId" UUID NOT NULL, "categoryId" UUID NOT NULL, CONSTRAINT "ProductCategory_pkey" PRIMARY KEY ("productId","categoryId"),
  CONSTRAINT "ProductCategory_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ProductCategory_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "ProductCategory_categoryId_idx" ON "ProductCategory"("categoryId");

CREATE TABLE "ProductCollection" (
  "productId" UUID NOT NULL, "collectionId" UUID NOT NULL, CONSTRAINT "ProductCollection_pkey" PRIMARY KEY ("productId","collectionId"),
  CONSTRAINT "ProductCollection_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ProductCollection_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "Collection"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "ProductCollection_collectionId_idx" ON "ProductCollection"("collectionId");

CREATE TABLE "ProductTag" (
  "productId" UUID NOT NULL, "tagId" UUID NOT NULL, CONSTRAINT "ProductTag_pkey" PRIMARY KEY ("productId","tagId"),
  CONSTRAINT "ProductTag_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ProductTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "ProductTag_tagId_idx" ON "ProductTag"("tagId");
