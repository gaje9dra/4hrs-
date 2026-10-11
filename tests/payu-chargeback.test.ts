import assert from "node:assert/strict";
import test from "node:test";
import { createHash } from "node:crypto";
import {
  normalizePayUChargebackStatus,
  parsePayUChargebackPayload,
  verifyPayUChargebackSignature,
} from "@/lib/payments/payu-chargebacks";

const merchantKey = "test-merchant-key";
const merchantSalt = "test-merchant-salt";

function fixture(overrides: Record<string, unknown> = {}) {
  return {
    type: "payments",
    event: "dispute",
    mid: "merchant-123",
    txn_id: "payu-txn-123",
    cb_id: 4567,
    cb_type: "Card-Not-Present",
    cb_amount: "499.00",
    cb_status: "Pending Response",
    reason_code: "Fraud",
    created_at: "2026-10-11T10:00:00+05:30",
    updated_at: "2026-10-11T10:01:00+05:30",
    due_date: "2026-10-20",
    ...overrides,
  };
}

function signature(payload: ReturnType<typeof parsePayUChargebackPayload>, status = payload.cb_status.replace(/\s+/g, "")) {
  return createHash("sha512").update([
    merchantKey,
    payload.txn_id,
    payload.cb_amount,
    payload.cb_id,
    payload.cb_type,
    status,
    merchantSalt,
  ].join("|"), "utf8").digest("hex");
}

test("accepts a valid PayU V2 signature when PayU signs the mapped status without spaces", () => {
  const payload = parsePayUChargebackPayload(fixture());
  assert.equal(verifyPayUChargebackSignature(payload, signature(payload), merchantKey, merchantSalt), true);
});

test("rejects missing, malformed, or tampered PayU chargeback signatures", () => {
  const payload = parsePayUChargebackPayload(fixture());
  assert.equal(verifyPayUChargebackSignature(payload, null, merchantKey, merchantSalt), false);
  assert.equal(verifyPayUChargebackSignature(payload, "not-a-signature", merchantKey, merchantSalt), false);
  assert.equal(verifyPayUChargebackSignature(payload, signature(payload), merchantKey, "wrong-salt"), false);
  const altered = parsePayUChargebackPayload(fixture({ cb_amount: "498.00" }));
  assert.equal(verifyPayUChargebackSignature(altered, signature(payload), merchantKey, merchantSalt), false);
});

test("parses chargeback identity and rejects unsupported or malformed payloads", () => {
  const payload = parsePayUChargebackPayload(fixture());
  assert.equal(payload.mid, "merchant-123");
  assert.equal(payload.txn_id, "payu-txn-123");
  assert.equal(payload.cb_id, "4567");
  assert.equal(payload.cb_amount, "499.00");
  assert.throws(() => parsePayUChargebackPayload(fixture({ event: "payment" })));
  assert.throws(() => parsePayUChargebackPayload(fixture({ cb_amount: "-1.00" })));
  assert.throws(() => parsePayUChargebackPayload(fixture({ updated_at: "not-a-date" })));
});

test("normalizes PayU chargeback states conservatively", () => {
  assert.equal(normalizePayUChargebackStatus("New"), "OPEN");
  assert.equal(normalizePayUChargebackStatus("Pending Response"), "OPEN");
  assert.equal(normalizePayUChargebackStatus("Pending Doc Review"), "OPEN");
  assert.equal(normalizePayUChargebackStatus("Submitted to Bank"), "OPEN");
  assert.equal(normalizePayUChargebackStatus("Insufficient Document"), "OPEN");
  assert.equal(normalizePayUChargebackStatus("Closed Customer Favour"), "CLOSED_CUSTOMER_FAVOUR");
  assert.equal(normalizePayUChargebackStatus("Closed in Merchant Favour"), "CLOSED_MERCHANT_FAVOUR");
  assert.equal(normalizePayUChargebackStatus("Closed under Fraud Liability"), "CLOSED_FRAUD_LIABILITY");
  assert.equal(normalizePayUChargebackStatus("future unknown state"), "UNKNOWN");
});
