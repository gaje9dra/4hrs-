import { db } from "@/lib/db/client";
import { DEFAULT_LOCALE, isSupportedLocale, normalizeLocale, type SupportedLocale } from "@/lib/i18n/registry";
import { isValidTimeZone, normalizeTimeZone } from "@/lib/i18n/timezone";

export type CustomerRegionalPreferences = {
  locale: SupportedLocale;
  timezone: string;
};

export async function getCustomerRegionalPreferences(customerId: string): Promise<CustomerRegionalPreferences> {
  const customer = await db.customer.findUnique({
    where: { id: customerId },
    select: { locale: true, timezone: true },
  });
  if (!customer) throw new Error("CUSTOMER_NOT_FOUND");
  return {
    locale: normalizeLocale(customer.locale),
    timezone: normalizeTimeZone(customer.timezone, "Asia/Kolkata"),
  };
}

export async function updateCustomerRegionalPreferences(input: {
  customerId: string;
  locale: unknown;
  timezone: unknown;
}): Promise<CustomerRegionalPreferences> {
  if (!isSupportedLocale(input.locale)) throw new Error("UNSUPPORTED_LOCALE");
  if (!isValidTimeZone(input.timezone)) throw new Error("UNSUPPORTED_TIMEZONE");
  const updated = await db.customer.update({
    where: { id: input.customerId },
    data: { locale: input.locale, timezone: input.timezone },
    select: { locale: true, timezone: true },
  });
  return {
    locale: normalizeLocale(updated.locale),
    timezone: normalizeTimeZone(updated.timezone, "Asia/Kolkata"),
  };
}

export const DEFAULT_CUSTOMER_REGIONAL_PREFERENCES: CustomerRegionalPreferences = {
  locale: DEFAULT_LOCALE,
  timezone: "Asia/Kolkata",
};