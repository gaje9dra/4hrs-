import type { Decimal } from "@prisma/client/runtime/library";
import { getLocaleDefinition, normalizeLocale, assertSupportedCurrency, type SupportedCurrency, type SupportedLocale } from "./registry";

type DecimalLike = Decimal | string | number;

function numericDisplayValue(value: DecimalLike): number {
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number(value);
  return value.toNumber();
}

export function formatNumber(value: number, locale: SupportedLocale, options?: Intl.NumberFormatOptions): string {
  return new Intl.NumberFormat(locale, options).format(value);
}

export function formatPercent(value: number, locale: SupportedLocale, maximumFractionDigits = 2): string {
  return formatNumber(value, locale, { style: "percent", maximumFractionDigits });
}

export function formatQuantity(value: number, locale: SupportedLocale): string {
  return formatNumber(value, locale, { maximumFractionDigits: 0 });
}

export function formatMoney(
  amount: DecimalLike,
  currency: string,
  locale: SupportedLocale = "en-IN",
): string {
  const code = assertSupportedCurrency(currency);
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: code,
    currencyDisplay: "symbol",
  }).format(numericDisplayValue(amount));
}

export function formatDateTime(
  value: Date | string | number,
  locale: SupportedLocale,
  timezone: string,
  options: Intl.DateTimeFormatOptions = {},
): string {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: timezone,
    ...options,
  }).format(new Date(value));
}

export function formatDateOnly(
  value: Date | string | number,
  locale: SupportedLocale,
  timezone: string,
): string {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeZone: timezone,
  }).format(new Date(value));
}

export function formatBusinessDate(value: Date | string | number, locale: SupportedLocale, timezone: string): string {
  return new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: timezone,
  }).format(new Date(value));
}

export function getDefaultTimezone(locale: SupportedLocale): string {
  return getLocaleDefinition(normalizeLocale(locale)).defaultTimezone;
}

export function getDefaultCurrency(locale: SupportedLocale): SupportedCurrency {
  return getLocaleDefinition(normalizeLocale(locale)).defaultCurrency;
}