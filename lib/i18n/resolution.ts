import { cookies, headers } from "next/headers";
import { DEFAULT_LOCALE, normalizeLocale, type SupportedLocale } from "./registry";

export const LOCALE_COOKIE = "4hrs_locale";

function parseAcceptLanguage(value: string | null): SupportedLocale | null {
  if (!value) return null;
  const candidates = value
    .split(",")
    .map((part) => part.trim().split(";")[0]?.trim())
    .filter(Boolean);
  for (const candidate of candidates) {
    if (candidate.toLowerCase() === "en-in") return "en-IN";
    if (candidate.toLowerCase() === "en-us" || candidate.toLowerCase() === "en") return "en-US";
  }
  return null;
}

export function resolveLocale(input: {
  explicit?: unknown;
  customerLocale?: unknown;
  persistedLocale?: unknown;
  acceptLanguage?: string | null;
}): SupportedLocale {
  if (input.explicit) return normalizeLocale(input.explicit);
  if (input.customerLocale) return normalizeLocale(input.customerLocale);
  if (input.persistedLocale) return normalizeLocale(input.persistedLocale);
  return parseAcceptLanguage(input.acceptLanguage ?? null) ?? DEFAULT_LOCALE;
}

export async function resolveRequestLocale(customerLocale?: string | null): Promise<SupportedLocale> {
  const requestHeaders = await headers();
  const cookieLocale = (await cookies()).get(LOCALE_COOKIE)?.value;
  return resolveLocale({
    customerLocale,
    persistedLocale: cookieLocale,
    acceptLanguage: requestHeaders.get("accept-language"),
  });
}