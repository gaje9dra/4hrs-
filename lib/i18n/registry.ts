export const DEFAULT_LOCALE = "en-IN" as const;
export const SUPPORTED_LOCALES = ["en-IN", "en-US"] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

export type LocaleDefinition = {
  code: SupportedLocale;
  language: "en";
  region: "IN" | "US";
  displayName: string;
  fallbackLocale: SupportedLocale;
  direction: "ltr";
  defaultTimezone: string;
  defaultCurrency: "INR" | "USD";
};

export const LOCALE_REGISTRY: Record<SupportedLocale, LocaleDefinition> = {
  "en-IN": {
    code: "en-IN",
    language: "en",
    region: "IN",
    displayName: "English (India)",
    fallbackLocale: "en-IN",
    direction: "ltr",
    defaultTimezone: "Asia/Kolkata",
    defaultCurrency: "INR",
  },
  "en-US": {
    code: "en-US",
    language: "en",
    region: "US",
    displayName: "English (United States)",
    fallbackLocale: "en-IN",
    direction: "ltr",
    defaultTimezone: "America/New_York",
    defaultCurrency: "USD",
  },
};

export const SUPPORTED_CURRENCIES = ["INR", "USD"] as const;
export type SupportedCurrency = (typeof SUPPORTED_CURRENCIES)[number];

export function isSupportedLocale(value: unknown): value is SupportedLocale {
  return typeof value === "string" && (SUPPORTED_LOCALES as readonly string[]).includes(value);
}

export function normalizeLocale(value: unknown): SupportedLocale {
  return isSupportedLocale(value) ? value : DEFAULT_LOCALE;
}

export function getLocaleDefinition(locale: unknown): LocaleDefinition {
  return LOCALE_REGISTRY[normalizeLocale(locale)];
}

export function isSupportedCurrency(value: unknown): value is SupportedCurrency {
  return typeof value === "string" && (SUPPORTED_CURRENCIES as readonly string[]).includes(value);
}

export function assertSupportedCurrency(value: string): SupportedCurrency {
  if (!isSupportedCurrency(value)) throw new Error("UNSUPPORTED_CURRENCY");
  return value;
}

export function localeFallbackChain(locale: unknown): SupportedLocale[] {
  const normalized = normalizeLocale(locale);
  const fallback = LOCALE_REGISTRY[normalized].fallbackLocale;
  return normalized === fallback ? [normalized] : [normalized, fallback];
}