import { NextResponse } from "next/server";
import { resolveRequestId } from "@/lib/observability/request";
import { reportError } from "@/lib/observability/errors";

export type ApiAudience =
  | "PUBLIC_STOREFRONT"
  | "AUTHENTICATED_CUSTOMER"
  | "ADMIN"
  | "INTERNAL"
  | "PROVIDER"
  | "WEBHOOK"
  | "BACKGROUND_JOB";

export type ApiClassification = {
  audience: ApiAudience;
  browserAccessible: boolean;
  cache: "public" | "private" | "no-store";
  idempotent: boolean;
  retryable: boolean;
  externallyContractSensitive: boolean;
};

export const API_CLASSIFICATIONS: Record<ApiAudience, ApiClassification> = {
  PUBLIC_STOREFRONT: { audience: "PUBLIC_STOREFRONT", browserAccessible: true, cache: "public", idempotent: true, retryable: true, externallyContractSensitive: true },
  AUTHENTICATED_CUSTOMER: { audience: "AUTHENTICATED_CUSTOMER", browserAccessible: true, cache: "private", idempotent: false, retryable: false, externallyContractSensitive: true },
  ADMIN: { audience: "ADMIN", browserAccessible: true, cache: "private", idempotent: false, retryable: false, externallyContractSensitive: true },
  INTERNAL: { audience: "INTERNAL", browserAccessible: false, cache: "no-store", idempotent: false, retryable: false, externallyContractSensitive: false },
  PROVIDER: { audience: "PROVIDER", browserAccessible: false, cache: "no-store", idempotent: true, retryable: true, externallyContractSensitive: false },
  WEBHOOK: { audience: "WEBHOOK", browserAccessible: false, cache: "no-store", idempotent: true, retryable: true, externallyContractSensitive: false },
  BACKGROUND_JOB: { audience: "BACKGROUND_JOB", browserAccessible: false, cache: "no-store", idempotent: true, retryable: true, externallyContractSensitive: false },
};

export class ApiContractError extends Error {
  readonly code: string;
  readonly status: number;
  readonly retryable: boolean;
  readonly details?: Record<string, unknown>;

  constructor(code: string, message: string, status: number, options: { retryable?: boolean; details?: Record<string, unknown> } = {}) {
    super(message);
    this.name = "ApiContractError";
    this.code = code;
    this.status = status;
    this.retryable = options.retryable ?? false;
    this.details = options.details;
  }
}

export function apiResponse<T>(data: T, request: Request, init: ResponseInit = {}, classification?: ApiClassification): NextResponse<T> {
  const requestId = resolveRequestId(request.headers.get("x-request-id"));
  const headers = new Headers(init.headers);
  headers.set("x-request-id", requestId);
  headers.set("x-content-type-options", "nosniff");
  if (classification?.cache === "no-store" || classification?.cache === "private") headers.set("cache-control", "private, no-store, max-age=0");
  return NextResponse.json(data, { ...init, headers });
}

export function apiErrorResponse(error: unknown, request: Request): NextResponse {
  const requestId = resolveRequestId(request.headers.get("x-request-id"));
  const reported = reportError(error, { requestId, outcome: "failure" });
  if (error instanceof ApiContractError) {
    return apiResponse({ error: { code: error.code, message: error.message, requestId, retryable: error.retryable, ...(error.details ? { details: error.details } : {}) } }, request, { status: error.status });
  }
  return apiResponse({
    error: {
      code: reported.errorClass === "validation" ? "INVALID_REQUEST" : "INTERNAL_ERROR",
      message: "The request could not be completed safely.",
      requestId,
      retryable: reported.errorClass === "dependency" || reported.errorClass === "timeout",
    },
  }, request, { status: reported.errorClass === "validation" ? 400 : 503 });
}

export function parseIdempotencyKey(request: Request): string {
  const value = request.headers.get("Idempotency-Key")?.trim() ?? "";
  if (!/^[A-Za-z0-9._~-]{16,128}$/.test(value)) throw new ApiContractError("INVALID_IDEMPOTENCY_KEY", "A valid Idempotency-Key header is required.", 400);
  return value;
}

export function parsePositivePagination(request: Request, options: { maxPageSize?: number; allowedKeys?: readonly string[] } = {}): { page?: number; pageSize?: number } {
  const maxPageSize = options.maxPageSize ?? 100;
  const allowed = new Set(options.allowedKeys ?? ["page", "pageSize"]);
  const url = new URL(request.url);
  for (const key of url.searchParams.keys()) {
    if (!allowed.has(key)) throw new ApiContractError("UNSUPPORTED_PARAMETER", "The request contains an unsupported parameter.", 400);
  }
  const parse = (name: string, max: number) => {
    const raw = url.searchParams.get(name);
    if (raw === null) return undefined;
    if (!/^\d+$/.test(raw)) throw new ApiContractError("INVALID_PAGINATION", "Pagination parameters are invalid.", 400);
    const value = Number(raw);
    if (!Number.isSafeInteger(value) || value < 1 || value > max) throw new ApiContractError("INVALID_PAGINATION", "Pagination parameters are invalid.", 400);
    return value;
  };
  return { page: parse("page", Number.MAX_SAFE_INTEGER), pageSize: parse("pageSize", maxPageSize) };
}

export function noStoreClassification(): ApiClassification {
  return { ...API_CLASSIFICATIONS.AUTHENTICATED_CUSTOMER, cache: "no-store" };
}
