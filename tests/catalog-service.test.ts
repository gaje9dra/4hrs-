import test from "node:test";
import assert from "node:assert/strict";
import { createCatalogService } from "../lib/catalog/service.ts";
import { CatalogServiceError } from "../lib/catalog/errors.ts";

const product = {
  id: "product-1",
  title: "Oversized Graphic T-Shirt",
  slug: "oversized-graphic-t-shirt",
  description: null,
  shortDescription: null,
  status: "DRAFT" as const,
  price: "999.00",
  compareAtPrice: null,
  currency: "INR",
  seoTitle: null,
  seoDescription: null,
};

test("service rejects invalid product before opening a transaction", async () => {
  let transactionOpened = false;
  const service = createCatalogService({
    withTransaction: async () => {
      transactionOpened = true;
      throw new Error("transaction should not be reached");
    },
  });

  await assert.rejects(
    service.createProduct({
      ...product,
      title: " ",
    }),
    (error: unknown) =>
      error instanceof CatalogServiceError && error.code === "INVALID_PRODUCT",
  );
  assert.equal(transactionOpened, false);
});

test("service maps missing product reads to a domain error", async () => {
  const service = createCatalogService({
    getProductById: async () => null,
  });

  await assert.rejects(
    service.getProductById("missing"),
    (error: unknown) =>
      error instanceof CatalogServiceError && error.code === "PRODUCT_NOT_FOUND",
  );
});

test("service prevents duplicate SKU before persistence", async () => {
  const existingVariant = {
    id: "variant-1",
    productId: "product-1",
    sku: "TSHIRT-BLK-M-001",
    displayName: null,
    size: "M",
    color: "Black",
    price: null,
    compareAtPrice: null,
    status: "ACTIVE" as const,
  };

  const service = createCatalogService({
    getProductById: async () => product,
    getVariantsByProduct: async () => [existingVariant],
  });

  await assert.rejects(
    service.createVariant({
      productId: "product-1",
      sku: "TSHIRT-BLK-M-001",
      size: "L",
      color: "Black",
      status: "ACTIVE",
    }),
    (error: unknown) =>
      error instanceof CatalogServiceError && error.code === "DUPLICATE_SKU",
  );
});

test("service prevents duplicate normalized variant options", async () => {
  const existingVariant = {
    id: "variant-1",
    productId: "product-1",
    sku: "TSHIRT-BLK-M-001",
    displayName: null,
    size: "M",
    color: "Black",
    price: null,
    compareAtPrice: null,
    status: "ACTIVE" as const,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  };

  const service = createCatalogService({
    getProductById: async () => product,
    getVariantsByProduct: async () => [existingVariant],
  });

  await assert.rejects(
    service.createVariant({
      productId: "product-1",
      sku: "TSHIRT-BLK-M-002",
      size: " m ",
      color: " black ",
      status: "ACTIVE",
    }),
    (error: unknown) =>
      error instanceof CatalogServiceError && error.code === "INVALID_VARIANT",
  );
});

test("service rejects archived product publication", async () => {
  const archived = { ...product, status: "ARCHIVED" as const };
  const service = createCatalogService({
    getProductDetails: async () => ({
      ...archived,
      variants: [],
      images: [],
      categories: [],
      collections: [],
      tags: [],
    }),
  });

  await assert.rejects(
    service.publishProduct("product-1"),
    (error: unknown) =>
      error instanceof CatalogServiceError && error.code === "PRODUCT_NOT_PUBLISHABLE",
  );
});

test("service reports deterministic publication readiness without mutating status", async () => {
  const service = createCatalogService({
    getProductDetails: async () => ({
      ...product,
      variants: [],
      images: [],
      categories: [],
      collections: [],
      tags: [],
    }),
  });

  const result = await service.isPublishable("product-1");
  assert.equal(result.publishable, false);
  assert.ok(result.issues.some((issue) => issue.code === "VARIANT_REQUIRED"));
  assert.ok(result.issues.some((issue) => issue.code === "PRODUCT_IMAGE_REQUIRED"));
});
