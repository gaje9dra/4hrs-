# Phase 16.3 — Payment and Financial Safety Certification

## Decision

Phase 16.3 is a **certification/hardening phase only**. The implementation preserves the existing provider-neutral payment architecture and does not add a second payment engine, order-finalization engine, or reconciliation system.

The current repository contains a production-oriented payment domain with server-authoritative amounts, customer-scoped reads, persisted idempotency, provider-event uniqueness, explicit state transitions, refund limits, reconciliation, and admin authorization.

## Material certification boundary

The current payment provider registry intentionally contains no external adapter:

- `lib/payments/registry.ts`
- `providerAdapters` is currently an empty array.

Therefore the repository cannot honestly certify provider-facing sandbox behavior for:

- provider verification/status lookup,
- cryptographic webhook verification against a concrete provider,
- provider amount/currency confirmation,
- provider refund execution,
- provider timeout/unknown-result integration,
- controlled provider failure injection.

No fake provider success or real-money transaction is introduced to make these checks pass.

**Certification result: NOT READY until a concrete controlled/sandbox provider adapter is available.**

## Hardening performed

### 1. Normalized financial event integrity

`NormalizedPaymentEvent` now carries the provider-observed amount and currency.

The canonical payment application validates:

- event timestamp,
- event amount syntax,
- event currency,
- event amount against the authoritative `Payment.amount`,
- event currency against the authoritative `Payment.currency`.

A mismatched event is rejected without changing financial state.

### 2. Webhook replay/concurrency hardening

Payment-event processing retains the existing unique provider-event identity and serializable transaction boundary.

Concurrent settlement conflicts (`P2034`) are treated as concurrency conflicts and re-read for an already-processed event rather than blindly marking a successfully settled event as failed.

This prevents a duplicate callback race from overwriting a processed event's audit state.

### 3. Existing database controls retained

The certification relies on existing constraints rather than introducing duplicate models:

- unique `Payment.internalReference`
- unique `Order.paymentId`
- unique `PaymentEvent(providerId, providerEventId)`
- unique `PaymentIdempotency(customerId, operation, key)`
- unique `PaymentRefund.idempotencyKey`
- unique `PaymentAttempt(paymentId, attemptNumber)`

## Evidence matrix

The executable audit `scripts/phase-16-3-payment-financial-safety-certification.ts` evaluates all 30 required Phase 16.3 areas:

1. architecture
2. financial data model
3. authoritative amount
4. currency
5. initialization
6. idempotency
7. webhook verification boundary
8. state machine
9. failure handling
10. unknown state
11. duplicate protection
12. payment/order consistency
13. order finalization
14. provider security
15. customer authorization
16. admin authorization
17. refund controls
18. refund idempotency
19. reconciliation
20. audit trail
21. concurrency
22. database integrity
23. webhook replay
24. abuse protection
25. observability
26. customer UX
27. failure injection
28. payment tests
29. CI/Prisma validation
30. provider/sandbox certification

## Findings

### HIGH

**No concrete payment provider adapter is registered.**

This is a certification blocker, not a reason to weaken the audit. Provider-facing certification cannot be inferred from provider-neutral interfaces or mocked success.

### MEDIUM / REVIEW

The audit also records the absence of explicit payment-specific rate-limit evidence as a review item. Existing request-size, validation, authentication and idempotency controls remain intact; no aggressive rate limit is invented without the project's established abuse-control architecture.

## Required CI

The existing CI remains authoritative:

- `npm run lint`
- `npm run typecheck`
- `npm test`
- `npm run build`
- `npx prisma validate`
- `npx prisma generate`
- existing recovery, reconciliation, governance and certification validators

The Phase 16.3 audit is added to CI. Tests are not removed or weakened.

## Final gate

Phase 16.3 is **NOT READY FOR PHASE 16.4** while the concrete provider/sandbox boundary is absent.

This document does not authorize implementation of Phase 16.4 or any later phase.
