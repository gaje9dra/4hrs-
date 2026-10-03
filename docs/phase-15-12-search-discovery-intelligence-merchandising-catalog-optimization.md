# Phase 15.12 — Search, Discovery Intelligence, Merchandising & Catalog Optimization

## Scope

Phase 15.12 extends the existing 4HRS+ catalog/search architecture. It does not create a second catalog, second analytics pipeline, or vendor-specific search layer.

## Boundaries

- **Canonical catalog:** Product, ProductVariant, taxonomy, publication, inventory, price, media, and provider mappings remain authoritative.
- **Search:** `lib/catalog/search.ts` and `lib/catalog/repository.ts` remain the public search path.
- **Analytics:** Phase 15.10 `AnalyticsEvent` remains the event source.
- **Discovery intelligence:** `lib/discovery/signals.ts` derives bounded, aggregated observational signals.
- **Merchandising:** `MerchandisingRule` is explicit administrator-controlled configuration, protected by existing admin RBAC and audit logging.
- **Experiments:** Phase 15.11 remains the assignment/exposure mechanism. Search behavior may be feature-flagged, but experiments never mutate canonical commerce state.

## Search pipeline

Public search continues to apply hard catalog eligibility before ranking:

1. published/valid catalog eligibility
2. category/collection/tag/price/availability filters
3. deterministic textual relevance
4. explicit merchandising precedence
5. stable product-ID tie-breaking

Unpublished or otherwise ineligible products cannot be promoted by behavioral or merchandising signals.

Search normalization now applies Unicode NFKC normalization, control-character removal, whitespace normalization, and locale-aware lower-casing without changing the existing query contract.

Exact SKU search remains an internal capability because the current public search architecture intentionally keeps SKU matching internal. No public SKU exposure was introduced.

## Merchandising

`MerchandisingRule` supports:

- actions: PIN, BOOST, PROMOTE, DEMOTE, BURY
- scopes: GLOBAL, CATEGORY, COLLECTION, QUERY, PRODUCT, LOCALE
- explicit priority
- activation/deactivation
- start/end timestamps
- environment isolation
- optimistic version concurrency

Active rules are applied deterministically during relevance ranking. Precedence is PIN, BOOST/PROMOTE, DEMOTE, BURY, then no rule. Within a precedence class, configured priority remains the administrative ordering signal and product ID remains the deterministic final tie-breaker.

Production activation requires an admin reason. All material create/update operations use the existing Phase 14/15 admin authorization and audit infrastructure.

Existing category/collection featured/priority/position fields remain intact and continue to support canonical merchandising ordering.

## Behavioral discovery signals

Only currently available Phase 15.10 events are used:

- PRODUCT_VIEWED
- ADD_TO_CART

No purchase signal is fabricated because the current analytics event catalog does not provide one.

Popularity is a bounded observational score based on log-scaled views and add-to-cart activity, normalized by distinct observed subjects. Trending uses a recent 24-hour window relative to the 30-day observation baseline. New products with no behavioral history receive no fabricated popularity and continue to rely on catalog relevance and explicit merchandising.

Analytics failure falls back to canonical catalog relevance and explicit merchandising.

Raw behavioral records are not copied into a new discovery database. Existing analytics retention/deletion/consent controls remain authoritative.

## Search diagnostics

The protected admin discovery endpoint exposes aggregated:

- search volume
- zero-result search count
- zero-result rate
- bounded discovery signals
- catalog-quality findings

The current Phase 15.10 event schema intentionally does not retain raw search query text, so raw popular-query and reformulation reports are not invented. Historical search latency is likewise not synthesized from process-local observations.

## Catalog quality

The discovery layer reports recommendations such as:

- missing title
- missing description
- missing image
- missing active category
- invalid variant SKU

Findings are advisory only. The service never silently mutates canonical catalog records.

## Privacy and consent

- No fingerprinting.
- No sensitive targeting.
- No sensitive characteristics.
- No persistent behavioral profile is created.
- No raw customer search history is exposed through discovery APIs.
- Anonymous behavior uses the existing bounded anonymous identifier.
- Customer identity is used only as an aggregated distinct-subject denominator for discovery scoring.
- Phase 15.8 consent remains the authority for analytics collection.
- Phase 15.6 retention/deletion remains the authority for raw analytics data.

## Caching

The new discovery APIs are dynamic and do not introduce global personalized caching. No customer-specific result set is cached.

## Provider boundary

The current database search implementation remains provider-neutral. No vendor SDK or browser-visible search credentials were added.

## Feature flags and experiments

Phase 15.11 feature flags remain server-side. They may gate future ranking/discovery implementations. Experiment assignment and exposure remain deterministic and use the Phase 15.10 analytics catalog.

Experiments must not modify product identity, inventory, price, order, payment, fulfillment, shipping, authorization, or customer-account state.

## Index consistency

The current search implementation queries canonical Product/ProductVariant state directly rather than maintaining a separate external search index. Therefore canonical publication and availability constraints are applied at query time. No stale external index was introduced in this phase.

## Autocomplete, synonyms and typo tolerance

The repository currently has no independent autocomplete/synonym provider or authoritative synonym store. This phase does not invent one. Query normalization is strengthened without introducing unsafe automatic synonym generation or misleading typo substitution.

## Performance and security

- Search remains bounded by existing page-size limits.
- Relevance uses deterministic SQL ordering.
- Merchandising rules are evaluated in the ranking query rather than with per-result application queries.
- Public search never receives admin diagnostics.
- Admin merchandising/discovery endpoints use existing RBAC and same-origin protections.
- Provider credentials are never sent to the browser.
- Rule input is strongly validated and bounded.
- Optimistic versioning prevents stale administrative updates.

## Failure behavior

- Analytics unavailable: canonical search + explicit merchandising remain authoritative.
- Merchandising configuration unavailable: search remains safe and canonical; callers should fail closed to normal catalog ordering.
- Feature-flag evaluation failure: Phase 15.11 safe defaults remain authoritative.
- Search-provider changes are isolated behind the existing search service/provider boundary.
- Canonical catalog state is never changed by discovery intelligence.

## Operational runbook

1. Check admin discovery diagnostics for zero-result and catalog-quality signals.
2. Inspect active merchandising rules and their audit history.
3. Deactivate an unsafe rule using optimistic versioning.
4. Verify canonical catalog publication and inventory independently.
5. If analytics is unavailable, keep canonical relevance active and do not fabricate discovery scores.
6. For rollout experiments, use Phase 15.11 feature-flag controls and verify exposure events.

## Known limitations

- The current analytics catalog does not contain raw search-query text, so query popularity/reformulation analytics are intentionally unavailable.
- There is no purchase analytics event in the current Phase 15.10 catalog, so discovery signals do not invent purchase-derived scores.
- The current search architecture is database-backed; no separate external index/rebuild system was introduced.
- Existing autocomplete is not a separate persisted search-history system, so this phase does not expose customer search history as suggestions.
- Discovery signals are computed from retained analytics events rather than a second event store.
