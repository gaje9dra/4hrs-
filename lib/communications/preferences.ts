import { Prisma, type CommunicationCategory, type CommunicationChannel, type CommunicationPreferenceSource, type CommunicationPreferenceState, type CommunicationPreferenceActorType } from "@prisma/client";
import { db } from "@/lib/db/client";
import { incrementMetric } from "@/lib/observability/metrics";

export const SUPPORTED_PREFERENCE_CATEGORIES = ["MARKETING_PROMOTIONAL"] as const;
export const SUPPORTED_PREFERENCE_CHANNELS = ["EMAIL"] as const;
export type SupportedPreferenceCategory = (typeof SUPPORTED_PREFERENCE_CATEGORIES)[number];
export type SupportedPreferenceChannel = (typeof SUPPORTED_PREFERENCE_CHANNELS)[number];

export class CommunicationPreferenceError extends Error {
  constructor(
    public readonly code:
      | "INVALID_CATEGORY"
      | "INVALID_CHANNEL"
      | "INVALID_STATE"
      | "CUSTOMER_NOT_FOUND"
      | "PREFERENCE_CONFLICT"
      | "IDEMPOTENCY_CONFLICT"
      | "PREFERENCE_DATABASE_ERROR"
      | "RATE_LIMITED",
    message: string,
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = "CommunicationPreferenceError";
  }
}

export function isOptionalCommunicationCategory(category: CommunicationCategory): boolean {
  return category === "OPTIONAL_SERVICE" || category === "MARKETING_PROMOTIONAL";
}

export function defaultPreferenceState(category: CommunicationCategory): CommunicationPreferenceState {
  return isOptionalCommunicationCategory(category) ? "OPTED_OUT" : "OPTED_IN";
}

export function normalizePreferenceCategory(value: unknown): SupportedPreferenceCategory {
  if (value === "MARKETING_PROMOTIONAL") return value;
  throw new CommunicationPreferenceError("INVALID_CATEGORY", "The communication category is not supported.");
}

export function normalizePreferenceChannel(value: unknown): SupportedPreferenceChannel {
  if (value === "EMAIL") return value;
  throw new CommunicationPreferenceError("INVALID_CHANNEL", "The communication channel is not supported.");
}

export type CommunicationPreferenceDto = {
  category: CommunicationCategory;
  channel: CommunicationChannel;
  state: CommunicationPreferenceState;
  version: number;
  source: CommunicationPreferenceSource;
  updatedAt: string | null;
};

export async function getCustomerCommunicationPreferences(customerId: string): Promise<CommunicationPreferenceDto[]> {
  const customer = await db.customer.findUnique({ where: { id: customerId }, select: { id: true, status: true, anonymizedAt: true } });
  if (!customer || customer.anonymizedAt || customer.status !== "ACTIVE") {
    throw new CommunicationPreferenceError("CUSTOMER_NOT_FOUND", "Customer could not be found.");
  }

  const rows = await db.customerCommunicationPreference.findMany({
    where: { customerId },
    orderBy: [{ category: "asc" }, { channel: "asc" }],
    select: { category: true, channel: true, state: true, version: true, source: true, updatedAt: true },
  });
  const rowByKey = new Map(rows.map((row) => [`${row.category}:${row.channel}`, row]));
  return SUPPORTED_PREFERENCE_CATEGORIES.flatMap((category) =>
    SUPPORTED_PREFERENCE_CHANNELS.map((channel) => {
      const row = rowByKey.get(`${category}:${channel}`);
      return {
        category,
        channel,
        state: row?.state ?? defaultPreferenceState(category),
        version: row?.version ?? 0,
        source: row?.source ?? "SYSTEM",
        updatedAt: row?.updatedAt?.toISOString() ?? null,
      };
    }),
  );
}

export async function evaluateNotificationEligibility(input: {
  customerId: string;
  category: CommunicationCategory;
  channel: CommunicationChannel;
}): Promise<{ eligible: boolean; reason: "REQUIRED_TRANSACTIONAL" | "CUSTOMER_OPTED_OUT" | "CONSENT_NOT_PRESENT" | "CHANNEL_UNAVAILABLE" | "CUSTOMER_DELETED" }> {
  if (input.category === "REQUIRED_TRANSACTIONAL") return { eligible: true, reason: "REQUIRED_TRANSACTIONAL" };
  if (input.channel !== "EMAIL") return { eligible: false, reason: "CHANNEL_UNAVAILABLE" };

  const customer = await db.customer.findUnique({ where: { id: input.customerId }, select: { status: true, anonymizedAt: true } });
  if (!customer || customer.anonymizedAt || customer.status !== "ACTIVE") return { eligible: false, reason: "CUSTOMER_DELETED" };

  const preference = await db.customerCommunicationPreference.findUnique({
    where: { customerId_category_channel: { customerId: input.customerId, category: input.category, channel: input.channel } },
    select: { state: true },
  });
  if (preference?.state === "OPTED_IN") return { eligible: true, reason: "REQUIRED_TRANSACTIONAL" };
  return { eligible: false, reason: preference ? "CUSTOMER_OPTED_OUT" : "CONSENT_NOT_PRESENT" };
}

