# Phase 1.7 — Global Layout Architecture

## Layout primitives
- Container: standard `max-w-7xl`, plus narrow, wide and full variants.
- Section: semantic full-width boundary with responsive spacing, optional background, structural divider, decoration and constrained content.
- Grid: lightweight responsive CSS Grid with independently selectable tablet/desktop columns.
- Split: two-sided content/media structure.
- Stack: vertical flow.
- Cluster: wrapping horizontal grouping.

## Container rules
Use Container for constrained content. Standard site width is `max-w-7xl`. Narrow is for reading measure; wide is reserved for justified large compositions; full is intentionally full-bleed.

## Section rules
A section owns its full-width background, divider and vertical rhythm. Constrained content is nested in Container. Major dividers use the existing 2px mobile / 4px desktop tokens.

## Grid and asymmetry
Grid is mobile-first and supports independent tablet/desktop columns. Split preserves document order by default. Intentional asymmetry should not compromise reading order.

## Responsive strategy
- mobile: below 640px
- tablet: 640–1024px
- desktop: above 1024px

Responsive CSS is used instead of viewport JavaScript.

## Overflow
The document prevents accidental horizontal overflow. Decorative overflow is permitted only inside an explicitly controlled composition boundary.

## Accessibility
Primitives remain server-compatible. Semantic elements are available through component props. Visual order is not used to replace logical reading order. Decorative geometry remains separate from content semantics.

## Performance
Layout uses CSS Grid/Flexbox and design tokens. No runtime measurements, resize listeners, or unnecessary client components are introduced.

## Showcase
The development showcase demonstrates Container, Section, full-width/constrained sections, Grid, Split, Stack, Cluster, asymmetric composition, color-block structure, and responsive behavior with placeholder content only.
