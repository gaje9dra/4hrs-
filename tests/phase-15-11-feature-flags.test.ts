import assert from "node:assert/strict";
import test from "node:test";
import {
  deterministicBucket,
  stableSubject,
  validateFeatureFlagInput,
  validateExperimentInput,
} from "@/lib/feature-flags/service";
import { ANALYTICS_EVENT_CATALOG } from "@/lib/analytics/events";

test("deterministic rollout hashing is stable and namespaced", () => {
  const first = deterministicBucket("homepage_v2", "subject-1");
  const second = deterministicBucket("homepage_v2", "subject-1");
  const differentNamespace = deterministicBucket("checkout_v2", "subject-1");
  assert.equal(first, second);
  assert.ok(first >= 0 && first < 10_000);
  assert.notEqual(first, differentNamespace);
});

test("stable subject prefers authenticated customer identity", () => {
  const subject = stableSubject({ customerId: "customer-1", anonymousId: "anonymous-1" });
  assert.equal(subject?.type, "CUSTOMER");
  assert.equal(subject?.hash.length, 64);
});

test("anonymous subject requires a bounded safe identifier", () => {
  const subject = stableSubject({ anonymousId: "session_123" });
  assert.equal(subject?.type, "ANONYMOUS");
  assert.equal(stableSubject({ anonymousId: "bad value" }), null);
});

test("boolean feature flags validate percentage boundaries", () => {
  const flag = validateFeatureFlagInput({
    key: "homepage-v2",
    name: "Homepage V2",
    description: "Safe presentation rollout",
    type: "BOOLEAN",
    environment: "PRODUCTION",
    lifecycle: "DRAFT",
    defaultEnabled: false,
    rolloutPercentage: 10,
  });
  assert.equal(flag.rolloutPercentage, 10);
  assert.equal(flag.defaultEnabled, false);
});

test("multivariant allocations must total exactly 100%", () => {
  assert.throws(() => validateFeatureFlagInput({
    key: "card-experiment",
    name: "Card Experiment",
    type: "MULTIVARIANT",
    environment: "PRODUCTION",
    defaultVariantKey: "control",
    rolloutPercentage: 100,
    variants: [
      { key: "control", weightPercentage: 40 },
      { key: "variant_a", weightPercentage: 40 },
    ],
  }));
});

test("experiment allocations and lifecycle validate", () => {
  const experiment = validateExperimentInput({
    key: "product-card-copy",
    name: "Product Card Copy",
    environment: "STAGING",
    status: "ACTIVE",
    variants: [
      { key: "control", weightPercentage: 50 },
      { key: "variant_a", weightPercentage: 50 },
    ],
    primaryMetricEvent: "ADD_TO_CART",
  });
  assert.equal(experiment.variants.length, 2);
  assert.equal(experiment.primaryMetricEvent, "ADD_TO_CART");
});

test("experiment exposure uses the Phase 15.10 event catalog", () => {
  assert.deepEqual(ANALYTICS_EVENT_CATALOG.EXPERIMENT_EXPOSURE, {
    version: 1,
    properties: ["experimentKey", "experimentVersion", "variantKey", "subjectType"],
  });
});

test("unsafe flag keys are rejected", () => {
  assert.throws(() => validateFeatureFlagInput({
    key: "Bad Flag",
    name: "Bad Flag",
    type: "BOOLEAN",
    environment: "PRODUCTION",
  }));
});
