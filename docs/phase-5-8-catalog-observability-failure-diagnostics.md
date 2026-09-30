# Phase 5.8 — Production Catalog Listing Observability & Failure Diagnostics

## Scope
Applies to /shop, /category/[slug], and /collection/[slug]. No storefront redesign or new monitoring platform was introduced.

## Error classifications
- Expected empty result: successful catalog state; no error log is emitted.
- Invalid user query: invalid_query.
- Missing category, collection, or tag: not_found.
- Malformed catalog record that cannot be safely mapped: catalog_data_integrity.
- Repository/database access failure: database_failure.
- Other unexpected failures at the storefront boundary: unexpected_application_failure.

Customer-facing error boundaries remain concise and recovery-oriented. Category and collection resolution failures continue through the existing not-found behavior.

## Structured logging
A dependency-free server-side logger in lib/catalog/observability.ts emits one JSON object for operational failures. Fields are:
- event
- surface
- operation
- classification
- durationMs when measured
- sanitized canonical filter/sort/pagination state when available

Category and collection slugs, selected tag slugs, sort, price range, stock flag, page, and page size are public catalog state and are the only query fields included.

No passwords, tokens, cookies, payment data, secrets, private customer data, complete request headers/bodies, SQL, raw ORM error messages, filesystem paths, or environment values are logged.

No correlation/request ID is generated because the repository has no existing request-ID infrastructure. No external monitoring dependency was added.

## Failure handling
Unknown repository failures are converted to CatalogServiceError with the stable public message "Catalog data could not be loaded." The original cause remains server-side and is not copied into customer-facing responses or structured logs.

Malformed catalog mapping is converted to CATALOG_DATA_INTEGRITY_ERROR with the safe public message "Catalog data could not be rendered safely."

Invalid query and not-found conditions retain their existing controlled service errors. Empty results remain distinct from failures.

## Performance diagnostics
Duration is measured with Date.now() around existing operations. Diagnostics add no database queries and no persistent event writes. Listing payloads, pagination, deterministic ordering, and URL state remain unchanged from Phase 5.1–5.7.

## Customer UX and accessibility
Existing /shop, /category/[slug], and /collection/[slug] error boundaries avoid stack traces and technical details. They retain retry/recovery actions, keyboard-accessible controls, focus styles, responsive layout, and the existing Bauhaus visual language.

## Regression coverage
Existing Phase 5 query, filtering, sorting, pagination, URL-state, empty-state, not-found, SEO, and deterministic-result tests remain in place. Phase 5.8 adds tests for:
- repository/database failure classification
- malformed catalog data classification
- safe customer-facing error text
- structured logging fields
- absence of SQL/password/token content in logs
- absence of operational error logs for expected empty results

## Validation status
GitHub repository inspection and source-level scope auditing were performed. The repository does not expose runnable local checkout/database/browser execution in this environment, and its Actions/status history has no usable validation run for this work. Therefore lint, typecheck, full test suite, production build, browser smoke tests, and live database failure injection cannot be truthfully marked as passed.

## Known limitations
- Host/runtime log collection is still responsible for retaining/searching console JSON.
- There is no request correlation ID until the application introduces a shared request-ID mechanism.
- No live SQL query-plan or production latency telemetry is available here.
