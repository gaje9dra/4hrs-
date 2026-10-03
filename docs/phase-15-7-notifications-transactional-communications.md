# Phase 15.7 — Production Notifications, Transactional Communications & Event-Driven Messaging

## 1. Current architecture and pre-flight findings

The repository already had a lib/notifications boundary containing only a README and a Prisma NotificationEvent model used by the Returns/Cancellation domain.

No production email provider, SMTP integration, Resend/SendGrid/Postmark/SES SDK, SMS provider, WhatsApp provider, push provider, queue worker, or notification webhook adapter was present.

Phase 15.7 therefore extends the existing boundary instead of replacing it:

Domain operation → NotificationEvent → NotificationDelivery → channel/template resolution → provider adapter → delivery result → observability/audit/retry.

The business domains remain authoritative for Order, Payment, Fulfillment, Shipping, Returns, Cancellation, Case, Customer, Auth, and Admin state.

## 2. Domain boundaries

Notification infrastructure owns communication intent, channel selection, template resolution/rendering, delivery attempts, provider adapter invocation, delivery status, retry scheduling, idempotency, provider references, and communication audit metadata.

Notification infrastructure does not own or mutate order, payment, fulfillment, shipment/tracking, return, cancellation, case, customer authentication, financial calculation, authorization, or business transaction state.

A notification failure never rolls back a successful domain transaction.

## 3. Persistence model

NotificationEvent is the durable communication/domain-event record. It stores customer ownership, optional order/return references, event type, minimal communication snapshot payload, idempotency key, correlation ID, and creation timestamp.

NotificationDelivery owns delivery lifecycle state: event reference, customer reference, channel, template key/version/locale, recipient address snapshot, status, attempt count/max attempts, retry schedule, timestamps, provider identifier/reference, failure category/code, correlation ID, and unique delivery idempotency key.

Rendered message bodies are not persisted. Recipient addresses are scrubbed when a customer executes the Phase 15.6 deletion/anonymization workflow.

## 4. Event catalog

Supported catalog: ORDER_CONFIRMED, PAYMENT_SUCCEEDED, PAYMENT_FAILED, FULFILLMENT_SUBMITTED, FULFILLMENT_FAILED, SHIPMENT_CREATED, SHIPMENT_IN_TRANSIT, SHIPMENT_OUT_FOR_DELIVERY, SHIPMENT_DELIVERED, SHIPMENT_DELIVERY_FAILED, CANCELLATION_REQUESTED, CANCELLATION_APPROVED, CANCELLATION_REJECTED, RETURN_REQUESTED, RETURN_APPROVED, RETURN_REJECTED, RETURN_RECEIVED, RETURN_RESOLUTION_COMPLETED, REFUND_INITIATED, REFUND_COMPLETED, REFUND_FAILED, CASE_CREATED, CASE_RESOLVED.

The Returns/Cancellation flows that already emitted notification events are now routed through provider-neutral orchestration with deterministic idempotency keys and minimal template snapshots.

The additional catalog entries establish stable contracts for existing/future authoritative domain events. They do not create duplicate business-domain state.

## 5. Notification lifecycle

1. An authoritative domain operation completes its own state transition.
2. The domain records a notification event through enqueueNotificationEvent.
3. A communication delivery row is created transactionally with the event.
4. The recipient is resolved server-side from the customer record.
5. A source-controlled template is selected.
6. A worker claims a pending delivery.
7. Template variables are validated.
8. Content is rendered with HTML escaping.
9. The provider adapter is invoked server-side.
10. The normalized result updates delivery state.
11. Retryable failures receive bounded exponential backoff with jitter.
12. Permanent/ambiguous failures become terminal operational states.
13. Observability metrics/logs are emitted without sensitive payloads.

The business transaction does not wait for provider delivery.

## 6. Idempotency

Event creation uses a deterministic domain idempotency key. Delivery idempotency is derived from the domain event key plus channel plus template key.

Duplicate event creation returns the existing event/delivery rather than creating another communication.

Admin resend intentionally creates a new delivery with a unique resend key and requires an explicit high-risk reason.

The system does not claim exactly-once external delivery.

## 7. Channel architecture

Only EMAIL is implemented in this phase. The domain model keeps channel selection provider-neutral.

SMS, WhatsApp, push, marketing messaging, newsletters, and social messaging are intentionally not implemented.

## 8. Template architecture

Templates are source-controlled in lib/notifications/templates.ts.

Each template has a stable key, version, channel, subject, text body, HTML body, and required variables.

Templates contain no executable code. Template identifiers are selected internally from trusted event types. Clients cannot select arbitrary templates.

Missing required variables cause a controlled rendering failure. HTML variables are escaped before insertion. Rendered bodies are not stored.

## 9. Localization

The delivery model includes locale and template version. The current fallback is en-IN because the repository does not contain a complete localization platform.

## 10. Transactional vs marketing communication

This architecture is transactional only. Order/payment/fulfillment/shipping/return/cancellation/case communications are not treated as marketing subscriptions.

No marketing opt-in or duplicate consent model was created.

## 11. Secure links

Phase 15.7 does not introduce notification links requiring tokenized customer actions. Future account/order/return/tracking links must use the configured canonical site origin and existing signed-token/open-redirect protections.

## 12. Provider adapter

The core code uses NotificationProvider and normalized NotificationDeliveryResult contracts.

Provider responsibilities are isolated to authentication, request construction, timeout, provider invocation, provider reference extraction, response normalization, and failure classification.

