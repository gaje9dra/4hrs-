import assert from "node:assert/strict";
import test from "node:test";
import { normalizeProviderId, validateProviderMappingInput } from "@/lib/fulfillment/mapping-service";

test("provider mapping normalizes provider identifiers", () => {
  assert.equal(normalizeProviderId(" QIKINK "), "qikink");
});

test("provider mapping rejects malformed provider identifiers", () => {
  assert.throws(() => normalizeProviderId("Qikink Provider"), /invalid/i);
});

test("provider mapping requires a bounded provider SKU", () => {
  assert.throws(() => validateProviderMappingInput({ providerId: "qikink", providerSku: " " }), /SKU is invalid/i);
  assert.throws(() => validateProviderMappingInput({ providerId: "qikink", providerSku: "x".repeat(121) }), /SKU is invalid/i);
});

test("provider mapping accepts an optional external variant reference", () => {
  assert.doesNotThrow(() => validateProviderMappingInput({
    providerId: "qikink",
    providerSku: "QK-TEE-M",
    providerVariantReference: "external-123",
  }));
});

test("store SKU is not part of provider mapping input", () => {
  assert.doesNotThrow(() => validateProviderMappingInput({
    providerId: "qikink",
    providerSku: "QK-TEE-M",
  }));
});
