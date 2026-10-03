import type { FeatureFlagEvaluationContext, FeatureFlagEvaluationResult } from "./service";

export interface FeatureFlagProviderAdapter {
  evaluateFlag(
    key: string,
    context: FeatureFlagEvaluationContext,
  ): Promise<FeatureFlagEvaluationResult | null>;
}

/**
 * The internal database-backed evaluator is canonical in Phase 15.11.
 * This interface exists only as a future isolation boundary; no vendor SDK
 * or remote provider is required for application operation.
 */
