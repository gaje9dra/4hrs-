# Phase 1.5 — Core Bauhaus UI Components

## Component inventory

| Component | Location | Variants / purpose |
| --- | --- | --- |
| Button | `components/ui/button.tsx` | primary, secondary, yellow, outline, ghost, loading, link composition |
| Card | `components/ui/card.tsx` | Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter |
| Input | `components/ui/input.tsx` | Native text input styling with invalid/disabled states |
| Textarea | `components/ui/textarea.tsx` | Native multiline input styling with invalid/disabled states |
| Select | `components/ui/select.tsx` | Native select with Lucide chevron |
| Checkbox | `components/ui/checkbox.tsx` | Native checkbox behavior with Bauhaus styling |
| Radio | `components/ui/radio.tsx` | Native radio behavior with circular semantic geometry |
| Label | `components/ui/label.tsx` | Accessible native label styling |
| FormField | `components/ui/form-field.tsx` | Label, helper/error messaging and field grouping |
| Badge | `components/ui/badge.tsx` | neutral, red, blue, yellow, outline |
| Divider | `components/ui/divider.tsx` | Responsive structural rule |
| SectionHeading | `components/ui/section-heading.tsx` | eyebrow, title, description, alignment |
| Section | `components/ui/section.tsx` | Responsive container and vertical rhythm |
| IconButton | `components/ui/icon-button.tsx` | Accessible icon-only control |
| Accordion | `components/ui/accordion.tsx` | Keyboard-accessible disclosure with mechanical chevron |
| Alert / Status | `components/ui/alert.tsx` | information, success, warning, error |
| GeometricDecoration | `components/bauhaus/geometric-decoration.tsx` | circle, square, triangle, diamond, line |

## Conventions

- Components are presentation-only and contain no product, checkout, database, payment, shipping or provider logic.
- Existing design tokens in `lib/tokens` and CSS variables in `app/globals.css` remain the source of truth.
- Tailwind utility classes reference the established semantic palette and hard-shadow tokens.
- Square geometry is the default. Circular geometry is reserved for semantically appropriate controls/decorations.
- Lucide is the existing icon system; meaningful icon-only controls require an accessible name.
- Native HTML semantics are preferred over unnecessary ARIA.

## Accessibility

- Buttons and native form controls use semantic HTML and keyboard behavior.
- IconButton requires an explicit accessible `label`.
- Accordion exposes `aria-expanded`, `aria-controls`, and a labelled region.
- FormField associates its label through `htmlFor` and exposes helper/error messaging.
- Error states use `aria-invalid` and alert messaging where supplied.
- Global focus styling remains in `app/globals.css`.
- Reduced-motion handling remains centralized in `app/globals.css`.

## Showcase

`app/dev/components/page.tsx` is development-only and is not available when `NODE_ENV` is not `development`. It demonstrates every Phase 1.5 primitive without implementing storefront functionality.

## Validation

Runtime lint/typecheck/build execution remains environment-dependent. The repository does not contain a lockfile and the available execution environment previously could not install dependencies because GitHub DNS/network resolution was unavailable. Source-level inspection should therefore be paired with local `npm install`, `npm run lint`, `npm run typecheck`, and `npm run build` when dependencies are available.

## Known limitations

- The primitive layer intentionally does not include business-specific product cards, cart, checkout, authentication, admin UI, payment UI or provider integrations.
- Loading is represented by a compact text state rather than a separate spinner dependency.
