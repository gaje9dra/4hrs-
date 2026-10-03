# Phase 15.9 — Internationalization, Localization, Currency & Regionalization

## 1. Supported locales
- `en-IN` — English (India), default.
- `en-US` — English (United States).
- No other locale is supported by the application registry.

## 2. Locale registry
The canonical registry is `lib/i18n/registry.ts`. It owns supported locale codes, fallback locale, direction, default timezone, and default currency. Unsupported values deterministically fall back to `en-IN`.

## 3. Locale-resolution precedence
Request resolution is bounded and deterministic:
1. Explicit supported locale supplied by an application caller.
2. Authenticated customer locale, when supplied by the caller.
3. Persisted locale cookie.
4. `Accept-Language`.
5. `en-IN`.

The request helper is `lib/i18n/resolution.ts`. Locale is never used as an authorization, payment, tax, shipping, fulfillment, or order-state input.

## 4. Routing strategy
The existing application does not use locale-prefixed public routes. Phase 15.9 preserves that architecture rather than creating duplicate URLs. `localeFromPathname()` validates possible locale prefixes for future routing work, but no locale-prefix routing is enabled.

Because there are no separate localized public URLs, Phase 15.9 does not emit hreflang alternates or locale-specific sitemap URLs. Canonical URLs remain the existing canonical URLs.

## 5. Translation architecture
Translations live in `lib/i18n/messages.ts` behind controlled namespaces and stable keys. Customer input is never treated as a translation key and translation values are plain trusted application data.

Namespaces established for the architecture:
common, navigation, catalog, product, cart, checkout, payment, orders, shipping, returns, cases, account, auth, admin, notifications, validation, errors.

Only namespaces with currently required messages contain runtime content; the namespace union establishes the controlled ownership boundary.

## 6. Fallback strategy
The locale registry defines an explicit fallback chain. `en-US` falls back to `en-IN`; `en-IN` is its own fallback. Missing message keys are observable in development and resolve to an empty presentation value rather than exposing internal translation keys.

Fallback never changes money, payment amounts, order state, shipping state, fulfillment state, authorization, or privacy behavior.

## 7. Currency semantics
The existing domain remains authoritative:
- Product currency remains stored on Product.
- Order currency remains stored on Order.
- Historical order-item pricing is not rewritten.
- No currency conversion was introduced.

Supported display/transaction currency codes are explicitly bounded to the existing repository currency evidence: INR. Currency code validation is centralized.

Changing locale does not change a transaction's currency.

## 8. Money formatting
`lib/i18n/formatters.ts` exposes `formatMoney(amount, currency, locale)`. Formatting is presentation-only. No floating-point arithmetic is performed for financial calculations and the formatter never converts one currency into another.

Authoritative money continues to use the existing Prisma Decimal/currency representation.

## 9. Date/time architecture
Formatting is centralized in `lib/i18n/formatters.ts`. Instant timestamps remain canonical Date/ISO/DB values; localized strings are generated only at presentation boundaries.

Date-only and date-time formatting are separate APIs to avoid accidental timezone shifts.

## 10. Timezone strategy
Customer timezone is persisted separately from locale. The default is `Asia/Kolkata`. Timezones are validated through the platform's `Intl.DateTimeFormat` IANA timezone support.

Timezone affects presentation only. It does not alter authorization, transaction identity, order state, or historical timestamps.

## 11. Address/phone formatting
Address formatting accepts an explicit stored country code and does not infer financial or shipping eligibility from locale. Phone display formatting requires an explicit country context and keeps canonical storage separate from presentation.

## 12. Validation/error localization
Stable machine-readable error codes remain independent of translated text. Translation keys are controlled by application code.

## 13. Notification localization
Phase 15.7 notification ownership is preserved. At enqueue time, the recipient's normalized locale is snapshotted onto NotificationDelivery. Notification processing resolves the template using that stored locale, so a later customer preference change cannot cause an already-queued delivery to change language mid-flight.

