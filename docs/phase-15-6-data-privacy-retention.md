# Phase 15.6 — Data Privacy, Retention & Customer Data Lifecycle

## Status

This document records repository-level privacy controls implemented in Phase 15.6. It is an engineering/data-governance document, not a legal compliance certification.

No statutory retention period is invented here. Any period that depends on accounting, tax, consumer, privacy, fraud, contractual, or other legal requirements requires business/legal confirmation.

## 1. Personal-data inventory

| Data | Domain/source | Storage | Purpose | Access | External sharing | Lifecycle | Classification |
|---|---|---|---|---|---|---|---|
| Customer email | Customer/auth registration | Customer.email | Account identity and authentication | Customer; authorized admin | Authentication/provider workflows only where implemented | Anonymized on approved deletion | PERSONAL |
| Display name | Customer/profile | Customer.displayName | Account personalization | Customer; authorized admin | None required | Cleared on deletion | PERSONAL |
| Email verification timestamp | Customer/auth | Customer.emailVerifiedAt | Authentication state | Server/auth; limited admin view | None | Cleared on deletion | SECURITY/AUDIT |
| Password hash | Auth registration | CustomerCredential.passwordHash | Authentication | Server only | Never | Credential deleted on deletion | AUTHENTICATION SECRET |
| Session token hash and metadata | Auth/session | CustomerSession | Authentication | Server only | Never | Sessions deleted on deletion; expiry remains operational | AUTHENTICATION SECRET |
| Saved address and recipient phone | Customer/address | CustomerAddress | Checkout and delivery | Owning customer; authorized admin | Fulfillment/shipping only as required | Deleted on deletion | SENSITIVE PERSONAL |
| Historical shipping address | Order | OrderAddressSnapshot | Preserve commercial/shipping history | Customer owning order; authorized admin | Provider handoff as required | Preserved and never overwritten by current address | SENSITIVE PERSONAL |
| Order/customer relationship | Order | Order.customerId | Commercial history | Owning customer; authorized admin | Not exposed unnecessarily | Preserved; customer identity row anonymized | INTERNAL |
| Order item snapshots | Order | OrderItem | Historical commercial correctness | Owning customer; authorized admin | Fulfillment receives only required data | Preserved | INTERNAL / FINANCIAL |
| Payment amounts/status/references | Payment | Payment and PaymentRefund | Reconciliation and refunds | Customer own records; authorized financial admin | Provider references only | Preserved | FINANCIAL |
| Payment attempts/events metadata | Payment | PaymentAttempt and PaymentEvent | Provider reconciliation/audit | Server and authorized operational access | Provider boundary only | Retention requires business/legal confirmation; export excludes internal metadata | OPERATIONAL / FINANCIAL |
| Fulfillment/provider references | Fulfillment | Fulfillment and FulfillmentItem | Provider handoff/reconciliation | Authorized operations | Provider adapter only for required fields | Preserved | OPERATIONAL |
| Shipment/tracking data | Shipping | Shipment, TrackingEvent, ReturnShipment | Delivery and customer tracking | Customer-owned shipment; authorized admin | Provider integration only for required fields | Preserved | PERSONAL / OPERATIONAL |
| Return/cancellation records | Post-order | ReturnRequest/CancellationRequest | Customer service and commercial history | Owning customer; authorized admin | Provider/payment boundaries as required | Preserved; customer descriptions scrubbed | PERSONAL / OPERATIONAL |
| Customer case content | Support | Case.customerDescription | Support | Customer own cases; authorized case access | No unnecessary provider sharing | Description cleared on deletion | SENSITIVE PERSONAL |
| Internal case notes | Support | CaseNote | Operational support | Authorized operators only | Never customer export | Preserved | INTERNAL / SECURITY |
| Case audit events | Support | CaseAuditEvent | Accountability | Authorized case/admin access | Not customer export | Preserved | SECURITY/AUDIT |
| Notification event type/time | Notifications | NotificationEvent | Operational history | Server/admin as authorized | No payload in export | Payload cleared on deletion | OPERATIONAL |
| Admin audit records | Admin/security | AdminAuditLog | Accountability | Authorized admins | Never customer export | Preserved through anonymization | SECURITY/AUDIT |
| Request/observability metadata | Observability | Logger/metrics/security paths | Reliability/security | Operators | Provider telemetry only where configured | Sensitive fields redacted | OPERATIONAL |
| Authentication cookie | Browser/auth | customer_session cookie | Authentication | Browser/server | Never business-shared | Expired/revoked; cleared on deletion | AUTHENTICATION SECRET |

