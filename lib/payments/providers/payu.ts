import { createHash, timingSafeEqual } from "node:crypto";
import { absoluteSiteUrl } from "@/config/site";
import type { PaymentAmount, PaymentStatus } from "@/lib/payments/domain";
import type { NormalizedPaymentEvent, PaymentProviderAdapter, PaymentProviderResult, PaymentProviderWebhook } from "@/lib/payments/provider";

const ID = "payu";
const TEST_PAYMENT_URL = "https://test.payu.in/_payment";
const LIVE_PAYMENT_URL = "https://secure.payu.in/_payment";
const TEST_SERVICE_URL = "https://test.payu.in/merchant/postservice.php?form=2";
const LIVE_SERVICE_URL = "https://info.payu.in/merchant/postservice.php?form=2";

function required(name: string): string {
  const value = process.env[name]?.trim() ?? "";
  if (!value) throw new Error(`PayU configuration ${name} is missing.`);
  return value;
}

function merchantKey(): string { return required("PAYU_MERCHANT_KEY"); }
function merchantSalt(): string { return required("PAYU_MERCHANT_SALT"); }
function isLive(): boolean { return (process.env.PAYMENT_PROVIDER_MODE ?? "test").trim().toLowerCase() === "live"; }
function paymentUrl(): string { return isLive() ? LIVE_PAYMENT_URL : TEST_PAYMENT_URL; }
function serviceUrl(): string { return isLive() ? LIVE_SERVICE_URL : TEST_SERVICE_URL; }

function sha512(value: string): string {
  return createHash("sha512").update(value, "utf8").digest("hex");
}

function requestHash(input: {
  key: string; txnid: string; amount: string; productinfo: string; firstname: string; email: string;
  udf1?: string; udf2?: string; udf3?: string; udf4?: string; udf5?: string;
}): string {
  return sha512([
    input.key, input.txnid, input.amount, input.productinfo, input.firstname, input.email,
    input.udf1 ?? "", input.udf2 ?? "", input.udf3 ?? "", input.udf4 ?? "", input.udf5 ?? "",
    "", "", "", "", merchantSalt(),
  ].join("|"));
}

function responseHash(fields: URLSearchParams): string {
  const additionalCharges = fields.get("additionalCharges") ?? fields.get("additional_charges") ?? "";
  const prefix = additionalCharges ? [additionalCharges, merchantSalt()] : [merchantSalt()];
  return sha512([
    ...prefix,
    fields.get("status") ?? "",
    "", "", "", "", "",
    fields.get("udf5") ?? "",
    fields.get("udf4") ?? "",
    fields.get("udf3") ?? "",
    fields.get("udf2") ?? "",
    fields.get("udf1") ?? "",
    fields.get("email") ?? "",
    fields.get("firstname") ?? "",
    fields.get("productinfo") ?? "",
    fields.get("amount") ?? "",
    fields.get("txnid") ?? "",
    fields.get("key") ?? "",
  ].join("|"));
}