Missing translation content falls back through the controlled locale registry. Notification eligibility and communication-consent logic remain owned by Phase 15.8.

## 14. Communication preference integration
Locale/timezone preferences are separate Customer fields and are not duplicated per communication category/channel. Changing locale or timezone cannot change marketing consent, opt-in state, channel eligibility, or unsubscribe state.

## 15. SEO/hreflang
Existing canonical URL architecture is preserved. Since locale-prefixed public URLs are not enabled, hreflang is intentionally not fabricated. Localized metadata support is provided by `lib/i18n/metadata.ts` for future routes that have real distinct locale URLs.

## 16. Structured data
Existing structured data remains canonical. No locale-specific price is generated and no translated product facts are fabricated.

## 17. Cache behavior
Locale-sensitive request resolution uses request headers/cookies at the application boundary. Locale-dependent metadata/rendering therefore remains request-aware instead of being silently reused across locales. Private customer locale data is not introduced into public cache keys or public URLs.

## 18. Accessibility
The document root receives the resolved language and remains LTR for both currently supported locales. The architecture does not claim RTL support. Existing semantic labels and focus behavior remain unchanged.

## 19. RTL readiness
RTL is not currently supported. New regionalization code avoids making RTL claims or introducing an unsupported RTL locale.

## 20. Security model
Locale input is normalized against a fixed allow-list. Translation resources are trusted application data. No arbitrary locale is used to load files. Locale does not participate in authorization. Timezone and country context are never treated as proof of identity, residency, tax jurisdiction, or payment currency.

## 21. Performance considerations
No third-party i18n runtime or complete locale bundle was introduced. Translation catalogs are small, server-resolvable modules, and formatting is performed only at presentation boundaries.

## 22. Database changes
Customer now has:
- `locale VARCHAR(16) NOT NULL DEFAULT 'en-IN'`
- `timezone VARCHAR(64) NOT NULL DEFAULT 'Asia/Kolkata'`

An index on Customer.locale supports future locale-based operational queries. Existing customers receive safe defaults. No historical commerce data is changed.

Migration:
`prisma/migrations/20261003110000_customer_regional_preferences/migration.sql`

## 23. Production configuration
No new secrets, provider credentials, exchange-rate APIs, or external translation services are required.

## 24. Known limitations
- Public URL locale prefixes are not enabled.
- There are no distinct translated English-language content variants; `en-IN` and `en-US` currently share English copy.
- No automatic currency conversion exists.
- No multi-currency payment processing was introduced.
- No international tax/shipping expansion was introduced.
- RTL is readiness-only, not implemented support.
- Existing hard-coded storefront copy remains where replacing it would constitute unrelated redesign; new localization boundaries are available for progressive migration.

## 25. Unsupported regions/currencies/locales
Unsupported locales deterministically fall back to `en-IN`. Unsupported currency codes are rejected by the formatter boundary. The phase does not add countries or currencies merely for completeness.

## 26. Legal/tax assumptions requiring review
Localization does not establish tax residency, tax jurisdiction, consumer-law compliance, payment compliance, or international shipping eligibility. Those remain separate domain/legal decisions.

## Production scenario verification
The Phase 15.9 test suite covers:
- invalid locale fallback
- locale precedence
- currency display without conversion
- timezone validation
- translation key safety/fallback
- regional defaults
- explicit-country phone presentation

Additional architecture guarantees:
- notification locale is snapshotted at enqueue
- locale does not alter communication consent
- canonical money remains unchanged by locale
- historical timestamps remain canonical
- locale is not an authorization input

## Validation
Required CI commands remain:
- `npm run lint`
- `npm run typecheck`
- `npm test`
- `npm run build`
- Prisma generation/validation and migration checks
- localization-specific tests
- notification/SEO/security regressions where applicable

No CI gate is disabled or weakened by Phase 15.9.