No separate analytics provider or new browser analytics identifier is introduced by this phase.

## 2. Data classification

Engineering classifications are PUBLIC, INTERNAL, PERSONAL, SENSITIVE PERSONAL, AUTHENTICATION SECRET, FINANCIAL, SECURITY/AUDIT, and OPERATIONAL.

An identifier is not classified as sensitive solely because it is an identifier.

## 3. Data minimization

Customer-facing DTOs exclude credentials and session secrets. The privacy export uses explicit selects and DTO mapping and excludes:

- password hashes;
- session token hashes/tokens;
- provider credentials;
- internal admin notes;
- internal audit metadata;
- payment-attempt/event metadata;
- arbitrary database rows;
- raw provider payloads.

The export avoids unnecessary internal database IDs. No production data is removed merely because a field appears unnecessary.

## 4. Customer access boundary

Customer APIs derive identity from authenticated server-side context. Customer-supplied customer IDs are not accepted for privacy operations.

GET /api/customer/privacy exports only the authenticated customer's data.

POST /api/customer/privacy deletes/anonymizes only the authenticated customer's account and requires the exact confirmation DELETE MY ACCOUNT.

Phase 15.3 same-origin request validation remains the state-changing request boundary.

## 5. Admin access boundary

Existing Phase 14 granular RBAC remains authoritative. Customer detail access is permission-gated for addresses, financial information, and cases. Sensitive customer access is audited through the existing admin audit architecture.

No second authorization system or arbitrary customer-edit screen is introduced.

Administrative accounts cannot be deleted through the customer self-service endpoint.

## 6. Export model

Customer export is generated server-side and returned immediately as a private, no-store JSON download.

It contains current profile data, saved addresses, historical order/shipping information, payment/refund history, return/cancellation records, customer-visible case content, and notification event type/timestamp.

It excludes credentials, session secrets, provider credentials, internal admin notes, internal audit metadata, and raw provider/payment metadata.

A bounded export limit of 5,000 records per top-level customer collection prevents unbounded response generation. Oversized exports are rejected rather than silently truncated.

There is no public export URL, stored export file, raw database dump, arbitrary table selector, or generic SQL export endpoint.

## 7. Export security

- Authentication is required.
- The export is private and no-store.
- X-Robots-Tag is noindex, nofollow, noarchive.
- The filename contains no customer personal data.
- The export is not placed in a public static directory.
- The export has no reusable public download URL.
- Export access is rate-limited.
- Successful exports are audited without storing the payload.

## 8. Deletion and anonymization model

Customer self-service deletion is controlled and transactional:

1. Authenticate the requester.
2. Require explicit confirmation.
3. Refuse administrative accounts.
4. Remain idempotent after anonymization.
5. Use a serializable transaction.
6. Delete credentials and sessions.
7. Delete current saved addresses.
8. Delete the customer cart.
9. Clear customer case descriptions and genericize customer-created case titles.
10. Clear notification payloads.
11. Clear payment-idempotency response payloads.
12. Disable the customer.
13. Replace email with a deterministic privacy placeholder.
14. Clear display name and email-verification timestamp.
15. Record Customer.anonymizedAt.
16. Record an audit operation without deleted values.
17. Clear the browser session cookie.

Historical orders, order items, order address snapshots, payments, refunds, fulfillment, shipments, tracking history, returns, cancellations, case/audit relationships, and security/audit records are not cascade-deleted.

## 9. Anonymization model