function safeEqualHex(expected: string, supplied: string): boolean {
  const a = Buffer.from(expected.toLowerCase(), "utf8");
  const b = Buffer.from(supplied.toLowerCase(), "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}

function statusFromPayU(status: string, unmapped?: string): PaymentStatus {
  const normalized = status.trim().toLowerCase();
  const internal = (unmapped ?? "").trim().toLowerCase();
  if (normalized === "success" || internal === "captured" || internal === "auth") return "SUCCEEDED";
  if (["pending", "in progress", "initiated"].includes(normalized) || internal === "pending") return "PROCESSING";
  if (["failure", "failed", "cancelled", "usercancelled", "dropped", "bounced"].includes(normalized) || ["failed", "usercancelled", "dropped", "bounced"].includes(internal)) return "FAILED";
  throw new Error("Unsupported PayU transaction status.");
}

function failureCode(error: unknown): string {
  const code = error && typeof error === "object" && "code" in error ? String((error as {code: unknown}).code) : "";
  return code || "PROVIDER_UNKNOWN_ERROR";
}

async function verifyPaymentAtPayU(txnid: string): Promise<PaymentProviderResult> {
  const key = merchantKey();
  const var1 = JSON.stringify({ txnid });
  const hash = sha512(`${key}|verify_payment|${var1}|${merchantSalt()}`);
  const body = new URLSearchParams({ key, command: "verify_payment", var1, hash });
  const response = await fetch(serviceUrl(), {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    cache: "no-store",
    signal: AbortSignal.timeout(Number(process.env.PAYMENT_PROVIDER_TIMEOUT_MS ?? 10000)),
  });
  if (!response.ok) throw Object.assign(new Error(`PayU verification returned HTTP ${response.status}.`), { code: "PROVIDER_NETWORK_ERROR" });
  const payload = await response.json() as { status?: number | string; msg?: string; transaction_details?: Record<string, Record<string, unknown>> };
  const details = payload.transaction_details?.[txnid];
  if (!details || typeof details !== "object") throw new Error(payload.msg || "PayU verification did not return transaction details.");
  const amount = String(details.amount ?? details.amt ?? details.transaction_amount ?? "");
  const status = statusFromPayU(String(details.status ?? ""), String(details.unmappedstatus ?? ""));
  return {
    providerId: ID,
    providerPaymentReference: String(details.mihpayid ?? txnid),
    providerAttemptReference: txnid,
    status,
    clientAction: { type: "NONE" },
    safeMetadata: { payuStatus: String(details.status ?? ""), payuUnmappedStatus: String(details.unmappedstatus ?? ""), amount },
  };
}

export function buildPayUHostedCheckoutFields(input: {
  txnid: string;
  amount: string;
  productinfo: string;
  firstname: string;
  email: string;
  phone: string;
  udf1?: string;
  udf2?: string;
  udf3?: string;
  udf4?: string;
  udf5?: string;
}): Record<string, string> {
  const key = merchantKey();
  const fields = {
    key,
    txnid: input.txnid,
    amount: input.amount,
    productinfo: input.productinfo,
    firstname: input.firstname,
    email: input.email,
    phone: input.phone,
    udf1: input.udf1 ?? "",
    udf2: input.udf2 ?? "",
    udf3: input.udf3 ?? "",
    udf4: input.udf4 ?? "",
    udf5: input.udf5 ?? "",
    surl: absoluteSiteUrl("/api/payments/payu/callback"),
    furl: absoluteSiteUrl("/api/payments/payu/callback"),
    curl: absoluteSiteUrl("/api/payments/payu/callback"),
  };
  return { ...fields, hash: requestHash(fields) };
}

export function payUHostedCheckoutUrl(): string {
  merchantKey();
  merchantSalt();
  return paymentUrl();
}

export const payuPaymentProvider: PaymentProviderAdapter = {
  id: ID,
  capabilities: {
    createPayment: true,
    clientAction: true,
    webhookVerification: true,
    statusLookup: true,
    cancellation: false,
    refunds: false,
    partialRefunds: false,
  },

  async createPayment(request) {
    merchantKey();
    merchantSalt();
    if (request.amount.currency !== "INR") throw Object.assign(new Error("PayU provider currently supports INR only."), { code: "PAYMENT_INVALID_REQUEST" });
    const redirectUrl = absoluteSiteUrl(`/api/payments/payu/redirect?payment=${encodeURIComponent(request.paymentReference)}`);
    return {
      providerId: ID,
      providerPaymentReference: null,
      providerAttemptReference: request.attemptReference,
      status: "REQUIRES_ACTION",
      clientAction: { type: "REDIRECT", redirectUrl },
    };
  },

  async retrievePayment(request) {
    return verifyPaymentAtPayU(request.paymentReference);
  },

  async verifyPayment(request) {
    return verifyPaymentAtPayU(request.paymentReference);
  },

  async verifyWebhook({ body }): Promise<PaymentProviderWebhook> {
    const fields = new URLSearchParams(body);
    const suppliedHash = fields.get("hash")?.trim() ?? "";
    if (!suppliedHash || !safeEqualHex(responseHash(fields), suppliedHash)) {
      throw Object.assign(new Error("PayU callback hash verification failed."), { code: "WEBHOOK_VERIFICATION_FAILED" });
    }
    const txnid = fields.get("txnid")?.trim() ?? "";
    const amount = fields.get("amount")?.trim() ?? "";
    const currency = "INR";
    if (!txnid || !amount) throw new Error("PayU callback is missing transaction identity or amount.");
    const status = statusFromPayU(fields.get("status") ?? "", fields.get("unmappedstatus") ?? "");
    const providerReference = fields.get("mihpayid")?.trim() || txnid;
    return {
      verified: true,
      event: {
        providerId: ID,
        providerEventReference: `payu:${providerReference}:${fields.get("status") ?? ""}:${fields.get("addedon") ?? ""}`,
        providerPaymentReference: providerReference,
        internalPaymentReference: txnid,
        normalizedEventType: `PAYMENT_${status}`,
        status,
        occurredAt: fields.get("addedon") ? new Date(fields.get("addedon")!).toISOString() : new Date().toISOString(),
        amount: { value: amount, currency },
        currency,
        metadata: { mode: fields.get("mode") ?? "", unmappedstatus: fields.get("unmappedstatus") ?? "" },
      },
    };
  },

  normalizeStatus(input) {
    return statusFromPayU(String(input));
  },

  normalizeError(error) {
    const code = failureCode(error);
    if (code === "PROVIDER_TIMEOUT" || code === "PROVIDER_NETWORK_ERROR" || code === "PAYMENT_DECLINED" || code === "PAYMENT_INVALID_REQUEST" || code === "WEBHOOK_VERIFICATION_FAILED") return code;
    return "PROVIDER_UNKNOWN_ERROR";
  },
};
