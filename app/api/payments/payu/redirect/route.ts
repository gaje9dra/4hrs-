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
  const paymentId = new URL(request.url).searchParams.get("payment")?.trim() ?? "";
  if (!/^[0-9a-f-]{36}$/i.test(paymentId)) return new Response("Invalid payment reference.", { status: 400 });

  const token = (await cookies()).get(CUSTOMER_SESSION_COOKIE)?.value;
  if (!token) return new Response("Authentication is required.", { status: 401 });
  const session = await db.customerSession.findFirst({
    where: { sessionTokenHash: hashSessionToken(token), revokedAt: null, expiresAt: { gt: new Date() } },
    select: { customerId: true },
  });
  if (!session) return new Response("Authentication is required.", { status: 401 });

  const payment = await db.payment.findFirst({
    where: { id: paymentId, customerId: session.customerId },
    include: { customer: { select: { email: true, displayName: true, addresses: { where: { isDefault: true }, take: 1, select: { phone: true } } } } },
  });
  if (!payment) return new Response("Payment could not be found.", { status: 404 });
  if (payment.status !== "CREATED" && payment.status !== "REQUIRES_ACTION") return new Response("Payment is no longer payable.", { status: 409 });

  const phone = payment.customer.addresses[0]?.phone?.trim() ?? "";
  if (!phone) return new Response("A phone number is required before payment.", { status: 409 });

  const fields = buildPayUHostedCheckoutFields({
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
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Redirecting to PayU</title></head><body><p>Redirecting to secure payment…</p><form id="payu" method="post" action="${action}">${inputs}</form><script>document.getElementById("payu").submit()</script></body></html>`;
  return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
}
