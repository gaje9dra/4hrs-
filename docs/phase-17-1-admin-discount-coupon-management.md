# Phase 17.1 — Admin Discount Coupon Management & Redemption

## Status: NOT READY — CI and end-to-end financial verification still required

This branch extends the original admin coupon foundation with checkout previews, authoritative discount calculations, transactional reservation, PayU/order integration, and order pricing snapshots. The branch is not approved for production until CI, database integration tests, and payment/order recovery behavior are verified.

## Implemented in this branch

### Admin and persistence
- DiscountCoupon and CouponRedemption models with unique coupon codes and unique checkout/order redemption associations.
- Migration creates coupon/redemption tables and adds order-level discountTotal, couponCode, and couponDiscountPercent snapshot columns.
- Dedicated coupons.read and coupons.manage permissions; migration grants them to SUPER_ADMIN only.
- Admin create/list/search/update APIs and Bauhaus-style management page.
- Admin updates cannot change coupon code or financial terms after any reservation/redemption; usage limit cannot be lowered below completed plus reserved records. Deactivation remains available.

### Checkout and money calculation
- Existing checkout request accepts an optional normalized coupon code; checkout can also remove a coupon by sending couponCode: null.
- Shared lib/coupons/calculation.ts uses Prisma Decimal arithmetic and two-decimal rounding for percentage discounts, maximum-discount caps, minimum-subtotal rules, and non-negative payable totals.
- Checkout response carries server-calculated coupon preview, discount adjustment, and payable total. Browser-supplied amounts are not accepted.
- Checkout UI supports apply/remove actions, busy/error/success feedback, and displays savings. Payment initiation revalidates checkout and submits the server-calculated total to the existing payment application.
- Checkout payment references include coupon identity and discount snapshot, so distinct coupon choices do not alias the same payment reference.

### Reservation, PayU, and order
- Before payment creation, coupon capacity is reserved inside a PostgreSQL transaction with a row lock on the coupon, serializable isolation, and bounded retry for serialization conflicts.
- The reservation records checkout ownership, coupon-code/percentage snapshots, eligible subtotal, discount, currency, and an initial 15-minute reservation expiry.
- Expired reservations are not blindly released if a corresponding payment exists. A payment with a non-terminal or successful state retains capacity until verified finalization/reconciliation; reservations with no payment can expire, and known terminal unsuccessful payments can release capacity.
- The existing PayU callback signature verification and server-side successful-payment verification remain in place. Verified failed/cancelled/expired payment states release matching reservations.
- Order creation re-resolves authoritative cart items and matches the payment reference against the coupon reservation. It verifies the reservation/customer/subtotal/currency, validates the discounted payable amount against the verified payment, stores order pricing snapshots, and finalizes the redemption in the same transaction as order creation.
- Public order DTOs and order detail display the historical coupon and discount amount.
- No Qikink fulfillment behavior has been changed.

## Reservation and refund policy

- Capacity is counted as completed redemptions plus active RESERVED rows; the coupon row lock serializes reservations for the same coupon.
- A checkout reference can own at most one redemption; a reservation cannot be claimed by another customer or checkout.
- Verified payment success finalizes a reservation once with the order transaction. Duplicate callbacks reuse existing order/redemption state.
- A definitive unsuccessful provider state releases a matching still-reserved redemption. Unknown/non-terminal payment states retain capacity rather than assuming no money was collected.
- Completed redemptions remain historical and continue consuming the configured redemption limit after cancellation/refund. This avoids silently reissuing a promotion after a completed payment; the current PayU adapter does not support refunds. Any future policy to restore capacity after a completed refund requires an explicit audited business rule and reconciliation design.
- A late successful payment with an expired/released reservation is not silently granted a new redemption. Order creation fails safely for reconciliation rather than allowing a different checkout to claim that capacity.

## Automated tests added

- tests/coupon-calculation.test.ts: 1%, 10%, 20%, 50%, cap, minimum subtotal, inactive/future/expired coupon, and zero-payable boundary checks.
- tests/coupon-redemption-concurrency.test.ts: PostgreSQL-backed concurrent attempts against a 10-use coupon; verifies accepted and persisted reservations never exceed capacity. It is skipped unless running in CI against an identified test/local database.

## Verification and remaining blockers

The GitHub Actions workflow is the source of truth for CI. At the time of this update, no green result has been confirmed for the latest branch head. Do not interpret added tests as proof they pass.

Still required before READY:
- Confirm latest npm ci, npm run lint, npm run typecheck, npm test, npm run build, npx prisma validate, and npx prisma generate results.
- Confirm the PostgreSQL concurrency integration test actually ran (not skipped) and passed against the CI test database.
- Add/verify broader tests for callback hash/signature failures, wrong amount/reference, duplicate and delayed callbacks, retries, checkout cart mutation, reservation ownership, and no-coupon regression.
- Verify payment initiation failures and ambiguous provider outcomes through existing reconciliation tooling, including operational visibility for reservations that remain held while payment status is unknown.
- Verify order cancellation/refund flows and their audit behavior. The policy above intentionally does not restore coupon capacity after a completed redemption.
- Verify migrations against a disposable database using the repository's supported PostgreSQL version; never use production resets or real-money/live-fulfillment tests.

## Production safety decision

Do not merge or enable this implementation for production until the required checks are green and the financial/concurrency invariants above are demonstrated. If any critical check remains blocked or unverified, retain NOT READY.
