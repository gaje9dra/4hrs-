# Phase 17.3 — Refer & Earn

## Status

**INCOMPLETE — DO NOT MERGE OR DESCRIBE AS PRODUCTION-READY YET.**

This increment now includes referral attribution at registration, customer tracking UI, admin referral reporting, and reward processing hooks. The critical remaining external dependency is real trusted delivery status: the existing Qikink adapter explicitly declares tracking lookup and webhooks unavailable. The reward processor only reacts to a persisted shipment in `DELIVERED` state and verified successful payment; it does not fabricate a delivery event.

## Implemented in this increment

- Referral profile codes and first-touch referral attribution through a secure HTTP-only referral cookie.
- New-account registration creates the referred relationship and one single-use 14% coupon for each recipient in the same registration transaction.
- Referral coupon ownership is enforced by the existing coupon reservation service.
- Customer Refer & Earn page displays link, referral statuses, progress counts, and own referral coupons, without exposing invitee emails or order identifiers.
- Admin Refer & Earn page and API allow permission-gated search/filter/reporting of referral, payment, delivery, and coupon state.
- When a successful verified payment creates an eligible referred order, the referral is moved to awaiting delivery and bound to that order.
- Persisted trusted shipment delivery state is checked against the current verified payment state before a transaction issues the 25% coupon pair idempotently.
- Dedicated referral permissions are granted to SUPER_ADMIN by a forward-only migration.

## Business rules

- New registrations only can be attributed. Existing customer login does not issue referral rewards.
- Visiting a referral URL is not sufficient to issue coupons.
- Both referrer and invitee receive one 14% coupon after a valid new registration.
- Both receive one 25% coupon only after the qualifying order's payment is verified as SUCCEEDED and the persisted shipment state is DELIVERED.
- Coupons are assigned to recipient accounts and each is limited to one redemption.
- Coupon expiry defaults to 365 days and can be configured using `REFERRAL_COUPON_TTL_DAYS` (bounded to 1–3650; invalid values fall back to 365).
- A unique referral relationship per invited account and unique reward constraints prevent duplicate attribution/reward issuance.

## Delivery and financial lifecycle blockers

The Qikink adapter currently has `createShipment: false`, `trackingLookup: false`, and `webhooks: false`. Therefore it cannot reliably emit machine-to-machine delivery state in this repository today. The 25% reward path is safely gated but will not run for Qikink orders unless a trusted existing or future shipment integration records a real `DELIVERED` state. Do not manually create fake provider tracking events.

Cancellation, refund, chargeback, reservation-expiry/recovery and post-reward refund handling still require dedicated lifecycle policy and tests. If payment is no longer SUCCEEDED when delivery is processed, no 25% reward is issued. Those exceptional states and recovery behavior must be addressed before calling the whole phase production-ready.

## Delivery contract investigation (2026-10-11)

Reviewed Qikink's official public documentation:

- The [Qikink API documentation](https://admins.qikink.com/api-docs) documents creating an order with `POST /erp2/index.php/api/createOrder` and returns an order identifier. The documented operation does not define an authenticated tracking-status lookup endpoint, a delivery webhook, a webhook signature scheme, or a polling contract.
- Qikink's [tracking guide](https://qikink.com/help/orders/how-to-track-an-order/) describes checking the tracking ID and live shipment information through the merchant dashboard.
- Qikink's [shipment-status guide](https://qikink.com/help/orders/shipping-statuses/) lists statuses such as `Delivered`, but does not document a machine-to-machine event transport or signature contract for this integration.

Therefore these public sources are insufficient to implement a secure Qikink delivery webhook or polling adapter. Do not infer a private endpoint from dashboard behavior. A written, versioned API contract from Qikink (including authentication/signatures, event identifiers, timestamps, status semantics, retry behavior, and order/tracking identifiers) or a separately approved tracking provider is required before delivery-based rewards can be enabled in production.

## Additional safety hardening in this increment

- Reward processing re-reads the order and payment inside the serializable transaction, requires a confirmed order and successful payment, and rejects any payment with a pending, ambiguous, or successful refund record.
- Reward processing now requires a persisted non-manual delivery tracking event whose provider identity matches the shipment provider and whose timestamp is not later than the recorded delivery timestamp. A shipment `DELIVERED` flag by itself is not enough.
- Deterministic tests cover matching provider evidence and reject manual, mismatched-provider, future-dated, or absent events.
- This evidence gate intentionally means current Qikink orders cannot earn 25% delivery rewards: Qikink's adapter declares tracking lookup and webhooks unavailable, and there is no supported trusted event path.
- Referral reward emails use the existing notification event/delivery infrastructure. Registration and delivered-order coupon notifications are enqueued with stable idempotency keys inside the same database transaction as reward creation, so a rolled-back reward cannot send a notification.

## Refund/reversal policy decision (implementation still required)

The qualifying order becomes ineligible for a new 25% reward if any refund is pending, ambiguous, or successful, or if payment is no longer `SUCCEEDED`. This is a conservative issuance gate, not a complete post-issuance reversal workflow. If a refund/cancellation is recorded after reward issuance, the existing coupon audit history must be retained; unused coupons should be deactivated through a dedicated idempotent audited operation, while already redeemed coupons must not be retroactively changed into fake financial reversals. That post-issuance operation and its integration into all refund/cancellation outcomes remain incomplete and block production completion.

## Operational recovery

1. Do not manually set a shipment to `DELIVERED` to trigger a reward.
2. If delivery evidence is missing or provider identity/timestamps do not match, leave the referral awaiting delivery and investigate the provider's official records.
3. Do not retry a reward by editing coupon or referral rows manually. Re-run the supported idempotent reward processor only after verified payment and trusted delivery evidence exist.
4. For any reward already issued before a later refund/reversal, preserve the original referral/coupon rows and use the approved audited correction process once implemented. Until that process exists, escalate for a recorded administrative decision and do not claim automated reversal support.

## Verification requirements

Check the current branch's GitHub Actions results after each complete increment. Required checks include the repository's actual lint, typecheck, test, build, Prisma validation, migration, and recovery checks. The phase stays a draft/unmerged while any required test fails or while the real delivery contract and refund/recovery behavior remain unresolved.
