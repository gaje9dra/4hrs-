# Phase 10.4 — Checkout UI, Address Selection & Storefront Checkout Integration

## Route and authentication
The canonical customer-facing route is `/checkout`. It is force-dynamic, private and non-indexable. The server route resolves the existing customer session before rendering the Checkout client surface. Anonymous users are redirected to the existing `/login` flow with the fixed local `/checkout` return target.

## UI architecture
The server route owns authentication. The client component owns transient presentation and interaction state only. Checkout data is consumed through `/api/checkout`; no ORM/database access exists in the UI.

## Address selection
Saved addresses are loaded through `GET /api/customer/addresses`. The UI renders the safe CustomerAddress DTO and submits only `selectedAddressId` to Checkout. The Checkout service revalidates ownership server-side.

The repository had no Account address-management UI, while Phase 10.2 already provides the customer address application/API boundary. Therefore this phase adds a focused inline create-address flow using that existing boundary rather than creating a parallel address manager. Newly created addresses are sent through Checkout validation before selection is accepted.

## Default address behavior
The initial Checkout response determines the selected/default address. The UI never treats array position as default. When no default exists, the server validation remains address-required until the customer explicitly selects or creates an address.

## State machine
The client uses explicit states: loading, ready, address_required, validating, valid, validation_error, price_changed, availability_changed, cart_changed, session_expired and server_error. Address changes are serialized by a pending guard and request-version check so stale responses cannot overwrite newer state.

## Pricing and availability
The UI renders server-authoritative Checkout totals and line subtotals exactly as returned. It does not calculate totals or send prices, totals, currency, inventory values, customer IDs or payment credentials. Price and availability failures block the future payment action and provide a Cart return path.

## Future Payment boundary
The Checkout action is intentionally disabled because payment is not implemented. No payment SDK, credential collection, intent, transaction, provider, order, shipping, fulfillment or inventory reservation code is introduced.

## Error handling
Route-level loading and error boundaries are present. Session expiry has an explicit sign-in path. API/network failures use concise customer-facing messages without exposing ORM, database, stack-trace or implementation details.

## Accessibility and responsive behavior
Checkout uses semantic headings, native radio-group semantics, associated labels, live-region updates, visible selected/error treatments beyond color alone, keyboard-focusable controls and mobile-first layout. The summary becomes sticky only at large breakpoints. Long address content wraps.

## Bauhaus design
The implementation reuses the existing Container, Card, Button, FormField and Input primitives plus existing border, hard-shadow, spacing and project color tokens. No gradients, glassmorphism or unrelated component system was introduced.

## Privacy and SEO
The route uses force-dynamic rendering and robots noindex/nofollow/noarchive metadata. Checkout and address requests use same-origin credentials and no-store caching. No checkout content is intended for public indexing or sitemap inclusion.

## Tests
`tests/checkout-ui.test.ts` verifies safe authentication return handling, private route metadata, server-authoritative request shape, explicit UI state coverage and absence of ORM access in the UI.

## Browser validation
Repository CI validates the route/component contracts, lint, typecheck and production build. A live browser session at every requested viewport requires the developer's browser/runtime and is not available through the repository connector, so final visual checks should be performed locally at 320, 375, 390, 640, 768, 1024, 1280, 1440 and 1920px before release.

## Known limitations
- Payment is intentionally unavailable.
- Account does not currently expose an address-management page, so Checkout provides focused address creation only.
- Editing/deleting existing addresses remains in the Phase 10.2 API boundary and is not duplicated in Checkout.
- Order, Shipping, Fulfillment, Inventory Reservation and Wishlist remain deferred.
