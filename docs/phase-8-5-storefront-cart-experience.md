# Phase 8.5 — Storefront Cart Experience

## Status

**NOT READY FOR PHASE 8.6**

Phase 8.5 implements the customer-facing Cart route, Cart UI, server-backed mutations, and Product Detail → Cart handoff without implementing authentication, Wishlist, Checkout, Payments, Orders, Shipping, Fulfillment, Reviews, or inventory reservation.

## Architecture

The storefront uses:

`/cart` → `CartPage` client interaction → `/api/cart` → Cart application → Cart domain service → catalog/repository.

The browser consumes only the client-safe Cart contracts in `lib/cart/contracts.ts`. No Prisma client, database access, provider identifiers, ownership identifiers, or server secrets enter client components.

The Cart route is dynamic and its metadata is `noindex, nofollow, nocache`. API responses remain `private, no-store`.

## Cart UI

The Cart page includes authoritative item count, product media/title, variant data, current price, line subtotal, Cart subtotal, availability messaging, quantity controls, remove, clear, loading/error states, and an empty state linking to the real `/shop` route. Checkout is not fabricated; the page explicitly communicates that it is unavailable.

## Product Detail → Cart

The existing Phase 7 selection contract remains canonical: `productId`, `variantId`, and quantity `1`. Product Detail POSTs only that selection to `/api/cart`. It never sends price, title, inventory, provider data, or totals.

Add-to-Cart feedback is server-confirmed. Pending state prevents duplicate clicks. Successful mutation exposes a real `/cart` link.

## Quantity, Remove, Clear

Quantity uses PATCH `/api/cart/items/:cartItemId`; remove uses DELETE on that route; clear uses DELETE `/api/cart`. The UI adopts only the returned CartDto as authoritative state.

Mutation/fetch requests use a version guard so an older response cannot replace newer state. Controls are disabled while their relevant operation is pending.

## Stale items

Unavailable lines remain visible. The UI distinguishes product unavailable, selected option unavailable, and insufficient availability. Unavailable lines cannot be incremented and no client-side inventory validation is used.

## Pricing and security

All displayed authoritative monetary values come from CartDto. The browser performs no authoritative total calculation. Cart data is not stored in localStorage or URL parameters.

The Cart API's request-context resolver still fails closed with `CART_OWNERSHIP_UNAVAILABLE` because the repository has no customer/session identity mechanism. This is intentional; no client-supplied Cart ID or owner ID was invented.

## Responsive/Bauhaus/accessibility

The implementation reuses existing Container, Button, Alert, and IconButton primitives and established Bauhaus tokens. It uses square geometry, thick borders, hard-offset shadows, red/blue/yellow palette, Outfit typography, mobile-first stacking, and reduced-motion support.

Semantic headings, keyboard controls, focus styles, accessible labels, live status messages, `aria-busy`, image alt text, and 44px-class touch targets are provided. No gradients, glass effects, soft shadows, or unrelated rounded-card styling were introduced.

## SEO/privacy/performance

The Cart route is noindex/nofollow/nocache and the API is private/no-store. No Cart structured data or public indexing was added.

The initial page performs one GET. Mutations use their returned CartDto and do not intentionally trigger a second client GET. There is no polling, mini-cart, drawer, localStorage persistence, or client-side pricing.

## Testing and validation

Phase 8.4 contains API/application contract coverage. Phase 8.5 source changes cover the Cart route, client mutation flows, Product Detail add flow, and navigation. Browser/E2E execution and local PostgreSQL validation are not available through the GitHub integration environment.

Required local/CI commands:

`npm run lint`
`npm run typecheck`
`npm test`
`npm run build`

Browser smoke testing should cover valid product selection, add, Cart loading, quantity changes, remove, clear, empty state, stale/unavailable state, mobile viewports, and keyboard operation.

## Known limitations

1. Customer authentication/session ownership is not implemented.
2. Therefore the current production Cart API and Cart UI correctly fail closed until a supported identity mechanism is introduced.
3. Browser/E2E and PostgreSQL runtime execution were not available here.
4. Lint, typecheck, tests, and production build were not executed here.
5. No Wishlist, Checkout, Payments, Orders, Shipping, Fulfillment, Reviews, or Inventory Reservation functionality was implemented.

## Phase 8.6 prerequisites

- Introduce a supported customer/session identity mechanism outside the Cart UI layer.
- Make the existing server-side request-context resolver consume that identity.
- Run the full local/CI validation suite and browser smoke matrix.
- Verify authenticated persistence and cross-Cart authorization.
- Preserve the Cart DTO/API boundary; keep ownership, pricing, availability, and database logic server-side.

## Final readiness decision

**NOT READY FOR PHASE 8.6**
