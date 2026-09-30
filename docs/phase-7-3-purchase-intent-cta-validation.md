# Phase 7.3 — Product Purchase Intent, CTA State & Pre-Cart Validation Hardening

## Scope
This phase hardens the existing PDP purchase-intent boundary before Cart exists. No Cart persistence, API, database model, checkout, payments, orders, shipping, fulfillment, authentication, inventory reservation, wishlist, reviews, or provider integration was added.

## Purchase-intent state model
The canonical variant-selection boundary now exposes:
- MISSING_REQUIRED_SELECTION — at least one declared product option has no selected value.
- INVALID_SELECTION — all required values are present, but no canonical variant resolves from the selection.
- UNAVAILABLE — a canonical variant resolves but its public availability state is OUT_OF_STOCK.
- READY — a canonical variant resolves and its public availability is not OUT_OF_STOCK.
The state is derived from the existing canonical product DTO and variant-selection helper. No catalog rules were duplicated inside the UI.
The current CTA remains disabled because Cart does not exist. READY therefore communicates that the selection is valid for a future Cart handoff; it does not claim that an item was added, inventory was reserved, payment occurred, or an order was created.

## Required option validation
Required options are derived from product.options. A purchase selection cannot be constructed when an option is missing, the combination does not resolve, or the resolved variant is OUT_OF_STOCK.
Option changes continue to use the Phase 7.2 canonical resolver and selectability helper. No second variant algorithm was introduced.

## Selected variant integrity
buildPurchaseSelection() produces only canonical product ID, canonical variant ID, and quantity = 1.
The variant is resolved from the current product's canonical variant array. It is not derived from labels, indexes, DOM state, or client-generated identities.
The quantity value is a minimal future-handoff default, not a quantity UI or Cart quantity system.

## Quantity behavior
No quantity selector currently exists, so no quantity UI was introduced.
The future Cart layer owns final quantity validation, including integer constraints, minimum/maximum rules, zero/negative values, malformed input, excessive values, and authoritative availability checks.

## Pricing boundary
Displayed price remains derived from the resolved canonical variant, falling back to product pricing where appropriate. Compare-at pricing continues through the existing server-side validation.
The purchase-intent contract intentionally does not contain a client-authoritative price.
Final Cart/Order pricing must be revalidated server-side by the future commerce layer.

## Availability boundary
The UI derives purchase intent from the selected variant's public availability state. OUT_OF_STOCK produces UNAVAILABLE and cannot produce a purchase selection.
The storefront DTO continues to expose only availability state and not inventory quantities, reservations, warehouse data, provider inventory, or operational metadata.
Final availability must be revalidated by the future Cart/Order flow because the current browser state can become stale after page load.

## Future Cart handoff contract
The provider-neutral internal selection contract is: productId, variantId, quantity.
It intentionally excludes client-calculated price, inventory counts, reservation state, discounts, totals, payment information, shipping information, provider credentials, provider API payloads, and arbitrary product data.
The future Cart service must re-fetch/revalidate the authoritative catalog state before accepting this selection. No Cart API or persistence was created.

## Client/server authority boundary
The client may manage temporary option selection, selected-variant presentation, media state, and UI state.
The client is not authoritative for price, availability, inventory, lifecycle, variant ownership, discounts, or totals.
Phase 7.2's server-side variant matrix validation remains the catalog integrity boundary.

## Stale data and concurrency
The PDP does not claim that a READY state reserves inventory or guarantees future availability.
If catalog data changes after page load, the future Cart boundary must revalidate product lifecycle, variant ownership, current price, and current availability.
No inventory locking was introduced.
Option changes are synchronous local state transitions over the already-loaded canonical DTO. No per-click database request was added.

## Error and feedback states
The purchase-intent panel communicates missing required selection, invalid selection, unavailable selection, and validated/READY selection with Cart intentionally deferred.
No fake Added to cart, order-success, payment-success, or reservation-success feedback exists.

## Rapid interaction
The current option controls remain native buttons with synchronous state transitions. There is no asynchronous purchase mutation to duplicate.
Because Cart does not exist, duplicate-order/cart prevention was intentionally not implemented.

## Accessibility
The purchase-intent CTA is a disabled native button with an accessible relationship to its status message.
Existing option controls retain fieldset/legend structure, aria-pressed, aria-disabled, native disabled, visible focus styling, and live pricing/availability messaging.
Validation feedback is presented in readable text and is not communicated by color alone.
Browser/screen-reader validation was not executable in this environment.

## Responsive and Bauhaus consistency
Existing PDP composition and styling were preserved.
The purchase-intent panel uses the existing Bauhaus vocabulary: strong borders, hard offset shadows, established typography, existing palette, existing spacing, no gradients, no glassmorphism, no soft shadows, no generic rounded UI, and no excessive animation.
Required browser-width validation remains outstanding.

## Security and public data exposure
The purchase-selection contract does not expose inventory counts, reservations, provider credentials, provider payloads, admin metadata, or audit records.
Variant ownership remains constrained to the current product's canonical variants.
Client validation is treated as UX validation only; the future Cart server remains authoritative.

## Performance
No request is generated for each option click.
Purchase-intent state is derived locally from the server-rendered product DTO.
No speculative state-management library or cache was introduced.

## Tests
Added regression coverage for purchase-intent state model, canonical purchase-selection contract, non-authoritative disabled CTA, provider-neutral boundary, and absence of quantity UI.
Existing Phase 7.1/7.2 PDP tests remain in place for variant integrity, availability, pricing, media, public DTO safety, lifecycle, breadcrumbs, and no-commerce boundaries.

## Runtime validation
The following required gates were not executed in the available repository environment: npm run lint, npm run typecheck, npm test / unit tests, integration tests, npm run build, browser/smoke tests, and responsive validation at 320, 375, 640, 768, 1024, 1280, 1440, and 1920px.
No failures were suppressed or represented as passed.

## Cross-system regression
Source-level integration remains bounded to: Homepage → Shop → Category → Collection → Search → Product → Variant Selection → Purchase Intent.
No changes were made to Phase 5 catalog discovery or Phase 6 search architecture.

## Classification
- Purchase-intent state model: FIXED
- CTA state boundary: FIXED
- Required option validation: PASS
- Selected variant integrity: PASS
- Quantity: NOT APPLICABLE
- Pricing: PASS
- Availability: PASS
- Future Cart handoff contract: FIXED
- Client/server authority: PASS
- Stale-data/concurrency: WARNING — final server revalidation belongs to future Cart
- Error/feedback: PASS
- Rapid interaction: PASS
- Accessibility: PASS — source-level
- Responsive validation: WARNING — browser validation unavailable
- Security/public data: PASS
- Performance: PASS
- Runtime validation: WARNING — not executed

## Remaining limitations
The source-level purchase-intent boundary is hardened, but production runtime, build, integration, and browser validation remain unverified. The future Cart system must perform authoritative server-side revalidation before any commerce mutation.
This phase does not implement Cart and does not begin Phase 7.4.