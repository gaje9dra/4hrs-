# Phase 17.3 — Refer & Earn

## Status

**INCOMPLETE — KEEP PR #278 DRAFT AND UNMERGED.**

The verified-payment 25% reward path and audited post-issuance refund/cancellation transitions are implemented. Concurrent lifecycle synchronization retries PostgreSQL serializable-transaction conflicts up to three attempts. Tests now include transaction rollback under an injected audit-write constraint failure, concurrent refund/cancellation state resolution, and reserved-coupon lifecycle behavior. Final CI verification on the exact current head remains a completion gate.

## Business rules

- A valid referral is attributed only during new account registration; returning customer login does not create a new referral or issue a second registration reward.
- On valid new registration, the referrer and invited customer each receive one account-bound, single-use 14% coupon.
- The invited customer’s first eligible order is bound to the referral during the server-side verified-payment order-creation transaction.
- The referrer and invited customer each receive one account-bound, single-use 25% coupon in that same transaction when the persisted payment is `SUCCEEDED`, has a completion timestamp, and matches the persisted order’s customer, checkout reference, amount, and currency.
- A shipment, tracking event, or delivery status is not required and is not consulted for referral reward eligibility.
- The qualifying order must be in an eligible persisted state (`PENDING` immediately after verified order creation or `CONFIRMED`) and must be the first order bound to the referral.
- Any refund record that is `PENDING`, `AMBIGUOUS`, or `SUCCEEDED` blocks new 25% issuance. A `FAILED` refund does not by itself block issuance. Any cancellation request that is not `REJECTED` or `FAILED` also blocks new issuance.
- Coupons are recipient-bound and limited to one redemption. Expiry defaults to 365 days and can be configured with `REFERRAL_COUPON_TTL_DAYS` (1–3650 days; invalid values fall back to 365).

## Transaction, idempotency, and recovery

- Referral order binding, the pair of 25% coupon records, reward audit rows, notification enqueueing, and the final referral status are written inside the verified order-creation transaction.
- The reward processor re-reads the persisted order/payment/refunds and locks the referral row before deciding eligibility.
- Unique constraints on `Referral.qualifyingOrderId` and `ReferralReward(referralId, recipientCustomerId, type)`, together with serializable transactions, protect against duplicate/concurrent issuance.
- Retrying order creation for an already-persisted order re-runs the idempotent reward processor, providing a recovery path for referrals awaiting the previous delivery-triggered reward.
- If coupon creation or notification enqueueing fails, the transaction rolls back the order/referral reward changes together; retry the verified order-creation flow after the underlying failure is corrected.

## Refund, cancellation, and reversal lifecycle — remaining blocker

The payment model represents refund states `PENDING`, `SUCCEEDED`, `FAILED`, and `AMBIGUOUS`, including partial/full refund outcomes through payment status and refund amounts. At issuance time, pending, ambiguous, or successful refunds block the 25% pair. Failed refunds do not block issuance.

Implemented lifecycle policy: pending, ambiguous, or successful refunds and active cancellation requests deactivate 25% coupons for any new reservations and create idempotent `ReferralRewardLifecycleEvent` audit rows. A previously reserved checkout retains its persisted discount snapshot and may finalize under the original terms; deactivating the coupon does not rewrite that reservation. If a refund fails or a cancellation is rejected, an unexpired coupon can reactivate only when no other disqualifying refund/cancellation remains. A still-active reservation continues to consume coupon capacity, so reactivation cannot exceed the single-redemption limit. Partial and full successful refunds both disqualify rewards. Already `REDEEMED` coupons retain their true history and are audited without attempting to reverse the completed transaction. Repeated events use stable keys and do not duplicate lifecycle transitions. Tests inject an audit-write constraint failure to verify transaction rollback and exercise concurrent refund/cancellation resolution.

The repository still has no verified external chargeback/dispute event source or provider contract that can safely authenticate such events. Do not synthesize chargeback events from browser requests, admin-entered payment statuses, or unverified callbacks. Automated chargeback handling remains an external integration blocker until the payment provider supplies a documented, authenticated event or reconciliation API and that integration is implemented and tested.

## Notifications and interfaces

- Registration and verified-payment reward notifications use the existing notification event infrastructure and stable idempotency keys in the same transaction as coupon issuance.
- Customer dashboard progress is based on referral registration, qualifying order, verified payment, and reward issuance. It does not state that delivery is required.
- Admin referral reporting is read-only and permission-gated; payment and reward status come from persisted records. There is no manual payment-success override.

## Migration and shipping boundaries

- New enum values are introduced with a forward-only migration; existing delivery reward enum values and historical records are retained for compatibility.
- Shipping/tracking validation and the Qikink adapter are unchanged. This phase does not invent Qikink tracking capabilities or modify shipment state.
- Verify migration deployment from a clean PostgreSQL database and run all repository CI, recovery, architecture, security, reconciliation, and production-certification checks on the final head SHA.

## Operational recovery

1. Confirm the provider payment is server-verified and persisted payment/order amount, currency, customer, and checkout reference match.
2. Confirm no refund is pending, ambiguous, or successful.
3. Retry the existing verified order-creation path for the persisted payment. The reward processor is idempotent and rechecks referral and financial records.
4. Retry the refund operation with the same idempotency key to re-run audited referral lifecycle synchronization after a post-persistence processing failure. Review `ReferralRewardLifecycleEvent` before manual intervention.
5. Inspect the referral’s qualifying order, reward rows, coupon ownership/status, lifecycle events, and notification outbox records before any manual intervention.
6. Do not manually create shipment/tracking events or edit payment state to force a referral reward.
