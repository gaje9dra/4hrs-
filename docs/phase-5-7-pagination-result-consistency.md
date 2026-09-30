# Phase 5.7 — Production Catalog Pagination & Result Consistency

## Pagination strategy

The shared catalog remains page/offset based.

The three production surfaces use the same path:

`/shop`, `/category/[slug]`, `/collection/[slug]`
→ storefront query parameters
→ catalog query service
→ catalog repository
→ database.

Offset pagination is retained because the existing storefront exposes numbered pages and the Phase 5.2–5.6 architecture already uses `skip/take`. Cursor pagination would change URL semantics and is not required to correct the verified consistency issues in this phase.

No catalog is loaded into memory before pagination.

## Canonical pagination contract

- Default page size: 24.
- Maximum page size: 100.
- Page numbers are positive integers from 1 through 10,000.
- Invalid page/page-size values are rejected before repository execution.
- Generated pagination URLs use the same bounds.
- Page size and page state are serialized through the shared catalog URL builder.
- Default page 1 and default page size 24 are omitted from canonical URLs.
- Filter/sort changes continue to use the shared filter URL builder, which resets pagination.
- Category and collection routes inject their canonical fixed scope into the server query; URL state cannot replace that scope.

For very large result sets, total page count is capped at the maximum addressable page number. This prevents generating links to pages the contract intentionally rejects.

## Deterministic ordering

Every supported direct-product sort retains an explicit secondary product-id ordering:

- createdAt + id
- updatedAt + id
- price + id
- title + id

Merchandising order retains its established relation-level ordering:

- featured
- priority
- position
- product creation time
- product title
- product id

The final product/relation identifier tie-breaker makes equal primary sort values deterministic for repeated requests using the same catalog state.

No database default ordering is relied upon.

## Filter and sort consistency

Filters and sorting are passed through the same canonical query service for shop, category, and collection listings.

The repository applies:

- publication/lifecycle filtering
- category/collection scope
- tags
- effective price constraints
- inventory availability
- sort order
- offset pagination

all at database level.

Changing a filter or sort through the existing controls resets the page through the shared URL builder. Existing active filters and sort state are retained when moving between pages.

## Out-of-range behavior

A requested page is considered out of range when the filtered result set is non-empty and the requested page is greater than the current addressable final page.

The service exposes `pagination.isOutOfRange` rather than treating that response as an ordinary empty catalog.

The shared listing renders a controlled “page is no longer available” state and links to the current final page while preserving the complete current URL/filter/sort state. It does not silently show unrelated products.

An actually empty catalog is not classified as out of range, so empty category/collection states remain intact.

## Catalog mutation considerations

Offset pagination cannot provide snapshot isolation across independent HTTP requests unless the application/database architecture supplies a transactionally consistent snapshot. This architecture does not provide such a snapshot contract.

Therefore:

- publication/unpublication can move products between pages between requests;
- category or collection membership changes can change page membership;
- price changes can affect price-filtered and price-sorted pages;
- inventory changes can affect availability-filtered results;
- deletion can reduce the final page count.

The hardening guarantees logical correctness for each individual request and deterministic ordering for identical catalog state; it does not promise that page 2 fetched before a mutation and page 3 fetched after a mutation represent one immutable snapshot.

When a mutation makes a requested page exceed the current range, the explicit out-of-range state prevents unrelated products from being substituted.

## URL behavior

The shared URL parser and builder now use the same page/page-size bounds as the catalog service.

Canonical behavior includes:

- `page=1` omitted
- default `pageSize=24` omitted
- `pageSize` limited to 100
- `page` limited to 10,000
- filters and sort normalized through the shared parser
- deterministic tag ordering
- unused default tag mode omitted
- category/collection scope supplied by the canonical route layer

Malformed recognized values are rejected safely rather than silently interpreted as another catalog state.

## Accessibility and responsive behavior

The existing shared pagination component remains the only pagination implementation for the three catalog surfaces.

It retains:

- a named navigation landmark;
- `rel=prev/next`;
- meaningful accessible link names;
- visible keyboard focus;
- current-page indication;
- responsive wrapping;
- the established Bauhaus border/shadow treatment.

No new visual language or catalog redesign was introduced.

## Performance

The pagination path continues to use database-level `skip/take` and does not fetch the complete catalog.

Phase 5.6 payload and query hardening remains active:

- bounded page size and page number;
- lightweight listing DTO projection;
- database-level filtering and sorting;
- no client-side catalog pagination;
- deterministic ordering;
- existing production indexes;
- count and page queries use the same canonical predicate.

The total count remains necessary because the storefront displays total results and total pages. It is executed against the same filtered predicate as the page query.

## Testing

Added/updated coverage for:

- final valid page;
- page beyond range;
- empty catalog versus out-of-range distinction;
- filter + pagination;
- sort + pagination;
- category/collection scoped pagination;
- maximum page size;
- maximum page number;
- canonical page-size URL rejection;
- DTO and existing URL canonicalization regressions;
- deterministic repository ordering remains explicitly defined in the shared repository path.

## Validation status

The GitHub integration provides source/diff inspection but no runnable repository checkout, database, browser session, or usable CI workflow for this repository. The current commit has no reported GitHub Actions workflow runs or status checks.

Consequently, lint, typecheck, full test execution, production build, browser smoke tests, and live SQL/query-plan inspection cannot be truthfully marked as passed from this environment.

## Known limitations

- Offset pagination remains susceptible to page drift across separate requests when the underlying catalog mutates.
- No snapshot-consistent pagination guarantee is introduced.
- Numbered pages are intentionally bounded at 10,000.
- Total pages are capped at that addressable maximum for URL/navigation safety.
- A live database query plan could not be inspected in the repository-only environment.
