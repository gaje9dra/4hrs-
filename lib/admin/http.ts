import { CatalogServiceError } from "@/lib/catalog/errors";
import { NextResponse } from "next/server";
import { AdminError } from "@/lib/admin/errors";
import { isTrustedStateChangingRequest } from "@/lib/security/request";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function isValidAdminId(value: unknown): value is string { return typeof value === "string" && UUID_PATTERN.test(value.trim()); }
export function adminJson<T>(data: T, init: ResponseInit = {}) {
  return NextResponse.json(data, { ...init, headers: {
    "cache-control": "private, no-store, max-age=0",
    "x-content-type-options": "nosniff",
    "x-robots-tag": "noindex, nofollow, noarchive",
    ...(init.headers ?? {}),
  }});
}
export function adminErrorResponse(error: unknown) {
  if (error instanceof AdminError) {
    const status = error.code === "ADMIN_REQUIRED" ? 401 : error.code === "FORBIDDEN" ? 403 :
      error.code === "NOT_FOUND" ? 404 : error.code === "CONFLICT" ? 409 :
      error.code === "RATE_LIMITED" ? 429 : error.code === "INVALID_REQUEST" ? 400 : 503;
    return adminJson({ error: { code: error.code, message: error.message } }, { status });
  }
  return adminJson({ error: { code: "DATABASE_ERROR", message: "The administrative operation could not be completed safely." } }, { status: 503 });
}
export function assertAdminSameOrigin(request: Request): void {
  if (!isTrustedStateChangingRequest(request)) {
    throw new AdminError("FORBIDDEN", "The request origin is not allowed.");
  }
}
export async function readAdminJson(request: Request): Promise<Record<string, unknown>> {
  const length = request.headers.get("content-length");
  if (length && Number(length) > 32 * 1024) throw new AdminError("INVALID_REQUEST", "Request is invalid.");
  try {
    const body = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error();
    return body as Record<string, unknown>;
  } catch { throw new AdminError("INVALID_REQUEST", "Request is invalid."); }
}
export function adminCatalogErrorResponse(error: unknown) {
  if (error instanceof CatalogServiceError) {
    const status = error.code === "PRODUCT_NOT_FOUND" || error.code === "VARIANT_NOT_FOUND" || error.code === "CATEGORY_NOT_FOUND" || error.code === "COLLECTION_NOT_FOUND" || error.code === "IMAGE_NOT_FOUND" ? 404 :
      error.code === "CATALOG_CONFLICT" ? 409 :
      error.code.startsWith("DUPLICATE_") || error.code === "PRODUCT_ALREADY_EXISTS" ? 409 :
      400;
    const details = error.cause && typeof error.cause === "object" && "issues" in error.cause
      ? { issues: (error.cause as { issues?: unknown }).issues }
      : undefined;
    return adminJson({
      error: {
        code: error.code,
        message: error.message,
        ...(details ? { details } : {}),
      },
    }, { status });
  }
  return adminErrorResponse(error);
}
