# 4HRS Application Architecture

## Purpose

Phase 1.2 defines application boundaries for the 4HRS fashion platform. The repository remains a modular monolith built on the Next.js App Router.

## Current structure

app/
  (storefront)/   customer-facing route boundary
  admin/           reserved admin route boundary
  api/             reserved server API route boundary
  layout.tsx       root application layout
  globals.css

components/
  ui/              generic reusable UI
  layout/          global shell/navigation and reusable layout primitives
  bauhaus/         Bauhaus geometry, compositions and presets
  shared/          cross-domain presentation components

features/
  products/ categories/ collections/
  cart/ wishlist/ customers/
  orders/ inventory/ admin/

lib/
  db/ auth/ notifications/
  payments/ fulfillment/ shipping/
  architecture/   compatibility location for Phase 1 foundation contracts
  tokens/          existing visual foundation

config/             non-secret application configuration
types/              genuinely cross-domain types only
styles/             shared style boundary
docs/               architecture and phase documentation

## Application boundaries

### Storefront
The customer-facing route boundary is reserved under app/(storefront). The route group does not change public URLs. Customer features belong under features/ rather than coupling route components to infrastructure.

### Admin
app/admin is the protected administrative control plane established in Phase 14.1. It uses the existing customer session plus explicit AdminUser authority and centralized role-to-permission authorization. Admin routes must remain a thin control-plane boundary and must invoke canonical domain/application services rather than duplicating storefront business logic.

### API
app/api is reserved for server-side API handlers. API handlers should delegate to feature/domain services rather than contain business rules or raw infrastructure access.

### Features
Business domains are organized under features/<domain>. A feature may own components, services, types and utilities. Subdirectories are created only when needed.

### Database
lib/db is the only future database infrastructure boundary. UI components and route files must not contain raw database queries.

Intended direction:
UI -> Feature Service -> Repository/Data Access -> Database

No database implementation exists in Phase 1.2.

### Payments
lib/payments owns payment contracts and future provider adapters. Storefront and order logic must depend on provider-neutral contracts, not a specific provider.

### Fulfillment
lib/fulfillment owns fulfillment contracts and future provider adapters.

Order -> Fulfillment Service -> Provider Adapter -> External Provider

Qikink, Printrove, Printful, Printify, manual fulfillment and inventory are provider choices, not the core architecture.

### Shipping
lib/shipping owns shipping contracts and future provider adapters. Provider-specific clients remain behind this boundary.

### Authentication
lib/auth is reserved for authentication/session infrastructure. Customer, admin and staff authentication must not be embedded in individual pages.

### Notifications
lib/notifications is reserved for notification orchestration. Email, WhatsApp, SMS and push channels must remain replaceable integrations.

### Shared UI
components/ui remains the generic reusable UI layer. components/layout owns the global shell and reusable layout primitives. components/bauhaus is the dedicated home for the project's distinctive visual-language primitives and compositions. Storefront-specific compositions remain deferred to later phases.

## Dependency direction

Preferred:

UI / Route
  ↓
Feature
  ↓
Domain Service / Contract
  ↓
Infrastructure / Provider Adapter

Infrastructure must not import customer-facing React components. Provider adapters must not own business rules that belong to the store domain.

## Server / client boundary

Server-only code includes database access, secrets, payment credentials, fulfillment credentials, shipping credentials and other private integrations.

Client code is limited to presentation, user interaction and UI state.

Shared code is limited to pure types, constants and deterministic utilities safe in both environments.

No secret is exposed through NEXT_PUBLIC_* or client components.

## Environment boundary

Public configuration is separated from server-only secrets. Secrets remain in environment variables or deployment-platform secure configuration. Source-controlled configuration contains no credentials.

## Provider adapter principle

Every future external integration follows:

Provider-neutral contract
  ↓
Provider adapter
  ↓
External provider

This prevents provider lock-in and keeps business logic independent of vendor APIs.

## Naming and imports