There is currently no production provider configured or implemented. A development/test adapter exists only for automated verification and is explicitly rejected in production.

If production mode is enabled with an unsupported provider ID, the resolver fails closed instead of silently using the test adapter.

No provider credentials are stored in source code, client bundles, notification rows, logs, or API responses.

## 13. Failure classification and retry

Failure classes include validation, configuration, rate limiting, temporary provider outage, timeout, connection failure, permanent recipient failure, malformed provider response, ambiguous provider result, and rendering failure.

Retryable classes are rate limiting, temporary provider failure, timeout, and connection failure.

Retries are bounded to five attempts with exponential backoff and jitter, capped at one hour per retry delay.

Permanent failures are terminal. Ambiguous provider results are recorded as AMBIGUOUS and are not blindly retried.

## 14. Background processing

The repository now has netlify/functions/process-notifications.mts. It runs every five minutes when production notification processing is explicitly enabled.

The worker claims at most 20 deliveries per invocation, uses an optimistic database claim so concurrent workers cannot process the same delivery simultaneously, isolates each delivery failure, and does not run when a production provider is not configured.

## 15. Admin controls

Two granular permissions were added: notifications.read and notifications.manage.

SUPER_ADMIN/ADMIN receive read + manage. OPERATIONS receive read + manage. VIEWER receives read only.

GET /api/admin/notifications exposes operational metadata only.

POST /api/admin/notifications supports only an explicit RESEND operation and requires authentication, notifications.manage, same-origin validation, a high-risk reason, and a valid notification-delivery UUID.

Admin responses do not expose raw provider payloads or provider credentials. Resend actions are recorded through the existing AdminAuditLog.

## 16. Customer communication visibility

Customers do not receive arbitrary NotificationDelivery records. The Phase 15.6 privacy export retains communication event type/timestamp as customer-visible history. Delivery provider internals remain administrative/operational data.

## 17. Privacy and minimization

Notification payloads are communication snapshots, not a duplicate source of truth.

Do not place passwords, authentication/session tokens, payment secrets, provider credentials, internal case notes, fraud/risk information, unnecessary addresses/phone numbers, or raw provider payloads into notification payloads.

Customer deletion/anonymization clears NotificationEvent.payload and NotificationDelivery.recipientAddress.

Logs use Phase 15.4 telemetry redaction.

## 18. Observability

Notification operations use the Phase 15.4 logger and bounded metrics.

Metric: notification_operations_total.

Operational logs contain bounded delivery/resource identifiers, correlation IDs, provider identifier, bounded error code, outcome, and duration where available. They do not contain rendered bodies or recipient contents.

## 19. Failure recovery

Order succeeds while provider is down: the order remains successful and notification delivery is independently retried.

Payment succeeds while worker crashes: durable NotificationDelivery remains recoverable.

Duplicate event: deterministic event idempotency returns the existing event.

Concurrent workers: only one worker can claim a pending delivery.

Provider timeout: classified and retried within the bounded policy.

Provider accepted but response is ambiguous: recorded as AMBIGUOUS and not blindly retried.

Customer deletion: event remains for operational/history integrity while payload and recipient address are scrubbed.

Unauthorized admin resend: RBAC, same-origin checks, high-risk reason requirements, and audit logging protect the operation.

Notification worker unavailable: domain transactions remain independent and pending deliveries remain durable.

## 20. Webhooks / delivery receipts

No notification provider with a documented webhook contract exists in the repository. Therefore no unsigned or invented delivery webhook endpoint was created.

When a real provider is selected, its authoritative API documentation must be used for signature verification, timestamp validation, replay protection, deduplication, canonical status mapping, and provider-event persistence where justified.

## 21. Environment configuration

Server-only variables: NOTIFICATION_PROVIDER_ENABLED, NOTIFICATION_PROVIDER_ID, NOTIFICATION_PROVIDER_MODE, NOTIFICATION_PROVIDER_TIMEOUT_MS.

The repository default is disabled/test mode. No real provider secret variable is invented before a real provider is selected.

Netlify production configuration must set real provider secrets with Functions/runtime scope when a real adapter is introduced.

## 22. Production readiness requirements

Phase 15.7 provides provider-neutral production architecture, durable delivery state, worker, retry/idempotency semantics, admin controls, templates, and observability.

Actual production delivery still requires a supported transactional email provider and its verified server-side adapter.

The repository intentionally does not claim email delivery is production-enabled while no real provider adapter exists.

## 23. Explicitly unsupported capabilities

Marketing campaigns, newsletters, bulk marketing email, arbitrary customer messaging, live chat, CRM replacement, SMS/WhatsApp/push without a justified supported integration, direct browser-to-provider communication, Qikink notification integration, undocumented provider APIs, exactly-once external delivery, and duplicate business-domain state.

## 24. Verification

Required validation: npm run lint; npm run typecheck; npm test; npm run build; Prisma validation/generation/migration validation; Phase 15.3 security tests; Phase 15.4 observability tests; Phase 15.5 recovery/integrity tests; Phase 15.6 privacy tests; Phase 15.7 notification tests; complete repository CI.

## 25. Known limitations

1. No real production email provider is configured.
2. The test adapter never runs in production.
3. Provider webhook/reconciliation behavior requires a selected provider and verified API contract.
4. Netlify scheduled processing is bounded by the platform execution limit, so the worker processes a bounded batch.
5. Notification history is durable; customer deletion scrubs mutable payload/recipient information without deleting the communication event relationship.
6. No legal retention period is invented; Phase 15.6 retention decisions remain authoritative.