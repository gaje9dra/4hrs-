const SENSITIVE_KEY = /password|passwd|secret|token|authorization|cookie|set-cookie|credential|api[-_]?key|access[-_]?key|private[-_]?key|database[-_]?url|cvv|card[-_]?number|session/i;
const MAX_DEPTH = 5;
const MAX_KEYS = 40;
const MAX_ARRAY = 40;
const MAX_STRING = 2000;

export function sanitizeTelemetryValue(value: unknown, depth = 0): unknown {
  if (depth > MAX_DEPTH) return "[TRUNCATED]";
  if (value === null || typeof value === "boolean" || typeof value === "number") return value;
  if (typeof value === "string") return value.length > MAX_STRING ? value.slice(0, MAX_STRING) + "…" : value;
  if (value instanceof Error) return { name: value.name, message: sanitizeTelemetryValue(value.message, depth + 1), code: sanitizeTelemetryValue((value as Error & { code?: unknown }).code, depth + 1) };
  if (Array.isArray(value)) return value.slice(0, MAX_ARRAY).map((item) => sanitizeTelemetryValue(item, depth + 1));
  if (typeof value === "object") {
    const output: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value).slice(0, MAX_KEYS)) {
      if (SENSITIVE_KEY.test(key)) output[key] = "[REDACTED]";
      else output[key] = sanitizeTelemetryValue(item, depth + 1);
    }
    return output;
  }
  return String(value);
}

export function sanitizeRequestId(value: string | null | undefined): string | null {
  if (!value) return null;
  const normalized = value.trim();
  return /^[A-Za-z0-9._:-]{1,128}$/.test(normalized) ? normalized : null;
}
