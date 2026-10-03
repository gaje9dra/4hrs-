# Phase 15.15 — API Governance, Contract Hardening & Integration Safety

## Executive summary
Phase 15.15 hardens the existing API boundary without redesigning completed domains. Existing authentication, customer ownership, Phase 14 RBAC, payment idempotency, webhook verification, privacy controls, observability, and provider adapters remain canonical.

The route rule is: authenticate, authorize, validate, call the canonical application/domain service, map to a safe API contract, and return a traceable response.

## Existing API architecture audit
The repository contains public storefront, authenticated customer, admin, internal/provider, webhook, analytics, content, search/discovery, privacy, and operational routes.

Existing strengths include server-side session identity, customer ownership checks, centralized admin RBAC, domain-owned payment/fulfillment/shipping idempotency, provider webhook verification, request IDs, and telemetry redaction.

Governance findings addressed:
1. response/error helpers were inconsistent across route families;
2. request IDs were not consistently emitted;
3. pagination rules were implemented locally without one shared governance contract;
4. idempotency existed in high-risk domains but was not documented repository-wide;
5. route audience classification was implicit;
6. some public APIs used raw Response/NextResponse rather than the shared governance boundary.

## API classification
PUBLIC_STOREFRONT: unauthenticated browser consumer; public caching only for publishable data.
AUTHENTICATED_CUSTOMER: customer session; private/no-store.
ADMIN: customer session plus Phase 14 RBAC; private/no-store.
INTERNAL: server-only; no-store.
PROVIDER: provider adapter boundary; no-store.
WEBHOOK: provider-authenticated inbound event; no-store.
BACKGROUND_JOB: authenticated internal job entrypoint; no-store.

A route existing under app/api does not make it public.

## Canonical contract standards
Success envelopes remain domain-owned where already established. Errors must expose a stable machine-readable code, safe message, request ID, retryability, and optional safe field details.

Public errors must not expose stacks, SQL/Prisma details, provider credentials, tokens, filesystem paths, database URLs, or sensitive customer data.

## Authentication and authorization
Customer identity is derived from the server-side session. Customer IDs supplied by clients cannot override authenticated identity. Admin authorization remains centralized in Phase 14 RBAC. This phase does not introduce a second authorization system.

## Validation
JSON bodies, query parameters, path parameters, and security-relevant headers must be explicitly validated. Mutation fields use allowlists. Database models are not public response DTOs by default.

## Idempotency
Idempotency belongs to the domain owning the side effect. Existing payment, fulfillment, and shipping mechanisms remain authoritative. The shared governance helper validates Idempotency-Key syntax without creating a competing database.

High-risk mutations include payments, refunds, orders, fulfillment, shipment creation, cancellation, returns, notifications, privacy operations, provider calls, and webhook processing.

## Pagination, filtering, sorting
Collection APIs must reject unknown parameters, bound page sizes, use explicit filter/sort allowlists, and preserve stable ordering. Phase 15.12 search/discovery semantics remain unchanged.

## Versioning and compatibility
No artificial version prefix is introduced without a demonstrated external compatibility requirement. Additive optional changes are compatible. Changes to field meaning, enums, required fields, auth, pagination, money, timestamps, locale, or currency require an explicit migration decision.

## Rate limiting
Limits remain risk-specific. Existing authentication, admin, privacy, and analytics limits are retained. The known limitation is that current in-memory limiters are process-local; distributed limiting is deferred until shared atomic infrastructure exists.

## Webhooks and providers
Webhook handlers must verify the sender, bound payload size, validate the normalized event, prevent replay/duplicate side effects, and call canonical application services. Qikink remains fulfillment-only behind provider adapters. Provider errors never become public 4HRS+ contracts.

## Privacy, caching, analytics, flags, search, content
Private customer/admin/payment/order/address/privacy responses are no-store. Public content is served only when publication rules permit it. Analytics remains consent-aware and is not business truth. Feature flags remain server-authoritative. Search uses bounded explicit parameters. Content APIs cannot leak drafts.

## Background jobs
Operational jobs and reconciliation routes must not be callable by ordinary customers. Payloads must be validated and retries must be idempotent.

## Observability
The shared governance response emits x-request-id. Existing error classification and sensitive telemetry redaction remain authoritative.

## Testing
Phase-specific tests cover API classification, request IDs, safe errors, pagination bounds/allowlists, idempotency-key syntax, and private cache semantics. Existing domain tests remain authoritative for authentication, RBAC, payments, webhooks, privacy, search, content, and fulfillment.

## Database and migration notes
No new database migration is required. Existing domain-owned idempotency and webhook state remain authoritative.

## Known limitations
- In-memory rate limiting is process-local.
- Legacy routes are not mechanically rewritten when their domain-specific response/error semantics are already correct.
- No speculative OpenAPI generator or distributed idempotency coordinator is introduced.
- A future centralized middleware layer requires separate compatibility validation.

## Deferred work
- Distributed rate limiting after shared atomic infrastructure selection.
- Formal OpenAPI publication when an externally supported API consumer boundary exists.
- Further migration of legacy routes to the shared response helper where safe.
- Additional provider-specific webhook contracts when new adapters are introduced.

## Production readiness decision
Readiness requires the final commit to pass lint, typecheck, tests, build, relevant integration/security/contract tests, and repository recovery validation. This document describes implemented behavior and explicit limitations rather than aspirational controls.
