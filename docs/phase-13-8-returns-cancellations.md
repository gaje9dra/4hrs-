# Phase 13.8 — Returns, Cancellations & Post-Shipment Exceptions

## Audit result

Before implementation, the repository was audited against the existing Order, Payment, Fulfillment, Shipping, Customer/authentication, admin authorization, notification, Prisma and CI boundaries.

Current facts:
- Order lifecycle is PENDING -> CONFIRMED; Returns does not create a second Order lifecycle.
- Payment has authoritative payment state but no production refund execution/refund-provider boundary.
- Fulfillment owns provider submission; Shipping owns outbound Shipment/tracking.
- Qikink remains a fulfillment integration. No undocumented Qikink return API is called.
- Customer authentication and ownership use the existing session/customer boundary.
- Admin authorization uses the existing server-side requireAdmin boundary.
- Notifications had only a placeholder boundary, so this phase adds durable application-level notification events rather than coupling to email/SMS/WhatsApp.
- Exception transitions use a dedicated append-only audit event model.

## Cancellation architecture

Cancellation is a separate exception aggregate associated with the canonical Order. It does not add CANCELLED to OrderStatus.

Lifecycle:
REQUESTED -> APPROVED | REJECTED | REQUIRES_REVIEW
APPROVED -> PROCESSING
PROCESSING -> COMPLETED | FAILED
REQUIRES_REVIEW -> APPROVED | REJECTED
FAILED -> REQUIRES_REVIEW

Centralized eligibility evaluates the actual Order, Fulfillment and Shipment state:
- pending Order with no shipment and Fulfillment absent/pending: eligible;
- fulfillment started or shipment created: operational review;
- delivered/returned shipment: cancellation no longer possible.

A customer cancellation never directly mutates Payment or Fulfillment. Because the existing Payment architecture does not execute production refunds, cancellation completion remains behind the Payment refund boundary and is not fabricated.

Duplicate cancellation requests are protected by the unique Order constraint and returned idempotently.

## Return architecture

Return is a provider-neutral aggregate:
ReturnRequest -> ReturnShipment -> Return Receipt -> Inspection -> Resolution.

Persistence:
- ReturnRequest
- ReturnItem
- ReturnShipment
- ReturnInspection
- ReturnResolution

Return records reference canonical Order/OrderItem entities and never copy product records.

Return eligibility is centralized and requires:
- confirmed Order;
- successful Payment;
- delivered Shipment with authoritative delivery timestamp;
- configurable return window (RETURN_WINDOW_DAYS, default 7 days because no existing repository return-policy configuration exists).

The return-window value is centralized rather than scattered through UI/routes and must be replaced with the actual business policy before production launch if the merchant policy differs.

## Partial-return accounting

Each ReturnItem stores a quantity against an existing OrderItem.

The application calculates existing non-rejected returned quantities inside a serializable transaction and rejects any request where:
existing returned quantity + requested quantity > purchased quantity.

A unique (ReturnRequest, OrderItem) constraint prevents duplicate items in one request. Application validation protects positive quantities and inspection arithmetic.

## Return reasons

Customer reason is a controlled enum:
WRONG_ITEM, DAMAGED, DEFECTIVE, SIZE_OR_FIT, NOT_AS_EXPECTED, CHANGED_MIND, OTHER.

Customer description is bounded untrusted text. Operational reasons are stored separately and are never returned as customer DTO fields.

## Return shipment

ReturnShipment is separate from outbound Shipment and never overwrites outbound tracking.

No provider return-creation API is invented. The current implementation supports authorized operational/manual return shipment handling and externally supplied carrier/tracking data.

externallySupplied records that the tracking data was supplied operationally rather than created through an undocumented provider integration.

## Inspection

Inspection is explicit:
RETURN_RECEIVED -> INSPECTION_PENDING -> INSPECTED -> RESOLUTION_PENDING.

The operator records received, accepted and rejected quantities. The invariant is:
accepted + rejected = received <= returned quantity.