- Files/directories use kebab-case.
- React components use PascalCase.
- The existing @/* TypeScript alias remains the single alias convention.
- Avoid automatic barrel files.
- Prefer direct imports unless a focused barrel improves discoverability without circular dependencies.

## Phase boundary

Phase 1.2 establishes structure and boundaries only. It does not implement database schema/CRUD, product management, provider APIs, payment gateways, shipping, fulfillment, checkout, authentication, cart/wishlist, orders, admin dashboard or analytics.

## Global layout architecture

Phase 1.7 establishes reusable global layout primitives under `components/layout`: Container, Section, Grid, Split, Stack and Cluster. The root shell remains responsible for the global header, single main landmark, and footer. Layout primitives are server-compatible, mobile-first, and independent of business logic.

Container alignment uses `max-w-7xl` as the standard content width. Full-width sections own backgrounds and structural dividers while constrained content nests inside Container. Narrow reading content and justified wide compositions use explicit container variants rather than page-specific max-widths.

Responsive layout uses CSS Grid/Flexbox at the established 640px and 1024px boundaries. Decorative overflow must be locally contained; document-level accidental horizontal scrolling is suppressed.

## Global header and navigation architecture

Phase 1.8 keeps the global header under `components/layout`. The header consumes structured navigation configuration from `config/navigation.ts`, while desktop and mobile presentation are separated into focused components.

Desktop navigation and mobile navigation share the same `NavigationItem` data model. Utility navigation is optional and only renders configured destinations, preventing non-functional search/account/wishlist/cart controls from appearing before those routes exist.

The mobile navigation is client-side only because it owns menu state and focus/keyboard behavior. Static brand and navigation configuration remain independent of business services, databases, authentication, payments, fulfillment and shipping providers.

## Global footer and section architecture

Phase 1.9 keeps the global Footer under `components/layout` and composes it from focused brand, navigation, social, legal and copyright components. Footer destinations are configured through `config/footer.ts` and typed through `types/footer.ts`. The Footer uses the same global Container established in Phase 1.7, so header/footer content remains horizontally aligned.

The phase also establishes presentation-only global sections under `components/layout`: AnnouncementBar, SectionDivider and GlobalCTA. These components accept content/actions as props and do not perform product, cart, authentication, payment, order, shipping, provider, database or CMS operations.

Footer and global section components remain server-compatible. Optional external social links use explicit configuration and secure external-link attributes. Geometric decoration reuses the Phase 1.6 system rather than creating another visual primitive library.

## Responsive system — Phase 1.10

The responsive foundation is mobile-first and uses one breakpoint vocabulary:

- Mobile: below 640px.
- Tablet: 640px–1024px.
- Desktop: 1025px and above.
- Tailwind `sm` remains the 640px tablet boundary.
- Tailwind `md` remains the approximately 768px navigation transition.
- Tailwind `lg` is explicitly aligned to 1025px so desktop utilities match the design tokens.

The shared `Container` uses `max-w-7xl` with `px-4 sm:px-6 lg:px-8`, keeping Header, main sections, Footer and global sections on the same horizontal alignment system.

Responsive grids start at one column and progressively enhance through `sm` and `lg`. Flex clusters wrap by default. Form controls use full available width with minimum touch-friendly heights.

Structural borders use the established 2px mobile / 4px desktop vocabulary where responsive scaling is meaningful. Hard shadows remain offset and scale down on mobile for buttons, cards and the mobile navigation drawer.

The existing `overflow-x: clip` rule is retained as a documented containment safeguard from the layout foundation, not as a substitute for fixing component overflow. Geometric compositions and global CTA decorations explicitly contain decorative overflow, while content layouts use normal sizing and wrapping.

Responsive behavior is CSS-driven. No viewport detection, resize listeners, duplicate mobile/desktop trees, or new client-side responsive state was introduced in Phase 1.10.

## Animation & interaction system — Phase 1.11

Motion is a shared presentation concern rather than component-specific business logic. The source of truth is `lib/tokens/index.ts` with matching CSS variables/utilities in `app/globals.css`.

The interaction vocabulary is intentionally small:

- 200ms fast interactions.
- 300ms standard transitions.
- ease-out easing.
- 2px mechanical press.
- 4px card lift.
- 1.04 restrained icon scale.
- strong 2px-offset focus treatment.

Shared CSS utilities provide `motion-press`, `motion-lift`, `motion-link` and `motion-icon`. Components reuse these instead of creating independent timing/transform definitions.

Animation is CSS-driven. No animation library, JavaScript animation loop, viewport listener, scroll listener or layout measurement was introduced.

Reduced motion removes unnecessary transforms and minimizes transition duration while preserving functional state changes.

Normal interaction effects use transform/opacity/color/background changes and do not change document layout. Accordion expansion is the intentional layout-changing interaction because content is being revealed.

Decorative geometry remains static unless a future interaction has a concrete usability reason. Continuous spinning, pulsing, floating, bouncing and parallax are outside the interaction system.

## Accessibility foundation — Phase 1.12

Accessibility is a reusable architecture concern rather than page-specific decoration.

The root shell exposes one clear `header`, navigation regions, a focusable `main#main-content`, and `footer`. `SkipLink` provides keyboard users with a direct path past repeated navigation.

The shared focus system remains centralized in `app/globals.css`: interactive controls use a high-contrast 2px yellow outline with a 2px offset and dark secondary ring. Components must not suppress that treatment with `outline: none` or `outline-none` unless an equivalent accessible treatment is supplied.

Interactive controls use native HTML semantics. `Button` renders `button` for actions and `a` for navigation. `IconButton` requires a label. Lucide icons used only as decoration are marked `aria-hidden`, while navigation regions have explicit labels where multiple navigation landmarks exist.

`FormField` provides a reusable context for description, error, invalid and required semantics. Shared `Input`, `Textarea`, `Select`, `Checkbox` and `Radio` controls consume that context and expose `aria-describedby`, `aria-invalid` and `aria-required` consistently. Required status is also visible as text. Validation errors remain textual and are not communicated through red color alone.

Accordion triggers expose native button semantics plus `aria-expanded` and `aria-controls`; panels are associated with their triggers. Mobile navigation retains keyboard operation, Escape handling, initial focus, and focus restoration to the menu trigger.

Decorative geometric compositions and decorative icons are removed from the accessibility tree. Meaningful images must supply content-derived alternative text when introduced. `VisuallyHidden` provides a reusable utility for assistive-technology-only text.

The core Bauhaus color combinations were audited for contrast without changing the palette. Responsive touch targets remain at least 44px for primary controls, navigation links, icon buttons, and checkbox/radio controls. Reduced-motion behavior from Phase 1.11 remains intact.

Phase 1.12 does not claim full WCAG conformance because runtime browser, assistive-technology, and automated accessibility testing were not available in the repository environment.

