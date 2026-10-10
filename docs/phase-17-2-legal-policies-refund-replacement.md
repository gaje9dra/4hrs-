# Phase 17.2 — Legal policies, refund/replacement policy, and customer information pages

## Status

**NOT READY for production policy sign-off.** The customer-facing routes, content, footer links, sitemap entries, and regression tests are implemented on this branch. Before production publication, qualified Indian consumer-law counsel must review the policy wording, and the business must configure verified public support/privacy contact details. Secure video/photo upload is not available in the current support-case form, so this phase does not pretend that an upload workflow exists.

## Pages and routes

- `/refund-replacement` — defective-product eligibility, 24-hour requested reporting procedure, evidence guidance, review and remedies.
- `/shipping` — charges shown at checkout, estimates only where shown, conditional tracking, delays, address and delivery issues.
- `/terms` — website use, product listings, availability, prices/promotions, orders, payment verification, cancellations, shipping, consumer remedies, IP, availability/liability, applicable law and updates.
- `/privacy` — account/contact/address, order/payment, support, security and analytics categories; provider sharing; retention; security; account data export/deletion controls.
- `/cancellation` — supported cancellation request flow and how order/fulfilment state affects processing.
- `/contact` — supported customer case route, order guidance, privacy and defect reporting.
- `/faq` — answers consistent with the above policies.

All pages use the existing shared layout, responsive Container, Bauhaus typography/colors/borders/shadows, semantic sections, related links, metadata titles/descriptions/canonicals/Open Graph metadata, and an account support-case CTA where relevant.

## Footer and SEO

The footer's Policies & Help group links to all seven pages. Checkout includes concise links to terms, privacy, shipping, and refund/replacement information; order details link to shipping, refund/replacement, cancellation, and support. The existing sitemap includes all seven public routes. No private case/order route or evidence route was added to the sitemap. The existing robots configuration already disallows account and API paths.

## Refund/replacement wording and claim procedure

- The standard voluntary policy is for qualifying product defects only; change of mind, incorrect size choice and unrelated fit/preference dissatisfaction are excluded from the voluntary policy except where law requires a remedy.
- Customers are asked to report a suspected defect within 24 hours of receipt. The text explicitly says this is the standard reporting procedure, not an automatic forfeiture of statutory rights; late claims are still submitted for review where required by law or where an exception is appropriate.
- Requested evidence includes a continuous unboxing video where available, defect photographs, order number, affected item/size, description, and relevant packaging/shipping-label photos with unnecessary personal information redacted.
- Claims are individually reviewed. No claim submission automatically approves a claim, refunds a payment, or creates a replacement order.
- Approved resolution and any return/shipping arrangement are communicated after review. No invented processing deadline, return address, phone number, email address, or universal delivery estimate is published.
- Customers are told to keep the item and packaging until resolution and not to return anything before receiving instructions.

## Existing support-case and order workflow

The current authenticated customer case flow at `/account/cases/new` and `POST /api/cases` is reused for support intake. The form supports order references and existing categories including order issues, return review, and shipping/delivery issues. Existing order-specific cancellation/return actions remain unchanged.

The current support-case form has no attachment field or evidence upload API, and no separate private evidence-submission channel is configured in the storefront. The policy explicitly tells customers not to publish evidence or send it to an unverified address; support can receive an initial written report, but a private evidence channel must be configured before video/photo files can be accepted. No separate claim/order-management system, refund automation, or replacement-order automation was added.

## Privacy and provider notes

The text reflects existing account/session, customer address, order, payment, return/cancellation, case, notification, analytics/experimentation, data export and account deletion/anonymization functionality. It explains that PayU and Qikink may receive relevant transaction/fulfilment information where configured for an order; it does not promise that every provider is used for every order. Retention periods are not invented. The policy avoids an absolute security guarantee.

## Missing business configuration and blockers

1. **Verified public support/privacy contact details are absent** from the current storefront configuration. The page directs customers to the authenticated case system and does not publish fake contact values. Configure verified support email/phone and any required grievance contact before production.
2. **Secure defect evidence upload is absent.** Current case forms do not accept files. Before accepting video/photo evidence, configure an approved private submission channel and, if implemented as uploads, private storage with signature validation, file-size/count/duration limits, server-generated keys, ownership checks, authorized admin access, audit events, retention/deletion rules, and short-lived access URLs. No new storage provider was introduced.
3. **Legal review required.** Have qualified Indian counsel review the refund/return wording, consumer-protection requirements, privacy obligations, grievance requirements, and governing-law language.
4. **No verified universal delivery/refund processing SLA is configured.** Policy pages therefore avoid promising one.
5. **No claim-specific upload or review-status system was added.** Existing case handling is reused for initial contact only.

## Tests and validation

A regression test file covers route wrappers, policy text safeguards, footer links, sitemap entries, and existing support-case reuse. CI is the source of truth for lint, typecheck, test, build, Prisma validation and generation. This document must be updated with actual results after CI completes; it does not claim tests passed merely because they were authored.
