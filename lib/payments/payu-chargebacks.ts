import { createHash, timingSafeEqual } from "node:crypto";
import { Prisma, type PaymentDisputeStatus } from "@prisma/client";
import { db } from "@/lib/db/client";
import { syncReferralRewardLifecycleInTransaction } from "@/lib/referrals/service";

export class PayUChargebackInputError extends Error {}
export class PayUChargebackNotFoundError extends Error {}
export class PayUChargebackConflictError extends Error {}

export type PayUChargebackPayload = {
  type: "payments";
  event: "dispute";
  mid: string;
  txn_id: string;
  cb_id: string;
  cb_type: string;
  cb_amount: string;
  cb_status: string;
  reason_code: string | null;
  created_at: string | null;
  updated_at: string;
  due_date: string | null;
};

function stringField(value: unknown, field: string, max: number, allowNumber = false): string {
  const candidate = typeof value === "string" ? value : allowNumber && typeof value === "number" && Number.isSafeInteger(value) ? String(value) : "";
  const normalized = candidate.trim();
  if (!normalized || normalized.length > max) throw new PayUChargebackInputError(`PayU dispute field ${field} is invalid.`);
  return normalized;
}

function optionalStringField(value: unknown, field: string, max: number): string | null {
  if (value === undefined || value === null || value === "") return null;
  return stringField(value, field, max, true);
}

function timestampField(value: unknown, field: string, optional = false): string | null {
  if (optional && (value === undefined || value === null || value === "")) return null;
  const candidate = stringField(value, field, 64);
  const parsed = new Date(candidate);
  if (Number.isNaN(parsed.getTime())) throw new PayUChargebackInputError(`PayU dispute timestamp ${field} is invalid.`);
  return parsed.toISOString();
}

export function parsePayUChargebackPayload(input: unknown): PayUChargebackPayload {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new PayUChargebackInputError("PayU dispute payload must be a JSON object.");
  const row = input as Record<string, unknown>;
  if (row.type !== "payments" || row.event !== "dispute") throw new PayUChargebackInputError("Unsupported PayU webhook event.");
  const amount = stringField(row.cb_amount, "cb_amount", 40, true);
  if (!/^\d+(?:\.\d{1,2})?$/.test(amount) || !new Prisma.Decimal(amount).isFinite() || new Prisma.Decimal(amount).lte(0)) {
    throw new PayUChargebackInputError("PayU dispute amount is invalid.");
  }
  const transactionReference = stringField(row.txn_id, "txn_id", 64);
  const disputeId = stringField(row.cb_id, "cb_id", 128, true);
  if (!/^[A-Za-z0-9._-]+$/.test(disputeId)) throw new PayUChargebackInputError("PayU dispute id is invalid.");
  return {
    type: "payments",
    event: "dispute",
    mid: stringField(row.mid, "mid", 64, true),
    txn_id: transactionReference,
    cb_id: disputeId,
    cb_type: stringField(row.cb_type, "cb_type", 120),
    cb_amount: amount,
    cb_status: stringField(row.cb_status, "cb_status", 120),
    reason_code: optionalStringField(row.reason_code, "reason_code", 255),
    created_at: timestampField(row.created_at, "created_at", true),
    updated_at: timestampField(row.updated_at ?? row.created_at, "updated_at", false)!,
    due_date: optionalStringField(row.due_date, "due_date", 64),
  };
}

function sha512(value: string): Buffer {
  return createHash("sha512").update(value, "utf8").digest();
}

export function verifyPayUChargebackSignature(
  payload: PayUChargebackPayload,
  suppliedSignature: string | null,
  merchantKey: string,
  merchantSalt: string,
): boolean {
  if (!suppliedSignature || !/^[a-f0-9]{128}$/i.test(suppliedSignature) || !merchantKey || !merchantSalt) return false;
  const supplied = Buffer.from(suppliedSignature, "hex");
  const statusCandidates = new Set([payload.cb_status, payload.cb_status.replace(/\s+/g, "")]);
  return [...statusCandidates].some((signedStatus) => {
    const expected = sha512([
      merchantKey,
      payload.txn_id,
      payload.cb_amount,
      payload.cb_id,
      payload.cb_type,
      signedStatus,
      merchantSalt,
    ].join("|"));
    return supplied.length === expected.length && timingSafeEqual(supplied, expected);
  });
}