An anonymized customer remains because historical business records reference it with restrictive foreign keys.

The anonymized customer receives a deterministic non-deliverable deleted-plus-customer-id privacy email, null display name, null email-verification timestamp, DISABLED status, and anonymizedAt timestamp.

Financial identifiers, order references, provider references, operational identifiers, and audit records remain intact.

## 10. Customer identity lifecycle

Current profile changes do not rewrite historical commercial snapshots.

Email changes are not exposed by the current profile API. Name changes affect only Customer.displayName. Historical order shipping/customer snapshots remain unchanged.

Account deletion is terminal for self-service purposes because the anonymized customer is disabled and credentials/sessions are removed.

## 11. Address data

Saved addresses are owned by the authenticated customer. Address mutations use the authenticated customer ID.

Historical OrderAddressSnapshot records are independent and preserved. Deletion removes current saved addresses but does not rewrite historical shipping snapshots.

## 12. Order retention

Orders are business records. Customer deletion does not delete orders, order items, pricing snapshots, customer relationships, fulfillment references, shipment references, cancellation records, or return records.

Exact legal/business retention requires business/legal confirmation.

## 13. Payment data retention

The application stores payment state, amounts, currencies, provider references, refunds, attempts, and events required by the existing payment architecture.

It does not intentionally store card numbers or CVV fields in the Prisma data model.

Payment records are not deleted during customer anonymization. Provider references remain server-side for reconciliation.

No statutory payment-retention period is asserted. Retention requires business/legal confirmation.

## 14. Fulfillment/provider data

Qikink remains only a provider integration. Provider credentials are server-side and are not exported. Only required order/shipping/fulfillment information crosses the provider adapter boundary.

Provider operational history is preserved for reconciliation/recovery. Exact retention requires business/legal confirmation.

## 15. Shipping/tracking privacy

Customer tracking uses the dedicated customer tracking boundary with no-store/noindex responses.

Customer-facing tracking exposes only information required for tracking. Raw provider payloads and credentials are not exposed.

## 16. Case/support privacy

Customer-facing case DTOs expose customer-visible content only. Internal notes and operator metadata are excluded from customer export.

On deletion, customer case descriptions are cleared and customer-created case titles are genericized. Cases and audit history remain for operational accountability.

## 17. Audit-log privacy

Privacy operations use the existing AdminAuditLog persistence boundary so they survive customer anonymization.

Audit records contain operation, customer resource identifier, actor type, result, timestamp, and request/correlation identifier where available.

Export payloads and deleted values are never stored in audit records.

## 18. Logging and telemetry privacy

Phase 15.4 redaction remains active. Authentication secrets, cookies, credentials, API keys, card/CVV fields, and database URLs are redacted. Privacy operations do not log export contents or deleted values.

## 19. Cookies and browser storage

The authentication cookie is HTTP-only and SameSite=Lax; production uses Secure. The privacy UI does not store secrets in localStorage/sessionStorage. Successful deletion clears the customer session cookie.

## 20. Analytics

No new analytics platform or tracking identifier is introduced. Future analytics must minimize direct personal identifiers and document purpose before implementation.

## 21. Search and SEO privacy

Account, order, tracking, case, and admin surfaces remain private/noindex where the existing architecture defines them as such. Privacy API responses are no-store/noindex.

Customer names, addresses, order details, and case content are not added to public structured data.

## 22. Development and test data

Tests and development scripts use synthetic data. Phase 15.6 introduces no production customer records, credentials, payment data, or provider secrets.

## 23. Retention matrix

