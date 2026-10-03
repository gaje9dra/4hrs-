import { Prisma, type FeatureFlagEnvironment, type FeatureFlagLifecycle, type FeatureFlagType, type ExperimentStatus, type ExperimentSubjectType } from "@prisma/client";
import { createHash } from "node:crypto";
import { db } from "@/lib/db/client";
import { recordAnalyticsEvent } from "@/lib/analytics/events";
import { incrementMetric, observeMetric } from "@/lib/observability/metrics";

export const ROLLOUT_BASIS_POINTS = 10_000;
export const FLAG_KEY_PATTERN = /^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/;
export const VARIANT_KEY_PATTERN = /^[a-z][a-z0-9_-]{0,63}$/;

export type FeatureFlagEvaluationContext = {
  environment?: FeatureFlagEnvironment;
  customerId?: string;
  anonymousId?: string;
  locale?: string;
};

export type FeatureFlagEvaluationResult = {
  key: string;
  type: FeatureFlagType;
  enabled: boolean;
  variantKey: string | null;
  flagVersion: number | null;
  source: "CONFIGURED" | "DEFAULT" | "ERROR";
  reason: string;
};

export type ExperimentEvaluationContext = {
  environment?: FeatureFlagEnvironment;
  customerId?: string;
  anonymousId?: string;
  locale?: string;
};

export type ExperimentEvaluationResult = {
  key: string;
  variantKey: string | null;
  experimentVersion: number | null;
  subjectType: ExperimentSubjectType | null;
  source: "ASSIGNED" | "DEFAULT" | "INACTIVE" | "ERROR";
  reason: string;
};

export class FeatureFlagError extends Error {
  constructor(
    public readonly code:
      | "INVALID_KEY"
      | "INVALID_CONFIGURATION"
      | "NOT_FOUND"
      | "CONFLICT"
      | "DATABASE_ERROR",
    message: string,
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = "FeatureFlagError";
  }
}

function validKey(value: unknown, pattern: RegExp, maxLength: number): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= maxLength && pattern.test(value);
}

export function normalizeEnvironment(value?: string): FeatureFlagEnvironment {
  const explicit = value ?? process.env.FEATURE_FLAG_ENVIRONMENT;
  if (explicit === "DEVELOPMENT" || explicit === "TEST" || explicit === "STAGING" || explicit === "PRODUCTION") return explicit;
  if (process.env.NODE_ENV === "test") return "TEST";
  if (process.env.NODE_ENV === "production") return "PRODUCTION";
  return "DEVELOPMENT";
}

export function deterministicBucket(namespace: string, subject: string): number {
  const digest = createHash("sha256").update(namespace).update("\0").update(subject).digest("hex");
  return Number.parseInt(digest.slice(0, 8), 16) % ROLLOUT_BASIS_POINTS;
}

export function stableSubject(context: FeatureFlagEvaluationContext | ExperimentEvaluationContext): { hash: string; type: ExperimentSubjectType } | null {
  if (context.customerId) {
    const hash = createHash("sha256").update("customer\0").update(context.customerId).digest("hex");
    return { hash, type: "CUSTOMER" };
  }
  if (context.anonymousId && /^[A-Za-z0-9_-]{1,64}$/.test(context.anonymousId)) {
    const hash = createHash("sha256").update("anonymous\0").update(context.anonymousId).digest("hex");
    return { hash, type: "ANONYMOUS" };
  }
  return null;
}

function validatePercentage(value: unknown): number {
  if (!Number.isInteger(value) || value < 0 || value > 100) throw new FeatureFlagError("INVALID_CONFIGURATION", "Rollout percentage must be an integer from 0 to 100.");
  return value;
}

