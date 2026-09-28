# Phase 1.10 — Responsive System

## Breakpoint strategy

- Mobile: below 640px.
- Tablet: 640–1024px.
- Navigation transition: approximately 768px using `md`.
- Desktop: 1025px and above using `lg`, explicitly aligned to the foundation token.

The responsive system remains mobile-first and uses one breakpoint vocabulary. The `lg` theme breakpoint is set to 1025px so desktop utilities match the design tokens.

## Container and spacing

The shared Container remains the single horizontal alignment primitive: `max-w-7xl`, `px-4`, `sm:px-6`, `lg:px-8`. Header, Footer, Section, CTA and future storefront content can therefore share the same content edge.

Responsive spacing uses the existing vocabulary rather than scattered one-off values. Existing section padding progresses through `py-12 sm:py-16 lg:py-24`.

## Typography

Global heading typography remains mobile-first: H1 is 2.25rem → 3.75rem → 6rem across mobile/tablet/desktop, and H2 is 2rem → 2.75rem → 3.75rem. Display utilities use the tokenized `text-4xl / text-6xl / text-8xl` progression.

## Borders and shadows

The system retains approximately 2px structural borders on mobile and 4px on desktop. Buttons, cards and the mobile navigation drawer use smaller hard shadows on mobile and step up to the larger hard shadow on desktop. No soft elevation system was introduced.

## Grid, flex and forms

Grid is mobile-first: one column by default, tablet columns through `sm`, desktop columns through `lg`. Split layouts stack by default and become two-column at desktop. Cluster wraps by default. Forms use full-width controls with minimum 48px heights.

## Header and footer

Header navigation remains approximately 768px: mobile trigger/drawer below `md`, desktop navigation at `md` and above. Footer stacks on smaller screens and expands into a desktop grid. No viewport JavaScript was introduced.

## Geometry and overflow

Corner decorations are hidden below `sm` where their negative positioning is unnecessary. Geometric compositions default to `overflow-hidden`, and GlobalCTA contains its decorative shapes. Decorative layers remain pointer-transparent.

The existing `overflow-x: clip` rule is retained as an intentional containment safeguard from the layout foundation, not as a substitute for fixing content overflow. No global `overflow-x: hidden` rule was introduced.

## Touch targets and accessibility

Button, IconButton, menu controls and form controls retain approximately 44–48px minimum interaction dimensions. Responsive behavior preserves reading order, keyboard focus, visible focus, semantic landmarks and accessible mobile-menu focus management.

## Motion and performance

Existing reduced-motion handling remains active. No new continuous animation, resize listener, viewport detection, duplicate mobile/desktop DOM tree or layout recalculation loop was introduced.

## Required viewport verification

Mobile: 320px, 375px, 390px, 430px.
Tablet: 640px, 768px, 820px, 1024px.
Desktop: 1280px, 1440px, 1920px.

Intermediate widths should also be checked.

## Validation

Source-level audit covered breakpoints, Container alignment, typography, borders, hard shadows, Grid/Split/Cluster behavior, Header/Footer, geometric containment, touch targets, full-width sections, accessibility and CSS-driven responsiveness.

Runtime lint/typecheck/build/tests and browser viewport screenshots could not be executed in the available repository environment because dependencies cannot currently be installed through the existing GitHub/network limitation. No runtime pass is being claimed.