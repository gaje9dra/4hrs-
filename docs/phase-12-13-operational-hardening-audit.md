# Phase 12.13 — Operational Hardening Audit

## Findings

### Catalog and mapping
The canonical 4HRS+ catalog remains authoritative. Provider mapping is separate from Store SKU and is unique per variant/provider and provider/provider-SKU pair.

Mapping changes are now recorded through the existing CatalogAuditEvent infrastructure, including ProductVariant, actor when available, previous mapping state, resulting mapping state, and manual-operation source.

### Mapping timing
The implementation resolves provider mapping at Fulfillment creation and stores the resolved provider SKU on FulfillmentItem.

A mapping change after Order creation affects a later Fulfillment creation only. A mapping change or deletion after Fulfillment creation does not rewrite the existing FulfillmentItem or historical OrderItem snapshots.

### Failure and retry behavior
Provider submission failures are persisted. Retryable failures are bounded to three attempts. Validation, authentication, authorization, and provider rejection failures are not automatically retried.

Timeout and network failures are treated as ambiguous and require reconciliation before another provider submission.

Provider submission occurs outside the database transaction. The provider result is persisted in a separate short transaction protected by expected-state checks and serializable isolation.

### Idempotency
Idempotency is enforced at payment creation, Order identity, Fulfillment idempotency key, one Fulfillment per Order, and provider fulfillment reference uniqueness.

Successful SUBMITTED/COMPLETED Fulfillments are returned without another provider call.

### Reconciliation
The canonical reconciliation service refuses to invent provider state. It requires an adapter with statusLookup enabled and a stored provider reference.

Qikink currently has statusLookup disabled, so ambiguous Qikink submissions are explicitly marked reconciliation-required and must be checked against the Qikink-side order/reference before corrective action.

### Webhooks
No Qikink webhook is implemented because the current verified provider contract used by the adapter does not establish a supported webhook interface. No fake or unverified webhook behavior was added.

### Diagnostics
A protected admin diagnostics endpoint exposes the minimum operational state needed to investigate a Fulfillment without exposing credentials, access tokens, authorization headers, or unnecessary customer data.

### Configuration
Qikink credentials are read only from server-side environment variables. Provider mode, timeout, and enablement are environment-driven. The adapter validates credentials/configuration before provider submission.

Previously exposed credentials are a production security risk and must be rotated before production use. Actual credentials are intentionally not reproduced here.

## Known production boundaries
1. A live Qikink transaction cannot be proven from repository-only validation; it requires a real Qikink account/wallet and safe live credentials.
2. Qikink status lookup is not enabled in the adapter, so automatic reconciliation of an ambiguous Qikink submission is not available.
3. The Qikink sandbox order path remains unsupported by the generic fulfillment contract because the documented sandbox/custom-design flow requires design metadata that the current provider-neutral request does not carry.
4. CI results must be verified on the Phase 12.13 PR before the final readiness decision.

## Required validation
- npm run lint
- npm run typecheck
- npm test
- npm run build
- Prisma validation/generation/migration checks
- relevant catalog, payment, Order, provider mapping, Fulfillment, and diagnostics tests
- GitHub Actions CI

No production-ready verdict should be issued until those checks are verified.