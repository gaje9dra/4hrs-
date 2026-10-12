import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { db } from "@/lib/db/client";
import { CUSTOMER_SESSION_COOKIE, hashSessionToken } from "@/lib/auth/session";
import { buildPayUHostedCheckoutFields, payUHostedCheckoutUrl } from "@/lib/payments/providers/payu";

function firstName(displayName: string | null, email: string): string {
  const value = displayName?.trim() || email.split("@")[0] || "Customer";
  return value.split(/\s+/)[0].slice(0, 60) || "Customer";
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export async function GET(request: Request) {
  const searchParams = new URL(request.url).searchParams;
  const paymentReference = searchParams.get("payment")?.trim() ?? "";
  const method = searchParams.get("method")?.trim() ?? "";
  if (!paymentReference || paymentReference.length > 128) return new Response("Invalid payment reference.", { status: 400 });

  const token = (await cookies()).get(CUSTOMER_SESSION_COOKIE)?.value;
  if (!token) return new Response("Authentication is required.", { status: 401 });
  const session = await db.customerSession.findFirst({
    where: { sessionTokenHash: hashSessionToken(token), revokedAt: null, expiresAt: { gt: new Date() } },
    select: { customerId: true },
  });
  if (!session) return new Response("Authentication is required.", { status: 401 });

  const payment = await db.payment.findFirst({
    where: { internalReference: paymentReference, customerId: session.customerId },
    include: { customer: { select: { email: true, displayName: true, addresses: { where: { isDefault: true }, take: 1, select: { phone: true } } } } },
  });
  if (!payment) return new Response("Payment could not be found.", { status: 404 });
  if (payment.status !== "CREATED" && payment.status !== "REQUIRES_ACTION") return new Response("Payment is no longer payable.", { status: 409 });

  const phone = payment.customer.addresses[0]?.phone?.trim() ?? "";
  if (!phone) return new Response("A phone number is required before payment.", { status: 409 });

  const enforcePayMethod = method === "upi"
    ? "upi"
    : method === "cards"
      ? "creditcard|debitcard"
      : method === "netbanking"
        ? "netbanking"
        : undefined;

  const fields = buildPayUHostedCheckoutFields({
    enforcePayMethod,
    txnid: payment.internalReference,
    amount: payment.amount.toFixed(2),
    productinfo: "4HRS+ Order",
    firstname: firstName(payment.customer.displayName, payment.customer.email),
    email: payment.customer.email,
    phone,
  });

  const inputs = Object.entries(fields).map(([name, value]) =>
    `<input type="hidden" name="${escapeHtml(name)}" value="${escapeHtml(value)}">`,
  ).join("");
  const action = escapeHtml(payUHostedCheckoutUrl());

  // This route returns a standalone HTML response, so it must own the nonce
  // and CSP together. Request headers are not a reliable source of a nonce
  // after the Netlify/Next.js proxy boundary; a missing or mismatched nonce
  // leaves customers stuck on this page instead of posting to PayU.
  const nonce = randomBytes(18).toString("base64");
  const script = `<script nonce="${nonce}">(()=>{const form=document.getElementById("payu");if(form instanceof HTMLFormElement){form.submit();}})()</script>`;
  // Fallback for browsers or hosting layers that block automatic form submission.
  const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Redirecting to PayU</title><style>body{font:16px system-ui,sans-serif;margin:2rem;color:#111}main{max-width:32rem;margin:10vh auto;padding:1.5rem;border:1px solid #ddd;border-radius:.5rem}button{margin-top:1rem;padding:.85rem 1.1rem;background:#111;color:#fff;border:0;font:inherit;cursor:pointer}p{line-height:1.5}</style></head><body><main><p>Redirecting to PayU secure payment…</p><form id="payu" method="post" action="${action}">${inputs}<noscript><p>Automatic redirect is unavailable. Continue securely to PayU below.</p></noscript><button type="submit">Continue to secure payment</button></form></main>${script}</body></html>`;
  const headers = new Headers({
    "Content-Type": "text/html; charset=utf-8",
    "Cache-Control": "no-store",
    "Content-Security-Policy": [
      "default-src 'none'",
      `script-src 'nonce-${nonce}'`,
      "form-action 'self' https://test.payu.in https://secure.payu.in",
      "base-uri 'none'",
      "frame-ancestors 'none'",
      "object-src 'none'",
    ].join("; "),
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
  });
  return new Response(html, { headers });
}
