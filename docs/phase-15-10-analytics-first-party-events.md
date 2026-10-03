# Phase 15.10 — Analytics, Consent-Aware Tracking & First-Party Events

## 1. Architecture
4HRS+ analytics is a first-party projection boundary:

Customer/visitor action → typed event API → schema validation → consent gate → sanitization/minimization → AnalyticsEvent storage → reporting/supporting signals.

Analytics never owns customer identity, authentication, orders, payments, fulfillment, shipping, returns, cancellations, cases, catalog, consent, notifications, or financial truth.

## 2. Observability vs analytics
Operational observability remains in `lib/observability`. AnalyticsEvent is for storefront behavior. Admin audit logs remain authoritative for privileged/security actions.

## 3. Event envelope
Stored events contain a generated event ID, controlled event name/version, occurrence/receipt timestamps, optional bounded anonymous/session identifiers, server-derived customer ID, allowlisted locale, sanitized properties, source, and an explicit expiry timestamp.

## 4. Event catalog
Current supported events are PAGE_VIEW, PRODUCT_VIEWED, CATEGORY_VIEWED, COLLECTION_VIEWED, SEARCH_PERFORMED, FILTER_APPLIED, SORT_CHANGED, PRODUCT_VARIANT_SELECTED, ADD_TO_CART, REMOVE_FROM_CART, CART_VIEWED, CHECKOUT_STARTED, CHECKOUT_STEP_VIEWED, ACCOUNT_CREATED, and ACCOUNT_LOGIN.

Purchase/revenue events are intentionally not accepted from the browser.

## 5. Versions
Every event has a numeric schema version. Unsupported versions are rejected; changing event meaning requires a new version.

## 6. Allowed properties
Each event has a fixed property allowlist. Unknown properties are rejected. Product/catalog properties use stable identifiers. Search events intentionally exclude the raw query.

## 7. PII rules
The boundary rejects property names associated with passwords, tokens, secrets, authorization, cookies, payment credentials, bank information, API keys, email, phone, address, date of birth, customer names, IP addresses, and full URLs. Request headers, cookies, database objects, and entire user objects are never copied into events.

## 8. Anonymous vs authenticated
Anonymous identifiers are random, non-sensitive, session-scoped values. Authenticated customer identity is derived from the authenticated server session; the browser cannot select another customer ID.

## 9. Consent model
Analytics consent is separate from marketing/communication consent. New analytics consent defaults to OPTED_OUT. Authenticated consent is persisted in CustomerAnalyticsConsent; anonymous consent is represented by a first-party consent cookie. Without OPTED_IN, non-essential analytics is rejected.

## 10. Cookie model
The only analytics cookie is `4hrs_analytics_consent`. It is Secure in production, SameSite=Lax, path-scoped to the site, and has a bounded one-year preference lifetime. No tracking identifier is stored in a cookie.

## 11. Collection API
`/api/analytics/events` exposes GET/POST consent operations and PUT event ingestion. Event ingestion is same-origin, rate-limited, allowlisted, versioned, size-bounded, and fail-safe.

## 12. Browser collection
`lib/analytics/client.ts` is the typed browser boundary. It does not scatter provider calls through components, blocks navigation, or throw analytics failures into commerce flows. It uses best-effort keepalive requests.

## 13. Server-side events
`recordAnalyticsEvent` provides a server-side boundary for future authoritative domain projections. Purchase/revenue truth remains in Order/Payment and is not created from browser clicks.

## 14. Deduplication
`eventId` is unique and duplicate inserts are treated as already accepted. The design assumes retries and at-least-once delivery.

## 15. Event ordering
Analytics does not infer business state from event order. Occurrence timestamps are retained, but Order/Payment state remains authoritative.

## 16. E-commerce analytics
Engagement signals cover product views, add-to-cart, checkout initiation, and related storefront behavior. Revenue, orders, refunds, and payment KPIs continue to come from canonical business tables.

## 17. Search analytics
Only bounded result/page/filter/sort metadata is accepted. Raw search text is not stored.

## 18. Admin analytics integration
Phase 14.8 admin analytics remains canonical for financial/operational/customer KPIs. AnalyticsEvent contributes an explicitly labeled supporting engagement signal only. Admin access remains protected by existing analytics RBAC and audit logging.

## 19. Retention
Raw AnalyticsEvent rows carry a 90-day `expiresAt`. `purgeExpiredAnalyticsEvents()` provides the enforceable deletion operation for scheduled maintenance. Retention is separate from canonical order/payment retention.

## 20. Deletion/anonymization
Customer privacy deletion removes attributable AnalyticsEvent rows and CustomerAnalyticsConsent. Customer privacy export includes bounded attributable analytics events and remains subject to the existing 5,000-record export bound.

## 21. Third-party providers
No third-party analytics provider or SDK is introduced in Phase 15.10. There is no GA/GTM/Meta/Clarity/PostHog/Mixpanel dependency.

## 22. Provider adapter
No adapter is required while there is no external provider. The canonical event boundary is provider-neutral so a future adapter can be isolated without changing storefront event semantics.

## 23. Security
Controls include strict event allowlists, property allowlists, PII rejection, server-derived customer identity, same-origin mutation requests, payload limits, rate limiting, random identifiers, and idempotent event IDs.

## 24. CSP
No third-party analytics script or domain is added. Existing CSP is therefore not weakened.

## 25. Performance
Collection is best-effort and non-blocking. No analytics call occurs during React render. The client uses keepalive and the storefront remains functional when analytics fails.

## 26. Observability
Analytics ingestion records bounded operational metrics for accepted events and database failures. Analytics failure telemetry is not recursively sent as analytics events.

## 27. Data quality
Invalid names, versions, timestamps, properties, payload sizes, identifiers, and sensitive properties are rejected rather than silently stored.

## 28. Production configuration
No analytics secret is exposed to browsers and no analytics vendor credential is required. The existing Netlify architecture is unchanged.

## 29. Known limitations
The phase establishes the production boundary and typed collection infrastructure. Existing storefront components are not blanket-instrumented; only events justified by actual product behavior should be added through the client boundary. Raw-event aggregation/warehouse infrastructure is not introduced.

## 30. Unsupported tracking
No fingerprinting, cross-site tracking, marketing automation, invasive behavioral profiling, third-party tracker bundle, arbitrary browser event names, raw URL collection, or client-authored customer attribution is supported.

## Failure scenarios
- Provider unavailable: no provider exists; analytics storage failure returns a safe error and does not fail commerce operations.
- Malformed/unknown/forbidden payload: rejected.
- Forged customer ID: ignored; authenticated identity is server-derived.
- Duplicate event: deduplicated by event ID.
- Out-of-order event: retained without changing business state.
- Consent disabled/revoked: new non-essential events are rejected.
- Customer deletion: attributable analytics and consent are deleted.
- Checkout/payment succeeds while analytics fails: authoritative domain operation remains independent.
- Volume spike: endpoint has bounded payloads and rate limiting.
- Locale change: event locale is allowlisted and does not determine financial/legal jurisdiction.
- Currency change: analytics never converts or becomes currency truth.
- Admin access: existing analytics RBAC/audit boundary remains authoritative.
- Cache isolation: event API and admin analytics are request/dynamic paths; no shared analytics response cache is introduced.
- Deployment during processing: event IDs and bounded best-effort ingestion tolerate retries.

## Validation
Phase 15.10 requires lint, typecheck, test, build, Prisma validation/generation/migration validation, analytics/privacy/security regression coverage, and CI-equivalent checks. Existing tests and CI must not be weakened.