function validateVariants(variants: Array<{ key: string; weightPercentage: number }>): Array<{ key: string; weightBasisPoints: number }> {
  if (variants.length < 2 || variants.length > 8) throw new FeatureFlagError("INVALID_CONFIGURATION", "A multivariant configuration requires 2 to 8 variants.");
  const seen = new Set<string>();
  let total = 0;
  const normalized = variants.map((variant) => {
    if (!validKey(variant.key, VARIANT_KEY_PATTERN, 64)) throw new FeatureFlagError("INVALID_CONFIGURATION", "Variant key is invalid.");
    if (seen.has(variant.key)) throw new FeatureFlagError("INVALID_CONFIGURATION", "Variant keys must be unique.");
    seen.add(variant.key);
    if (!Number.isInteger(variant.weightPercentage) || variant.weightPercentage < 0 || variant.weightPercentage > 100) {
      throw new FeatureFlagError("INVALID_CONFIGURATION", "Variant allocation must be an integer percentage from 0 to 100.");
    }
    const weightBasisPoints = variant.weightPercentage * 100;
    total += weightBasisPoints;
    return { key: variant.key, weightBasisPoints };
  });
  if (total !== ROLLOUT_BASIS_POINTS) throw new FeatureFlagError("INVALID_CONFIGURATION", "Variant allocations must total exactly 100%.");
  if (normalized.every((variant) => variant.weightBasisPoints === 0)) throw new FeatureFlagError("INVALID_CONFIGURATION", "At least one variant must have non-zero allocation.");
  return normalized;
}

function selectWeightedVariant(
  namespace: string,
  subject: { hash: string } | null,
  variants: Array<{ key: string; weightBasisPoints: number }>,
): string | null {
  if (!subject) return null;
  const bucket = deterministicBucket(namespace, subject.hash);
  let cumulative = 0;
  for (const variant of variants) {
    cumulative += variant.weightBasisPoints;
    if (bucket < cumulative) return variant.key;
  }
  return variants.at(-1)?.key ?? null;
}

function safeFlagFallback(flag: { defaultEnabled: boolean; defaultVariantKey: string | null; type: FeatureFlagType; version: number } | null, reason: string): FeatureFlagEvaluationResult {
  return {
    key: "",
    type: flag?.type ?? "BOOLEAN",
    enabled: flag?.defaultEnabled ?? false,
    variantKey: flag?.defaultVariantKey ?? null,
    flagVersion: flag?.version ?? null,
    source: flag ? "DEFAULT" : "ERROR",
    reason,
  };
}

export async function evaluateFeatureFlag(key: string, context: FeatureFlagEvaluationContext = {}): Promise<FeatureFlagEvaluationResult> {
  if (!validKey(key, FLAG_KEY_PATTERN, 100)) throw new FeatureFlagError("INVALID_KEY", "Feature flag key is invalid.");
  const environment = context.environment ?? normalizeEnvironment();
  const started = performance.now();
  try {
    const flag = await db.featureFlag.findUnique({
      where: { key_environment: { key, environment } },
      include: { variants: { orderBy: { key: "asc" } } },
    });
    if (!flag) return { ...safeFlagFallback(null, "FLAG_NOT_FOUND"), key };
    if (flag.lifecycle !== "ACTIVE") return { ...safeFlagFallback(flag, "LIFECYCLE_FALLBACK"), key };
    if (flag.expiresAt && flag.expiresAt <= new Date()) return { ...safeFlagFallback(flag, "EXPIRED_FALLBACK"), key };

    if (flag.type === "BOOLEAN") {
      const subject = stableSubject(context);
      const enabled = flag.rolloutPercentage >= 100
        ? true
        : flag.rolloutPercentage <= 0 || !subject
          ? flag.defaultEnabled
          : deterministicBucket(key, subject.hash) < flag.rolloutPercentage * 100;
      incrementMetric("feature_flag_evaluations_total", { operation: "evaluated", environment, category: key });
      return { key, type: flag.type, enabled, variantKey: null, flagVersion: flag.version, source: "CONFIGURED", reason: enabled ? "ROLLOUT_ENABLED" : "ROLLOUT_DISABLED" };
    }

    const subject = stableSubject(context);
    const variantKey = selectWeightedVariant(key, subject, flag.variants);
    const enabled = variantKey !== null;
    incrementMetric("feature_flag_evaluations_total", { operation: "evaluated", environment, category: key });
    return { key, type: flag.type, enabled, variantKey: variantKey ?? flag.defaultVariantKey, flagVersion: flag.version, source: variantKey ? "CONFIGURED" : "DEFAULT", reason: variantKey ? "VARIANT_ASSIGNED" : "NO_STABLE_SUBJECT" };
  } catch (error) {
    incrementMetric("feature_flag_evaluations_total", { operation: "error", environment });
    const fallback = safeFlagFallback(null, "EVALUATION_ERROR");
    observeMetric("feature_flag_evaluation_latency_ms", performance.now() - started, { environment });
    return { ...fallback, key };
  } finally {
    observeMetric("feature_flag_evaluation_latency_ms", performance.now() - started, { environment });
  }
}

