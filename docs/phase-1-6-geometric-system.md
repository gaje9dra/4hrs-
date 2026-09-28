# Phase 1.6 — Geometric Decoration System

## Primitives
- GeometricShape
- GeometricCircle
- GeometricSquare
- GeometricTriangle
- GeometricBar

Colors are the existing Bauhaus red, blue, yellow, black, and white tokens. Rotations are limited to 0, 45, 90, -45, and -90 degrees.

## Composition
GeometricComposition provides an isolated positioning context. GeometricLayer provides only back/base/front layers using z-0/z-10/z-20. Composition overflow is explicit.

## Corner decoration
CornerDecoration supports all four corners. Its default cluster is generic, decorative, and pointer-transparent.

## Presets
CornerAccent, HeroComposition, EditorialComposition, and SectionAccent contain only reusable geometry.

## Responsive and performance
No breakpoint-specific duplicate components are created. Consumers use existing responsive utilities. Corner decorations hide below sm to avoid narrow-screen collisions. Shapes are CSS geometry with no image assets, animation loops, or JavaScript-driven decoration.

## Accessibility
Geometry is decorative by default with aria-hidden and pointer-events-none. It never substitutes for textual information. Semantic page content remains in normal document flow.

## Visual constraints
No gradients, blur, glassmorphism, random blobs, arbitrary colors, soft floating shadows, or continuous animation are introduced.
