import test from "node:test";
import assert from "node:assert/strict";
import {
  canTransitionProductStatus,
  getEffectivePrice,
  validateCategoryHierarchy,
  validateImage,
  validateMoney,
  validatePricePair,
  validateProduct,
  validatePublishingReadiness,
  validateTag,
  validateVariant,
  validateVariantUniqueness,
} from "../lib/catalog/validation.ts";

const baseProduct = {
  id: "product-1",
  title: "Oversized Graphic T-Shirt",
  slug: "oversized-graphic-t-shirt",
  status: "DRAFT" as const,
  price: "999.00",
  currency: "INR",
};

const baseVariant = {
  productId: "product-1",
  sku: "TSHIRT-BLK-M-001",
  size: "M",
  color: "Black",
  status: "ACTIVE" as const,
};

test("accepts a valid product", () => {
  assert.deepEqual(validateProduct(baseProduct), []);
});

test("rejects empty title, malformed slug, invalid currency, and negative price", () => {
  const issues = validateProduct({
    ...baseProduct,
    title: "   ",
    slug: "Bad Slug",
    currency: "inr",
    price: -1,
  });
  assert.ok(issues.some((item) => item.field === "title"));
  assert.ok(issues.some((item) => item.code === "INVALID_SLUG"));
  assert.ok(issues.some((item) => item.code === "INVALID_CURRENCY"));
  assert.ok(issues.some((item) => item.code === "INVALID_PRICE"));
});

test("enforces compare-at price relationship and money precision", () => {
  assert.equal(validatePricePair("999.00", "999.00").length, 0);
  assert.ok(validatePricePair("999.00", "899.00").some((item) => item.code === "INVALID_COMPARE_AT_PRICE"));
  assert.ok(validateMoney("10.999", "price").some((item) => item.code === "INVALID_MONEY_PRECISION"));
});

test("requires a Product relationship and rejects an empty SKU", () => {
  assert.deepEqual(validateVariant(baseVariant), []);
  assert.ok(validateVariant({ ...baseVariant, productId: "" }).some((item) => item.code === "INVALID_PRODUCT"));
  assert.ok(validateVariant({ ...baseVariant, sku: " " }).some((item) => item.code === "INVALID_SKU"));
  assert.ok(validateVariant({ ...baseVariant, productId: "" }).some((item) => item.code === "INVALID_PRODUCT"));
});

test("detects duplicate variants by normalized size and color", () => {
  const duplicates = validateVariantUniqueness([
    baseVariant,
    { ...baseVariant, sku: "TSHIRT-BLK-M-002", size: " m ", color: " black " },
  ]);
  assert.ok(duplicates.some((item) => item.code === "DUPLICATE_VARIANT"));
});

test("validates image ownership and sort order", () => {
  assert.deepEqual(validateImage({
    productId: "product-1",
    url: "https://cdn.example.com/image.jpg",
    sortOrder: 0,
    isPrimary: true,
  }), []);
  assert.ok(validateImage({
    productId: "product-1",
    variantId: "variant-1",
    url: "https://cdn.example.com/image.jpg",
    sortOrder: 0,
    isPrimary: false,
  }).some((item) => item.code === "INVALID_IMAGE_OWNER"));
  assert.ok(validateImage({
    variantId: "variant-1",
    url: "https://cdn.example.com/image.jpg",
    sortOrder: -1,
    isPrimary: false,
  }).some((item) => item.code === "INVALID_SORT_ORDER"));
});

test("rejects self-parenting categories", () => {
  assert.ok(validateCategoryHierarchy("category-1", "category-1").some((item) => item.code === "SELF_PARENT"));
});

test("rejects invalid tags and documents normalization through validation", () => {
  assert.deepEqual(validateTag({ name: "Streetwear", slug: "streetwear" }), []);
  assert.ok(validateTag({ name: " ", slug: "streetwear" }).some((item) => item.code === "REQUIRED"));
});

test("publishing readiness requires an active variant and product-level image", () => {
  const incomplete = validatePublishingReadiness({
    product: baseProduct,
    variants: [],
    images: [],
  });
  assert.ok(incomplete.some((item) => item.code === "VARIANT_REQUIRED"));
  assert.ok(incomplete.some((item) => item.code === "PRODUCT_IMAGE_REQUIRED"));

  const complete = validatePublishingReadiness({
    product: { ...baseProduct, status: "DRAFT" },
    variants: [baseVariant],
    images: [{
      productId: "product-1",
      url: "https://cdn.example.com/image.jpg",
      sortOrder: 0,
      isPrimary: true,
    }],
  });
  assert.deepEqual(complete, []);

  const invalidInheritedCompareAt = validatePublishingReadiness({
    product: { ...baseProduct, price: "999.00" },
    variants: [{ ...baseVariant, price: null, compareAtPrice: "899.00" }],
    images: [{ productId: "product-1", url: "https://cdn.example.com/image.jpg", sortOrder: 0, isPrimary: true }],
  });
  assert.ok(invalidInheritedCompareAt.some((item) => item.code === "INVALID_COMPARE_AT_PRICE"));
});

test("effective variant price overrides inherited product price", () => {
  assert.equal(getEffectivePrice("999.00"), 999);
  assert.equal(getEffectivePrice("999.00", "1099.00"), 1099);
});

test("uses a deterministic Product lifecycle", () => {
  assert.equal(canTransitionProductStatus("DRAFT", "ACTIVE"), true);
  assert.equal(canTransitionProductStatus("ACTIVE", "ARCHIVED"), true);
  assert.equal(canTransitionProductStatus("ARCHIVED", "ACTIVE"), false);
});
