# Phase 15.8 — Communication Preferences, Consent Controls & Communication Control

## 1. Preference architecture
4HRS+ remains authoritative for customer communication eligibility. The canonical boundary is Customer → communication preference → notification orchestration → eligibility → template → provider adapter → delivery.
CustomerCommunicationPreference is relational and scoped to customer + communication category + channel. It is not an identity, authentication, order, payment, fulfillment, shipping, returns, case, privacy-identity, or delivery-state store.
The current implementation supports EMAIL and a customer-facing MARKETING_PROMOTIONAL preference. The schema also distinguishes REQUIRED_TRANSACTIONAL and OPTIONAL_SERVICE categories for provider-neutral classification.

## 2. Consent vs preference
A communication preference is an operational choice such as opting out of promotional email. It is not a legal consent record and does not establish a legal basis, statutory compliance, or jurisdiction-specific consent evidence.
No separate legal-consent evidence model was added because the repository currently has no documented business/legal requirement defining such evidence. Legal interpretation, notice wording, retention obligations, and jurisdiction-specific requirements require business/legal review before production marketing use.

## Transactional and marketing classification

Required transactional communication remains separate from optional marketing communication.

## 3. Communication categories
- REQUIRED_TRANSACTIONAL: account/security, order, payment, fulfillment, shipping, returns, cancellation, case, and other operational messages represented by the current notification catalog.
- OPTIONAL_SERVICE: reserved for explicitly supported optional operational communications.
- MARKETING_PROMOTIONAL: optional promotional communication.
Marketing preference does not suppress required transactional communication.

## 4. Channel model
Only EMAIL is implemented because Phase 15.7 currently supports EMAIL only. No SMS, push, or WhatsApp controls were created.

## 5. Defaults
Required transactional communication is eligible by category.
Optional communication is fail-closed: absence of an explicit opt-in means OPTED_OUT / CONSENT_NOT_PRESENT. Account creation, browsing, purchase, email opens, and transactional delivery do not create opt-in records.
No migration seeds promotional opt-ins.

## 6. Notification integration
NotificationEvent.communicationCategory defaults to REQUIRED_TRANSACTIONAL, preserving existing Phase 15.7 transactional events.
Notification eligibility is evaluated during durable delivery creation and again immediately before provider invocation.
For optional communication, the current preference is authoritative at the final server-side check. A queued message cannot use stale queue state to bypass a later opt-out.
If preference evaluation cannot be completed safely, optional delivery does not proceed; the worker retries or terminates according to bounded delivery retry rules.

## 7. Suppression behavior
Suppressed deliveries use SUPPRESSED status with a bounded suppression reason. No provider request is made.
Reasons are limited to customer opted out, consent not present, channel unavailable, policy restriction, and customer deleted.

## 8. Unsubscribe architecture
Authenticated customer settings support opt-out directly.
For future unauthenticated email unsubscribe links, the server provides a signed, expiring, one-time token boundary. Tokens contain no email address or internal customer identifier. The database token record resolves the customer after signature verification. Tokens are hashed at rest, expire after a bounded period, and are single-use.
No open redirect or arbitrary customer ID is accepted as an unsubscribe authority.
No marketing template currently emits an unsubscribe link because no marketing event/template/provider exists in this phase.

## 9. API contracts
Customer: GET /api/customer/communications/preferences; PUT /api/customer/communications/preferences; POST /api/customer/communications/unsubscribe; GET /api/customer/communications/unsubscribe.
Preference mutations require the authenticated session, same-origin protection, supported category/channel, explicit state, expected version, and idempotency key.
Admin: GET and PATCH /api/admin/customers/:customerId/communication-preferences.
Admin access is permission-gated and audited. Administrative opt-in requires a high-risk reason plus an explicit CUSTOMER_REQUEST basis. This is an operational safeguard, not a claim of legal consent.

## 10. Customer UI behavior
Communication settings are integrated into the existing profile page without redesigning the account area.
The UI distinguishes required transactional communication from optional promotional email.
Promotional email is visibly off by default, has accessible controls, loading/saving/error states, and no hidden or pre-checked opt-in.

