import { Prisma, type AnalyticsEventSource, type AnalyticsConsentState } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { db } from "@/lib/db/client";
import { normalizeLocale } from "@/lib/i18n/registry";
import { incrementMetric } from "@/lib/observability/metrics";

export const ANALYTICS_RAW_RETENTION_DAYS = 90;
export const ANALYTICS_MAX_PAYLOAD_BYTES = 16_384;
export const ANALYTICS_MAX_PROPERTIES = 24;
export const ANALYTICS_MAX_STRING_LENGTH = 256;
export const ANALYTICS_MAX_EVENT_AGE_MS = 24 * 60 * 60 * 1000;
export const ANALYTICS_MAX_FUTURE_SKEW_MS = 5 * 60 * 1000;

export const ANALYTICS_CONSENT_COOKIE = "4hrs_analytics_consent";

export const ANALYTICS_EVENT_CATALOG = {
  PAGE_VIEW: { version: 1, properties: ["page"] },
  PRODUCT_VIEWED: { version: 1, properties: ["productId", "categoryId", "collectionId", "position"] },
  CATEGORY_VIEWED: { version: 1, properties: ["categoryId"] },
  COLLECTION_VIEWED: { version: 1, properties: ["collectionId"] },
  SEARCH_PERFORMED: { version: 1, properties: ["resultCount", "page", "filterIds", "sortId"] },
  FILTER_APPLIED: { version: 1, properties: ["filterId", "value"] },
  SORT_CHANGED: { version: 1, properties: ["sortId"] },
  PRODUCT_VARIANT_SELECTED: { version: 1, properties: ["productId", "variantId"] },
  ADD_TO_CART: { version: 1, properties: ["productId", "variantId", "quantity"] },
  REMOVE_FROM_CART: { version: 1, properties: ["productId", "variantId", "quantity"] },
  CART_VIEWED: { version: 1, properties: [] },
  CHECKOUT_STARTED: { version: 1, properties: [] },
  CHECKOUT_STEP_VIEWED: { version: 1, properties: ["step"] },
  ACCOUNT_CREATED: { version: 1, properties: [] },
  ACCOUNT_LOGIN: { version: 1, properties: [] },
} as const;

export type AnalyticsEventName = keyof typeof ANALYTICS_EVENT_CATALOG;
export type AnalyticsEventProperties = Record<string, unknown>;

export class AnalyticsError extends Error {
  constructor(
    public readonly code:
      | "INVALID_EVENT"
      | "INVALID_VERSION"
      | "INVALID_PROPERTIES"
      | "INVALID_TIMESTAMP"
      | "PAYLOAD_TOO_LARGE"
      | "CONSENT_REQUIRED"
      | "RATE_LIMITED"
      | "DUPLICATE_EVENT"
      | "CUSTOMER_MISMATCH"
      | "DATABASE_ERROR",
    message: string,
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = "AnalyticsError";
  }
}

const identifierPattern = /^[A-Za-z0-9_-]{1,64}$/;

function byteLength(value: string): number {
  return Buffer.byteLength(value, "utf8");
}

function sanitizeValue(value: unknown, depth = 0): unknown {
  if (depth > 2) throw new AnalyticsError("INVALID_PROPERTIES", "Analytics properties are too deeply nested.");
  if (value === null || typeof value === "boolean" || typeof value === "number") {
    if (typeof value === "number" && !Number.isFinite(value)) throw new AnalyticsError("INVALID_PROPERTIES", "Analytics properties contain an invalid number.");
    return value;
  }
  if (typeof value === "string") return value.replace(/[\u0000-\u001F\u007F]/g, " ").trim().slice(0, ANALYTICS_MAX_STRING_LENGTH);
  if (Array.isArray(value)) {
    if (value.length > ANALYTICS_MAX_PROPERTIES) throw new AnalyticsError("INVALID_PROPERTIES", "Analytics property arrays are too large.");
    return value.map((item) => sanitizeValue(item, depth + 1));
  }
  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length > ANALYTICS_MAX_PROPERTIES) throw new AnalyticsError("INVALID_PROPERTIES", "Too many analytics properties.");
    const output: Record<string, unknown> = {};
    for (const [key, item] of entries) {
      if (!/^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(key)) throw new AnalyticsError("INVALID_PROPERTIES", "An analytics property name is invalid.");
      output[key] = sanitizeValue(item, depth + 1);
    }
    return output;
  }
  throw new AnalyticsError("INVALID_PROPERTIES", "Analytics properties contain an unsupported value.");
}

function forbiddenPropertyScan(value: unknown): void {
  if (!value || typeof value !== "object") return;
  const forbidden = /password|passwd|token|secret|authorization|cookie|credit.?card|cvv|cvc|bank|api.?key|provider.?credential|private.?key|email|phone|address|date.?of.?birth|customer.?name|full.?url|ip.?address/i;
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    if (forbidden.test(key)) throw new AnalyticsError("INVALID_PROPERTIES", "Analytics payload contains a forbidden or unnecessary sensitive property.");
    forbiddenPropertyScan(item);
  }
}

