import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db/client";
import { updateCustomerCommunicationPreference, normalizePreferenceCategory, normalizePreferenceChannel, CommunicationPreferenceError } from "./preferences";

const TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const TOKEN_VERSION = "v1";

function secret(): string {
  const value = process.env.NOTIFICATION_UNSUBSCRIBE_SECRET;
  if (!value || value.length < 32) throw new CommunicationPreferenceError("PREFERENCE_DATABASE_ERROR", "Unsubscribe security configuration is unavailable.");
  return value;
}
function encode(value: string): string { return Buffer.from(value, "utf8").toString("base64url"); }
function sign(payload: string): string { return createHmac("sha256", secret()).update(payload).digest("base64url"); }
function hashToken(token: string): string { return createHash("sha256").update(token).digest("hex"); }

export async function issueUnsubscribeToken(input: { customerId: string; category: "MARKETING_PROMOTIONAL"; channel: "EMAIL"; expiresAt?: Date }): Promise<string> {
  const customer = await db.customer.findUnique({ where: { id: input.customerId }, select: { status: true, anonymizedAt: true } });
  if (!customer || customer.status !== "ACTIVE" || customer.anonymizedAt) throw new CommunicationPreferenceError("CUSTOMER_NOT_FOUND", "Customer could not be found.");
  const expiresAt = input.expiresAt ?? new Date(Date.now() + TOKEN_TTL_MS);
  if (expiresAt.getTime() <= Date.now()) throw new CommunicationPreferenceError("PREFERENCE_DATABASE_ERROR", "Unsubscribe token expiry is invalid.");
  const nonce = randomBytes(16).toString("base64url");
  const payload = encode(JSON.stringify({ v: TOKEN_VERSION, exp: expiresAt.getTime(), nonce }));
  const token = `${payload}.${sign(payload)}`;
  await db.communicationUnsubscribeToken.create({
    data: { customerId: input.customerId, tokenHash: hashToken(token), category: input.category, channel: input.channel, expiresAt },
  });
  return token;
}

async function verifySignature(token: string): Promise<{ exp: number; nonce: string }> {
  const parts = token.split(".");
  if (parts.length !== 2 || parts[0].length < 20 || parts[1].length < 20) throw new CommunicationPreferenceError("PREFERENCE_DATABASE_ERROR", "The unsubscribe link is invalid or expired.");
  const [payload, provided] = parts;
  const expected = sign(payload);
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) throw new CommunicationPreferenceError("PREFERENCE_DATABASE_ERROR", "The unsubscribe link is invalid or expired.");
  let decoded: unknown;
  try { decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")); } catch { throw new CommunicationPreferenceError("PREFERENCE_DATABASE_ERROR", "The unsubscribe link is invalid or expired."); }
  if (!decoded || typeof decoded !== "object") throw new CommunicationPreferenceError("PREFERENCE_DATABASE_ERROR", "The unsubscribe link is invalid or expired.");
  const value = decoded as { v?: unknown; exp?: unknown; nonce?: unknown };
  if (value.v !== TOKEN_VERSION || typeof value.exp !== "number" || typeof value.nonce !== "string" || value.exp <= Date.now()) {
    throw new CommunicationPreferenceError("PREFERENCE_DATABASE_ERROR", "The unsubscribe link is invalid or expired.");
  }
  return { exp: value.exp, nonce: value.nonce };
}

export async function validateUnsubscribeToken(token: unknown): Promise<void> {
  if (typeof token !== "string" || token.length < 40 || token.length > 2048) throw new CommunicationPreferenceError("PREFERENCE_DATABASE_ERROR", "The unsubscribe link is invalid or expired.");
  await verifySignature(token);
  const record = await db.communicationUnsubscribeToken.findUnique({ where: { tokenHash: hashToken(token) }, select: { expiresAt: true, usedAt: true } });
  if (!record || record.usedAt || record.expiresAt.getTime() <= Date.now()) throw new CommunicationPreferenceError("PREFERENCE_DATABASE_ERROR", "The unsubscribe link is invalid or expired.");
}

export async function consumeUnsubscribeToken(token: unknown, correlationId?: string | null): Promise<{ status: "unsubscribed" }> {
  if (typeof token !== "string" || token.length < 40 || token.length > 2048) {
    throw new CommunicationPreferenceError("PREFERENCE_DATABASE_ERROR", "The unsubscribe link is invalid or expired.");
  }
  await verifySignature(token);
  const tokenHash = hashToken(token);
  try {
    return await db.$transaction(async (tx) => {
      const record = await tx.communicationUnsubscribeToken.findUnique({
        where: { tokenHash },
        select: { id: true, customerId: true, category: true, channel: true, expiresAt: true, usedAt: true },
      });
      if (!record || record.usedAt || record.expiresAt.getTime() <= Date.now()) {
        throw new CommunicationPreferenceError("PREFERENCE_DATABASE_ERROR", "The unsubscribe link is invalid or expired.");
      }
      const customer = await tx.customer.findUnique({ where: { id: record.customerId }, select: { status: true, anonymizedAt: true } });
      if (!customer || customer.status !== "ACTIVE" || customer.anonymizedAt) {
        throw new CommunicationPreferenceError("CUSTOMER_NOT_FOUND", "Customer could not be found.");
      }
      const current = await tx.customerCommunicationPreference.findUnique({
        where: { customerId_category_channel: { customerId: record.customerId, category: normalizePreferenceCategory(record.category), channel: normalizePreferenceChannel(record.channel) } },
        select: { state: true, version: true, source: true },
      });
      if (!current || current.state !== "OPTED_OUT") {
        const nextVersion = current ? current.version + 1 : 1;
        if (current) {
          await tx.customerCommunicationPreference.update({ where: { customerId_category_channel: { customerId: record.customerId, category: record.category, channel: record.channel } }, data: { state: "OPTED_OUT", source: "UNSUBSCRIBE", version: nextVersion } });
        } else {
          await tx.customerCommunicationPreference.create({ data: { customerId: record.customerId, category: record.category, channel: record.channel, state: "OPTED_OUT", source: "UNSUBSCRIBE", version: 1 } });
        }
        await tx.customerCommunicationPreferenceAudit.create({
          data: { customerId: record.customerId, category: record.category, channel: record.channel, previousState: current?.state ?? null, newState: "OPTED_OUT", source: "UNSUBSCRIBE", actorType: "CUSTOMER", correlationId: correlationId?.slice(0,128) ?? null, idempotencyKey: `unsubscribe:${record.id}` },
        });
      }
      const marked = await tx.communicationUnsubscribeToken.updateMany({ where: { id: record.id, usedAt: null }, data: { usedAt: new Date() } });
      if (marked.count !== 1) throw new CommunicationPreferenceError("PREFERENCE_DATABASE_ERROR", "The unsubscribe link is invalid or expired.");
      return { status: "unsubscribed" as const };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch (error) {
    if (error instanceof CommunicationPreferenceError) throw error;
    throw new CommunicationPreferenceError("PREFERENCE_DATABASE_ERROR", "The unsubscribe request could not be completed safely.", { cause: error });
  }
}