export function normalizePayUChargebackStatus(value: string): PaymentDisputeStatus {
  const normalized = value.trim().toLowerCase().replace(/[\s_-]+/g, "");
  if (["new", "pendingresponse", "pendingdocreview", "submittedtobank", "insufficientdocument"].includes(normalized)) return "OPEN";
  if (normalized === "closedcustomerfavour") return "CLOSED_CUSTOMER_FAVOUR";
  if (normalized === "closedinmerchantfavour") return "CLOSED_MERCHANT_FAVOUR";
  if (normalized === "closedunderfraudliability") return "CLOSED_FRAUD_LIABILITY";
  return "UNKNOWN";
}

function reasonForStatus(status: PaymentDisputeStatus, disputeId: string): string {
  if (status === "OPEN") return `CHARGEBACK_OPEN:${disputeId}`;
  if (status === "UNKNOWN") return `CHARGEBACK_UNKNOWN:${disputeId}`;
  if (status === "CLOSED_CUSTOMER_FAVOUR") return `CHARGEBACK_LOST:${disputeId}`;
  return `CHARGEBACK_CLOSED:${disputeId}`;
}

function isRetryableConflict(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && (error.code === "P2034" || error.code === "P2002");
}

export async function processPayUChargebackEvent(payload: PayUChargebackPayload): Promise<{ disputeId: string; status: PaymentDisputeStatus; duplicate: boolean }> {
  const amount = new Prisma.Decimal(payload.cb_amount);
  const providerUpdatedAt = new Date(payload.updated_at);
  const providerCreatedAt = payload.created_at ? new Date(payload.created_at) : null;
  const normalizedStatus = normalizePayUChargebackStatus(payload.cb_status);

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await db.$transaction(async (tx) => {
        const payment = await tx.payment.findFirst({
          where: { internalReference: payload.txn_id, providerId: "payu" },
          select: { id: true, amount: true, currency: true },
        });
        if (!payment) throw new PayUChargebackNotFoundError("PayU dispute does not match a known PayU payment.");
        if (payment.currency !== "INR" || amount.gt(payment.amount)) throw new PayUChargebackInputError("PayU dispute amount or currency does not match the payment.");
        const unique = { providerId_providerDisputeId: { providerId: "payu", providerDisputeId: payload.cb_id } };
        const existing = await tx.paymentDispute.findUnique({ where: unique });
        if (existing && existing.paymentId !== payment.id) throw new PayUChargebackConflictError("PayU dispute id is already linked to a different payment.");

        let dispute = existing;
        let duplicate = Boolean(existing);
        if (!existing) {
          dispute = await tx.paymentDispute.create({
            data: {
              paymentId: payment.id,
              providerId: "payu",
              providerDisputeId: payload.cb_id,
              transactionReference: payload.txn_id,
              amount,
              currency: "INR",
              disputeType: payload.cb_type,
              reasonCode: payload.reason_code,
              providerStatus: payload.cb_status,
              status: normalizedStatus,
              providerCreatedAt,
              providerUpdatedAt,
              lastReceivedAt: new Date(),
              metadata: { mid: payload.mid, dueDate: payload.due_date },
            },
          });
          duplicate = false;
        } else if (providerUpdatedAt.getTime() > existing.providerUpdatedAt.getTime()) {
          dispute = await tx.paymentDispute.update({
            where: { id: existing.id },
            data: {
              amount,
              disputeType: payload.cb_type,
              reasonCode: payload.reason_code,
              providerStatus: payload.cb_status,
              status: normalizedStatus,
              providerCreatedAt,
              providerUpdatedAt,
              lastReceivedAt: new Date(),
              metadata: { mid: payload.mid, dueDate: payload.due_date },
            },
          });
          duplicate = false;
        }

        const order = await tx.order.findUnique({ where: { paymentId: payment.id }, select: { id: true } });
        if (order && dispute) {
          const reason = reasonForStatus(dispute.status, dispute.providerDisputeId);
          const eventKey = `chargeback:${dispute.id}:${dispute.status}:${dispute.providerUpdatedAt.toISOString()}`;
          await syncReferralRewardLifecycleInTransaction(tx, order.id, eventKey, reason);
        }
        if (!dispute) throw new Error("PayU dispute persistence returned no record.");
        return { disputeId: dispute.id, status: dispute.status, duplicate };
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 5000, timeout: 15000 });
    } catch (error) {
      if (isRetryableConflict(error) && attempt < 2) continue;
      throw error;
    }
  }
  throw new Error("PayU chargeback transaction retry exhausted.");
}
