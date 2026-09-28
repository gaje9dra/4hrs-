# Phase 1.8 — Header, Navigation & Mobile Navigation

## Architecture

The global header lives under `components/layout` and remains independent from storefront business logic.

- `header.tsx` — global composition and responsive state.
- `header-brand.tsx` — reusable brand/logo slot using the existing geometric mark.
- `desktop-nav.tsx` — data-driven desktop primary navigation.
- `utility-nav.tsx` — optional data-driven search/account/wishlist/cart links.
- `mobile-nav.tsx` — accessible mobile drawer and interaction state.
- `config/navigation.ts` — shared navigation configuration.
- `types/navigation.ts` — navigation item contracts.

The root layout continues to own the single global header instance. The header uses the Phase 1.7 `Container` rather than introducing another max-width system.

## Navigation data

Primary navigation uses:

```ts
type NavigationItem = {
  label: string
  href?: string
  children?: NavigationItem[]
  external?: boolean
  disabled?: boolean
}
```

Desktop and mobile navigation consume the same `storefrontNavigation` source.

Utility navigation uses a separate structured type with an icon key. Empty utility configuration means no misleading non-functional search/account/wishlist/cart controls are rendered.

Only currently implemented routes are active in production navigation. Future routes can be added to the configuration when their route exists.

## Responsive behavior

The navigation transition follows the existing mobile-first architecture:

- below `md` (768px): compact header + mobile menu trigger.
- `md` and above: desktop primary navigation + configured utility navigation.
- the global `Container` preserves horizontal alignment with the rest of the site.

The header is not sticky or fixed. No scroll listener or scroll-driven effect was introduced.

## Mobile menu behavior

When opened:

1. The drawer is mounted.
2. Focus moves to the first navigation link.
3. Body scrolling is disabled.
4. An overlay prevents normal background interaction.
5. Escape closes the menu.
6. Tab/Shift+Tab cycle within the drawer controls.
7. The trigger displays the close icon/state.

When closed:

1. The drawer is unmounted, removing hidden navigation from the accessibility tree.
2. Body scrolling is restored.
3. Focus returns to the menu trigger.

The implementation does not use an uncontrolled permanent hidden navigation tree.

## Accessibility

The header uses semantic `header` and `nav` elements with explicit accessible labels.

- Menu trigger has an accessible name.
- `aria-expanded` reflects menu state.
- `aria-controls` identifies the mobile panel.
- Current desktop navigation uses `aria-current="page"`.
- Icon-only utility controls use accessible link names.
- Escape and keyboard focus behavior are implemented.
- Focus-visible styling comes from the Phase 1.4 global system.
- Navigation links use native `Link` semantics.
- No color-only active state is used; the active desktop item also receives a border/accent marker.

## Visual system

The implementation reuses the established Bauhaus system:

- Outfit typography.
- black structural borders.
- square interaction geometry.
- red/blue/yellow palette.
- existing geometric brand mark.
- hard-edged interaction feedback.
- no gradients, glassmorphism, backdrop blur, or soft navigation shadows.

The header remains intentionally restrained so navigation remains the primary function.

## Extension points

Nested navigation is represented by the `children` property without implementing a mega-menu in Phase 1.8. Future dropdowns can consume the same data model and remain independent from product/provider queries.

Utility destinations can be added without changing the header composition.

## Validation

Source-level verification covered:

- shared navigation source used by desktop/mobile header.
- no duplicate hardcoded navigation list in the header.
- mobile breakpoint begins below 768px.
- mobile drawer supports Escape, focus return, and body scroll restoration.
- hidden mobile navigation is conditionally unmounted.
- icon-only controls have accessible names.
- no business/provider/database/payment logic was added.
- no sticky/fixed header behavior was introduced.

Local `npm run lint`, `npm run typecheck`, `npm run build`, and tests could not be executed because the environment could not resolve `github.com` to clone/install the repository dependencies. This is an environment/network limitation, not a reported Phase 1.8 runtime failure.