Inspection records include the authorized operator and internal reason. Internal reason is never exposed to customers.

## Resolution and refund boundary

The architecture exposes resolution types for the domain:
- REFUND
- REPLACEMENT
- STORE_CREDIT
- REJECTED
- PARTIAL_REFUND

Only the REJECTED resolution is executable in the current repository because no production Payment refund, replacement, or store-credit subsystem exists.

The intended future boundary is:
Return -> Approved Resolution -> Refund Intent -> Payment -> Payment Provider.

Returns never call a payment provider directly. No arbitrary refund amount is accepted from the browser.

When Payment gains a verified refund application service, the existing ReturnResolution.paymentRefundIntentReference is the integration/audit handoff point. Until then, refund/replacement/store-credit execution fails safely with REFUND_UNAVAILABLE.

## Authorization and privacy

Customer operations derive identity from the authenticated session and scope Order/Return/Cancellation access to that customer.

Admin review, shipment authorization, receipt, inspection and resolution require server-side requireAdmin.

The API does not trust:
- customer ID;
- order ownership;
- payment state;
- shipment state;
- item price;
- refund amount;
- SKU/product metadata.

Customer responses do not include provider credentials, raw provider payloads, operational notes, or internal database error details.

Private APIs use Cache-Control: private, no-store and X-Robots-Tag: noindex, nofollow, noarchive.

## Audit trail

Important transitions create immutable CommerceExceptionAuditEvent records with:
- actor type/id;
- action;
- previous/new state;
- reason;
- Order;
- Return/Cancellation reference;
- timestamp;
- optional correlation ID.

Notification lifecycle changes create durable NotificationEvent records inside the same database transaction. No external notification provider is called before commit.

## Customer UI/API

Customer Order detail now obtains a server-authoritative exception summary.

Eligible cancellation and return controls are rendered only when the application policy allows them. Server validation remains authoritative.

Customer endpoints:
- POST /api/order/{orderNumber}/cancel
- POST /api/order/{orderNumber}/return
- GET /api/order/{orderNumber}/exceptions
- GET /api/cancellations/{cancellationReference}
- GET /api/returns/{returnReference}

Admin operational endpoints cover review, return shipment authorization, receipt, inspection and resolution.

## Security

Controls include authentication, ownership scoping, admin authorization, bounded request bodies, enum validation, quantity validation, IDOR-safe customer repository queries, private/no-store responses, safe error normalization, unique constraints and serializable transactions with bounded retry.

## Provider limitations

Qikink is not called from Returns and is not treated as a Return provider.

The previous shipping-provider qualification did not establish a verified return-shipment API, so the implementation deliberately uses a provider-neutral/manual ReturnShipment boundary.

## Database changes

Migration:
20261002210000_returns_cancellations

New persistence:
- CancellationRequest
- ReturnRequest
- ReturnItem
- ReturnShipment
- ReturnInspection
- ReturnResolution
- CommerceExceptionAuditEvent
- NotificationEvent
- associated lifecycle/reason enums and Order/Customer/OrderItem/Shipment relations.

The migration is additive and does not rewrite existing Orders.

## Testing

Added domain tests for:
- cancellation eligibility;
- cancellation review after fulfillment starts;
- cancellation after delivery;
- return delivery/window eligibility;
- valid/invalid state transitions;
- inspection quantity bounds;
- positive return quantities.

The full repository regression suite remains mandatory in CI.

## Production dependencies

1. The current Payment domain does not expose production refund execution. Refund resolution therefore remains an explicit boundary and is not faked.
2. Replacement and store-credit systems do not currently exist and are not fabricated.
3. The return-window baseline is configurable through RETURN_WINDOW_DAYS; confirm the merchant policy before production use.
4. Automated provider return-shipment creation remains unavailable until an authoritative provider contract is qualified.

## Hard stop

Phase 13.9 is not implemented by this change. Payment, Order, Fulfillment, Shipping, Catalog, Checkout and Authentication are not redesigned.
