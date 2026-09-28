# Phase 1.9 — Footer & Global Sections

## Footer architecture

The root layout continues to own the single global Footer instance. The Footer is split into focused presentation components under `components/layout`:

- `footer.tsx` — global composition and responsive structure.
- `footer-brand.tsx` — concise brand/intro area.
- `footer-nav.tsx` — data-driven navigation groups.
- `footer-social.tsx` — optional external social links with accessible labels.
- `footer-legal.tsx` — optional legal/utility links.
- `footer-copyright.tsx` — current-year copyright.

The Footer uses the Phase 1.7 `Container`; no separate maximum-width system was introduced.

## Footer configuration

Footer navigation and social destinations are kept outside JSX:

- `config/footer.ts` contains navigation groups, legal links, and social configuration.
- `types/footer.ts` defines the shared contracts.

Only the Home route is exposed because it is the only implemented production destination in the current foundation. Empty social/legal configuration renders no misleading controls.

External links support `target="_blank"` with `rel="noopener noreferrer"` when explicitly configured.

## Visual architecture

The Footer uses the established near-black foreground background with white text, strong borders, yellow headings, and the existing geometric brand mark.

It intentionally does not use:

- gradients
- glass effects
- soft floating shadows
- excessive rounded containers
- fake placeholder destinations

The mobile layout stacks the brand, configured navigation, optional social area, and legal/copyright area. Desktop uses a two-region grid with the brand separated from navigation/utility content.

## Global section primitives

Phase 1.9 establishes three reusable presentation primitives:

### AnnouncementBar

`AnnouncementBar` supports:

- concise message
- optional link and link label
- accessible native link semantics
- Bauhaus yellow treatment

It does not contain CMS, campaign management, dismissal persistence, or backend behavior.

### SectionDivider

`SectionDivider` provides a structural full-width divider using the established palette. It is decorative and does not introduce a second border system.

### GlobalCTA

`GlobalCTA` provides a generic yellow final-action structure with:

- heading
- optional supporting text
- primary action
- optional secondary action
- optional/custom geometric decoration

It is presentation-only and does not hardcode a marketing campaign.

## Accessibility

Footer navigation groups use labelled `nav` landmarks. Social links expose their destination through `aria-label`. Icon controls have minimum interaction dimensions and use the global focus-visible system.

Footer links preserve native keyboard behavior and visible focus. Navigation does not rely only on color.

Global sections use semantic sectioning and native link/button semantics.

## Responsive behavior

The footer follows the existing mobile-first layout system and Phase 1.7 Container architecture.

The footer avoids compressing a desktop-only multi-column structure into unusable mobile columns. Content naturally stacks at smaller widths and expands into structured grids at larger widths.

The global CTA uses a responsive content/action grid and contained geometry. The AnnouncementBar remains compact across widths.

## Geometry

Footer geometry is limited to the existing `GeometricMark`. GlobalCTA uses the Phase 1.6 geometric decoration primitives selectively and keeps them pointer-transparent so they cannot obstruct interaction.

No new geometry system was introduced.

## Server/client boundary

Footer and global section components are server-compatible. No client state, API calls, database access, authentication, payment operations, provider integrations, or business logic were introduced.

The current-year copyright uses a deterministic server-side `Date` value rather than a manually maintained year.

## Showcase

The development-only component showcase demonstrates:

- AnnouncementBar
- SectionDivider
- GlobalCTA
- Footer

The showcase uses placeholder presentation data only and does not connect to production business data.

## Validation

Source-level checks covered:

- Footer uses the Phase 1.7 Container.
- Footer destinations are configuration-driven.
- No fake `#` footer destinations remain.
- Current year is generated dynamically.
- Footer uses semantic navigation landmarks.
- Social links are optional and accessible.
- External links receive `noopener noreferrer`.
- GlobalCTA and AnnouncementBar remain presentation-only.
- Existing Bauhaus geometry is reused.
- No product/cart/payment/order/provider/admin/database logic was added.
- No new dependencies were added.

Local `npm run lint`, `npm run typecheck`, `npm run build`, and existing tests could not be executed because the environment cannot currently resolve `github.com` to install repository dependencies. This remains an environment/network limitation rather than a reported Phase 1.9 runtime failure.
