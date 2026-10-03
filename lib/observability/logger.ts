import { randomUUID } from "node:crypto";
import { sanitizeTelemetryValue } from "@/lib/observability/redaction";

export type LogSeverity = "debug" | "info" | "warn" | "error";
export type TelemetryActorType = "customer" | "admin" | "system" | "anonymous";
export type LogContext = Readonly<{ requestId?: string | null; correlationId?: string | null; operationId?: string | null; actorType?: TelemetryActorType; actorId?: string | null; resourceType?: string | null; resourceId?: string | null; provider?: string | null; durationMs?: number | null; outcome?: "success" | "failure" | "timeout" | "rejected"; errorCode?: string | null }>;

function write(severity: LogSeverity, event: string, context: LogContext = {}, data?: unknown): void {
  try {
    const record = {
      timestamp: new Date().toISOString(),
      severity,
      environment: process.env.NODE_ENV ?? "unknown",
      service: "4hrs-fashion",
      event: event.slice(0, 120),
      ...sanitizeTelemetryValue(context) as Record<string, unknown>,
      ...(data === undefined ? {} : { data: sanitizeTelemetryValue(data) }),
    };
    const line = JSON.stringify(record);
    if (severity === "error") console.error(line);
    else if (severity === "warn") console.warn(line);
    else console.log(line);
  } catch {}
}
export const logger = {
  debug: (event: string, context?: LogContext, data?: unknown) => write("debug", event, context, data),
  info: (event: string, context?: LogContext, data?: unknown) => write("info", event, context, data),
  warn: (event: string, context?: LogContext, data?: unknown) => write("warn", event, context, data),
  error: (event: string, context?: LogContext, data?: unknown) => write("error", event, context, data),
};
export function createOperationId(): string { return randomUUID(); }
