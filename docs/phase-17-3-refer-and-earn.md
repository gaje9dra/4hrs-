# Phase 17.3 — Refer & Earn

## Status

**INCOMPLETE — KEEP PR #278 DRAFT AND UNMERGED.**

The verified-payment 25% reward path is implemented in the verified order-creation transaction. The full post-issuance refund/cancellation lifecycle, broader failure-injection coverage, and final CI verification remain completion gates.

## Business rules

- A valid referral is attributed only during new account registration; returning customer login does not create a new referral or issue a second registration reward.
- On valid new registration, the referrer and invited customer each receive one account-bound, single-use 14% coupon.
- The invited customer’s first eligible order is bound to the referral during the server-side verified-payment order-creation transaction.
- The referrer and invited customer each receive one account-bound, single-use 25% coupon in that same transaction when the persisted payment is `SUCCEEDED`, has a completion timestamp, and matches the persisted order’s customer, checkout reference, amount, and currency.
- A shipment, tracking event, or delivery status is not required and is not consulted for referral reward eligibility.
- The qualifying order must be in an eligible persisted state (`PENDING` immediately after verified order creation or `CONFIRMED`) and must be the first order bound to the referral.
- Any refund record that is `PENDING`, `AMBIGUOUS`, or `SUCCEEDED` blocks new 25% issuance. A `FAILED` refund does not by itself block issuance.
- Coupons are recipient-bound and limited to one redemption. Expiry defaults to 365 days and can be configured with `REFERRAL_COUPON_TTL_DAYS` (1–3650 days; invalid values fall back to 365).

## Transaction, idempotency, and recovery

- Referral order binding, the pair of 25% coupon records, reward audit rows, notification enqueueing, and the final referral status are written inside the verified order-creation transaction.
- The reward processor re-reads the persisted order/payment/refunds and locks the referral row before deciding eligibility.
- Unique constraints on `Referral.qualifyingOrderId` and `ReferralReward(referralId, recipientCustomerId, type)`, together with serializable transactions, protect against duplicate/concurrent issuance.
- Retrying order creation for an already-persisted order re-runs the idempotent reward processor, providing a recovery path for referrals awaiting the previous delivery-triggered reward.
- If coupon creation or notification enqueueing fails, the transaction rolls back the order/referral reward changes together; retry the verified order-creation flow after the underlying failure is corrected.

## Refund, cancellation, and reversal lifecycle — remaining blocker

The payment model represents refund states `PENDING`, `SUCCEEDED`, `FAILED`, and `AMBIGUOUS`, including partial/full refund outcomes through payment status and refund amounts. At issuance time, pending, ambiguous, or successful refunds block the 25% pair. Failed refunds do not block issuance.

**Not yet implemented:** automatic post-issuance deactivation of unused 25% coupons on a later pending/ambiguous/successful refund or qualifying cancellation; audited reversal-state transitions; safe restoration after a failed refund; repeated/concurrent refund recovery tests; and behavior for coupons already redeemed before a later refund. Coupon deactivation would not reverse a completed financial transaction and must never rewrite a redemption as if it had not happened. These lifecycle requirements must be implemented before this phase can be marked complete.

The repository has no verified external chargeback event source in this phase. Chargeback automation is therefore unsupported and must not be claimed.

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
4. Inspect the referral’s qualifying order, reward rows, coupon ownership/status, and notification outbox records before any manual intervention.
5. Do not manually create shipment/tracking events or edit payment state to force a referral reward.
