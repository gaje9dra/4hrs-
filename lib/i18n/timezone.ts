export function isValidTimeZone(value: unknown): value is string {
  if (typeof value !== "string" || value.length < 3 || value.length > 64) return false;
  try {
    new Intl.DateTimeFormat("en", { timeZone: value }).format();
    return true;
  } catch {
    return false;
  }
}

export function normalizeTimeZone(value: unknown, fallback: string): string {
  return isValidTimeZone(value) ? value : fallback;
}