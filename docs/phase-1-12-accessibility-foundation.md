# Phase 1.12 — Accessibility Foundation

## Scope

Phase 1.12 strengthens accessibility across the existing Phase 1.1–1.11 architecture without adding storefront business functionality. The Bauhaus visual system remains unchanged.

## Semantic HTML and landmarks

- Root layout exposes `header`, `main#main-content`, and `footer`.
- Existing navigation regions retain native `nav` semantics and meaningful labels where multiple navigation landmarks exist.
- Actions continue to use native `button`; navigation continues to use native `a`.
- Accordion triggers remain native buttons.
- Forms continue to use native `label`, `input`, `textarea`, and `select` controls.

## Skip navigation

`components/layout/skip-link.tsx` provides a reusable keyboard skip link. It is visually hidden until keyboard focus and targets `#main-content`. The main landmark is programmatically focusable so the skip action has a reliable destination.

## Keyboard and focus behavior

- The shared 2px-offset Bauhaus focus treatment remains centralized in `app/globals.css`.
- Previous `outline-none` suppression was removed from the shared interactive controls audited in this phase.
- Header and mobile navigation retain native link/button keyboard behavior.
- Mobile navigation retains Escape-to-close, initial focus on the first navigation link, and focus restoration to the trigger.
- Accordion uses native button keyboard behavior and exposes expanded state.
- Touch-oriented controls use at least 44px interactive dimensions where applicable.

## Form accessibility

`FormField` now provides a reusable context for:

- descriptive help text
- validation errors
- invalid state
- required state

Shared `Input`, `Textarea`, `Select`, `Checkbox`, and `Radio` consume that context and expose `aria-describedby`, `aria-invalid`, and `aria-required` when applicable.

Required fields receive visible "(required)" text. Error messages remain textual and are associated through `aria-describedby`; invalid controls expose `aria-invalid`.

## Icons and screen readers

- Decorative Lucide icons are marked `aria-hidden`.
- Icon-only utility and social links retain accessible labels.
- `IconButton` requires an explicit `label`.
- Decorative homepage geometry and geometric composition layers are removed from the accessibility tree.
- The existing geometric visual language is preserved.

## Visually hidden content

`components/ui/visually-hidden.tsx` provides a reusable assistive-technology-only content primitive for future components.

## Status and error communication

`Alert`/ `Status` now distinguish urgent announcements from non-urgent status:

- warning/error: `role="alert"` with assertive announcement
- information/success: `role="status"` with polite announcement

The visual Bauhaus red/yellow/blue states remain supported, but the semantic message does not depend on color alone.

## Contrast

The core palette was checked for representative foreground/background combinations without replacing the Bauhaus colors:

| Combination | Approx. contrast |
| --- | ---: |
| #D02020 on #FFFFFF | 5.37:1 |
| #1040C0 on #FFFFFF | 8.34:1 |
| #F0C020 on #121212 | 10.94:1 |
| #FFFFFF on #121212 | 18.73:1 |
| #121212 on #F0F0F0 | 16.44:1 |

These are palette-level calculations, not a claim of full WCAG conformance for every future component state.

## Reduced motion

Phase 1.11 reduced-motion behavior is preserved:

- button/card/icon transforms are removed
- interaction transitions are minimized
- marquee animation is disabled
- functional state changes remain available

No new motion dependency or continuous decorative animation was introduced.

## Responsive accessibility

The existing responsive system remains unchanged:

- mobile: below 640px
- tablet: 640px–1024px
- desktop: 1025px+

The accessibility audit covered the source implementation for the specified viewport ranges and checked:

- readable text/wrapping
- focus visibility
- navigation reachability
- touch target sizing
- decorative containment
- horizontal overflow safeguards

Browser/device validation could not be executed in the repository environment.

## Validation

### Completed

- Source-level semantic audit of root layout, header, navigation, footer, controls, accordion, alerts, geometry, and homepage.
- Confirmed no remaining `outline-none` occurrences through repository search.
- Confirmed core palette contrast calculations.
- Confirmed no new accessibility dependency was added.
- Confirmed reduced-motion implementation remains present.
- Confirmed no business functionality was added.

### Not executable in the current environment

- `npm run lint`
- `npm run typecheck`
- `npm test` — no test script exists in `package.json`
- `npm run build`
- Browser keyboard/manual testing
- Screen-reader/assistive-technology testing
- Automated accessibility testing

A direct repository clone was attempted, but GitHub DNS resolution was unavailable in the execution environment. Therefore runtime validation is explicitly not claimed.

## Known limitations

- Full WCAG conformance has not been claimed.
- Browser-level focus clipping and responsive behavior require a runnable local/browser environment for final verification.
- Screen-reader output requires actual assistive-technology testing.
- Future meaningful images must supply content-derived `alt` text; no product/content image system exists yet in this foundation phase.
