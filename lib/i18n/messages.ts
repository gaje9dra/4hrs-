import type { SupportedLocale } from "./registry";

export type TranslationNamespace =
  | "common"
  | "navigation"
  | "catalog"
  | "product"
  | "cart"
  | "checkout"
  | "payment"
  | "orders"
  | "shipping"
  | "returns"
  | "cases"
  | "account"
  | "auth"
  | "admin"
  | "notifications"
  | "validation"
  | "errors";

const messages = {
  "en-IN": {
    common: { loading: "Loading", save: "Save", cancel: "Cancel", back: "Back" },
    navigation: { home: "Home", shop: "Shop", account: "Account" },
    validation: { required: "This field is required.", invalidLocale: "The selected language is not supported." },
    errors: { generic: "Something went wrong. Please try again.", notFound: "The requested resource could not be found." },
    notifications: {
      orderConfirmed: "Your 4HRS+ order is confirmed",
      paymentReceived: "Payment received for order {{orderNumber}}",
      paymentFailed: "Payment update for order {{orderNumber}}",
      securityPasswordChanged: "Your 4HRS+ password was changed",
      securitySessionsRevoked: "Your 4HRS+ sessions were signed out",
    },
  },
  "en-US": {
    common: { loading: "Loading", save: "Save", cancel: "Cancel", back: "Back" },
    navigation: { home: "Home", shop: "Shop", account: "Account" },
    validation: { required: "This field is required.", invalidLocale: "The selected language is not supported." },
    errors: { generic: "Something went wrong. Please try again.", notFound: "The requested resource could not be found." },
    notifications: {
      orderConfirmed: "Your 4HRS+ order is confirmed",
      paymentReceived: "Payment received for order {{orderNumber}}",
      paymentFailed: "Payment update for order {{orderNumber}}",
    },
  },
} as const;

type Messages = (typeof messages)["en-IN"];

export function getMessages(locale: SupportedLocale): Messages {
  return messages[locale];
}

export function translate(
  locale: SupportedLocale,
  namespace: TranslationNamespace,
  key: string,
  variables: Record<string, string | number> = {},
): string {
  const catalog = getMessages(locale) as Record<string, Record<string, string>>;
  const value = catalog[namespace]?.[key];
  if (!value) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("Missing translation", { locale, namespace, key });
    }
    const fallback = getMessages("en-IN") as Record<string, Record<string, string>>;
    const fallbackValue = fallback[namespace]?.[key];
    if (!fallbackValue) return "";
    return interpolate(fallbackValue, variables);
  }
  return interpolate(value, variables);
}

function interpolate(template: string, variables: Record<string, string | number>): string {
  return template.replace(/{{([A-Za-z][A-Za-z0-9_]*)}}/g, (_, key: string) => {
    const value = variables[key];
    return value === undefined ? "" : String(value);
  });
}