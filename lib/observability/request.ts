import { randomUUID } from "node:crypto";
import { sanitizeRequestId } from "@/lib/observability/redaction";

export const REQUEST_ID_HEADER = "x-request-id";

export function resolveRequestId(value: string | null | undefined): string {
  return sanitizeRequestId(value) ?? randomUUID();
}

export function requestHeadersWithId(headers: Headers, requestId: string): Headers {
  const next = new Headers(headers);
  next.set(REQUEST_ID_HEADER, requestId);
  return next;
}
