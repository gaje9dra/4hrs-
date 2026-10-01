# Phase 12.6 — Order Lifecycle & Fulfillment Readiness

## Scope

Phase 12.6 hardens the existing Phase 12.1–12.5 Order system without implementing Fulfillment, Shipping, Tracking, Returns, Refunds, Exchanges, Inventory Reservation, Admin Order Management, or new payment providers.

## Actual lifecycle

The repository currently defines exactly two persisted Order states:

| State | Meaning | Current transition behavior |
|---|---|---|
| `PENDING` | Order exists but has not completed the current Order lifecycle transition | May transition to `CONFIRMED` |
| `CONFIRMED` | Order is confirmed after Payment eligibility is revalidated | No transition is currently supported |

`PENDING` is the creation state established in Phase 12.3. A successful Payment does not imply shipping, delivery, fulfillment, or completion.

There are no persisted fulfillment/shipping states. `CONFIRMED` is therefore terminal **within the currently implemented state machine**: no reverse or arbitrary transition is accepted. Future phases may extend the same centralized transition mechanism with new states when those capabilities actually exist.

## Centralized transition architecture

All Order lifecycle mutation is routed through:

`OrderApplicationService.transitionOrderLifecycle()`
→ `assertOrderTransition()`
→ Payment eligibility validation
→ serializable Order repository transaction
→ conditional `expectedStatus` update
→ lifecycle observability

The domain transition table is centralized in `lib/orders/domain.ts`:

`PENDING -> CONFIRMED`

No UI or public customer endpoint can directly mutate Order status.

The repository transition operation uses an expected-current-state predicate. A stale request that no longer matches the current state affects zero rows and becomes `ORDER_CONCURRENCY_CONFLICT`. This prevents last-writer-wins lifecycle corruption.

## Terminal-state protection

`CONFIRMED -> PENDING` and arbitrary same/other-state replacements are rejected with `ORDER_TERMINAL` or `ORDER_INVALID_TRANSITION` as appropriate.

No cancellation, refund, return, delivery, or shipment state was invented.

## Payment → Order consistency

The established creation chain remains:

`Checkout -> Payment -> verified SUCCEEDED Payment -> Order`

Order creation still requires authenticated customer ownership, successful Payment state, `completedAt`, matching Checkout reference, matching amount/currency, and server-reconstructed Checkout data.

Lifecycle transition adds a second server-side Payment eligibility check inside the transition transaction. A transition cannot confirm an Order against a failed, cancelled, expired, refunded, or otherwise non-`SUCCEEDED` Payment.

No browser success page, client status, provider credential, or forged payment reference can authorize Order lifecycle mutation.

Payment logic remains in the Payment domain/repository; Order only consumes the established Payment eligibility boundary.

## Idempotency and duplicate protection

Exactly-once logical Order creation remains protected by:

- unique Payment → Order relation;
- unique Checkout reference → Order relation;
- serializable creation transaction;
- authorized existing-Order replay;
- serialization-conflict retries;
- unique-conflict reconciliation.

The Order service does not create a second Order or second set of OrderItems when the same verified Payment is retried.

Lifecycle transitions use the expected-state predicate and serializable transaction to reject stale/concurrent writes.

PostgreSQL serializable transactions require applications to handle serialization failures, which the existing creation path already does; the lifecycle path converts a conflicting transition into a deterministic domain error. citeturn0search4turn0search5

## Customer status contract

Customer Order DTOs continue to expose only the stable lifecycle states:

- `PENDING`
- `CONFIRMED`

The DTO now maps the internal Order state through an explicit `customerStatusForOrder()` domain function. Provider statuses, Payment internals, debugging state, and future fulfillment/shipping state are not exposed.

Phase 12.5 UI therefore continues to render only states that actually exist.

## Historical integrity

Order historical data remains authoritative after creation:

- Order Number;
- subtotal/total/currency;
- OrderItem product/variant references;
- product and variant title snapshots;
- SKU snapshot;
- selected-option snapshot;
- quantity;
- unit price;
- line total;
- item currency;
- address snapshot.

Catalog changes, product publication changes, SKU changes, variant changes, price changes, media changes, and category/collection changes do not rewrite Order snapshots.

Product/Variant foreign keys remain supporting references and may be nulled by catalog deletion without destroying historical snapshot data.

