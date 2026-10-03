import { logger } from "@/lib/observability/logger";
import { reportError } from "@/lib/observability/errors";

export function onRequestError(
  error: unknown,
  request: { path?: string; headers?: Headers },
  context?: { routerKind?: string; routePath?: string; routeType?: string },
) {
  const requestId = request?.headers?.get("x-request-id");
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
