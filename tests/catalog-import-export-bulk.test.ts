import test from "node:test";
import assert from "node:assert/strict";
import {
  CatalogImportError,
  CATALOG_IMPORT_MAX_PRODUCTS,
  parseCatalogImportJson,
} from "../lib/catalog/import.ts";
import { executeCatalogBulkOperations } from "../lib/catalog/bulk.ts";

test("catalog import parser accepts the canonical JSON envelope", () => {
  const payload = parseCatalogImportJson(JSON.stringify({
    version: 1,
    namespace: "manual",
    products: [{
      externalReference: "product-1",
      title: "  Oversized Tee  ",
      slug: "oversized-tee",
      status: "DRAFT",
      price: "999.00",
      compareAtPrice: null,
      currency: "INR",
    }],
  }));

  assert.equal(payload.version, 1);
  assert.equal(payload.namespace, "manual");
  assert.equal(payload.products.length, 1);
});

test("catalog import parser rejects malformed JSON with a structured error", () => {
  assert.throws(
    () => parseCatalogImportJson("{"),
    (error: unknown) =>
      error instanceof CatalogImportError &&
      error.issues[0]?.code === "MALFORMED_INPUT",
  );
});

test("catalog import bounds are explicit", () => {
  assert.equal(CATALOG_IMPORT_MAX_PRODUCTS, 1000);
});

test("bulk validation operation uses the canonical product validator", async () => {
  const result = await executeCatalogBulkOperations([
    {
      type: "VALIDATE_PRODUCT",
      product: {
        title: "",
        slug: "",
        status: "DRAFT",
        price: "-1",
        currency: "inr",
      },
    },
  ]);

  assert.equal(result.total, 1);
  assert.equal(result.succeeded, 0);
  assert.equal(result.failed, 1);
  assert.ok(result.results[0].issues.length > 0);
});

test("bulk operations can continue after a validation failure", async () => {
  const result = await executeCatalogBulkOperations([
    {
      type: "VALIDATE_PRODUCT",
      product: {
        title: "",
        slug: "",
        status: "DRAFT",
        price: "-1",
        currency: "inr",
      },
    },
    {
      type: "VALIDATE_PRODUCT",
      product: {
        title: "Valid Tee",
        slug: "valid-tee",
        status: "DRAFT",
        price: "999",
        currency: "INR",
      },
    },
  ]);

  assert.equal(result.succeeded, 1);
  assert.equal(result.failed, 1);
  assert.equal(result.skipped, 0);
});
