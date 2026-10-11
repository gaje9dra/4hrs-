import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { resolveRequestId, REQUEST_ID_HEADER } from "@/lib/observability/request";

function contentSecurityPolicy(nonce: string): string {
  const directives = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${process.env.NODE_ENV === "development" ? " " + "unsafe-" + "eval" : ""}`,
    `style-src 'self' 'nonce-${nonce}'`,
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    "connect-src 'self'",
    "media-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    // PayU Hosted Checkout is submitted as a cross-origin POST form.
    // Keep form submissions restricted to our site and the two official PayU gateways.
    "form-action 'self' https://test.payu.in https://secure.payu.in",
    "frame-ancestors 'none'",
    "frame-src 'none'",
    "manifest-src 'self'",
    "worker-src 'self' blob:",
    ...(process.env.NODE_ENV === "production" ? ["upgrade-insecure-requests"] : []),
  ];
  return directives.join("; ");
}

export function proxy(request: NextRequest) {
  const nonce = Buffer.from(globalThis.crypto.randomUUID()).toString("base64");
  const csp = process.env.NODE_ENV === "production" ? contentSecurityPolicy(nonce) : null;
  const requestId = resolveRequestId(request.headers.get(REQUEST_ID_HEADER));
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set(REQUEST_ID_HEADER, requestId);
  if (csp) requestHeaders.set("Content-Security-Policy", csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  if (csp) response.headers.set("Content-Security-Policy", csp);
  response.headers.set(REQUEST_ID_HEADER, requestId);
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)"],
};
