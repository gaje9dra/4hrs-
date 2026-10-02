# Phase 12.13 — Production Operations Readiness

## Production operating model
4HRS+ remains the commercial source of truth for catalog, inventory, payment, Order, and Fulfillment. Qikink remains fulfillment-only.

## Configuration checklist
- FULFILLMENT_PROVIDER_ID=qikink
- FULFILLMENT_PROVIDER_ENABLED=true
- FULFILLMENT_PROVIDER_MODE=live
- QIKINK_CLIENT_ID configured server-side
- QIKINK_CLIENT_SECRET configured server-side
- credentials are not stored in source control
- no Qikink secret is exposed through NEXT_PUBLIC_*
- test and production credentials are separated
- previously exposed credentials are rotated before production use

## Database checklist
- Apply all Prisma migrations before deployment.
- Verify foreign keys, unique constraints, indexes, and historical-record preservation.
- Verify variant/provider and provider/provider-SKU uniqueness.
- Verify Order -> Fulfillment is one-to-one.
- Verify Fulfillment -> FulfillmentItem references remain intact.
- Run Prisma validate, generate, and migrate deploy.

## Catalog and mapping checklist
- Every published ProductVariant has an active Qikink mapping.
- Store SKU and provider SKU remain separate.
- Provider SKU uniqueness is enforced.
- Mapping changes use the protected admin API.
- Mapping changes are recorded in CatalogAuditEvent.
- Mapping changes do not rewrite historical OrderItem snapshots.
- Mapping changes do not rewrite existing FulfillmentItem provider SKUs.

Provider mapping is resolved when Fulfillment is created. The resolved provider SKU is persisted on FulfillmentItem.

## Order and payment checklist
- Order creation accepts only verified payment state.
- Payment remains authoritative for Order creation.
- Order creation is idempotent.
- A provider failure does not roll back a paid Order.
- OrderAddressSnapshot remains the fulfillment shipping source.

## Fulfillment failure policy
| Failure | Internal handling | Automatic retry |
| --- | --- | --- |
| Provider validation / invalid SKU | FAILED | No |
| Authentication / authorization | FAILED | No |
| Provider rejection | FAILED | No |
| Rate limit | FAILED with retryable metadata | Bounded |
| Network error | FAILED; ambiguous outcome is reconciled | No when ambiguous |
| Timeout | FAILED; reconciliation required | No |
| Provider accepted but local persistence failed | Reconciliation required | No |
| Duplicate fulfillment creation | Existing/idempotency record or conflict | No duplicate |
| Concurrent creation | Serializable transaction + bounded conflict retry | Bounded |
| Completed Fulfillment | Terminal | Never reopen |

Retryable provider failures are bounded to three attempts. Ambiguous submissions must be reconciled before another provider submission.

## Reconciliation boundary
The Fulfillment application only performs provider status reconciliation when the selected adapter explicitly supports statusLookup.

The current Qikink adapter does not advertise status lookup. Therefore ambiguous submissions are persisted as reconciliation-required, automatic resubmission is blocked, and an administrator must inspect the provider-side order/reference before corrective action.

## Admin diagnostics
Protected endpoint: GET /api/admin/fulfillments/:fulfillmentId

It exposes only operational fields needed for debugging: Fulfillment ID, Order ID, provider, provider reference, lifecycle state, idempotency key, timestamps, failure code/message, reconciliation state, attempt count, and FulfillmentItem/provider-SKU snapshots.

It does not return passwords, payment credentials, provider access tokens, authorization headers, or raw provider payloads.

POST /api/admin/fulfillments/:fulfillmentId invokes canonical reconciliation and never bypasses the Fulfillment state machine.

## Webhook boundary
No Qikink webhook endpoint is introduced because the current verified provider contract used by this adapter does not establish a supported webhook interface.

If a verified webhook contract is introduced later, it must validate requests, verify signatures where supported, deduplicate event IDs, use the canonical Fulfillment domain, protect terminal states, and avoid secret/sensitive-payload logging.

## Security checklist
- Admin APIs require authenticated admin authorization.
- Mutating admin APIs require same-origin requests.
- Customer APIs cannot access another customer's Order.
- Customers cannot mutate provider mappings.
- Fulfillment operations are not customer-authorized endpoints.
- Qikink credentials remain server-only.
- Raw authorization headers are never logged.
- Internal errors are converted to safe customer-facing errors.

## Observability
Fulfillment logging uses structured fields for operation, Fulfillment ID, Order ID, provider, state transition, result, failure code, and duration. Operational debugging uses Order ID and Fulfillment ID as correlation identifiers.

## Validation commands
- npm run lint
- npm run typecheck
- npm test
- npm run build
- npx prisma validate
- npx prisma generate
- npx prisma migrate deploy
- GitHub Actions CI

CI must be green before production readiness is declared.

## Smoke test
Use a safe test/sandbox environment where the provider contract permits it: prepare Product, ProductVariant, Store SKU, Qikink mapping, publish, cart, checkout, verified payment, Order, Fulfillment, mapping resolution, adapter submission, provider response, and canonical Fulfillment verification.

Do not use production credentials for a test transaction unless the provider architecture explicitly requires it and the transaction is safe.

## Final release gate
Production readiness requires no failing CI checks, successful migrations, no exposed credentials, safe provider mapping, deterministic fulfillment idempotency, bounded retries, explicit reconciliation for ambiguous submissions, historical Order/Fulfillment preservation, no Qikink catalog ownership, and passing required automated tests.

This phase does not implement Phase 13 shipping, customer tracking, returns, exchanges, or a second fulfillment provider.