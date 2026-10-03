import assert from "node:assert/strict";
import test from "node:test";
import { formatDateOnly, formatMoney, formatNumber } from "@/lib/i18n/formatters";
import { getLocaleDefinition, normalizeLocale, localeFallbackChain } from "@/lib/i18n/registry";
import { resolveLocale } from "@/lib/i18n/resolution";
import { translate } from "@/lib/i18n/messages";
import { isValidTimeZone, normalizeTimeZone } from "@/lib/i18n/timezone";
import { formatPhoneForDisplay } from "@/lib/i18n/phone";

test("unsupported locales deterministically fall back to en-IN", () => {
  assert.equal(normalizeLocale("fr-FR"), "en-IN");
  assert.deepEqual(localeFallbackChain("en-US"), ["en-US", "en-IN"]);
});

test("locale resolution uses deterministic precedence", () => {
  assert.equal(resolveLocale({ explicit: "en-US", customerLocale: "en-IN", acceptLanguage: "en-IN" }), "en-US");
  assert.equal(resolveLocale({ customerLocale: "en-US", persistedLocale: "en-IN", acceptLanguage: "en-IN" }), "en-US");
  assert.equal(resolveLocale({ persistedLocale: "en-US", acceptLanguage: "en-IN" }), "en-US");
  assert.equal(resolveLocale({ acceptLanguage: "en-US,en;q=0.8" }), "en-US");
  assert.equal(resolveLocale({ acceptLanguage: "fr-FR" }), "en-IN");
});

test("money formatting never performs currency conversion", () => {
  assert.equal(formatMoney("999.00", "INR", "en-IN"), "₹999.00");
  assert.equal(formatMoney("999.00", "INR", "en-US"), "₹999.00");
  assert.throws(() => formatMoney("999.00", "USD", "en-US"), /UNSUPPORTED_CURRENCY/);
  assert.throws(() => formatMoney("not-a-number", "INR", "en-IN"), /INVALID_MONEY_VALUE/);
});

test("number and date formatting are locale and timezone aware", () => {
  assert.equal(formatNumber(1234567.89, "en-IN"), "12,34,567.89");
  assert.match(formatDateOnly("2026-10-03T00:00:00.000Z", "en-IN", "Asia/Kolkata"), /Oct/);
});

test("timezone validation is bounded to valid IANA zones", () => {
  assert.equal(isValidTimeZone("Asia/Kolkata"), true);
  assert.equal(isValidTimeZone("Definitely/NotAZone"), false);
  assert.equal(normalizeTimeZone("Definitely/NotAZone", "Asia/Kolkata"), "Asia/Kolkata");
});

test("translation lookup uses controlled keys and deterministic fallback", () => {
  assert.equal(translate("en-IN", "common", "save"), "Save");
  assert.equal(translate("en-US", "notifications", "paymentReceived", { orderNumber: "4HRS-1001" }), "Payment received for order 4HRS-1001");
  assert.equal(translate("en-IN", "validation", "missing-key"), "");
});

test("locale registry keeps regional defaults explicit", () => {
  assert.equal(getLocaleDefinition("en-IN").defaultTimezone, "Asia/Kolkata");
  assert.equal(getLocaleDefinition("en-US").defaultTimezone, "America/New_York");
});

test("phone formatting requires an explicit country context", () => {
  assert.equal(formatPhoneForDisplay("+919876543210", "IN"), "+91 98765 43210");
  assert.equal(formatPhoneForDisplay("+14155552671", "US"), "+1 415 555 2671");
});