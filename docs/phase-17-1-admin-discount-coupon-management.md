# Phase 17.1 — Admin Discount Coupon Management

## Status: NOT READY

This branch implements the initial administrative coupon-management foundation. It is not a production-ready coupon checkout feature yet.

## Implemented in this branch

- Prisma models for coupon definitions and coupon redemption lifecycle records.
- A migration creating coupon and redemption tables, uniqueness/index constraints, and dedicated `coupons.read` / `coupons.manage` permissions.
- Permission assignment only to the existing `SUPER_ADMIN` role; no other role receives coupon-management access by default.
- Server-side coupon create/list/update handlers behind the existing admin authorization, same-origin, request parsing, rate-limit, and audit patterns.
- Validation for normalized coupon codes, percentage range (1–100), positive global limits, date ordering, optional monetary limits, per-customer limit, and status.
- Admin navigation and responsive Bauhaus-style coupon management UI with search, creation, usage display, and activation/deactivation.
- Coupon listing distinguishes completed redemptions from active reservations.

## Data model

`DiscountCoupon` stores normalized code, percentage, total capacity, start/expiry timestamps, optional minimum subtotal/discount cap/per-customer limit, status, notes, and administrative attribution.

`CouponRedemption` records customer, optional order, eligible subtotal, discount, currency, status, and reservation timestamps. The database enforces unique coupon codes and at most one redemption row per order.

## Important limitations and blockers

The existing checkout and order/payment pipeline has not yet been connected to coupon codes. In particular:

- Customers cannot yet apply a coupon during checkout.
- Discount totals are not yet included in the checkout payment reference, verified payment amount, order totals, or order-level reconciliation.
- The reservation lifecycle is modeled but the transactional reserve/release/finalize operations are not yet wired into payment/order transitions.
- Therefore, global concurrent redemption capacity is not yet enforced by a live customer redemption path.
- Per-customer limits and expiry eligibility are validated at coupon creation but are not yet enforced at customer redemption because that redemption path is not implemented.
- No claim is made that tests, Prisma validation, migration deployment, build, or CI are passing unless verified by the actual checks.

## Safety decision

Do not enable coupon discounts in production or mark Phase 17.1 READY until checkout, payment callbacks, order creation, cancellation/refund policy, transaction-safe capacity reservation, and automated concurrency/financial tests are integrated and verified. The existing checkout/payment amount remains unchanged by this partial implementation.