export function validateFeatureFlagInput(input: {
  key: unknown;
  name: unknown;
  type: unknown;
  lifecycle?: unknown;
  environment: unknown;
  defaultEnabled?: unknown;
  defaultVariantKey?: unknown;
  rolloutPercentage?: unknown;
  expiresAt?: unknown;
  variants?: unknown;
}) {
  if (!validKey(input.key, FLAG_KEY_PATTERN, 100)) throw new FeatureFlagError("INVALID_KEY", "Feature flag key is invalid.");
  if (typeof input.name !== "string" || input.name.trim().length < 2 || input.name.trim().length > 160) throw new FeatureFlagError("INVALID_CONFIGURATION", "Feature flag name is invalid.");
  if (input.type !== "BOOLEAN" && input.type !== "MULTIVARIANT") throw new FeatureFlagError("INVALID_CONFIGURATION", "Feature flag type is invalid.");
  if (input.lifecycle !== undefined && !["DRAFT","ACTIVE","PAUSED","DEPRECATED","RETIRED"].includes(String(input.lifecycle))) throw new FeatureFlagError("INVALID_CONFIGURATION", "Feature flag lifecycle is invalid.");
  if (!["DEVELOPMENT","TEST","STAGING","PRODUCTION"].includes(String(input.environment))) throw new FeatureFlagError("INVALID_CONFIGURATION", "Feature flag environment is invalid.");
  const rolloutPercentage = validatePercentage(input.rolloutPercentage ?? 0);
  const defaultEnabled = input.defaultEnabled === undefined ? false : input.defaultEnabled;
  if (typeof defaultEnabled !== "boolean") throw new FeatureFlagError("INVALID_CONFIGURATION", "Default enabled value is invalid.");
  let variants: Array<{ key: string; weightBasisPoints: number }> = [];
  if (input.type === "MULTIVARIANT") {
    if (!Array.isArray(input.variants)) throw new FeatureFlagError("INVALID_CONFIGURATION", "Multivariant flags require variants.");
    variants = validateVariants(input.variants.map((value) => {
      if (!value || typeof value !== "object") throw new FeatureFlagError("INVALID_CONFIGURATION", "Variant is invalid.");
      const item = value as Record<string, unknown>;
      return { key: item.key as string, weightPercentage: item.weightPercentage as number };
    }));
    if (typeof input.defaultVariantKey !== "string" || !variants.some((variant) => variant.key === input.defaultVariantKey)) {
      throw new FeatureFlagError("INVALID_CONFIGURATION", "Default variant must reference a configured variant.");
    }
  }
  let expiresAt: Date | null = null;
  if (input.expiresAt !== undefined && input.expiresAt !== null) {
    if (typeof input.expiresAt !== "string") throw new FeatureFlagError("INVALID_CONFIGURATION", "Expiration must be an ISO timestamp.");
    expiresAt = new Date(input.expiresAt);
    if (Number.isNaN(expiresAt.getTime())) throw new FeatureFlagError("INVALID_CONFIGURATION", "Expiration timestamp is invalid.");
  }
  return {
    key: input.key,
    name: input.name.trim(),
    description: typeof input.description === "string" ? input.description.trim().slice(0, 1000) : null,
    type: input.type as FeatureFlagType,
    lifecycle: (input.lifecycle ?? "DRAFT") as FeatureFlagLifecycle,
    environment: input.environment as FeatureFlagEnvironment,
    defaultEnabled,
    defaultVariantKey: typeof input.defaultVariantKey === "string" ? input.defaultVariantKey : null,
    rolloutPercentage,
    expiresAt,
    variants,
  };
}

