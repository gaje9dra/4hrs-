-- Phase 2.8: canonical SEO metadata for customer-facing categories and collections.
ALTER TABLE "Category"
  ADD COLUMN "seoTitle" TEXT,
  ADD COLUMN "seoDescription" TEXT;

ALTER TABLE "Collection"
  ADD COLUMN "seoTitle" TEXT,
  ADD COLUMN "seoDescription" TEXT;