async function assertCustomer(customerId: string, client: typeof db | Prisma.TransactionClient = db) {
  const customer = await client.customer.findUnique({ where: { id: customerId }, select: { id: true, status: true, anonymizedAt: true } });
  if (!customer || customer.anonymizedAt || customer.status !== "ACTIVE") {
    throw new CommunicationPreferenceError("CUSTOMER_NOT_FOUND", "Customer could not be found.");
  }
}

export async function updateCustomerCommunicationPreference(input: {
  customerId: string;
  category: unknown;
  channel: unknown;
  state: unknown;
  expectedVersion: unknown;
  idempotencyKey: unknown;
  source?: CommunicationPreferenceSource;
  actorType?: CommunicationPreferenceActorType;
  correlationId?: string | null;
}): Promise<CommunicationPreferenceDto> {
  const category = normalizePreferenceCategory(input.category);
  const channel = normalizePreferenceChannel(input.channel);
  if (input.state !== "OPTED_IN" && input.state !== "OPTED_OUT") {
    throw new CommunicationPreferenceError("INVALID_STATE", "The communication preference state is invalid.");
  }
  if (!Number.isInteger(input.expectedVersion) || Number(input.expectedVersion) < 0) {
    throw new CommunicationPreferenceError("PREFERENCE_CONFLICT", "A current preference version is required.");
  }
  const idempotencyKey = typeof input.idempotencyKey === "string" ? input.idempotencyKey.trim() : "";
  if (idempotencyKey.length < 16 || idempotencyKey.length > 255) {
    throw new CommunicationPreferenceError("PREFERENCE_DATABASE_ERROR", "A valid idempotency key is required.");
  }
  const source = input.source ?? "CUSTOMER_SETTINGS";
  const actorType = input.actorType ?? "CUSTOMER";
  try {
    return await db.$transaction(async (tx) => {
      await assertCustomer(input.customerId, tx);
      const priorAction = await tx.customerCommunicationPreferenceAudit.findUnique({
        where: { idempotencyKey },
        select: { customerId: true, category: true, channel: true, newState: true },
      });
      if (priorAction) {
        if (priorAction.customerId !== input.customerId || priorAction.category !== category || priorAction.channel !== channel) {
          throw new CommunicationPreferenceError("IDEMPOTENCY_CONFLICT", "The idempotency key is already associated with another preference action.");
        }
        const current = await tx.customerCommunicationPreference.findUnique({
          where: { customerId_category_channel: { customerId: input.customerId, category, channel } },
          select: { category: true, channel: true, state: true, version: true, source: true, updatedAt: true },
        });
        if (!current) throw new CommunicationPreferenceError("PREFERENCE_DATABASE_ERROR", "Preference state could not be recovered safely.");
        return { ...current, updatedAt: current.updatedAt.toISOString() };
      }

      const current = await tx.customerCommunicationPreference.findUnique({
        where: { customerId_category_channel: { customerId: input.customerId, category, channel } },
        select: { category: true, channel: true, state: true, version: true, source: true, updatedAt: true },
      });
      const expectedVersion = Number(input.expectedVersion);
      if ((current?.version ?? 0) !== expectedVersion) {
        throw new CommunicationPreferenceError("PREFERENCE_CONFLICT", "The communication preference changed elsewhere. Refresh and try again.");
      }

      if (current?.state === input.state) {
        return { ...current, updatedAt: current.updatedAt.toISOString() };
      }

      const nextVersion = expectedVersion + 1;
      const updated = current
        ? (await tx.customerCommunicationPreference.updateMany({
            where: { customerId: input.customerId, category, channel, version: expectedVersion },
            data: { state: input.state, source, version: nextVersion },
          }), await tx.customerCommunicationPreference.findUniqueOrThrow({
            where: { customerId_category_channel: { customerId: input.customerId, category, channel } },
            select: { category: true, channel: true, state: true, version: true, source: true, updatedAt: true },
          }))
        : await tx.customerCommunicationPreference.create({
            data: { customerId: input.customerId, category, channel, state: input.state, source, version: 1 },
            select: { category: true, channel: true, state: true, version: true, source: true, updatedAt: true },
          });

      await tx.customerCommunicationPreferenceAudit.create({
        data: {
          customerId: input.customerId,
          category,
          channel,
          previousState: current?.state ?? null,
          newState: input.state,
          source,
          actorType,
          correlationId: input.correlationId?.slice(0, 128) ?? null,
          idempotencyKey,
        },
      });
      incrementMetric("communication_preference_operations_total" as never, { operation: input.state === "OPTED_IN" ? "opt_in" : "opt_out", category, channel });
      return { ...updated, updatedAt: updated.updatedAt.toISOString() };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch (error) {
    if (error instanceof CommunicationPreferenceError) throw error;
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new CommunicationPreferenceError("PREFERENCE_CONFLICT", "The communication preference changed elsewhere. Refresh and try again.", { cause: error });
    }
    throw new CommunicationPreferenceError("PREFERENCE_DATABASE_ERROR", "The communication preference could not be updated safely.", { cause: error });
  }
}
