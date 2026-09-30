# Phase 5.9 — Catalog Security & Data Exposure Audit

## Scope
Audited the production discovery path for /shop, /category/[slug], and /collection/[slug], including public catalog query normalization, repository publication predicates, storefront DTO mapping, error handling, and URL-state construction.

## Public data boundary
The listing response now exposes only the fields required by the storefront card: title, public slug, primary image URL/alt text, price/compare-at price/currency, public availability state, and public pagination/applied query state.

Internal product/database identifiers and image identifiers were removed from the listing DTO and its public listing query projection. Variant SKU and inventory quantities remain server-side inputs used only to calculate the public availability state; they are not returned by the listing mapper.

Provider credentials, supplier cost/margin data, audit records, inventory transactions, reserved quantities, storage references, and administrative metadata are not part of the listing response.

## Input validation
The canonical query boundary validates allowlisted sort values, page 1–10000, page size 1–100, at most 20 unique tags, canonical lowercase slug syntax, non-negative monetary syntax with at most two decimals, boolean inStock, AND/OR tag mode, and valid min/max price relationships.

The repository receives structured filters and allowlisted sort fields/directions; dynamic SQL fragments are not constructed from raw user input. Unknown URL parameters are not forwarded to the repository.

## Visibility enforcement
Public listing queries start from status = ACTIVE and require non-empty public catalog fields. Category and collection filters additionally require ACTIVE related resources. Direct category/collection resolution rejects inactive resources. Referencing an unpublished or inaccessible resource therefore does not make its products public.

## Direct URL and error security
Malformed slugs and invalid query state fail through controlled catalog errors before repository execution. Existing Phase 5.8 error boundaries return concise customer-safe messages without stack traces, SQL, ORM details, filesystem paths, environment values, or provider credentials.

Phase 5.8 structured diagnostics remain server-side and record only sanitized catalog state.

## Content safety
Catalog text is rendered through normal React text nodes rather than arbitrary HTML injection. No dangerouslySetInnerHTML or arbitrary HTML rendering was introduced. Product links are generated from normalized internal catalog slugs. Image URLs remain catalog-managed media references; no private storage reference is exposed by the listing DTO.

## Cache and response safety
No new public catalog cache was introduced. Existing React request-scoped caching is used for category/collection metadata and does not create a persistent cross-user catalog cache. Listing query state is normalized before service execution, and URL builders reconstruct only recognized public catalog parameters.

## Verified fixes
1. Removed internal product and image IDs from the public listing DTO.
2. Removed those unnecessary identifiers from the public listing Prisma projection.
3. Updated product-card keys to use the public slug.
4. Added regression tests for DTO field minimization.
5. Added tests for malformed slugs, oversized pagination, and inactive category/collection visibility.
6. Retained existing Phase 5 validation and publication predicates.

## Tests and validation
Source-level tests were expanded for public data exposure, input validation, visibility, error leakage, and expected empty results.

The repository currently exposes no usable CI workflow/status result for this branch, and this environment has no runnable local checkout/database/browser session. Consequently lint, typecheck, full test execution, production build, browser smoke tests, and live unpublished-content checks cannot be truthfully marked as passed.

## Remaining non-blocking risks
- No live production browser/database environment was available for manual verification.
- Existing public product-detail DTOs contain internal identifiers for variants/media/options; that detail surface is outside the three Phase 5.9 discovery routes audited here and was not changed to avoid expanding scope.
- External media URL policy is dependent on the existing catalog media ingestion/configuration path; this phase did not introduce arbitrary HTML or media handling.