| Record class | Source of truth | Current behavior | Owner | Retention period |
|---|---|---|---|---|
| Customer profile | Customer | Anonymized on approved deletion | Customer | Requires business/legal confirmation |
| Credentials | CustomerCredential | Deleted on deletion | Auth | Requires business/legal confirmation |
| Sessions | CustomerSession | Deleted/revoked on deletion | Auth | Existing session TTL is 30 days; broader retention requires confirmation |
| Saved addresses | CustomerAddress | Deleted on deletion | Customer | Requires business/legal confirmation |
| Orders | Order | Preserved | Orders | Requires business/legal confirmation |
| Payments/refunds | Payment/PaymentRefund | Preserved | Payments | Requires business/legal confirmation |
| Fulfillment | Fulfillment | Preserved | Fulfillment | Requires business/legal confirmation |
| Shipments/tracking | Shipment/TrackingEvent | Preserved | Shipping | Requires business/legal confirmation |
| Returns/cancellations | Post-order models | Preserved; customer descriptions scrubbed | Returns | Requires business/legal confirmation |
| Cases | Case | Preserved; customer descriptions scrubbed | Cases | Requires business/legal confirmation |
| Internal case notes | CaseNote | Preserved; excluded from export | Cases/Admin | Requires business/legal confirmation |
| Audit logs | AdminAuditLog and domain audit models | Preserved | Security/Admin | Requires business/legal confirmation |
| Application logs | Observability | Redacted | Operations | Requires business/legal confirmation |
| Telemetry | Observability | Redacted/bounded | Operations | Requires business/legal confirmation |
| Privacy exports | Immediate response | Not persisted | Customer | No server-side export-file retention |
| Media | Catalog/media storage | Not changed by customer deletion | Catalog/Operations | Requires business/legal confirmation |
| Backups | Phase 15.5 backup system | Primary deletion does not erase backups immediately | Operations | Requires business/legal confirmation |

## 24. Automated retention

No aggressive scheduled deletion job is introduced. The only automated privacy cleanup is the explicitly requested, authenticated, confirmed, transactional customer deletion operation.

Future scheduled retention jobs require an explicit business/legal policy.

## 25. Backup interaction

Deleting/anonymizing primary database data does not immediately erase historical backups. Restoring an older backup can reintroduce data later anonymized in the primary database.

Backup expiration and any formal erasure-propagation policy require business/legal confirmation.

## 26. Cache/CDN privacy

Customer privacy APIs are force-dynamic, private, no-store, and noindex. Personalized responses must not use shared public caching.

## 27. Privacy-operation security

The implementation protects against browser-supplied customer ID tampering, CSRF/cross-origin state changes, unauthenticated export/deletion, reusable public export URLs, arbitrary table selection, arbitrary SQL export/deletion, mass assignment, predictable export filenames, unbounded exports, and repeated privacy requests through rate limiting.

## 28. Concurrency and idempotency

Deletion uses a serializable transaction and conditional anonymization update. Historical business records are not rewritten.

Concurrent conflicts fail safely rather than committing a partial privacy state.

## 29. Final adversarial review

Repository-level checks cover customer cross-account export/delete boundaries, secret exclusion, provider credential exclusion, internal-note exclusion, no-store personalized responses, preservation of historical commercial relationships, deletion idempotency, same-origin protection, rate limiting, synthetic test data, and backup limitations.

## 30. Business/legal decisions still required

The repository does not establish:

- statutory/accounting/tax retention periods;
- legal retention for refunds, returns, cancellations, cases, or audit records;
- security-event/log retention periods;
- telemetry retention periods;
- provider-specific deletion/retention contracts;
- backup retention and formal erasure propagation;
- jurisdiction-specific asynchronous export/deletion requirements;
- formal privacy notice/terms language or legal basis for processing.

These are OPEN DECISIONS, not claims of regulatory compliance.

## 31. Known limitations

- The in-memory privacy rate limiter is defense-in-depth, not a distributed rate limiter.
- Export is synchronous and bounded at 5,000 records per top-level collection.
- No asynchronous export storage service is introduced.
- No automatic legal-retention deletion job is introduced.
- Backup copies cannot be synchronously erased by the application.
- No legal retention period is claimed.
- Production deletion/anonymization is not executed by CI.

## Verification

Required validation includes npm run lint, npm run typecheck, npm test, npm run build, Prisma validation/generation/migration validation, Phase 15.3 security tests, Phase 15.4 observability tests, Phase 15.5 recovery tests, Phase 15.6 privacy tests, and repository CI.