export function validateAnalyticsEvent(input: {
  eventId: unknown;
  eventName: unknown;
  eventVersion: unknown;
  occurredAt: unknown;
  properties: unknown;
  source: AnalyticsEventSource;
}): { eventId: string; eventName: AnalyticsEventName; eventVersion: number; occurredAt: Date; properties: Record<string, unknown> } {
  if (typeof input.eventId !== "string" || !identifierPattern.test(input.eventId)) throw new AnalyticsError("INVALID_EVENT", "Analytics event ID is invalid.");
  if (typeof input.eventName !== "string" || !(input.eventName in ANALYTICS_EVENT_CATALOG)) throw new AnalyticsError("INVALID_EVENT", "Analytics event name is not supported.");
  const eventName = input.eventName as AnalyticsEventName;
  const definition = ANALYTICS_EVENT_CATALOG[eventName];
  if (!Number.isInteger(input.eventVersion) || input.eventVersion !== definition.version) throw new AnalyticsError("INVALID_VERSION", "Analytics event version is unsupported.");
  if (typeof input.occurredAt !== "string") throw new AnalyticsError("INVALID_TIMESTAMP", "Analytics event timestamp is invalid.");
  const occurredAt = new Date(input.occurredAt);
  const now = Date.now();
  if (Number.isNaN(occurredAt.getTime()) || occurredAt.getTime() < now - ANALYTICS_MAX_EVENT_AGE_MS || occurredAt.getTime() > now + ANALYTICS_MAX_FUTURE_SKEW_MS) {
    throw new AnalyticsError("INVALID_TIMESTAMP", "Analytics event timestamp is outside the accepted window.");
  }
  if (!input.properties || typeof input.properties !== "object" || Array.isArray(input.properties)) throw new AnalyticsError("INVALID_PROPERTIES", "Analytics properties must be an object.");
  forbiddenPropertyScan(input.properties);
  const properties = sanitizeValue(input.properties) as Record<string, unknown>;
  const allowed = new Set<string>(definition.properties);
  for (const key of Object.keys(properties)) if (!allowed.has(key)) throw new AnalyticsError("INVALID_PROPERTIES", "Analytics event contains an unsupported property.");
  const serialized = JSON.stringify(properties);
  if (byteLength(serialized) > ANALYTICS_MAX_PAYLOAD_BYTES) throw new AnalyticsError("PAYLOAD_TOO_LARGE", "Analytics payload is too large.");
  return { eventId: input.eventId, eventName, eventVersion: input.eventVersion, occurredAt, properties };
}

export async function getAnalyticsConsent(customerId: string): Promise<AnalyticsConsentState> {
  const row = await db.customerAnalyticsConsent.findUnique({ where: { customerId }, select: { state: true } });
  return row?.state ?? "OPTED_OUT";
}

export async function setAnalyticsConsent(input: { customerId: string; state: AnalyticsConsentState }): Promise<{ state: AnalyticsConsentState; version: number }> {
  const current = await db.customerAnalyticsConsent.findUnique({ where: { customerId: input.customerId }, select: { version: true } });
  const version = (current?.version ?? 0) + 1;
  const row = await db.customerAnalyticsConsent.upsert({
    where: { customerId: input.customerId },
    create: { customerId: input.customerId, state: input.state, source: "CUSTOMER_SETTINGS", version },
    update: { state: input.state, source: "CUSTOMER_SETTINGS", version },
    select: { state: true, version: true },
  });
  return row;
}

export function normalizeAnalyticsIdentifier(value: unknown): string | null {
  if (typeof value !== "string" || !identifierPattern.test(value)) return null;
  return value;
}

export async function recordAnalyticsEvent(input: {
  eventId?: string;
  eventName: unknown;
  eventVersion: unknown;
  occurredAt: unknown;
  properties: unknown;
  source: AnalyticsEventSource;
  anonymousId?: unknown;
  sessionId?: unknown;
  customerId?: string | null;
  locale?: string | null;
  consent: boolean;
}): Promise<{ eventId: string; created: boolean }> {
  if (!input.consent) throw new AnalyticsError("CONSENT_REQUIRED", "Analytics consent is not enabled.");
  const validated = validateAnalyticsEvent({
    eventId: input.eventId ?? randomUUID().replace(/-/g, ""),
    eventName: input.eventName,
    eventVersion: input.eventVersion,
    occurredAt: input.occurredAt,
    properties: input.properties,
    source: input.source,
  });
  const anonymousId = normalizeAnalyticsIdentifier(input.anonymousId);
  const sessionId = normalizeAnalyticsIdentifier(input.sessionId);
  const normalizedLocale = input.locale ? normalizeLocale(input.locale) : null;
  const expiresAt = new Date(Date.now() + ANALYTICS_RAW_RETENTION_DAYS * 86_400_000);
  try {
    const existing = await db.analyticsEvent.findUnique({ where: { eventId: validated.eventId }, select: { eventId: true } });
    if (existing) return { eventId: existing.eventId, created: false };
    await db.analyticsEvent.create({
      data: {
        eventId: validated.eventId,
        eventName: validated.eventName,
        eventVersion: validated.eventVersion,
        occurredAt: validated.occurredAt,
        anonymousId,
        sessionId,
        customerId: input.customerId ?? null,
        locale: normalizedLocale,
        properties: validated.properties as Prisma.InputJsonValue,
        source: input.source,
        expiresAt,
      },
    });
    incrementMetric("analytics_events_total", { operation: "accepted", category: validated.eventName });
    return { eventId: validated.eventId, created: true };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { eventId: validated.eventId, created: false };
    }
    incrementMetric("analytics_events_total", { operation: "database_error", category: validated.eventName });
    throw new AnalyticsError("DATABASE_ERROR", "Analytics event could not be stored safely.", { cause: error });
  }
}

export async function purgeExpiredAnalyticsEvents(now = new Date()): Promise<number> {
  const result = await db.analyticsEvent.deleteMany({ where: { expiresAt: { lte: now } } });
  return result.count;
}

export async function deleteCustomerAnalyticsData(customerId: string): Promise<number> {
  const result = await db.analyticsEvent.deleteMany({ where: { customerId } });
  await db.customerAnalyticsConsent.deleteMany({ where: { customerId } });
  return result.count;
}
