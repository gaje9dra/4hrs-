# Phase 1.11 — Animation & Interaction System

## Motion tokens

The motion source of truth is centralized in `lib/tokens/index.ts` and mirrored into CSS custom properties in `app/globals.css`.

- Fast: 200ms.
- Standard: 300ms.
- Easing: `ease-out`.
- Press distance: 2px X/Y.
- Card lift distance: 4px upward.
- Interactive icon scale: 1.04.
- Focus offset: 2px.

The system deliberately avoids a large easing vocabulary.

## Interaction patterns

### Button / press

Buttons use the shared `motion-press` utility.

- Hover: restrained -1px emphasis.
- Active: 2px X/Y press.
- Active: hard shadow removed.
- Focus: existing strong focus treatment.
- Disabled/loading: interaction is suppressed.
- No scale-down, glow, blur or spring behavior.

The link form of Button uses the same transform-based interaction without relying on generic anchor hover behavior.

### Card / lift

Cards use `motion-lift`.

- Default: static.
- Hover: 4px upward transform.
- Hard shadow remains.
- Border remains strong.
- No layout-affecting position changes.

### Links

Interactive navigation/footer links use `motion-link`.

- Hover: Bauhaus yellow background plus foreground color.
- Active: restrained 1px vertical movement.
- Focus-visible: existing global focus treatment.
- The pattern does not rely on color alone.

### Icons

Interactive icon controls use `motion-icon`.

- Hover: restrained 1.04 scale.
- Active: 2px mechanical press.
- Focus-visible remains available.
- Lucide icons and existing stroke weights are preserved.

Decorative icons/geometric shapes remain static.

### Accordion

Accordion buttons use the shared link interaction treatment. The chevron rotates 180 degrees using the standard 300ms ease-out timing.

Accordion semantics remain unchanged:

- native button
- `aria-expanded`
- `aria-controls`
- labelled region
- keyboard operation
- disabled state

Content is intentionally revealed/hidden by the accordion state; no spring or JavaScript animation was introduced.

### Mobile navigation

The mobile navigation remains a functional mechanical panel.

- Trigger uses shared press interaction.
- Close button uses shared press interaction.
- Navigation items use shared link interaction.
- Existing focus management, Escape handling and body scroll lock are preserved.
- No blur, glass panel, cinematic slide or decorative animation was introduced.

### Forms

Input, textarea, select, checkbox and radio controls use the shared 200ms interaction timing.

States include:

- default
- hover where useful
- focus-visible
- filled/checked native state
- invalid
- disabled

Validation is never communicated by animation alone.

## Focus

The global focus treatment remains the source of truth:

- strong yellow outline
- black contrast ring
- 2px offset
- keyboard-visible behavior

No focus indicator was removed without an accessible replacement.

## Reduced motion

`prefers-reduced-motion: reduce` remains mandatory.

Reduced motion:

- removes unnecessary transforms
- minimizes transition duration
- disables the existing marquee animation
- prevents decorative interaction movement
- preserves functional state changes

No state depends on motion for comprehension.

## Performance

The system uses CSS transitions and transforms only.

No animation library, requestAnimationFrame loop, scroll listener, layout measurement or animation state machine was introduced.

Normal hover/press interactions use transforms rather than layout-affecting properties, preventing surrounding content from moving.

Accordion expansion is the intentional exception because revealing accordion content is itself a layout change.

## Responsive interaction

The system remains usable at:

- 320px
- 375px
- 390px
- 430px
- 640px
- 768px
- 820px
- 1024px
- 1280px
- 1440px
- 1920px

Touch targets remain at the established 44–48px minimums.

Hover is never the only way to access important functionality.

## Showcase

The existing development-only component showcase remains the verification surface. Phase 1.11 extends it with:

- button press
- card lift
- link interaction
- icon interaction
- accordion chevron
- form interaction states
- focus verification
- mobile navigation
- reduced-motion verification guidance

No production business functionality was added.

## Validation

Source-level validation covers:

- centralized 200ms / 300ms motion tokens
- single ease-out interaction curve
- centralized transform distances
- shared button press
- shared card lift
- shared link interaction
- shared icon interaction
- accordion chevron timing
- mobile navigation interaction
- form transitions
- focus-visible treatment
- reduced-motion transforms
- no new animation library
- no gradients
- no glassmorphism
- no soft shadows
- no continuous decorative animation introduced
- no business logic
- CSS-driven animation
- no layout-shifting normal hover/press effects

Runtime lint/typecheck/tests/build and browser/manual interaction validation remain blocked by the existing dependency/network limitation. Those are recorded as unexecuted rather than treated as passing.
