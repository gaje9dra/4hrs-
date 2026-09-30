# Phase 7.2 — Variant Selection, Purchasability & Commerce Handoff

## Scope
Phase 7.2 hardens the existing Product Detail Page without implementing Cart, Wishlist, Authentication, Checkout, Payments, Orders, Shipping, Fulfillment, inventory reservation, provider integrations, or a new variant system.

## Findings and changes

### Variant model — FIXED
The canonical Prisma model remains the source of truth for Product → ProductVariant → ProductVariantOptionValue → VariantOptionValue relationships. No new schema was introduced.
The catalog detail query now validates the mapped public variant matrix before returning it:
- every variant has exactly one option value for every product option type;
- option values belong to the product's declared option type;
- duplicate option-type assignments inside one variant are rejected;
- duplicate option combinations across active variants are rejected;
- a product with no declared options cannot expose multiple indistinguishable active variants.
Invalid catalog state raises CATALOG_DATA_INTEGRITY_ERROR instead of allowing ambiguous browser resolution.

### Option selection — FIXED
lib/storefront/variant-selection.ts is now the single provider-neutral client-side selection helper.
It provides deterministic initial variant selection, conversion from a canonical variant to selected option values, exact complete-selection → variant resolution, and option-value selectability checks against real variants and canonical availability.
ProductOptions no longer contains a second implementation of variant matching. Selecting a value is committed only when the resulting complete selection resolves to a real canonical variant.

### Combination matrix — FIXED
The selection helper distinguishes values participating in an available combination, combinations that resolve to a real variant, and combinations that do not exist. Unavailable variants remain non-selectable. The server-side catalog guard prevents duplicate or incomplete combinations from making the resolver ambiguous.

### Availability — PASS
Availability remains derived from the canonical inventory repository and is reduced at the storefront boundary to IN_STOCK, LOW_STOCK, OUT_OF_STOCK, or UNTRACKED.
No on-hand quantity, reserved quantity, inventory ledger, warehouse, provider synchronization, or other operational inventory data is exposed through the storefront DTO.

### Product-level purchasability — WARNING
The existing catalog contract exposes public product availability rather than a separate commerce authorization flag. The current PDP therefore treats product availability as presentation state only. A product with no available variant has no functional commerce action, and the future Cart layer must revalidate the selected product and variant server-side.

### Pricing — PASS
Variant price remains the canonical effective price: variant.price ?? product.price. Compare-at pricing continues through formatValidCompareAtPrice. No client-controlled price is introduced as commerce authority.

### Variant media — FIXED
The same deterministic initial variant resolver is reused by the interactive PDP and option selector. Variant selection updates media through the existing callback and falls back to product media when the selected variant has no dedicated media.

### URL-driven variant state — NOT APPLICABLE
The existing PDP does not implement URL-driven variant selection. Phase 7.2 does not introduce it because it is not required by the existing architecture.

### Quantity — NOT APPLICABLE
No quantity selector exists in the current PDP. None was added. Final quantity validation remains a future Cart responsibility.

### Future Cart handoff — PASS
The future boundary is provider-neutral. The eventual cart request should contain only a validated selection equivalent to canonical product identity, canonical variant identity, requested quantity, and current public availability/purchasability state.
The client must never be authoritative for price, inventory, discounts, totals, or arbitrary product/variant data. The future Cart service must revalidate: PDP selection → Cart request → server validation → product/variant validation → current price validation → current availability validation → cart creation.
No fake cart endpoint or commerce mutation was added.

### Security — PASS
The PDP does not expose provider credentials, inventory quantities, reservations, warehouse information, audit metadata, or provider synchronization state. Variant resolution is constrained to the current product's canonical public variant data.

### Performance — PASS
Variant clicks resolve against the already server-rendered product DTO. No request is issued for each option click. No speculative state-management or caching library was introduced.

### Accessibility — PASS (source-level)
Existing fieldsets/legends, aria-pressed, aria-disabled, native disabled buttons, visible focus styles, and live pricing/availability messaging remain in place. Browser keyboard/focus validation remains unexecuted.

### Responsive / Bauhaus — PASS (source-level)
No new visual system was introduced. Existing controls and composition remain within the established responsive/Bauhaus implementation. Required browser widths still require real browser validation.

## Tests added/updated
- central variant selection helper coverage;
- deterministic initial variant coverage;
- incomplete/ambiguous variant matrix guard coverage;
- provider-neutral commerce boundary regression coverage;
- existing PDP pricing, availability, media, DTO, breadcrumb, and no-commerce regressions retained.

## Validation status
Source-level review and repository edits completed.
The required production runtime gates were not executed in this environment: npm run lint, npm run typecheck, npm test, integration tests, npm run build, and relevant browser/smoke tests at 320/375/640/768/1024/1280/1440/1920px.
Therefore runtime/build/browser readiness is not verified.

## Readiness classification
- Variant model: FIXED
- Selection architecture: FIXED
- Combination integrity: FIXED
- Availability: PASS
- Product-level purchasability: WARNING
- Pricing: PASS
- Media: FIXED
- URL-driven variant state: NOT APPLICABLE
- Quantity: NOT APPLICABLE
- Future commerce handoff: PASS
- Security: PASS
- Performance: PASS
- Accessibility: PASS source-level
- Responsive validation: WARNING — browser validation unavailable
- Runtime validation: WARNING — commands unavailable

## Remaining limitation
The implementation is structurally hardened at the source level, but the required production validation suite has not been run. The phase gate therefore cannot be promoted to a production-ready state solely from repository inspection.