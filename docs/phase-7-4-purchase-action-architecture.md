# Phase 7.4 — Product Purchase Action Architecture & Cart Integration Readiness

## Scope

Phase 7.4 finalizes the existing PDP purchase-action boundary for the future Cart phase without implementing Cart or any commerce mutation.

No Cart models, persistence, APIs, add-to-cart endpoint, Cart UI, checkout, payments, orders, shipping, fulfillment, inventory reservation, authentication, wishlist, reviews, or provider integrations were added.

## Purchase-action architecture

The purchase action remains entirely inside the existing PDP option layer:

PDP product DTO → local option selection → canonical variant resolution → purchase-intent state → provider-neutral purchase selection.

The CTA is intentionally disabled until the future Cart phase supplies the actual action. The PDP does not claim that an item was added, inventory was reserved, payment succeeded, or an order was created.

Product loading remains server-first through the existing cached PDP loader. Product-not-found and malformed slug conditions remain handled at the route boundary.

## Purchase selection contract

The canonical handoff is:

- `productId`
- `variantId`
- `quantity`

The current PDP supplies `quantity: 1` as the minimal future-handoff default because no quantity UI exists.

The selection contains no client-authoritative price, inventory quantity, discounts, tax, shipping, totals, payment information, provider credentials, provider payloads, or other commerce state.

## CTA state model

Current source-level states are:

- MISSING_REQUIRED_SELECTION — one or more declared options are not selected.
- INVALID_SELECTION — all required values are present but no canonical variant resolves.
- UNAVAILABLE — the resolved variant is publicly OUT_OF_STOCK.
- READY — the resolved variant is publicly available.

READY is presented as **Selection ready**, not as a completed cart action. The button remains disabled until Cart exists.

Product loading, route-level product-not-found, and unexpected server failures remain outside the client purchase state machine because the PDP route/server boundaries already own those conditions. They do not produce a false purchase success state.

## Required option and variant ownership validation

Required option completeness continues to use the Phase 7.2 canonical resolver. No second combination-resolution algorithm was introduced.

The resolver now rejects malformed selection entries when an option-type ID is not declared by the current product, when a selected value is not a non-empty string, or when a required product option is missing.

A selected variant can only be produced by resolving against the currently displayed product's canonical `variants` array. An unrelated or nonexistent variant cannot be constructed by the PDP selection helper. Final server-side product/variant ownership validation remains mandatory in Cart.

## Quantity contract

No quantity control exists on the current PDP, so no quantity UI was introduced.

The future Cart layer must validate quantity server-side, including integer constraints, minimum and maximum rules, zero/negative values, malformed input, excessive values, and current inventory/business rules.

The PDP's fixed `quantity: 1` is not authoritative inventory validation.

## Pricing authority boundary

Displayed pricing remains canonical catalog pricing from the resolved variant, with the existing server-side compare-at validation and centralized money formatting.

The purchase selection intentionally contains no price.

**DISPLAY PRICE != FINAL CART PRICE**

The future Cart layer must re-read authoritative pricing before creating a cart line.

## Availability authority boundary

The PDP exposes only the existing public availability state:

- IN_STOCK
- LOW_STOCK
- OUT_OF_STOCK
- UNTRACKED

Inventory quantities, reservations, provider inventory, and operational inventory metadata remain hidden.

A resolved OUT_OF_STOCK variant cannot produce a purchase selection. Final Cart validation must re-check availability because PDP state can become stale.

No reservation or stock locking was introduced.

## Client/server responsibility

Client-owned temporary state:

- option selection
- selected-variant presentation
- variant media presentation
- validation/purchase-intent state
- future quantity input, if introduced

Server-authoritative data:

- product lifecycle
- product/variant ownership
- price
- availability/inventory
- discounts
- totals
- fulfillment/shipping data
- final commerce validity

The current PDP performs UX validation only.

## Future Cart handoff

The documented future flow is:

PDP
→ Purchase Selection
→ Cart Request
→ Server-side Catalog Validation
→ Variant Validation
→ Price Validation
→ Availability Validation
→ Cart Creation

This phase does not implement that server-side Cart flow.

## Network action readiness

The current CTA performs no network request and does not persist local cart state.

No fake endpoint, placeholder mutation, provider request, or client-side persistence was introduced.

Option changes resolve against the already-loaded canonical DTO, so they do not create per-click database requests.

## Rapid interaction and stale state

Option selection is synchronous local state. A selection is committed only after the resulting state resolves to a canonical variant and passes the existing availability selectability rule.

There is no asynchronous purchase mutation, so there is no duplicate-request or stale async result problem to solve in this phase.

Future Cart duplicate-submission protection is intentionally out of scope.

## Error handling

Invalid, malformed, incomplete, and unavailable selection states remain represented by understandable UI text.

The PDP does not expose database errors, stack traces, provider errors, or internal operational data.

Unexpected product loading failures remain within the existing server error boundary rather than being converted into false commerce states.

## Accessibility

The purchase CTA is a native disabled button with an accessible name and an associated status description.

Existing option controls retain:

- fieldset/legend grouping
- `aria-pressed`
- `aria-disabled`
- native `disabled`
- visible keyboard focus styling
- live pricing/availability feedback

Validation messages are textual and do not rely only on color.

Browser/screen-reader validation was not executable in the available repository environment.

## Responsive and Bauhaus consistency

No PDP redesign was introduced.

The purchase panel uses the established design vocabulary: strong borders, hard offset shadows, existing typography, existing palette, established spacing, and no gradients, glassmorphism, soft shadows, excessive rounding, or unrelated animation.

Required runtime viewport validation at 320, 375, 640, 768, 1024, 1280, 1440, and 1920px remains unverified.

## Security and public data exposure

The public DTO continues to reduce availability to state only. No inventory quantities, reservations, provider credentials/payloads, internal pricing rules, administrative metadata, audit data, or private customer data were introduced.

Malformed option state is rejected before purchase-selection construction.

Client validation remains UX validation. The future Cart server remains authoritative for all security-sensitive commerce checks.

## Performance

No new state-management or caching infrastructure was introduced.

Option changes are resolved locally from the already-loaded product DTO. No per-option database requests or duplicate product/variant queries were added.

## Tests

Regression coverage now includes:

- purchase-intent state model
- valid purchase-selection contract
- missing required options
- invalid combinations
- unavailable variants
- malformed selection state
- deferred disabled CTA
- provider-neutral commerce boundary
- absence of quantity UI
- existing Phase 7.1/7.2 PDP, pricing, availability, media, DTO, lifecycle, breadcrumb, and no-commerce regressions

## Validation results

Repository/source validation was performed through the GitHub source tree.

The required runtime gates were not executable in the available environment:

- `npm run lint`
- `npm run typecheck`
- `npm test`
- integration tests
- `npm run build`
- browser/smoke tests
- responsive validation at all required widths

No unavailable runtime result is represented as passed.

## Classification

- Purchase-action architecture: FIXED
- Purchase selection contract: FIXED
- CTA state model: FIXED
- Required option validation: PASS
- Variant ownership boundary: PASS
- Quantity: NOT APPLICABLE
- Pricing authority: PASS
- Availability authority: PASS
- Client/server responsibility: PASS
- Network readiness: PASS
- Rapid interaction: PASS
- Error handling: PASS
- Accessibility: PASS — source-level
- Responsive validation: WARNING — runtime browser unavailable
- Security/public data: PASS
- Performance: PASS
- Runtime/build/integration validation: WARNING — not executed

## Remaining limitations

The purchase-action boundary is structurally prepared for the future Cart layer, but production readiness cannot be certified without executing the required runtime, build, integration, browser, and responsive validation suite.

The future Cart phase must revalidate product lifecycle, product/variant ownership, price, availability, quantity, and all final commerce rules server-side.

## Readiness decision

NOT READY FOR PHASE 7.5