export async function createFeatureFlag(input: Parameters<typeof validateFeatureFlagInput>[0]) {
  const value = validateFeatureFlagInput(input);
  try {
    return await db.$transaction(async (tx) => {
      const flag = await tx.featureFlag.create({
        data: {
          key: value.key,
          name: value.name,
          description: value.description,
          type: value.type,
          lifecycle: value.lifecycle,
          environment: value.environment,
          defaultEnabled: value.defaultEnabled,
          defaultVariantKey: value.defaultVariantKey,
          rolloutPercentage: value.rolloutPercentage,
          expiresAt: value.expiresAt,
          variants: value.variants.length ? { create: value.variants } : undefined,
        },
        include: { variants: true },
      });
      return flag;
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw new FeatureFlagError("CONFLICT", "A feature flag with this key already exists in the environment.");
    throw new FeatureFlagError("DATABASE_ERROR", "Feature flag could not be created safely.", { cause: error });
  }
}

export async function updateFeatureFlag(id: string, expectedVersion: number, input: Parameters<typeof validateFeatureFlagInput>[0]) {
  const value = validateFeatureFlagInput(input);
  try {
    return await db.$transaction(async (tx) => {
      const current = await tx.featureFlag.findUnique({ where: { id }, include: { variants: true } });
      if (!current) throw new FeatureFlagError("NOT_FOUND", "Feature flag was not found.");
      if (current.version !== expectedVersion) throw new FeatureFlagError("CONFLICT", "Feature flag changed since it was read.");
      await tx.featureFlag.updateMany({ where: { id, version: expectedVersion }, data: { key: value.key, name: value.name, description: value.description, type: value.type, lifecycle: value.lifecycle, environment: value.environment, defaultEnabled: value.defaultEnabled, defaultVariantKey: value.defaultVariantKey, rolloutPercentage: value.rolloutPercentage, expiresAt: value.expiresAt, version: { increment: 1 } } });
      await tx.featureFlagVariant.deleteMany({ where: { flagId: id } });
      if (value.variants.length) await tx.featureFlagVariant.createMany({ data: value.variants.map((variant) => ({ ...variant, flagId: id })) });
      return tx.featureFlag.findUniqueOrThrow({ where: { id }, include: { variants: true } });
    });
  } catch (error) {
    if (error instanceof FeatureFlagError) throw error;
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw new FeatureFlagError("CONFLICT", "A feature flag with this key already exists in the environment.");
    throw new FeatureFlagError("DATABASE_ERROR", "Feature flag could not be updated safely.", { cause: error });
  }
}

export async function listFeatureFlags(environment?: FeatureFlagEnvironment) {
  return db.featureFlag.findMany({ where: environment ? { environment } : undefined, include: { variants: true }, orderBy: [{ environment: "asc" }, { key: "asc" }] });
}

export async function getFeatureFlag(id: string) {
  return db.featureFlag.findUnique({ where: { id }, include: { variants: true } });
}

function experimentIsActive(experiment: { status: ExperimentStatus; startAt: Date | null; endAt: Date | null }, now = new Date()): boolean {
  return experiment.status === "ACTIVE" && (!experiment.startAt || experiment.startAt <= now) && (!experiment.endAt || experiment.endAt > now);
}

export function validateExperimentInput(input: {
  key: unknown;
  name: unknown;
  description?: unknown;
  environment: unknown;
  status?: unknown;
  startAt?: unknown;
  endAt?: unknown;
  primaryMetricEvent?: unknown;
  variants?: unknown;
}) {
  if (!validKey(input.key, FLAG_KEY_PATTERN, 100)) throw new FeatureFlagError("INVALID_KEY", "Experiment key is invalid.");
  if (typeof input.name !== "string" || input.name.trim().length < 2 || input.name.trim().length > 160) throw new FeatureFlagError("INVALID_CONFIGURATION", "Experiment name is invalid.");
  if (!["DEVELOPMENT","TEST","STAGING","PRODUCTION"].includes(String(input.environment))) throw new FeatureFlagError("INVALID_CONFIGURATION", "Experiment environment is invalid.");
  if (input.status !== undefined && !["DRAFT","ACTIVE","PAUSED","COMPLETED","RETIRED"].includes(String(input.status))) throw new FeatureFlagError("INVALID_CONFIGURATION", "Experiment status is invalid.");
  if (input.primaryMetricEvent !== undefined && input.primaryMetricEvent !== null && !validKey(input.primaryMetricEvent, FLAG_KEY_PATTERN, 64)) throw new FeatureFlagError("INVALID_CONFIGURATION", "Primary metric event reference is invalid.");
  const parseDate = (value: unknown) => {
    if (value === undefined || value === null) return null;
    if (typeof value !== "string") throw new FeatureFlagError("INVALID_CONFIGURATION", "Experiment dates must be ISO timestamps.");
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) throw new FeatureFlagError("INVALID_CONFIGURATION", "Experiment date is invalid.");
    return date;
  };
  const startAt = parseDate(input.startAt);
  const endAt = parseDate(input.endAt);
  if (startAt && endAt && startAt >= endAt) throw new FeatureFlagError("INVALID_CONFIGURATION", "Experiment end must be after start.");
  if (!Array.isArray(input.variants)) throw new FeatureFlagError("INVALID_CONFIGURATION", "Experiments require variants.");
  const variants = validateVariants(input.variants.map((value) => {
    if (!value || typeof value !== "object") throw new FeatureFlagError("INVALID_CONFIGURATION", "Experiment variant is invalid.");
    const item = value as Record<string, unknown>;
    return { key: item.key as string, weightPercentage: item.weightPercentage as number };
  }));
  return {
    key: input.key,
    name: input.name.trim(),
    description: typeof input.description === "string" ? input.description.trim().slice(0, 1000) : null,
    environment: input.environment as FeatureFlagEnvironment,
    status: (input.status ?? "DRAFT") as ExperimentStatus,
    startAt,
    endAt,
    primaryMetricEvent: typeof input.primaryMetricEvent === "string" ? input.primaryMetricEvent : null,
    variants,
  };
}

export async function createExperiment(input: Parameters<typeof validateExperimentInput>[0]) {
  const value = validateExperimentInput(input);
  try {
    return await db.$transaction(async (tx) => tx.experiment.create({ data: { key: value.key, name: value.name, description: value.description, environment: value.environment, status: value.status, startAt: value.startAt, endAt: value.endAt, primaryMetricEvent: value.primaryMetricEvent, variants: { create: value.variants } }, include: { variants: true } }));
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw new FeatureFlagError("CONFLICT", "An experiment with this key already exists.");
    throw new FeatureFlagError("DATABASE_ERROR", "Experiment could not be created safely.", { cause: error });
  }
}

export async function updateExperiment(id: string, expectedVersion: number, input: Parameters<typeof validateExperimentInput>[0]) {
  const value = validateExperimentInput(input);
  try {
    return await db.$transaction(async (tx) => {
      const current = await tx.experiment.findUnique({ where: { id }, include: { variants: true } });
      if (!current) throw new FeatureFlagError("NOT_FOUND", "Experiment was not found.");
      if (current.version !== expectedVersion) throw new FeatureFlagError("CONFLICT", "Experiment changed since it was read.");
      await tx.experiment.updateMany({ where: { id, version: expectedVersion }, data: { key: value.key, name: value.name, description: value.description, environment: value.environment, status: value.status, startAt: value.startAt, endAt: value.endAt, primaryMetricEvent: value.primaryMetricEvent, version: { increment: 1 } } });
      await tx.experimentVariant.deleteMany({ where: { experimentId: id } });
      await tx.experimentVariant.createMany({ data: value.variants.map((variant) => ({ ...variant, experimentId: id })) });
      return tx.experiment.findUniqueOrThrow({ where: { id }, include: { variants: true } });
    });
  } catch (error) {
    if (error instanceof FeatureFlagError) throw error;
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw new FeatureFlagError("CONFLICT", "An experiment with this key already exists.");
    throw new FeatureFlagError("DATABASE_ERROR", "Experiment could not be updated safely.", { cause: error });
  }
}

export async function listExperiments(environment?: FeatureFlagEnvironment) {
  return db.experiment.findMany({ where: environment ? { environment } : undefined, include: { variants: true }, orderBy: [{ environment: "asc" }, { key: "asc" }] });
}

export async function getExperiment(id: string) {
  return db.experiment.findUnique({ where: { id }, include: { variants: true } });
}

export async function evaluateExperiment(key: string, context: ExperimentEvaluationContext = {}): Promise<ExperimentEvaluationResult> {
  if (!validKey(key, FLAG_KEY_PATTERN, 100)) throw new FeatureFlagError("INVALID_KEY", "Experiment key is invalid.");
  const environment = context.environment ?? normalizeEnvironment();
  try {
    const experiment = await db.experiment.findUnique({ where: { key }, include: { variants: { orderBy: { key: "asc" } } } });
    if (!experiment || experiment.environment !== environment) return { key, variantKey: null, experimentVersion: null, subjectType: null, source: "DEFAULT", reason: "NOT_FOUND" };
    if (!experimentIsActive(experiment)) return { key, variantKey: null, experimentVersion: experiment.version, subjectType: null, source: "INACTIVE", reason: "INACTIVE" };
    const subject = stableSubject(context);
    if (!subject) return { key, variantKey: null, experimentVersion: experiment.version, subjectType: null, source: "DEFAULT", reason: "NO_STABLE_SUBJECT" };

    const existing = await db.experimentAssignment.findUnique({ where: { experimentId_subjectHash: { experimentId: experiment.id, subjectHash: subject.hash } } });
    if (existing && existing.experimentVersion === experiment.version && experiment.variants.some((variant) => variant.key === existing.variantKey)) {
      return { key, variantKey: existing.variantKey, experimentVersion: experiment.version, subjectType: existing.subjectType, source: "ASSIGNED", reason: "PERSISTED_ASSIGNMENT" };
    }

    const variantKey = selectWeightedVariant(key, subject, experiment.variants);
    if (!variantKey) return { key, variantKey: null, experimentVersion: experiment.version, subjectType: subject.type, source: "DEFAULT", reason: "NO_VARIANT" };
    await db.experimentAssignment.upsert({
      where: { experimentId_subjectHash: { experimentId: experiment.id, subjectHash: subject.hash } },
      create: { experimentId: experiment.id, subjectHash: subject.hash, subjectType: subject.type, customerId: context.customerId ?? null, variantKey, experimentVersion: experiment.version },
      update: { subjectType: subject.type, customerId: context.customerId ?? null, variantKey, experimentVersion: experiment.version, assignedAt: new Date() },
    });
    incrementMetric("experiment_assignments_total", { operation: "assigned", environment, category: key });
    return { key, variantKey, experimentVersion: experiment.version, subjectType: subject.type, source: "ASSIGNED", reason: "DETERMINISTIC_ASSIGNMENT" };
  } catch (error) {
    incrementMetric("experiment_assignments_total", { operation: "error", environment });
    return { key, variantKey: null, experimentVersion: null, subjectType: null, source: "ERROR", reason: "EVALUATION_ERROR" };
  }
}

export async function recordExperimentExposure(input: {
  experimentKey: string;
  experimentVersion: number;
  variantKey: string;
  subjectType: ExperimentSubjectType;
  subjectHash: string;
  customerId?: string | null;
  locale?: string | null;
  analyticsConsent: boolean;
}): Promise<boolean> {
  if (!input.analyticsConsent) return false;
  const eventId = createHash("sha256").update(["experiment_exposure", input.experimentKey, String(input.experimentVersion), input.subjectHash, input.variantKey].join("\0")).digest("hex");
  try {
    await recordAnalyticsEvent({
      eventId,
      eventName: "EXPERIMENT_EXPOSURE",
      eventVersion: 1,
      occurredAt: new Date().toISOString(),
      properties: {
        experimentKey: input.experimentKey,
        experimentVersion: input.experimentVersion,
        variantKey: input.variantKey,
        subjectType: input.subjectType,
      },
      source: "SERVER",
      anonymousId: input.subjectType === "ANONYMOUS" ? input.subjectHash : undefined,
      sessionId: undefined,
      customerId: input.customerId ?? null,
      locale: input.locale ?? null,
      consent: true,
    });
    incrementMetric("experiment_exposures_total", { operation: "recorded", category: input.experimentKey });
    return true;
  } catch {
    incrementMetric("experiment_exposures_total", { operation: "failed", category: input.experimentKey });
    return false;
  }
}
