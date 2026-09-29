import test from "node:test";
import assert from "node:assert/strict";
import { createCatalogService } from "../lib/catalog/service.ts";
import {
  normalizeAltText,
  validateImage,
  validateImageAssetUniqueness,
} from "../lib/catalog/validation.ts";
import { CatalogServiceError } from "../lib/catalog/errors.ts";

test("media validation accepts canonical HTTPS image media with optional storage reference", () => {
  assert.deepEqual(
    validateImage({
      productId: "product-1",
      url: "https://cdn.example.com/products/shirt.webp",
      storageReference: "products/shirt.webp",
      altText: "  Oversized   graphic T-shirt  ",
      sortOrder: 0,
      isPrimary: true,
    }),
    [],
  );
  assert.equal(normalizeAltText("  Oversized   graphic T-shirt  "), "Oversized graphic T-shirt");
});

test("media validation rejects unsafe URLs, unsupported media types, and malformed storage references", () => {
  const issues = validateImage({
    productId: "product-1",
    url: "javascript:alert(1)",
    storageReference: "bad reference",
    mediaType: "VIDEO" as never,
    altText: "<img src=x>",
    sortOrder: -1,
    isPrimary: false,
  });

  assert.ok(issues.some((issue) => issue.code === "INVALID_IMAGE_URL"));
  assert.ok(issues.some((issue) => issue.code === "INVALID_ASSET_REFERENCE"));
  assert.ok(issues.some((issue) => issue.code === "UNSUPPORTED_MEDIA_TYPE"));
  assert.ok(issues.some((issue) => issue.code === "INVALID_ALT_TEXT"));
  assert.ok(issues.some((issue) => issue.code === "INVALID_SORT_ORDER"));
});

test("variant media cannot be marked as the canonical product primary", () => {
  const issues = validateImage({
    variantId: "variant-1",
    url: "https://cdn.example.com/variant.webp",
    sortOrder: 0,
    isPrimary: true,
  });
  assert.ok(issues.some((issue) => issue.code === "INVALID_PRIMARY_IMAGE_OWNER"));
});

test("media validation requires exactly one canonical owner", () => {
  assert.ok(
    validateImage({
      productId: "product-1",
      variantId: "variant-1",
      url: "https://cdn.example.com/image.webp",
      sortOrder: 0,
      isPrimary: false,
    }).some((issue) => issue.code === "INVALID_IMAGE_OWNER"),
  );
});

test("duplicate media references are rejected per canonical owner", () => {
  const issues = validateImageAssetUniqueness([
    {
      productId: "product-1",
      url: "https://cdn.example.com/a.webp",
      storageReference: "products/a.webp",
      sortOrder: 0,
      isPrimary: true,
    },
    {
      productId: "product-1",
      url: "https://cdn.example.com/a-copy.webp",
      storageReference: "products/a.webp",
      sortOrder: 1,
      isPrimary: false,
    },
    {
      productId: "product-1",
      url: "https://cdn.example.com/a.webp",
      storageReference: "products/a-duplicate.webp",
      sortOrder: 2,
      isPrimary: false,
    },
  ]);

  assert.equal(issues.length, 2);
  assert.ok(issues.every((issue) => issue.code === "DUPLICATE_MEDIA"));
});

test("CatalogService adds product media without coupling to storage providers", async () => {
  const calls: string[] = [];
  const service = createCatalogService({
    getProductById: async () => ({ id: "product-1" }),
    getImageById: async () => null,
    listProductImages: async () => [],
    listVariantImages: async () => [],
    updateProductImagesPrimaryState: async () => ({ count: 0 }),
    createImage: async (data: { url: string; storageReference?: string | null; altText?: string | null; sortOrder: number; isPrimary: boolean }) => {
      calls.push("createImage");
      return {
        id: "image-1",
        productId: "product-1",
        variantId: null,
        url: String(data.url),
        storageReference: typeof data.storageReference === "string" ? data.storageReference : null,
        mediaType: "IMAGE",
        altText: typeof data.altText === "string" ? data.altText : null,
        sortOrder: Number(data.sortOrder),
        isPrimary: Boolean(data.isPrimary),
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    },
    withTransaction: async (callback: (tx: never) => Promise<unknown>) => callback({} as never),
  } as unknown as Parameters<typeof createCatalogService>[0]);

  const result = await service.addImage({
    productId: "product-1",
    url: " https://cdn.example.com/shirt.webp ",
    storageReference: " products/shirt.webp ",
    altText: "  Shirt front  ",
    sortOrder: 0,
    isPrimary: true,
  });

  assert.equal(result.url, "https://cdn.example.com/shirt.webp");
  assert.equal(result.storageReference, "products/shirt.webp");
  assert.equal(result.altText, "Shirt front");
  assert.deepEqual(calls, ["createImage"]);
});

test("CatalogService prevents cross-product variant media association", async () => {
  const service = createCatalogService({
    getProductById: async () => ({ id: "product-1" }),
    getVariantById: async () => ({ id: "variant-1", productId: "product-2" }),
  } as unknown as Parameters<typeof createCatalogService>[0]);

  await assert.rejects(
    service.addImage({
      productId: "product-1",
      variantId: "variant-1",
      url: "https://cdn.example.com/variant.webp",
      sortOrder: 0,
      isPrimary: false,
    }),
    (error: unknown) =>
      error instanceof CatalogServiceError && error.code === "INVALID_IMAGE_RELATIONSHIP",
  );
});

test("CatalogService exposes ordered product and variant media DTOs", async () => {
  const date = new Date("2026-01-01T00:00:00.000Z");
  const image = {
    id: "image-1",
    productId: "product-1",
    variantId: null,
    url: "https://cdn.example.com/shirt.webp",
    storageReference: "products/shirt.webp",
    mediaType: "IMAGE" as const,
    altText: "Shirt",
    sortOrder: 0,
    isPrimary: true,
    createdAt: date,
    updatedAt: date,
  };

  const service = createCatalogService({
    getProductById: async () => ({ id: "product-1" }),
    getVariantById: async () => ({ id: "variant-1", productId: "product-1" }),
    listProductImages: async () => [image],
    listVariantImages: async () => [{ ...image, productId: null, variantId: "variant-1", isPrimary: false }],
    getPrimaryProductImage: async () => image,
  } as unknown as Parameters<typeof createCatalogService>[0]);

  assert.deepEqual(await service.getProductMedia("product-1"), [image]);
  assert.deepEqual(await service.getVariantMedia("variant-1"), [{ ...image, productId: null, variantId: "variant-1", isPrimary: false }]);
  assert.deepEqual(await service.getPrimaryProductMedia("product-1"), image);
});
