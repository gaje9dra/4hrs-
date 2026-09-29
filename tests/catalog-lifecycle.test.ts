import test from "node:test";
import assert from "node:assert/strict";
import {
  PRODUCT_LIFECYCLE_TRANSITIONS,
  assertProductLifecycleTransition,
  createCatalogLifecycleService,
} from "../lib/catalog/lifecycle.ts";
import { CatalogServiceError } from "../lib/catalog/errors.ts";
import type { CatalogRepositoryClient } from "../lib/catalog/repository.ts";

const baseProduct = {
  id: "product-1",
  title: "Oversized Graphic T-Shirt",
  slug: "oversized-graphic-t-shirt",
  description: null,
  shortDescription: null,
  status: "DRAFT" as const,
  price: { toString: () => "999.00" },
  compareAtPrice: null,
  currency: "INR",
  seoTitle: null,
  seoDescription: null,
  variants: [{
    id: "variant-1",
    productId: "product-1",
    sku: "TSHIRT-M-001",
    displayName: null,
    size: "M",
    color: "Black",
    price: null,
    compareAtPrice: null,
    status: "ACTIVE" as const,
    optionValues: [],
  }],
  images: [{
    id: "image-1",
    productId: "product-1",
    variantId: null,
    url: "https://cdn.example.com/shirt.jpg",
    storageReference: null,
    mediaType: "IMAGE" as const,
    altText: "shirt",
    sortOrder: 0,
    isPrimary: true,
  }],
};

test("documents the canonical three-state lifecycle", () => {
  assert.deepEqual(PRODUCT_LIFECYCLE_TRANSITIONS.DRAFT, ["DRAFT", "ACTIVE", "ARCHIVED"]);
  assert.deepEqual(PRODUCT_LIFECYCLE_TRANSITIONS.ACTIVE, ["ACTIVE", "DRAFT", "ARCHIVED"]);
  assert.deepEqual(PRODUCT_LIFECYCLE_TRANSITIONS.ARCHIVED, ["ARCHIVED", "DRAFT"]);
});

test("rejects unsupported lifecycle transitions with a domain error", () => {
  assert.throws(
    () => assertProductLifecycleTransition("ARCHIVED", "ACTIVE"),
    (error: unknown) =>
      error instanceof CatalogServiceError &&
      error.code === "INVALID_STATUS_TRANSITION",
  );
});

test("repeated transitions are deterministic no-ops without audit duplication", async () => {
  let product: typeof baseProduct & { status: "DRAFT" | "ACTIVE" | "ARCHIVED" } = { ...baseProduct, status: "ACTIVE" };
  const audits: unknown[] = [];
  const repository = {
    async getProductById() {
      return product;
    },
    async getProductDetails() {
      return product;
    },
    async transitionProductStatus(_id: string, from: "DRAFT" | "ACTIVE" | "ARCHIVED", to: "DRAFT" | "ACTIVE" | "ARCHIVED") {
      if (product.status !== from) return null;
      product = { ...product, status: to };
      return product;
    },
    async withTransaction<T>(callback: (tx: CatalogRepositoryClient) => Promise<T>) {
      return callback({} as CatalogRepositoryClient);
    },
  };
  const lifecycle = createCatalogLifecycleService(
    repository,
    async (event) => {
      audits.push(event);
    },
  );

  const first = await lifecycle.unpublishProduct("product-1");
  const second = await lifecycle.unpublishProduct("product-1");

  assert.equal(first.status, "DRAFT");
  assert.equal(second.status, "DRAFT");
  assert.equal(audits.length, 1);
});

test("publication readiness blocks malformed products before the status transition", async () => {
  let transitionCalls = 0;
  const audits: unknown[] = [];
  const repository = {
    async getProductById() {
      return { ...baseProduct, status: "DRAFT" as const };
    },
    async getProductDetails() {
      return { ...baseProduct, variants: [], images: [] };
    },
    async transitionProductStatus() {
      transitionCalls += 1;
      return null;
    },
    async withTransaction<T>(callback: (tx: CatalogRepositoryClient) => Promise<T>) {
      return callback({} as CatalogRepositoryClient);
    },
  };
  const lifecycle = createCatalogLifecycleService(repository, async (event) => audits.push(event));

  await assert.rejects(
    lifecycle.publishProduct("product-1"),
    (error: unknown) =>
      error instanceof CatalogServiceError &&
      error.code === "NOT_PUBLICATION_READY" &&
      (error.cause as { issues: Array<{ code: string }> }).issues.some((issue) => issue.code === "VARIANT_REQUIRED"),
  );
  assert.equal(transitionCalls, 0);
  assert.equal(audits.length, 0);
});

test("restore returns archived products to DRAFT and records RESTORE", async () => {
  let product: typeof baseProduct & { status: "DRAFT" | "ACTIVE" | "ARCHIVED" } = { ...baseProduct, status: "ARCHIVED" };
  const audits: Array<{ operation: string }> = [];
  const repository = {
    async getProductById() {
      return product;
    },
    async getProductDetails() {
      return product;
    },
    async transitionProductStatus(_id: string, from: "DRAFT" | "ACTIVE" | "ARCHIVED", to: "DRAFT" | "ACTIVE" | "ARCHIVED") {
      if (product.status !== from) return null;
      product = { ...product, status: to };
      return product;
    },
    async withTransaction<T>(callback: (tx: CatalogRepositoryClient) => Promise<T>) {
      return callback({} as CatalogRepositoryClient);
    },
  };
  const lifecycle = createCatalogLifecycleService(repository, async (event) => audits.push({ operation: event.operation }));

  const restored = await lifecycle.restoreProduct("product-1");

  assert.equal(restored.status, "DRAFT");
  assert.deepEqual(audits, [{ operation: "RESTORE" }]);
});
