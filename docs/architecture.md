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
  layout/          global shell/navigation
  geometry/        existing geometric primitives
  bauhaus/         future Bauhaus-specific compositions
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
app/admin is reserved for future administrative routes. It is separate from the customer storefront and must not become a second copy of storefront business logic.

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
components/ui remains the generic reusable UI layer. components/layout owns the global shell. components/bauhaus is the dedicated home for the project's distinctive visual-language components. The complete Bauhaus library is deferred to Phase 1.5.

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
