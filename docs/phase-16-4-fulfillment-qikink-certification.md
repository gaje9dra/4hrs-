# Phase 16.4 — Fulfillment / Qikink Certification

## 1. Objective
Certify the production fulfillment path from a paid 4HRS+ order through the provider-neutral fulfillment service and Qikink adapter without introducing a second fulfillment engine.

## 2. Scope
The certification covers eligibility, mapping, idempotency, concurrency, state transitions, provider failures, retries, unknown provider outcomes, Qikink secret isolation, data minimization, shipping boundaries, reconciliation, admin/RBAC boundaries, observability, database integrity, API isolation, and deterministic provider tests.

## 3. Architecture reviewed
Canonical path:

**Order → fulfillment eligibility → Fulfillment record → ProductVariant → 4HRS+ Store SKU / Provider Mapping → provider-neutral FulfillmentProviderAdapter → Qikink adapter → Qikink API → normalized provider result → Fulfillment state.**

The existing `lib/fulfillment/application.ts` remains the orchestration authority. `lib/fulfillment/provider.ts` remains the provider contract. `lib/fulfillment/resolver.ts` remains the provider boundary.

No second fulfillment engine or provider abstraction was introduced.

## 4. Canonical fulfillment flow
`createFulfillment` validates a durable idempotency key, prevents an existing order from receiving a second fulfillment, resolves the configured provider, verifies order/payment eligibility inside a serializable transaction, and persists the canonical fulfillment and line mappings.

`submitFulfillment` reconstructs the provider request from authoritative order data, not client-provided SKU/quantity/provider fields.

## 5. Qikink boundary
Qikink remains fulfillment-only. The adapter is under `lib/fulfillment/providers/qikink.ts`, credentials are loaded by `lib/fulfillment/providers/qikink-auth.ts`, and the domain uses the provider-neutral interface.

No customer-facing catalog path uses Qikink as its catalog source.

## 6. Catalog ownership model
4HRS+ owns Product, ProductVariant, Store SKU, pricing, availability and provider mapping.

`FulfillmentProviderMapping` is explicit and unique by `(variantId, providerId)` and `(providerId, providerSku)`. Missing or inactive mappings fail closed.

## 7. Idempotency certification
Creation uses:
- unique `Fulfillment.orderId`
- unique `Fulfillment.idempotencyKey`
- serializable creation transaction
- operation-level `FulfillmentOperationIdempotency`
- durable ambiguous-operation state

Repeated operations with an existing successful/failed key return the existing local result; ambiguous provider operations require reconciliation.

## 8. Provider failure certification
The Qikink adapter explicitly classifies timeout, network, authentication, authorization, rate-limit, validation, not-found, rejected, malformed-response and unknown failures.

Malformed or incomplete successful-looking responses do not become local provider success because a provider fulfillment reference is required.

## 9. Unknown-result certification
A timeout/network failure after a provider request is classified as ambiguous. It is persisted as reconciliation-required and is not automatically retried.

This is deliberate: the system must never create a second provider order merely because the first response was lost.

## 10. Retry certification
Retryable provider errors are bounded by the existing application policy. Ambiguous outcomes are not automatically retried. Operation idempotency prevents repeated operational requests from becoming uncontrolled provider submissions.

## 11. State-machine certification
Canonical states are `PENDING`, `SUBMITTED`, `FAILED`, and `COMPLETED`.

Legal transitions remain:
- PENDING → SUBMITTED / FAILED
- SUBMITTED → COMPLETED / FAILED
- FAILED → SUBMITTED
- COMPLETED → terminal

State transitions use compare-and-set semantics and serializable transactions.

## 12. Concurrency certification
Creation and state mutation use serializable database transactions. Repository transitions include the expected current state in the update condition.

## 13. Admin/RBAC certification
Existing administrative fulfillment operations remain behind the established server-side authorization boundary. No admin UI is permitted to call Qikink directly.

## 14. Security certification
The certification audit checks that Qikink credentials do not appear in browser/public source, that Qikink endpoints are trusted rather than client-controlled, and that provider responses are normalized before entering domain state.

## 15. Secret handling certification
Credentials are loaded only from server-side environment configuration. Provider responses and normalized fulfillment results do not contain credentials.

## 16. Privacy/data-minimization certification
The adapter sends only fulfillment-required order/shipping information. Payment secrets, internal audit information and provider credentials are not part of the provider request contract.

## 17. Shipping boundary certification
Qikink's current shipping adapter explicitly declares:
- `createShipment: false`
- `trackingLookup: false`
- `webhooks: false`

Therefore this phase does **not** fabricate shipment IDs, AWBs, tracking numbers, carrier state or delivery dates.

## 18. Callback/webhook certification
No verified Qikink callback/webhook contract is assumed or invented. The absence of a verified callback contract is documented as an operational limitation.

## 19. Reconciliation certification
The canonical reconciliation service refuses to invent provider status when Qikink does not expose a verified status lookup capability. Ambiguous provider outcomes are quarantined for controlled reconciliation/manual intervention rather than blindly retried.

## 20. Observability certification
Fulfillment and provider operations emit structured observations and metrics with fulfillment/order/provider correlation. Provider credentials are not logged.

## 21. Failure-injection results
The Phase 16.4 test suite covers:
- provider success
- malformed provider response
- timeout
- unsupported status lookup
- unpaid/non-confirmed order
- illegal/terminal state transition
- credential isolation at the normalized boundary

The full existing test suite remains mandatory.

## 22. Test results
The dedicated certification test is `tests/phase-16-4-fulfillment-qikink-certification.test.ts`.

The repository's complete `npm test` suite remains the final regression gate.

## 23. CI results
The Phase 16.4 audit is added to the existing CI test job. The existing lint, typecheck, test, build, Prisma, recovery and prior-phase governance validators remain unchanged.

## 24. Blockers
The verified Qikink integration does **not** expose a certified machine-to-machine status lookup or webhook contract in the current application contract. This is intentionally treated as an operational limitation, not papered over with invented endpoints.

Unknown provider results are therefore quarantined and require controlled reconciliation/manual provider-side investigation.

The current shipping boundary is also explicitly unsupported for machine-to-machine shipment/tracking creation and lookup.

## 25. Required remediation
No undocumented Qikink API is to be invented.

If Qikink later provides a verified status, webhook, or shipping contract, it must be added through the existing provider-neutral interfaces and separately certified.

## 26. Final certification decision
The executable audit determines the final status. A PASS requires all safety-critical checks and the complete CI suite to pass. An unresolved critical/high safety defect prevents readiness.

**Hard stop: do not implement Phase 16.5 in this phase.**


## CI remediation

The certification harness uses runtime-only evidence scans and preserves provider-neutral fulfillment boundaries; CI blocker fixes are part of this phase's final validation.
