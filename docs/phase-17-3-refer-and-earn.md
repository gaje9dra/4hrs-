# Phase 17.3 — Refer & Earn

## Status

**INCOMPLETE — NOT READY TO MERGE OR CLAIM PRODUCTION-READY.**

This branch adds the initial durable referral data model and migration, plus a server-side coupon-recipient ownership check. It is scaffolding for Phase 17.3, not the completed Refer & Earn product.

## Implemented in this increment

- Durable unique referral profiles/codes, single-invite attribution, qualifying-order linkage, and reward issuance audit records in Prisma.
- Forward-only migration adding referral status/reward enums, tables, uniqueness constraints, indexes, and foreign keys.
- Referral coupon recipient binding fields on the existing `DiscountCoupon` model.
- Coupon redemption now rejects a referral coupon when the authenticated customer does not match its assigned recipient.

## Existing architecture inspected

- Customer registration is handled by `app/api/auth/register/route.ts` and `lib/auth/service.ts`.
- PayU callback verifies successful payments through the existing provider verification before processing the payment event.
- Orders are created from verified payments.
- Shipping models record `ShipmentStatus.DELIVERED` and `deliveredAt`, and the shipping application accepts normalized/provider tracking events.
- The Qikink fulfillment integration is not, by itself, proof of delivery; referral rewards must wait for a trusted delivery status persisted by the shipping integration.

## Outstanding critical work

- Generate and maintain referral profiles/codes for eligible customers and build secure, persistent attribution through navigation and authentication redirects.
- Atomically attribute genuinely new registrations and issue exactly one unique 14% coupon to each recipient; make both visible in customer accounts.
- Add a customer Refer & Earn dashboard and privacy-safe referral list.
- Add an RBAC-protected admin referral management view and audited operational actions.
- Connect the first eligible referral order to verified payment and persisted trusted delivery status, then issue exactly one 25% coupon to each recipient.
- Implement retry-safe reward processing, delivery-before-payment ordering, and explicit cancellation/refund/chargeback policy.
- Add end-to-end, concurrency, authorization, coupon ownership, payment/delivery prerequisite, and recovery tests.
- Validate the migration against the actual CI database and run all required CI checks.

## Payment and delivery prerequisites

A browser redirect, order creation, fulfillment submission, or payment initiation is not a delivery confirmation. A 25% reward must not be issued until both the existing verified-payment state and a trusted persisted `DELIVERED` shipment state are established server-side. Any unsupported delivery-provider capability remains a blocker and must not be simulated.

## Required verification

The required checks are defined by the repository's package scripts and CI workflows. The phase must remain unmerged until Prisma validation/migration checks, lint, typecheck, tests, build, and every other required CI check pass on the final commit. Results must be updated here only after they are observed.
