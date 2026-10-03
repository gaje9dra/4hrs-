import { logger } from "@/lib/observability/logger";
import { reportError } from "@/lib/observability/errors";

function requestIdFromHeaders(headers: unknown): string | null {
  if (headers instanceof Headers) return headers.get("x-request-id");
  if (headers && typeof headers === "object") {
    const value = (headers as Record<string, unknown>)["x-request-id"];
    return Array.isArray(value) ? String(value[0] ?? "") || null : typeof value === "string" ? value : null;
  }
  return null;
}

export function onRequestError(
  error: unknown,
  request: { path?: string; headers?: unknown },
  context?: { routerKind?: string; routePath?: string; routeType?: string },
) {
  const requestId = requestIdFromHeaders(request?.headers);
  reportError(error, {
    requestId,
    resourceType: context?.routeType ?? "request",
    resourceId: context?.routePath ?? request?.path ?? null,
    outcome: "failure",
  });
  logger.error("request.failed", {
    requestId,
    resourceType: context?.routeType ?? "request",
    resourceId: context?.routePath ?? request?.path ?? null,
    outcome: "failure",
  });
}
