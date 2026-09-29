import test from "node:test";
import assert from "node:assert/strict";
import {
  findDuplicateOptionCombinations,
  normalizeOptionDisplayValue,
  normalizeOptionIdentity,
  normalizeOptionTypeName,
  validateOptionType,
  validateOptionValue,
  validateProductOptionAssignments,
  validateVariantUniqueness,
} from "../lib/catalog/validation.ts";
import { createCatalogService } from "../lib/catalog/service.ts";

test("option types normalize names without losing display labels", () => {
  assert.equal(normalizeOptionTypeName("  Product   Size "), "Product Size");
  assert.equal(normalizeOptionIdentity("Dark Navy Blue"), "dark-navy-blue");
  assert.equal(normalizeOptionDisplayValue("  Dark   Navy Blue "), "Dark Navy Blue");
  assert.deepEqual(validateOptionType({ name: "Color", sortOrder: 0 }), []);
});

test("option values retain display data while validating normalized identity", () => {
  assert.deepEqual(
    validateOptionValue({
      optionTypeId: "type-1",
      displayName: "Dark Navy Blue",
      normalizedValue: "dark-navy-blue",
      sortOrder: 0,
      hex: "#001122",
    }),
    [],
  );
  assert.ok(
    validateOptionValue({
      optionTypeId: "type-1",
      displayName: "Dark Navy Blue",
      normalizedValue: "Dark Navy Blue",
    }).some((issue) => issue.code === "INVALID_NORMALIZED_VALUE"),
  );
});

test("a product cannot assign two values from the same option type to one variant", () => {
  const issues = validateProductOptionAssignments([
    { optionTypeId: "size", optionValueId: "m" },
    { optionTypeId: "size", optionValueId: "l" },
  ]);
  assert.ok(issues.some((issue) => issue.code === "DUPLICATE_OPTION_TYPE"));
});

test("variant uniqueness uses canonical option combinations", () => {
  const variants = [
    { productId: "p", sku: "A", status: "ACTIVE" as const, size: null, color: null, optionValueIds: ["color-black", "size-m"] },
    { productId: "p", sku: "B", status: "ACTIVE" as const, size: null, color: null, optionValueIds: ["size-m", "color-black"] },
  ];
  assert.deepEqual(findDuplicateOptionCombinations(variants), [[0, 1]]);
  assert.equal(validateVariantUniqueness(variants).length, 1);
});

test("option type and value creation remain inside CatalogService boundaries", async () => {
  const calls: string[] = [];
  const service = createCatalogService({
    getOptionTypeByNormalizedName: async () => null,
    createOptionType: async (data) => {
      calls.push("createOptionType");
      return data;
    },
    getOptionTypeById: async () => ({ id: "type-1", name: "Color", normalizedName: "color", sortOrder: 0 }),
    getOptionValueByIdentity: async () => null,
    createOptionValue: async (data) => {
      calls.push("createOptionValue");
      return data;
    },
  } as unknown as Parameters<typeof createCatalogService>[0]);

  const type = await service.createOptionType({ name: " Color ", sortOrder: 0 });
  const value = await service.createOptionValue({
    optionTypeId: type.id,
    displayName: "Dark Navy Blue",
    normalizedValue: "Dark Navy Blue",
  });

  assert.equal(type.name, "Color");
  assert.equal(value.displayName, "Dark Navy Blue");
  assert.equal(value.normalizedValue, "dark-navy-blue");
  assert.deepEqual(calls, ["createOptionType", "createOptionValue"]);
});

test("product option assignments require existing canonical option types", async () => {
  const service = createCatalogService({
    getProductById: async () => ({ id: "product-1" }),
    getOptionTypeById: async () => ({ id: "color", name: "Color" }),
    assignProductOptionType: async (productId, optionTypeId, sortOrder) => ({ productId, optionTypeId, sortOrder }),
  } as unknown as Parameters<typeof createCatalogService>[0]);

  const result = await service.assignProductOptionType("product-1", "color", 1);
  assert.deepEqual(result, { productId: "product-1", optionTypeId: "color", sortOrder: 1 });
});
