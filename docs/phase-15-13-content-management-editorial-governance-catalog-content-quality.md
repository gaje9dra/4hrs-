# Phase 15.13 — Content Management, Editorial Governance & Catalog Content Quality

## Architecture

4HRS+ editorial content is a separate provider-neutral layer around the canonical catalog. Product, ProductVariant, price, inventory, fulfillment mapping, and transactional state remain owned by the catalog/order/fulfillment domains.

ContentItem stores the current editorial working state. ContentRevision is an immutable, reconstructable snapshot. The published version is identified by publishedVersion, so editing a published item never destroys the production snapshot.

## Content types

The phase defines only the required editorial types:

- HOMEPAGE_SECTION
- LANDING_PAGE
- COLLECTION_PAGE
- CATEGORY_EDITORIAL
- PRODUCT_EDITORIAL
- PROMOTIONAL_BANNER
- CONTENT_BLOCK

Each type is validated by validateContentInput. Collection/category/product editorial records must carry the corresponding catalog reference.

## Structured content and security

Content is represented by a strict block union rather than arbitrary HTML. Supported blocks are headings, paragraphs, canonical media images, safe links/CTAs, and typed product/category/collection references.

Unsafe schemes, credential-bearing URLs, control characters, unknown block types, oversized payloads, excessive block counts, and invalid media/reference declarations are rejected. No administrator-supplied HTML is rendered.

Media references reuse canonical ProductImage records. No binary storage or second media system was introduced.

## Lifecycle and separation of duties

The lifecycle is explicit:

DRAFT -> IN_REVIEW -> APPROVED -> SCHEDULED -> PUBLISHED -> UNPUBLISHED -> ARCHIVED

Supported corrective paths include review rejection back to draft, scheduled-to-published activation, published-to-draft editing, and archived-to-draft restoration. Arbitrary state jumps are rejected.

Existing admin RBAC is reused. Content capabilities are separate permissions:

- content.read
- content.create
- content.update
- content.review
- content.approve
- content.publish
- content.schedule
- content.rollback
- content.archive
- content.preview

Privileged publication/scheduling/unpublishing/rollback/archive operations require an audit reason in the admin API.

## Concurrency, revisions and rollback

Updates require expectedVersion. A stale version returns a conflict instead of overwriting another editor.

Every create/update/rollback produces a revision. Rollback creates a new revision from an existing immutable snapshot; intervening revisions are retained.

Publication changes and revision creation are transactional. Publication stores the exact current version as publishedVersion.

## Publication and scheduling

Publication is server-authoritative and validates locale, slug, SEO metadata, structured blocks, canonical media references, linked catalog entities, and publication window.

Scheduled publication and scheduled expiration are processed by netlify/functions/process-content-schedule.mts every five minutes. The worker uses compare-and-set updates on content version/status, so retries are idempotent and do not require a browser.

## Draft and preview isolation

Public APIs query only PUBLISHED records whose publication window is active and then load the exact publishedVersion revision.

Admin preview requires content.preview, returns Cache-Control private/no-store, and sends X-Robots-Tag noindex, nofollow. Preview is never a public authorization credential.

Public editorial rendering is force-dynamic and locale-aware. Public APIs vary on locale-related request context and never accept a status/version query parameter that could expose drafts.

## Localization and translation freshness

Content has an explicit locale and translation status. A translation can reference a source content record and source version. Publication is per locale; publishing an English record does not publish another locale.

The current locale registry supports en-IN and en-US and the existing locale resolver is reused.

## SEO

Editorial records support controlled title, description, canonical URL, robots, and Open Graph metadata. Canonical URLs accept safe internal paths or HTTP(S) URLs without credentials.

Product structured data remains generated from canonical catalog data. Editorial content cannot replace price, availability, SKU, brand identity, or product identity.

Landing pages use canonical /content/<slug> URLs unless an explicitly validated canonical URL is supplied. Unpublished content is never emitted into public metadata.

## Catalog references

Publication checks product/category/collection references against current canonical publication/active state. A broken or unpublished reference blocks publication.

Editorial references are advisory content and never become catalog ownership. If a referenced catalog entity becomes unavailable after publication, the public renderer safely omits unavailable typed reference links; administrators can inspect the underlying content and revision history.

## Search and merchandising

The existing product search remains catalog-owned. This phase does not invent a second search index or a third-party CMS/search provider.

Editorial content is therefore not injected into product ranking and cannot become a hidden merchandising rule. Phase 15.12 merchandising rules remain the explicit ranking control plane.

## Caching and invalidation

Public editorial pages are force-dynamic to prevent draft/public cache confusion. Publication, unpublication, update and rollback call Next.js path revalidation for affected content and sitemap paths. Preview is private/no-store.

No authenticated preview response is permitted to use a public cache key.

## Analytics, experiments and privacy

Editorial content remains compatible with Phase 15.10 analytics and Phase 15.11 experiments, but neither is publication authority. No customer-private content data is stored in editorial records.

No sensitive targeting, browser fingerprinting, or client-side publication control is introduced.

## Auditability

Existing AdminAuditLog is reused for content creation, updates, lifecycle transitions and rollback. Audit metadata contains version/action information rather than raw content snapshots.

Revision snapshots provide historical reconstruction; audit records provide actor/action/time traceability.

## Content quality and freshness

Validation is deterministic and blocks unsafe publication. Quality/freshness signals are operational warnings rather than automatic destructive rules.

The implementation tracks publication windows, translation status/source versions, revision age and stale/unavailable references. It does not auto-delete or auto-publish content based on a score.

## Failure recovery

- Validation failure: publication is rejected and state remains unchanged.
- Concurrent update: a version conflict is returned; the editor must refresh.
- Reference/media failure: publication is rejected.
- Scheduled worker retry: compare-and-set transition makes duplicate execution safe.
- Cache invalidation failure: publication state remains canonical; the route is force-dynamic and can be revalidated again operationally.
- Search failure: no editorial search index is mutated because the existing catalog search remains authoritative.
- Database failure during publication: transaction rollback prevents a published state without its corresponding revision.

## Known limitations

- There is no existing generic asset store in the repository, so editorial media references intentionally reuse canonical ProductImage assets rather than introducing a second media provider.
- Existing product search has no editorial-content index; editorial pages are not inserted into product search.
- The admin editor intentionally uses a strict JSON block field rather than introducing a third-party rich-text/CMS dependency.
- A scheduled worker is provided using the repository's existing Netlify scheduled-function pattern; deployment must retain scheduled-function execution.

## Operational procedures

1. Create content in DRAFT.
2. Validate the structured blocks and catalog/media references.
3. Submit for review.
4. Approve after editorial review.
5. Publish immediately or schedule.
6. Monitor scheduler and publication metrics.
7. Use revision history and rollback for recovery.
8. Unpublish or archive expired content rather than deleting historical production state.
9. Inspect stale translations and unavailable references before republishing localized content.

## Production safety boundary

This phase does not modify checkout, payment, order, fulfillment, shipping, inventory, pricing, or provider ownership. Editorial records can describe commercial content but cannot establish commercial truth.