Customer Order Detail continues to render snapshot data rather than current catalog state.

## Fulfillment readiness boundary

Phase 12.6 defines, but does not implement, a provider-neutral internal contract in:

`lib/orders/fulfillment-contract.ts`

Conceptual boundary:

`Order`
→ future Fulfillment Application Service
→ future Fulfillment Domain
→ future Fulfillment Provider Adapter
→ Provider

The internal contract provides the minimum stable Order information a future Fulfillment service may consume:

- Order ID;
- Order Number;
- current Order lifecycle status;
- verified Payment state;
- currency;
- product/variant references;
- SKU;
- quantity;
- historical product/variant titles;
- shipping address snapshot.

Fulfillment must not directly mutate historical OrderItem or address snapshot fields.

Provider IDs, shipment IDs, tracking numbers, carrier data, provider credentials, and provider-specific payloads remain outside the Order core.

No Fulfillment service or provider adapter is implemented in this phase.

## Database integrity

Existing database invariants remain authoritative:

- unique Order Number;
- unique Checkout reference;
- unique Payment relation;
- Customer/Payment foreign keys;
- OrderItem and address snapshot ownership;
- historical snapshot persistence;
- customer/createdAt access index;
- status/createdAt lifecycle index.

No unnecessary schema rewrite or lifecycle migration was introduced because the existing two-state representation is sufficient for the currently implemented lifecycle.

## Security

The audit covers:

- customer-scoped Order access;
- no customer ID accepted from the browser as authority;
- forged Payment references rejected by authenticated Payment ownership;
- no direct ORM access from Order UI;
- safe public DTO;
- private/no-store customer Order API behavior;
- stale lifecycle writes rejected;
- concurrent lifecycle writes rejected;
- terminal-state regression rejected;
- raw database/provider errors not exposed;
- observability excludes payment secrets, authentication tokens, and full sensitive address payloads.

There is no customer-facing lifecycle mutation endpoint in Phase 12.6, so customers cannot submit an arbitrary status update.

## Observability

Order lifecycle outcomes emit structured diagnostics containing:

- Order ID;
- Order Number when available;
- previous/current lifecycle state;
- actor classification;
- success/rejection/concurrency result;
- stable failure classification.

Creation observability continues to use operational identifiers and does not log secrets or full address/customer records.

## Customer experience

Phase 12.5 remains authoritative for customer presentation.

The customer sees:

- Order Number;
- creation date;
- purchased snapshot items;
- historical prices;
- total/currency;
- historical address;
- current authoritative Order status.

The UI does not claim:

- shipment tracking;
- carrier;
- tracking number;
- expected delivery;
- fulfillment completion;
- returns/refunds/cancellation.

No misleading timeline or future fulfillment milestone was added.

## Accessibility and design

The Phase 12.5 Bauhaus experience remains unchanged:

- existing Outfit typography;
- black borders;
- hard offset shadows;
- square geometry;
- established buttons/cards/badges;
- responsive layout;
- visible focus;
- status communicated as text, not color alone;
- semantic headings and navigation;
- accessible loading/error/not-found states.

No gradients, glass effects, soft SaaS shadows, or unrelated component system was introduced.

## Tests

Phase 12.6 adds `tests/order-lifecycle.test.ts` covering:

- valid `PENDING -> CONFIRMED`;
- invalid/terminal transition;
- ineligible Payment rejection;
- stale expected-state rejection;
- concurrent transition protection;
- historical Order data preservation.

Existing Phase 12.3/12.4/12.5 tests continue to cover:

- verified Payment → Order creation;
- amount/currency mismatch;
- customer ownership;
- duplicate and concurrent Order creation;
- historical snapshots;
- API IDOR protection;
- DTO minimality;
- customer Order UI.

## Known limitations

The current repository intentionally does not implement:

- additional Order states;
- Fulfillment;
- Shipping;
- Tracking;
- Inventory reservation/deduction;
- Returns;
- Refunds;
- Exchanges;
- Cancellation workflow;
- Admin Order management;
- Provider-specific Order logic.

Those capabilities must be introduced by later phases through explicit domain contracts rather than being implied by the current `CONFIRMED` state.

## Validation

Phase 12.6 must pass the complete CI-equivalent suite:

- `npm test`
- `npm run lint`
- `npm run typecheck`
- `npm run build`

No test is weakened to obtain a green result.