## 11. Admin permissions
New least-privilege permissions: communication.preference.read, communication.preference.manage, communication.preference.audit.read.
SUPER_ADMIN and ADMIN receive all three. OPERATIONS and VIEWER receive read access. Preference management is high-risk administrative activity and requires an explicit reason.

## 12. Audit semantics
Preference changes create a minimal audit record containing category, channel, previous/new state, source, actor type, timestamp, correlation ID, idempotency key, and optional bounded administrative reason.
Actor types are CUSTOMER, ADMIN, and SYSTEM.

## 13. Privacy lifecycle
Current preference state is included in the bounded customer data export.
On customer deletion/anonymization: current preference records are removed; preference audit records are removed because no legal-retention requirement is currently documented; unsubscribe tokens are removed; queued notification recipient addresses are redacted and marked CUSTOMER_DELETED; notification event payloads remain scrubbed under Phase 15.6.
This prevents future optional delivery to the deleted customer.

## 14. Retention
Current preference state is mutable customer data.
Historical preference audit data is retained only while the customer record exists under the current engineering model. No longer-term legal-consent retention is claimed. If later required, legal consent evidence must be a separate explicit model.

## 15. Queued notifications and deletion/anonymization
Customer deletion runs in the existing Phase 15.6 serializable privacy transaction.
Queued optional deliveries are checked against current customer status and preference before provider invocation. Already-sent messages cannot be unsent. A narrow race can still exist at the provider boundary if an external provider accepts a message immediately before an opt-out transaction commits; exactly-once cancellation of external delivery is not claimed.

## 16. Security model
Controls include authenticated ownership, same-origin protection, server-side eligibility, optimistic version checks, idempotency keys, bounded rate limiting, signed/expiring unsubscribe tokens, one-time token consumption, no customer IDs trusted from browser input, explicit admin RBAC, high-risk reasons, existing HTML-safe notification rendering, and no provider credential or preference-history exposure.

## 17. Rate limiting
Preference mutations use the existing bounded in-memory authentication rate-limiter pattern. This is defense-in-depth and is not a distributed rate limiter.

## 18. Observability
Bounded metrics cover preference opt-in/opt-out operations and notification suppression. Labels are constrained to low-cardinality category/channel/reason values.
No full customer email, phone number, consent token, unsubscribe token, or unnecessary personal data is logged.

## 19. Failure semantics
- Required transactional eligibility does not depend on marketing preference.
- Optional preference lookup failure fails closed by preventing provider delivery and scheduling bounded retry/terminal handling.
- Invalid category/channel/state requests are rejected.
- Concurrent updates require the current version and do not silently overwrite newer choices.
- Repeated idempotent mutations are safe.
- Invalid/expired/replayed unsubscribe tokens are rejected.
- Deleted customers cannot receive future optional communication.
- Provider adapters never receive preference history or consent evidence.

## 20. Legal/compliance assumptions
This phase provides technical controls only. It does not assert GDPR, CCPA, CAN-SPAM, India DPDP Act, or any other jurisdiction-specific legal compliance.
Production marketing use requires review of applicable jurisdiction, lawful basis/consent requirements, notices, unsubscribe language, retention, sender identity, provider suppression obligations, and sector-specific restrictions.

## 21. Production configuration
NOTIFICATION_UNSUBSCRIBE_SECRET must be a high-entropy server-only secret before issuing production unsubscribe tokens.
The Phase 15.7 production notification provider remains fail-closed and must be independently configured and verified.

## 22. Known limitations
- No real marketing provider is implemented.
- No marketing event types or production marketing provider are implemented in Phase 15.8.
- EMAIL is the only supported channel.
- No separate legal-consent evidence store exists.
- In-memory rate limiting is not distributed.
- Exactly-once external delivery is not claimed.
- Provider-level suppression-list synchronization is not implemented.
- No cookie, analytics, or tracking consent system is introduced.

## 23. Explicitly unsupported functionality
This phase does not implement marketing automation, campaign management, newsletters, SMS/WhatsApp/push delivery, CRM functionality, customer segmentation, behavioral advertising, cookie/tracking consent, third-party provider onboarding, or legal compliance certification.

## CI validation note
The phase readiness gate is based on the repository CI-equivalent validation suite, not compilation alone.
