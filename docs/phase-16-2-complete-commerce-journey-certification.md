# Phase 16.2 — Complete Commerce Journey Certification

## Purpose

Phase 16.2 certifies the existing production commerce journey rather than introducing new commerce features. The certification covers discovery through post-order operations, failure modes, concurrency, security, state machines, cross-domain consistency, observability, and reconciliation.

## Certification rule

A scenario is not treated as certified merely because a happy path exists. Evidence must come from executable tests or repository architecture evidence. Real payment transactions and real Qikink fulfillment orders are prohibited for certification.

## Evidence harness

- Audit: `scripts/phase-16-2-commerce-journey-certification.ts`
- Certification test: `tests/phase-16-2-commerce-journey-certification.test.ts`
- CI entry point: `npm run production-certification:phase-16-2`
- Existing unit/integration/API/domain tests remain authoritative; the Phase 16.2 harness does not replace them.
- The harness audits the required commerce artifacts, maps the 25 certification areas to existing test evidence, and verifies provider/payment/security boundaries.
- Existing tests are reused rather than duplicated where possible.

## Scope matrix

1. Discovery/category/search
2. Product/variant
3. Cart
4. Checkout
5. Payment boundary
6. Order creation
7. Order visibility/ownership
8. Fulfillment handoff
9. Fulfillment state
10. Shipping handoff
11. Tracking
12. Notifications
13. Cancellation
14. Returns
15. Customer cases
16. Failure-mode matrix
17. Concurrency
18. Refresh/retry/browser recovery
19. Security journey
20. State machines
21. Cross-domain consistency
22. Customer error experience
23. Admin operational visibility
24. Observability
25. Reconciliation

## Architectural invariants

- 4HRS+ remains the authoritative storefront/catalog.
- Qikink remains fulfillment-only.
- Browser-facing code must not communicate directly with Qikink.
- Qikink credentials remain server-side.
- Store SKU and provider SKU remain separate.
- Financial values remain server-authoritative.
- Duplicate order and fulfillment side effects must be prevented.
- Unsupported shipping capabilities must remain explicit rather than fabricated.
- Customer ownership and admin authorization remain server-enforced.
- Existing governance and reconciliation systems remain authoritative.

## Known boundary

The existing return architecture intentionally stops at its refund integration boundary. Phase 16.2 must certify that boundary safely; it must not introduce uncontrolled refund execution merely to satisfy a certification scenario.

## CI

The phase uses the repository's full CI suite:

- `npm run lint`
- `npm run typecheck`
- `npm test`
- `npm run build`
- existing architecture/recovery/reconciliation/governance validators
- Phase 16.1 certification audit
- Phase 16.2 certification audit

## Final decision

The final status is determined only after the complete CI suite and Phase 16.2 evidence harness run on the PR and after the merged main commit receives green CI.

Possible statuses:

- **CERTIFIED_BASELINE** — no critical/high gaps and the evidence harness passes.
- **CERTIFICATION_REVIEW_REQUIRED** — only medium findings remain; final production readiness still requires explicit review of those findings.
- **NOT_READY** — one or more high findings remain.
- **BLOCKED** — one or more critical findings remain.

Phase 16.3 must not be implemented by this phase.
