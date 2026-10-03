import { cookies } from "next/headers";
import { requireCurrentCustomer } from "@/lib/auth/context";
import { isAuthenticationError } from "@/lib/auth/errors";
import { assertSameOrigin, authJson, readAuthJson } from "@/lib/auth/http";
import { CustomerPrivacyError, deleteCustomerData, exportCustomerData } from "@/lib/customer/privacy";
import { consumeCustomerPrivacyRateLimit } from "@/lib/customer/privacy-rate-limit";
import { CUSTOMER_SESSION_COOKIE } from "@/lib/auth/session";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function errorResponse(error: unknown) {
  if (isAuthenticationError(error)) {
    return authJson(
      { error: { code: error.code, message: error.publicMessage } },
      { status: error.code === "RATE_LIMITED" ? 429 : 401, headers: error.code === "RATE_LIMITED" ? { "retry-after": "60" } : undefined },
    );
  }
  if (error instanceof CustomerPrivacyError) {
    const status =
      error.code === "CUSTOMER_NOT_FOUND" ? 404 :
      error.code === "EXPORT_TOO_LARGE" ? 413 :
      error.code === "CONFIRMATION_REQUIRED" ? 400 :
      error.code === "ADMIN_ACCOUNT_PROTECTED" ? 403 :
      503;
    return authJson({ error: { code: error.code, message: error.message } }, { status });
  }
  return authJson(
    { error: { code: "PRIVACY_DATABASE_ERROR", message: "Customer privacy operation could not be completed safely." } },
    { status: 503 },
  );
}

export async function GET(request: Request) {
  try {
    const current = await requireCurrentCustomer(request);
    consumeCustomerPrivacyRateLimit(current.customer.id, request, 3, 60 * 60 * 1000);
    const data = await exportCustomerData(current.customer.id, request.headers.get("x-request-id"));
    return new Response(JSON.stringify(data, null, 2), {
      status: 200,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "content-disposition": 'attachment; filename="4hrs-account-data.json"',
        "cache-control": "private, no-store, max-age=0",
        "x-content-type-options": "nosniff",
        "x-robots-tag": "noindex, nofollow, noarchive",
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const current = await requireCurrentCustomer(request);
    consumeCustomerPrivacyRateLimit(current.customer.id, request, 3, 24 * 60 * 60 * 1000);
    const body = await readAuthJson(request);
    if (Object.keys(body).some((key) => key !== "confirmation")) {
      throw new CustomerPrivacyError("CONFIRMATION_REQUIRED", "Explicit account deletion confirmation is required.");
    }
    const result = await deleteCustomerData(
      current.customer.id,
      body.confirmation,
      request.headers.get("x-request-id"),
    );
    const cookieStore = await cookies();
    cookieStore.set(CUSTOMER_SESSION_COOKIE, "", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 0 });
    return authJson({ deletion: { status: "completed", anonymizedAt: result.anonymizedAt } });
  } catch (error) {
    return errorResponse(error);
  }
}
